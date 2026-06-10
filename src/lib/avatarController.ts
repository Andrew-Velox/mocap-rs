// Applies a kalidokit-solved pose to a VRM humanoid with frame-rate-independent
// smoothing. All bone lookups are null-guarded so models missing optional bones
// (e.g. fingers) simply skip those joints instead of crashing.

import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { VRMHumanBoneName } from "@pixiv/three-vrm";
import type { SolvedPose } from "./poseSolver";
import type { TFace, THand } from "kalidokit";

type XYZ = { x?: number; y?: number; z?: number };
type Side = "Left" | "Right";

// Max eye-gaze deflection (degrees) mapped from the normalized iris position.
const GAZE_DEG = 22;

// kalidokit finger key → VRM bone suffix (VRM1 renames the thumb chain).
const FINGER_MAP: Array<[string, string]> = [
  ["ThumbProximal", "ThumbMetacarpal"],
  ["ThumbIntermediate", "ThumbProximal"],
  ["ThumbDistal", "ThumbDistal"],
  ["IndexProximal", "IndexProximal"],
  ["IndexIntermediate", "IndexIntermediate"],
  ["IndexDistal", "IndexDistal"],
  ["MiddleProximal", "MiddleProximal"],
  ["MiddleIntermediate", "MiddleIntermediate"],
  ["MiddleDistal", "MiddleDistal"],
  ["RingProximal", "RingProximal"],
  ["RingIntermediate", "RingIntermediate"],
  ["RingDistal", "RingDistal"],
  ["LittleProximal", "LittleProximal"],
  ["LittleIntermediate", "LittleIntermediate"],
  ["LittleDistal", "LittleDistal"],
];

export class AvatarController {
  private readonly euler = new THREE.Euler();
  private readonly quat = new THREE.Quaternion();
  private readonly corrected = new THREE.Quaternion();
  private readonly vec = new THREE.Vector3();
  // Smoothed facial blendshape values (lerped toward targets each frame).
  private faceValues: Record<string, number> = {};
  // Smoothed eye-gaze angles (degrees).
  private gazeYaw = 0;
  private gazePitch = 0;

  // Calibration: captured neutral-pose rotation per bone. When active, each
  // bone's motion is solved *relative* to this neutral so the user's rest pose
  // maps to the avatar's rest (cancels posture/camera-angle offsets).
  private neutral = new Map<string, THREE.Quaternion>();
  private calibState: "off" | "capture" | "active" = "off";

  // VRM 1.0 humanoid bones are rotated 180° about Y vs VRM 0.0, so X and Z
  // rotation axes are inverted. Negate them for VRM1 (matches SysMoCap).
  private readonly axisSign: number;

  // Keep the torso vertical (hips/spine use yaw only — no lean/tip).
  uprightLock = true;

  /** `smoothing` ~= responsiveness; higher snaps faster. Mutable at runtime. */
  smoothing: number;

  constructor(
    private readonly vrm: VRM,
    smoothing = 14
  ) {
    this.smoothing = smoothing;
    this.axisSign = vrm.meta?.metaVersion === "1" ? -1 : 1;
    // We drive gaze manually each frame via applyYawPitch; disable auto lookAt
    // so vrm.update() doesn't overwrite it.
    if (vrm.lookAt) vrm.lookAt.autoUpdate = false;
  }

  /** Capture the current pose as the neutral reference on the next frame. */
  calibrate() {
    this.calibState = "capture";
  }

  /** Forget calibration and track absolute pose again. */
  clearCalibration() {
    this.neutral.clear();
    this.calibState = "off";
  }

