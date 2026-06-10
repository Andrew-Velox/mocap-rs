// MediaPipe Holistic (legacy @mediapipe/holistic) — the same stack SysMoCap and
// Kalidokit were built for. Runs entirely in the phone browser. Loads its WASM
// + model assets from the local origin so it works fully offline.
//
// We deliberately use the *legacy* Holistic rather than the new Tasks
// HolisticLandmarker: Kalidokit's solvers expect this library's exact landmark
// coordinate conventions, so the canonical rig mapping works without axis hacks.

// Types only — the runtime is loaded via a <script> tag (see loadHolistic).
// @mediapipe/holistic is a UMD bundle that attaches `Holistic` to the global
// (its CDN usage), so an ESM import would be undefined at runtime.
import type { Holistic, Results, NormalizedLandmark, Options } from "@mediapipe/holistic";
import type { Landmark, TrackingMode } from "./landmarks";
import { asset } from "./assets";

const ASSET_PATH = asset("mediapipe/holistic");

type HolisticCtor = new (config: { locateFile: (f: string) => string }) => Holistic;

declare global {
  interface Window {
    Holistic?: HolisticCtor;
  }
}

let scriptPromise: Promise<HolisticCtor> | null = null;

/** Load holistic.js once and resolve the global constructor. */
function loadHolistic(): Promise<HolisticCtor> {
  if (window.Holistic) return Promise.resolve(window.Holistic);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${ASSET_PATH}/holistic.js`;
    s.crossOrigin = "anonymous";
    s.onload = () =>
      window.Holistic
        ? resolve(window.Holistic)
        : reject(new Error("holistic.js loaded but window.Holistic missing"));
    s.onerror = () => reject(new Error("failed to load holistic.js"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

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

// World landmarks aren't in the public typings; this build exposes them on the
// minified `za` property (graph stream "world_landmarks"). Probe robustly.
function worldLandmarks(results: Results): NormalizedLandmark[] | undefined {
  const r = results as unknown as Record<string, NormalizedLandmark[] | undefined>;
  return r.za ?? r.poseWorldLandmarks ?? r.ea;
}

export class Tracker {
  private listener?: (r: DetectResult) => void;

  private constructor(private holistic: Holistic) {}

  static async create(onProgress?: (msg: string) => void): Promise<Tracker> {
    onProgress?.("loading holistic");
    const HolisticCtor = await loadHolistic();
    const holistic = new HolisticCtor({
      locateFile: (file) => `${ASSET_PATH}/${file}`,
    });
    holistic.setOptions({
      // complexity 1 (full) keeps inference fast (~20-30fps) on CPU/iGPU, which
      // tracks tighter than complexity 2 stuck at ~8fps. Bump to 2 on a machine
      // that can sustain it for marginally more accurate joints.
      modelComplexity: 1,
      smoothLandmarks: true,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    } as Options);

    const tracker = new Tracker(holistic);
    holistic.onResults((results) => tracker.handle(results));

    onProgress?.("initializing (downloading models)…");
    await holistic.initialize();
    onProgress?.("ready");
    return tracker;
  }

  /** Register the per-frame result callback. */
  onResult(cb: (r: DetectResult) => void) {
    this.listener = cb;
  }

  private handle(results: Results) {
    this.listener?.({
      pose: toLandmarks(results.poseLandmarks),
      poseWorld: toLandmarks(worldLandmarks(results)),
      face: toLandmarks(results.faceLandmarks),
      leftHand: toLandmarks(results.leftHandLandmarks),
      rightHand: toLandmarks(results.rightHandLandmarks),
    });
  }

  /** Push one video frame; the result arrives via the `onResult` callback. */
  async send(video: HTMLVideoElement) {
    await this.holistic.send({ image: video });
  }

  async close() {
    await this.holistic.close();
  }
}

/** Filter a result by tracking mode (Holistic always computes everything). */
export function filterByMode(r: DetectResult, mode: TrackingMode): DetectResult {
  if (mode === "face") {
    return { pose: [], poseWorld: [], face: r.face, leftHand: [], rightHand: [] };
  }
  return r; // upper + full both use pose + hands (legs gated later by visibility)
}
