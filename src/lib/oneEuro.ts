// One-Euro filter — adaptive low-pass that trades latency for jitter based on
// speed: heavy smoothing when a point is nearly still (kills jitter), light
// smoothing when it moves fast (stays responsive). This is the standard filter
// for real-time motion capture.
//
// Tuning:
//   minCutoff ↓  → smoother but more lag at rest
//   beta      ↑  → snappier on fast motion (less lag), but lets more jitter through

export interface OneEuroParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

const DEFAULTS: OneEuroParams = { minCutoff: 1.2, beta: 0.02, dCutoff: 1.0 };

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class OneEuroFilter {
  private xPrev = 0;
  private dxPrev = 0;
  private hasPrev = false;

  constructor(private p: OneEuroParams) {}

  filter(x: number, dt: number): number {
    if (!this.hasPrev) {
      this.xPrev = x;
      this.hasPrev = true;
      return x;
    }
    const dx = (x - this.xPrev) / dt;
    const edx = this.dxPrev + alpha(this.p.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.p.minCutoff + this.p.beta * Math.abs(edx);
    const ex = this.xPrev + alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = ex;
    this.dxPrev = edx;
    return ex;
  }
}

/**
 * Smooths a stream of landmark arrays (x/y/z) in place over time. One filter
 * per coordinate per landmark index, lazily created. Visibility is passed
 * through untouched. Falls back gracefully when arrays grow/shrink between
 * frames (e.g. tracking drops out).
 */
// Per-stream tuning. Faces are already stable and expression latency is very
// visible, so smooth them lightly (high cutoff). Hands move fast and jitter
// most, so smooth them harder but with higher beta to stay responsive.
const STREAM_PARAMS: Record<string, Partial<OneEuroParams>> = {
  face: { minCutoff: 2.5, beta: 0.02 },
  pose: { minCutoff: 1.0, beta: 0.03 },
  poseWorld: { minCutoff: 1.0, beta: 0.03 },
  leftHand: { minCutoff: 1.0, beta: 0.05 },
  rightHand: { minCutoff: 1.0, beta: 0.05 },
};

export class LandmarkSmoother {
  private filters = new Map<string, OneEuroFilter>();
  private lastT = 0;
  private base: OneEuroParams;

  constructor(params: Partial<OneEuroParams> = {}) {
    this.base = { ...DEFAULTS, ...params };
  }

  private paramsFor(stream: string): OneEuroParams {
    return { ...this.base, ...(STREAM_PARAMS[stream] ?? {}) };
  }

  private f(stream: string, key: string): OneEuroFilter {
    let filter = this.filters.get(key);
    if (!filter) {
      filter = new OneEuroFilter(this.paramsFor(stream));
      this.filters.set(key, filter);
    }
    return filter;
  }

  private smoothStream(
    stream: string,
    pts: Array<{ x: number; y: number; z: number; visibility?: number }>,
    dt: number
  ) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x = this.f(stream, `${stream}:${i}:x`).filter(p.x, dt);
      p.y = this.f(stream, `${stream}:${i}:y`).filter(p.y, dt);
      p.z = this.f(stream, `${stream}:${i}:z`).filter(p.z, dt);
    }
  }

  /**
   * Smooth every landmark stream of a frame in place. `tSeconds` is a
   * monotonic clock (e.g. performance.now()/1000); dt is computed once so all
   * streams share the same timestep.
   */
  smoothFrame(
    frame: {
      pose: Array<{ x: number; y: number; z: number; visibility?: number }>;
      poseWorld?: Array<{ x: number; y: number; z: number; visibility?: number }>;
      face: Array<{ x: number; y: number; z: number }>;
      leftHand: Array<{ x: number; y: number; z: number }>;
      rightHand: Array<{ x: number; y: number; z: number }>;
    },
    tSeconds: number
  ) {
    let dt = tSeconds - this.lastT;
    if (!(dt > 0) || dt > 0.5) dt = 1 / 60; // guard first frame / long gaps
    this.lastT = tSeconds;

    this.smoothStream("pose", frame.pose, dt);
    if (frame.poseWorld) this.smoothStream("poseWorld", frame.poseWorld, dt);
    this.smoothStream("face", frame.face, dt);
    this.smoothStream("leftHand", frame.leftHand, dt);
    this.smoothStream("rightHand", frame.rightHand, dt);
  }
}