  /** Apply the latest solved pose. `delta` is seconds since last frame. */
  apply(solved: SolvedPose, delta: number) {
    const t = 1 - Math.exp(-this.smoothing * delta); // fps-independent lerp
    if (solved.pose) this.applyPose(solved.pose, t);
    if (solved.face) this.applyFace(solved.face, t);
    // Canonical kalidokit hand mapping: wrist pitch/yaw from the hand solve,
    // twist (z) from the arm/pose solve; fingers from the hand solve.
    if (solved.leftHand) {
      this.applyHand("Left", solved.leftHand, t, solved.pose?.LeftHand?.z ?? 0);
    }
    if (solved.rightHand) {
      this.applyHand("Right", solved.rightHand, t, solved.pose?.RightHand?.z ?? 0);
    }

    // Keep the avatar's feet on the floor (after all rotations are applied).
    if (solved.pose) this.groundFeet(t);

    // One full pass captured the neutral; switch to applying it from now on.
    if (this.calibState === "capture") this.calibState = "active";
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private bone(name: string) {
    return this.vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName);
  }

  /**
   * @param calibratable whether this bone participates in neutral-pose
   *   calibration (body bones yes; fingers/wrist no).
   */
  private rigRotation(
    name: string,
    rot: XYZ,
    dampener: number,
    t: number,
    calibratable = false
  ) {
    const node = this.bone(name);
    if (!node) return;
    this.euler.set(
      this.axisSign * (rot.x ?? 0) * dampener,
      (rot.y ?? 0) * dampener,
      this.axisSign * (rot.z ?? 0) * dampener,
      "XYZ"
    );
    this.quat.setFromEuler(this.euler);

    if (calibratable) {
      if (this.calibState === "capture") {
        // Record this frame's rotation as the neutral reference.
        this.neutral.set(name, this.quat.clone());
      } else if (this.calibState === "active") {
        const ref = this.neutral.get(name);
        if (ref) {
          // Solve relative to neutral: corrected = neutral⁻¹ · target.
          this.corrected.copy(ref).invert().multiply(this.quat);
          node.quaternion.slerp(this.corrected, t);
          return;
        }
      }
    }

    node.quaternion.slerp(this.quat, t);
  }

  /** Hip horizontal translation only — keeps the bone's rest vertical height. */
  private rigHipPosition(pos: XYZ, t: number) {
    const node = this.bone("hips");
    if (!node) return;
    this.vec.set(pos.x ?? 0, node.position.y, -(pos.z ?? 0));
    node.position.lerp(this.vec, t);
  }

  /**
   * Foot grounding: shift the whole avatar vertically so the lowest foot rests
   * on the floor (y=0). Keeps the character planted as legs bend / lean, and
   * removes the vertical float that comes from world-space hip height. Called
   * after all bone rotations so foot world positions are current.
   */
  private groundFeet(t: number) {
    const lf = this.bone("leftFoot") ?? this.bone("leftToes");
    const rf = this.bone("rightFoot") ?? this.bone("rightToes");
    let minY = Infinity;
    if (lf) {
      lf.getWorldPosition(this.vec);
      minY = Math.min(minY, this.vec.y);
    }
    if (rf) {
      rf.getWorldPosition(this.vec);
      minY = Math.min(minY, this.vec.y);
    }
    if (!Number.isFinite(minY)) return;
    const target = this.vrm.scene.position.y - minY; // bring lowest foot to 0
    this.vrm.scene.position.y = THREE.MathUtils.lerp(this.vrm.scene.position.y, target, t * 0.5);
  }

