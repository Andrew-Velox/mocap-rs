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
  private readonly vec = new THREE.Vector3();
  // Smoothed facial blendshape values (lerped toward targets each frame).
  private faceValues: Record<string, number> = {};

  /** `smoothing` ~= responsiveness; higher snaps faster. */
  constructor(
    private readonly vrm: VRM,
    private readonly smoothing = 14
  ) {}

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
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private bone(name: string) {
    return this.vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName);
  }

  private rigRotation(name: string, rot: XYZ, dampener: number, t: number) {
    const node = this.bone(name);
    if (!node) return;
    this.euler.set(
      (rot.x ?? 0) * dampener,
      (rot.y ?? 0) * dampener,
      (rot.z ?? 0) * dampener,
      "XYZ"
    );
    this.quat.setFromEuler(this.euler);
    node.quaternion.slerp(this.quat, t);
  }

  private rigPosition(name: string, pos: XYZ, dampener: number, t: number) {
    const node = this.bone(name);
    if (!node) return;
    this.vec.set((pos.x ?? 0) * dampener, (pos.y ?? 0) * dampener, (pos.z ?? 0) * dampener);
    node.position.lerp(this.vec, t);
  }

  // ── pose ─────────────────────────────────────────────────────────────────
  private applyPose(pose: NonNullable<SolvedPose["pose"]>, t: number) {
    if (pose.Hips.rotation) this.rigRotation("hips", pose.Hips.rotation, 0.7, t);
    this.rigPosition(
      "hips",
      {
        x: -pose.Hips.position.x, // mirror so the avatar faces the user
        y: pose.Hips.position.y + 1,
        z: -pose.Hips.position.z,
      },
      1,
      t * 0.5
    );

    this.rigRotation("chest", pose.Spine, 0.25, t);
    this.rigRotation("spine", pose.Spine, 0.45, t);

    this.rigRotation("rightUpperArm", pose.RightUpperArm, 1, t);
    this.rigRotation("rightLowerArm", pose.RightLowerArm, 1, t);
    this.rigRotation("leftUpperArm", pose.LeftUpperArm, 1, t);
    this.rigRotation("leftLowerArm", pose.LeftLowerArm, 1, t);

    // Wrist from pose (overridden below when hand tracking is present).
    this.rigRotation("leftHand", pose.LeftHand, 1, t);
    this.rigRotation("rightHand", pose.RightHand, 1, t);

    this.rigRotation("rightUpperLeg", pose.RightUpperLeg, 1, t);
    this.rigRotation("rightLowerLeg", pose.RightLowerLeg, 1, t);
    this.rigRotation("leftUpperLeg", pose.LeftUpperLeg, 1, t);
    this.rigRotation("leftLowerLeg", pose.LeftLowerLeg, 1, t);
  }

  // ── face ─────────────────────────────────────────────────────────────────
  private applyFace(face: TFace, t: number) {
    // Head orientation (split across neck for a natural bend).
    this.rigRotation("neck", face.head, 0.7, t);

    const em = this.vrm.expressionManager;
    if (!em) return;

    const set = (name: string, target: number) => {
      const prev = this.faceValues[name] ?? 0;
      const next = THREE.MathUtils.lerp(prev, THREE.MathUtils.clamp(target, 0, 1), t);
      this.faceValues[name] = next;
      em.setValue(name, next);
    };

    // Eyes: kalidokit reports openness (1 open) → VRM blink (1 closed).
    set("blink", 1 - (face.eye.l + face.eye.r) / 2);

    // Mouth visemes.
    set("aa", face.mouth.shape.A);
    set("ih", face.mouth.shape.I);
    set("ou", face.mouth.shape.U);
    set("ee", face.mouth.shape.E);
    set("oh", face.mouth.shape.O);
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
