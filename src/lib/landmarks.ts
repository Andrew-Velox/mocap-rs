// Shared wire format between the phone (publisher) and desktop (subscriber).
// Matches the agreed WebSocket message schema. `poseWorld` is an additive,
// optional field: MediaPipe's metric world landmarks give kalidokit much better
// 3D pose solving than the normalized screen-space `pose` alone.

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface LandmarkFrame {
  type: "landmarks";
  timestamp: number;
  pose: Landmark[];
  /** Metric world-space pose landmarks (meters, origin at hips). Optional. */
  poseWorld?: Landmark[];
  face: Landmark[];
  leftHand: Landmark[];
  rightHand: Landmark[];
}

/** Tracking modes the desktop can request from the phone. */
export type TrackingMode = "face" | "upper" | "full";

export interface ModeMessage {
  type: "mode";
  mode: TrackingMode;
}

/** Sent by either end to (re)capture the neutral pose for calibration. */
export interface CalibrateMessage {
  type: "calibrate";
  /** `reset` clears calibration instead of capturing. */
  reset?: boolean;
}

export function isLandmarkFrame(v: unknown): v is LandmarkFrame {
  return (
    !!v && typeof v === "object" && (v as { type?: unknown }).type === "landmarks"
  );
}

export function isModeMessage(v: unknown): v is ModeMessage {
  return !!v && typeof v === "object" && (v as { type?: unknown }).type === "mode";
}

export function isCalibrateMessage(v: unknown): v is CalibrateMessage {
  return !!v && typeof v === "object" && (v as { type?: unknown }).type === "calibrate";
}
