// MediaPipe Tasks Vision wrapper. Runs entirely in the phone browser on the
// GPU (WebGL) — never on the desktop. Loads the WASM runtime + .task models
// from the local origin so it works fully offline.

import {
  FilesetResolver,
  PoseLandmarker,
  FaceLandmarker,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { Landmark, TrackingMode } from "./landmarks";

const WASM_PATH = "/mediapipe/wasm";
const MODELS = {
  pose: "/models/mediapipe/pose_landmarker_full.task",
  face: "/models/mediapipe/face_landmarker.task",
  hand: "/models/mediapipe/hand_landmarker.task",
};

export interface DetectResult {
  pose: Landmark[];
  poseWorld: Landmark[];
  face: Landmark[];
  leftHand: Landmark[];
  rightHand: Landmark[];
}

function toLandmarks(src: NormalizedLandmark[] | undefined): Landmark[] {
  if (!src) return [];
  return src.map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z,
    ...(p.visibility !== undefined ? { visibility: p.visibility } : {}),
  }));
}

export class Tracker {
  private constructor(
    private pose: PoseLandmarker,
    private face: FaceLandmarker,
    private hand: HandLandmarker
  ) {}

  static async create(
    onProgress?: (msg: string) => void
  ): Promise<Tracker> {
    onProgress?.("loading runtime");
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

    // GPU delegate; falls back internally to CPU if WebGL is unavailable.
    onProgress?.("loading pose model");
    const pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODELS.pose, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      // Higher confidence = fewer spurious/ghost detections that cause flicker.
      minPoseDetectionConfidence: 0.6,
      minPosePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    onProgress?.("loading face model");
    const face = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODELS.face, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    onProgress?.("loading hand model");
    const hand = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODELS.hand, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    onProgress?.("ready");
    return new Tracker(pose, face, hand);
  }

  /** Run the enabled landmarkers for `mode` against the current video frame. */
  detect(video: HTMLVideoElement, ts: number, mode: TrackingMode): DetectResult {
    const out: DetectResult = {
      pose: [],
      poseWorld: [],
      face: [],
      leftHand: [],
      rightHand: [],
    };

    // Face is always tracked. Pose for upper/full. Hands for full.
    const faceRes = this.face.detectForVideo(video, ts);
    out.face = toLandmarks(faceRes.faceLandmarks?.[0]);

    if (mode === "upper" || mode === "full") {
      const poseRes = this.pose.detectForVideo(video, ts);
      out.pose = toLandmarks(poseRes.landmarks?.[0]);
      out.poseWorld = toLandmarks(
        poseRes.worldLandmarks?.[0] as NormalizedLandmark[] | undefined
      );
    }

    if (mode === "full") {
      const handRes = this.hand.detectForVideo(video, ts);
      const hands = handRes.landmarks ?? [];
      const handedness = handRes.handedness ?? [];
      for (let i = 0; i < hands.length; i++) {
        const label = handedness[i]?.[0]?.categoryName;
        const lm = toLandmarks(hands[i]);
        // MediaPipe labels hands from the subject's perspective.
        if (label === "Left") out.leftHand = lm;
        else if (label === "Right") out.rightHand = lm;
      }
    }

    return out;
  }

  close() {
    this.pose.close();
    this.face.close();
    this.hand.close();
  }
}
