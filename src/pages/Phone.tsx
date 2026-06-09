import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { Tracker } from "../lib/tracker";
import {
  isModeMessage,
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
  const lastTsRef = useRef(0);
  const modeRef = useRef<TrackingMode>("full");

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [fps, setFps] = useState(0);
  const [mode, setMode] = useState<TrackingMode>("full");
  const [detected, setDetected] = useState({ pose: false, face: false, hands: false });

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
    cancelAnimationFrame(rafRef.current);
    trackerRef.current?.close();
    trackerRef.current = null;
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setPhase("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    setPhase("starting");
    setStatusMsg("requesting camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      setStatusMsg("loading models…");
      trackerRef.current = await Tracker.create(setStatusMsg);

      setPhase("running");
      loop();
    } catch (e) {
      console.error(e);
      setStatusMsg(e instanceof Error ? e.message : "failed to start");
      setPhase("error");
    }
  }, []);

  // ── Detection + stream loop ────────────────────────────────────────────
  const fpsWindow = useRef<number[]>([]);
  const loop = useCallback(() => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!video || !tracker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // MediaPipe requires strictly increasing timestamps.
    let ts = performance.now();
    if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
    lastTsRef.current = ts;

    const r = tracker.detect(video, ts, modeRef.current);

    const frame: LandmarkFrame = {
      type: "landmarks",
      timestamp: Date.now(),
      pose: r.pose,
      poseWorld: r.poseWorld,
      face: r.face,
      leftHand: r.leftHand,
      rightHand: r.rightHand,
    };
    send(frame);

    drawOverlay(canvasRef.current, video, r);

    setDetected({
      pose: r.pose.length > 0,
      face: r.face.length > 0,
      hands: r.leftHand.length > 0 || r.rightHand.length > 0,
    });

    // FPS over a sliding 1s window.
    const now = performance.now();
    const w = fpsWindow.current;
    w.push(now);
    while (w.length && now - w[0] > 1000) w.shift();
    setFps(w.length);

    rafRef.current = requestAnimationFrame(loop);
  }, [send]);

  const connected = wsStatus === "open";

  return (
    <div className="phone">
      <div className="video-wrap">
        <video ref={videoRef} className="cam" playsInline muted />
        <canvas ref={canvasRef} className="overlay" />
        {phase !== "running" && (
          <div className="phone-cover">
            {phase === "idle" && (
              <>
                <h1>mocap-rs</h1>
                <p>Point the camera at yourself and tap start.</p>
                <button className="start-btn" onClick={start}>
                  Start capture
                </button>
              </>
            )}
            {phase === "starting" && <p className="loading">{statusMsg}</p>}
            {phase === "error" && (
              <>
                <p className="err">⚠ {statusMsg}</p>
                <button className="start-btn" onClick={start}>
                  Retry
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="phone-hud">
        <span className={`pill ${connected ? "on" : "off"}`}>
          {connected ? "● linked" : "○ connecting"}
        </span>
        <span className="pill">{fps} fps</span>
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
      </div>
    </div>
  );
}

// ── Overlay rendering ──────────────────────────────────────────────────────
function drawOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  r: {
    pose: Landmark[];
    face: Landmark[];
    leftHand: Landmark[];
    rightHand: Landmark[];
  }
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

  const dot = (pts: Landmark[], color: string, size: number) => {
    ctx.fillStyle = color;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  dot(r.face, "#7dd3fc", 1.2);
  dot(r.pose, "#34d399", 3);
  dot(r.leftHand, "#fbbf24", 2.5);
  dot(r.rightHand, "#fb923c", 2.5);
}