  // ── pose ─────────────────────────────────────────────────────────────────
  private applyPose(pose: NonNullable<SolvedPose["pose"]>, t: number) {
    // Keep the avatar vertically upright: drive the hips by yaw (turn) only,
    // zeroing pitch (lean fwd/back) and roll (tip side-to-side) so the body
    // never tips off-vertical. `uprightLock` can be turned off for full lean.
    if (pose.Hips.rotation) {
      const hips = this.uprightLock
        ? { x: 0, y: pose.Hips.rotation.y, z: 0 }
        : pose.Hips.rotation;
      this.rigRotation("hips", hips, 0.7, t, true);
    }
    // Horizontal lean/step only; vertical placement is handled by foot grounding
    // (groundFeet) so the avatar stays planted instead of floating/bobbing with
    // the noisy world-space hip Y.
    this.rigHipPosition(pose.Hips.position, t * 0.4);

    // Chest stays upright (kalidokit has no Chest; SysMoCap leaves it at rest).
    // The spine gives a subtle bend — locked to yaw only when upright is on.
    this.rigRotation("chest", { x: 0, y: 0, z: 0 }, 1, t, true);
    const spine = this.uprightLock
      ? { x: 0, y: (pose.Spine as { y?: number }).y ?? 0, z: 0 }
      : pose.Spine;
    this.rigRotation("spine", spine, 0.45, t, true);

    this.rigRotation("rightUpperArm", pose.RightUpperArm, 1, t, true);
    this.rigRotation("rightLowerArm", pose.RightLowerArm, 1, t, true);
    this.rigRotation("leftUpperArm", pose.LeftUpperArm, 1, t, true);
    this.rigRotation("leftLowerArm", pose.LeftLowerArm, 1, t, true);

    // Wrist from pose (overridden below when hand tracking is present).
    this.rigRotation("leftHand", pose.LeftHand, 1, t);
    this.rigRotation("rightHand", pose.RightHand, 1, t);

    this.rigRotation("rightUpperLeg", pose.RightUpperLeg, 1, t, true);
    this.rigRotation("rightLowerLeg", pose.RightLowerLeg, 1, t, true);
    this.rigRotation("leftUpperLeg", pose.LeftUpperLeg, 1, t, true);
    this.rigRotation("leftLowerLeg", pose.LeftLowerLeg, 1, t, true);
  }

  // ── face ─────────────────────────────────────────────────────────────────
  private applyFace(face: TFace, t: number) {
    // Head orientation.
    this.rigRotation("neck", face.head, 0.7, t, true);

    const em = this.vrm.expressionManager;
    if (em) {
      const set = (name: string, target: number) => {
        const prev = this.faceValues[name] ?? 0;
        const next = THREE.MathUtils.lerp(prev, THREE.MathUtils.clamp(target, 0, 1), t);
        this.faceValues[name] = next;
        em.setValue(name, next);
      };

      // Per-eye blink: kalidokit reports openness (1 open) → VRM blink (1
      // closed). The /0.8 makes a full blink actually close (SysMoCap trick).
      set("blinkLeft", (1 - face.eye.l) / 0.8);
      set("blinkRight", (1 - face.eye.r) / 0.8);

      // Mouth visemes.
      set("aa", face.mouth.shape.A / 0.8);
      set("ih", face.mouth.shape.I / 0.8);
      set("ou", face.mouth.shape.U / 0.8);
      set("ee", face.mouth.shape.E / 0.8);
      set("oh", face.mouth.shape.O / 0.8);
    }

    // Eye gaze from the iris (degrees). autoUpdate is disabled in the ctor so
    // this sticks across vrm.update().
    const lookAt = this.vrm.lookAt;
    if (lookAt && face.pupil) {
      this.gazeYaw = THREE.MathUtils.lerp(this.gazeYaw, face.pupil.x * GAZE_DEG, t);
      this.gazePitch = THREE.MathUtils.lerp(this.gazePitch, -face.pupil.y * GAZE_DEG, t);
      lookAt.applier.applyYawPitch(this.gazeYaw, this.gazePitch);
    }
  }

  // ── hands ────────────────────────────────────────────────────────────────
  private applyHand(
    side: Side,
    hand: THand<"Left"> | THand<"Right">,
    t: number,
    wristTwistZ: number
  ) {
    const h = hand as Record<string, XYZ>;
    const sideLc = side.toLowerCase();

    // Wrist: pitch/yaw from the hand solve, twist (z) from the arm/pose solve.
    const wrist = h[`${side}Wrist`];
    this.rigRotation(`${sideLc}Hand`, { x: wrist.x, y: wrist.y, z: wristTwistZ }, 1, t);

    // Fingers (kalidokit curls them on Z, per-side sign already applied).
    for (const [kkey, vrmSuffix] of FINGER_MAP) {
      const rot = h[`${side}${kkey}`];
      if (!rot) continue;
      this.rigRotation(`${sideLc}${vrmSuffix}`, rot, 1, t);
    }
  }
}
