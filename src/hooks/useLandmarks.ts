import { useCallback, useRef, useState } from "react";
import { isLandmarkFrame } from "../lib/landmarks";
import { solvePose, type SolvedPose } from "../lib/poseSolver";
import { LandmarkSmoother } from "../lib/oneEuro";

export interface TrackingFlags {
  pose: boolean;
  face: boolean;
  hands: boolean;
}

/**
 * Desktop-side landmark pipeline. Feed inbound WebSocket messages into
 * `ingest`; it solves them with kalidokit and stashes the result in
 * `solvedRef` (a mutable ref the render loop reads every frame — no React
 * re-render per frame). Tracking flags + inference FPS are throttled state for
 * the status bar.
 */
export function useLandmarks() {
  const solvedRef = useRef<SolvedPose>({});
  const [tracking, setTracking] = useState<TrackingFlags>({
    pose: false,
    face: false,
    hands: false,
  });
  const [inferenceFps, setInferenceFps] = useState(0);

  const fpsWindow = useRef<number[]>([]);
  const lastFpsEmit = useRef(0);
  // One-Euro filter applied to landmarks before solving — the main jitter fix.
  const smoother = useRef(new LandmarkSmoother());

  const ingest = useCallback((data: unknown) => {
    if (!isLandmarkFrame(data)) return;

    // Smooth raw landmarks in place (adaptive low-pass), then solve.
    smoother.current.smoothFrame(data, performance.now() / 1000);
    solvedRef.current = solvePose(data);

    const flags: TrackingFlags = {
      pose: data.pose.length > 0,
      face: data.face.length > 0,
      hands: data.leftHand.length > 0 || data.rightHand.length > 0,
    };
    setTracking((prev) =>
      prev.pose === flags.pose && prev.face === flags.face && prev.hands === flags.hands
        ? prev
        : flags
    );

    // Inference FPS over a 1s sliding window, emitted at most ~3x/sec.
    const now = performance.now();
    const w = fpsWindow.current;
    w.push(now);
    while (w.length && now - w[0] > 1000) w.shift();
    if (now - lastFpsEmit.current > 333) {
      lastFpsEmit.current = now;
      setInferenceFps(w.length);
    }
  }, []);

  return { solvedRef, ingest, tracking, inferenceFps };
}
