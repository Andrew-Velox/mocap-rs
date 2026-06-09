// Converts raw MediaPipe landmark frames into VRM-ready bone rotations using
// kalidokit. Runs on the desktop (the relay just forwards bytes). Every solver
// is guarded so partial frames (face-only, no hands, etc.) degrade gracefully.

import * as Kalidokit from "kalidokit";
import type { LandmarkFrame } from "./landmarks";

export interface SolvedPose {
  pose?: Kalidokit.TPose;
  face?: Kalidokit.TFace;
  leftHand?: Kalidokit.THand<"Left">;
  rightHand?: Kalidokit.THand<"Right">;
}

// kalidokit's mediapipe runtime uses image size for a couple of normalizations
// (mainly head position). Match the phone capture aspect ratio (16:9 @ 720p).
const IMAGE_SIZE = { width: 1280, height: 720 };

export function solvePose(frame: LandmarkFrame): SolvedPose {
  const out: SolvedPose = {};
  // Use the phone's real capture resolution so kalidokit's head/hips
  // normalization uses the correct aspect ratio (matches SysMoCap passing the
  // live video element).
  const imageSize =
    frame.imageSize && frame.imageSize.width > 0 ? frame.imageSize : IMAGE_SIZE;

  // MediaPipe Holistic labels the hands reversed relative to the body, so the
  // hand it calls "left" is actually the person's right hand. Swap to get
  // anatomically-correct hands (matches SysMoCap's known fix).
  const leftHandLm = frame.rightHand;
  const rightHandLm = frame.leftHand;

  if (frame.pose.length > 0) {
    // Legacy Holistic world landmarks already match kalidokit's expected
    // convention — no axis remapping needed.
    const lm3d = frame.poseWorld && frame.poseWorld.length ? frame.poseWorld : frame.pose;
    const pose =
      Kalidokit.Pose.solve(lm3d, frame.pose, {
        runtime: "mediapipe",
        imageSize,
        enableLegs: true,
      }) ?? undefined;

    if (pose) {
      // Limbs that aren't confidently visible (e.g. out of frame) get garbage
      // rotations from MediaPipe. Relax those back to the rest pose by zeroing
      // them, rather than flailing the avatar (the controller slerps to rest).
      relaxUntracked(pose, frame, leftHandLm.length > 0, rightHandLm.length > 0);
      out.pose = pose;
    }
  }

  if (frame.face.length > 0) {
    out.face =
      Kalidokit.Face.solve(frame.face, {
        runtime: "mediapipe",
        imageSize,
        smoothBlink: true,
      }) ?? undefined;
  }

  if (leftHandLm.length > 0) {
    out.leftHand = Kalidokit.Hand.solve(leftHandLm, "Left") ?? undefined;
  }
  if (rightHandLm.length > 0) {
    out.rightHand = Kalidokit.Hand.solve(rightHandLm, "Right") ?? undefined;
  }

  return out;
}

// MediaPipe Pose landmark indices.
const LM = {
  leftElbow: 13,
  leftWrist: 15,
  rightElbow: 14,
  rightWrist: 16,
  leftKnee: 25,
  leftAnkle: 27,
  rightKnee: 26,
  rightAnkle: 28,
} as const;

/** Minimum average visibility for a limb to be considered tracked. */
const VIS_THRESHOLD = 0.5;

function avgVisibility(frame: LandmarkFrame, indices: number[]): number {
  let sum = 0;
  let n = 0;
  for (const i of indices) {
    const v = frame.pose[i]?.visibility;
    if (v != null) {
      sum += v;
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

const ZERO = { x: 0, y: 0, z: 0 };
function zero(target: { x: number; y: number; z: number }) {
  target.x = 0;
  target.y = 0;
  target.z = 0;
}

/** Zero the rotations of limbs whose landmarks aren't confidently visible. */
function relaxUntracked(
  pose: Kalidokit.TPose,
  frame: LandmarkFrame,
  leftHandPresent: boolean,
  rightHandPresent: boolean
) {
  // If a hand is detected, keep its arm active even at lower pose visibility —
  // otherwise the arm parks at rest while the hand wiggles ("doesn't follow").
  if (!leftHandPresent && avgVisibility(frame, [LM.leftElbow, LM.leftWrist]) < VIS_THRESHOLD) {
    zero(pose.LeftUpperArm);
    zero(pose.LeftLowerArm);
    Object.assign(pose.LeftHand, ZERO);
  }
  if (!rightHandPresent && avgVisibility(frame, [LM.rightElbow, LM.rightWrist]) < VIS_THRESHOLD) {
    zero(pose.RightUpperArm);
    zero(pose.RightLowerArm);
    Object.assign(pose.RightHand, ZERO);
  }
  if (avgVisibility(frame, [LM.leftKnee, LM.leftAnkle]) < VIS_THRESHOLD) {
    Object.assign(pose.LeftUpperLeg, ZERO);
    Object.assign(pose.LeftLowerLeg, ZERO);
  }
  if (avgVisibility(frame, [LM.rightKnee, LM.rightAnkle]) < VIS_THRESHOLD) {
    Object.assign(pose.RightUpperLeg, ZERO);
    Object.assign(pose.RightLowerLeg, ZERO);
  }
}
