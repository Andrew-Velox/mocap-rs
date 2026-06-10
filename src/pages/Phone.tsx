import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play,
  Camera,
  Wifi,
  WifiOff,
  Gauge,
  Crosshair,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useWebSocket } from "../hooks/useWebSocket";
import { Tracker, filterByMode, type DetectResult } from "../lib/tracker";
import {
  isModeMessage,
  type CalibrateMessage,
  type LandmarkFrame,
  type Landmark,
  type TrackingMode,
} from "../lib/landmarks";

type Phase = "idle" | "starting" | "running" | "error";

/**
 * Phone capture page (opened on the phone over HTTPS from the Rust relay).
 * Runs MediaPipe locally on the phone GPU and streams landmark frames over
 * WebSocket to the desktop. Camera access requires a secure context + a user
 * gesture, so capture starts on a tap.
 */
export function Phone() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<Tracker | null>(null);
  const rafRef = useRef(0);
  const rvfcRef = useRef(0);
  const runningRef = useRef(false);
  const modeRef = useRef<TrackingMode>("full");

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [fps, setFps] = useState(0);
  const [mode, setMode] = useState<TrackingMode>("full");
  const [detected, setDetected] = useState({ pose: false, face: false, hands: false });
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimer = useRef<number | undefined>(undefined);

  modeRef.current = mode;

  // Connect to the same host that served this page.
  const wsUrl = useMemo(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/ws`;
  }, []);

  // The desktop can push a tracking-mode preference (Phase 5).
  const onMessage = useCallback((data: unknown) => {
    if (isModeMessage(data)) setMode(data.mode);
  }, []);

  const { status: wsStatus, send } = useWebSocket(wsUrl, { onMessage });

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const v0 = videoRef.current as (HTMLVideoElement & {
      cancelVideoFrameCallback?: (h: number) => void;
    }) | null;
    if (rvfcRef.current && v0?.cancelVideoFrameCallback) {
      v0.cancelVideoFrameCallback(rvfcRef.current);
    }
    void trackerRef.current?.close();
    trackerRef.current = null;
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setPhase("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  // ── Detection + stream loop ────────────────────────────────────────────
  const fpsWindow = useRef<number[]>([]);
  const lastHudEmit = useRef(0);

  // Schedule the next frame push once per real *camera* frame when possible
  // (lower latency, no wasted work on duplicate frames).
  const schedule = useCallback((cb: () => void) => {
    const v = videoRef.current as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (v?.requestVideoFrameCallback) {
      rvfcRef.current = v.requestVideoFrameCallback(() => cb());
    } else {
      rafRef.current = requestAnimationFrame(() => cb());
    }
  }, []);

  // Holistic delivers results via callback (not a sync return). Build the
  // landmark frame here, stream it, draw the overlay, and throttle HUD state.
  const handleResult = useCallback(
    (raw: DetectResult) => {
      const r = filterByMode(raw, modeRef.current);

      const video = videoRef.current;
      const frame: LandmarkFrame = {
        type: "landmarks",
        timestamp: Date.now(),
        pose: r.pose,
        poseWorld: r.poseWorld,
        face: r.face,
        leftHand: r.leftHand,
        rightHand: r.rightHand,
        imageSize: video
          ? { width: video.videoWidth, height: video.videoHeight }
          : undefined,
      };
      send(frame);

      if (video) drawOverlay(canvasRef.current, video, r);

      const now = performance.now();
      const w = fpsWindow.current;
      w.push(now);
      while (w.length && now - w[0] > 1000) w.shift();
      if (now - lastHudEmit.current > 333) {
        lastHudEmit.current = now;
        setFps(w.length);
        setDetected({
          pose: r.pose.length > 0,
          face: r.face.length > 0,
          hands: r.leftHand.length > 0 || r.rightHand.length > 0,
        });
      }
    },
    [send]
  );

  // Feed frames to Holistic one at a time (await serializes inference).
  const pump = useCallback(async () => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (video && tracker && video.readyState >= 2) {
      try {
        await tracker.send(video);
      } catch {
        /* transient send error — keep going */
      }
    }
    if (runningRef.current) schedule(pump);
  }, [schedule]);

  const start = useCallback(async () => {
    setPhase("starting");
    setStatusMsg("requesting camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Higher resolution → more precise landmarks (MediaPipe accuracy scales
        // with input size). The phone downscales internally as needed.
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      setStatusMsg("loading models…");
      const tracker = await Tracker.create(setStatusMsg);
      tracker.onResult(handleResult);
      trackerRef.current = tracker;

      runningRef.current = true;
      setPhase("running");
      pump();
    } catch (e) {
      console.error(e);
      setStatusMsg(e instanceof Error ? e.message : "failed to start");
      setPhase("error");
    }
  }, [handleResult, pump]);

  // Calibration: 3-2-1 countdown (so you can strike a neutral pose), then tell
  // the avatar side to capture the current pose as neutral.
  const calibrate = useCallback(() => {
    window.clearInterval(countdownTimer.current);
    let n = 3;
    setCountdown(n);
    countdownTimer.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(countdownTimer.current);
        setCountdown(null);
        const msg: CalibrateMessage = { type: "calibrate" };
        send(msg);
      } else {
        setCountdown(n);
      }
    }, 1000);
  }, [send]);

  const resetCalibration = useCallback(() => {
    const msg: CalibrateMessage = { type: "calibrate", reset: true };
    send(msg);
  }, [send]);

  useEffect(() => () => window.clearInterval(countdownTimer.current), []);

  const connected = wsStatus === "open";

  return (
    <div className="phone">
      <div className="video-wrap">
        <video ref={videoRef} className="cam" playsInline muted />
        <canvas ref={canvasRef} className="overlay" />
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              key={countdown}
              className="countdown"
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
            >
              {countdown}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {phase !== "running" && (
            <motion.div
              className="hero-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
            >
              {phase === "idle" && (
                <motion.div
                  className="hero"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 26 }}
                >
                  <div className="hero-badge">
                    <ShieldCheck size={13} /> on-device tracking
                  </div>
                  <h1>
                    Your phone is
                    <br />
                    <span className="hero-accent">the mocap camera.</span>
                  </h1>
                  <p>Point it at yourself, tap start, and watch the avatar follow.</p>
                  <motion.button
                    className="start-btn"
                    onClick={start}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play size={18} /> Start capture
                  </motion.button>
                </motion.div>
              )}
              {phase === "starting" && (
                <motion.div className="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <motion.div
                    className="loader-ring"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Camera size={20} />
                  </motion.div>
                  <p className="loading">{statusMsg}</p>
                </motion.div>
              )}
              {phase === "error" && (
                <motion.div className="hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <p className="err">
                    <AlertTriangle size={16} /> {statusMsg}
                  </p>
                  <motion.button className="start-btn" onClick={start} whileTap={{ scale: 0.95 }}>
                    <Play size={18} /> Retry
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="phone-hud">
        <span className={`pill ${connected ? "on" : "off"}`}>
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
          {connected ? "linked" : "connecting"}
        </span>
        <span className="pill">
          <Gauge size={13} /> {fps} fps
        </span>
        <span className="pill">{mode}</span>
        <span className="pill">
          {[
            detected.pose && "pose",
            detected.face && "face",
            detected.hands && "hands",
          ]
            .filter(Boolean)
            .join(" · ") || "no tracking"}
        </span>
        {phase === "running" && (
          <>
            <button className="pill btn" onClick={calibrate}>
              <Crosshair size={13} /> Calibrate
            </button>
            <button className="pill btn" onClick={resetCalibration}>
              <RotateCcw size={13} /> Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Overlay rendering ──────────────────────────────────────────────────────
// MediaPipe connection index pairs are globals once holistic.js loads.
type Conn = ReadonlyArray<readonly [number, number]>;
const mpConns = () =>
  window as unknown as {
    POSE_CONNECTIONS?: Conn;
    HAND_CONNECTIONS?: Conn;
    FACEMESH_TESSELATION?: Conn;
  };

function drawConnectors(
  ctx: CanvasRenderingContext2D,
  pts: Landmark[],
  conns: Conn | undefined,
  w: number,
  h: number,
  color: string,
  lineWidth: number
) {
  if (!conns || pts.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const [a, b] of conns) {
    const pa = pts[a];
    const pb = pts[b];
    if (!pa || !pb) continue;
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
  }
  ctx.stroke();
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  pts: Landmark[],
  w: number,
  h: number,
  color: string,
  r: number
) {
  ctx.fillStyle = color;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  r: { pose: Landmark[]; face: Landmark[]; leftHand: Landmark[]; rightHand: Landmark[] }
) {
  if (!canvas) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const C = mpConns();

  // Face mesh + iris.
  drawConnectors(ctx, r.face, C.FACEMESH_TESSELATION, w, h, "#46506a", 0.5);
  if (r.face.length >= 478) {
    drawDots(ctx, [r.face[468], r.face[473]], w, h, "#ffe603", 2);
  }

  // Pose skeleton.
  drawConnectors(ctx, r.pose, C.POSE_CONNECTIONS, w, h, "#00cff7", 3);
  drawDots(ctx, r.pose, w, h, "#ff0364", 2.5);

  // Hands.
  drawConnectors(ctx, r.leftHand, C.HAND_CONNECTIONS, w, h, "#eb1064", 4);
  drawDots(ctx, r.leftHand, w, h, "#00cff7", 2);
  drawConnectors(ctx, r.rightHand, C.HAND_CONNECTIONS, w, h, "#22c3e3", 4);
  drawDots(ctx, r.rightHand, w, h, "#ff0364", 2);
}
