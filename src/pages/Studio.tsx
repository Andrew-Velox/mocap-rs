import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Play, PersonStanding, AlertTriangle } from "lucide-react";
import type { VRM } from "@pixiv/three-vrm";
import { AvatarCanvas, type AvatarStatus, type BackgroundMode } from "../components/AvatarCanvas";
import { StatusBar } from "../components/StatusBar";
import { SettingsPanel } from "../components/SettingsPanel";
import { useLandmarks } from "../hooks/useLandmarks";
import { AvatarController } from "../lib/avatarController";
import { Tracker, filterByMode, type DetectResult, type Quality } from "../lib/tracker";
import { modelUrl } from "../lib/assets";
import type { LandmarkFrame, TrackingMode } from "../lib/landmarks";

const DEFAULT_MODEL = modelUrl({
  file: "shino.vrm",
  cdn: "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/beta/Sendagaya_Shino.vrm",
});

type Phase = "idle" | "starting" | "running" | "error";

/**
 * Standalone web studio: camera + MediaPipe + avatar all in ONE browser tab —
 * no relay, no second device. This is the page deployed to GitHub Pages.
 */
export function Studio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<Tracker | null>(null);
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const rvfcRef = useRef(0);

  const [params] = useSearchParams();
  const selected = params.get("m");
  // Avatar is chosen on the gallery and passed as a full URL (?m=…). It doesn't
  // change in-session, so it's a plain const (no in-Studio switcher anymore).
  const model = selected ? decodeURIComponent(selected) : DEFAULT_MODEL;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [avatar, setAvatar] = useState<AvatarStatus>({ kind: "loading", progress: 0 });
  const [renderFps, setRenderFps] = useState(0);
  const [mode, setMode] = useState<TrackingMode>("full");
  const [background, setBackground] = useState<BackgroundMode>("studio");
  const [responsiveness, setResponsiveness] = useState(14);
  const [quality, setQuality] = useState<Quality>(1);
  const [upright, setUpright] = useState(true);
  const [isSplitView, setIsSplitView] = useState(false);

  const { solvedRef, ingest, tracking, inferenceFps } = useLandmarks();

  // Settings mirrored into refs for the (memoized) frame/capture callbacks.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const respRef = useRef(responsiveness);
  respRef.current = responsiveness;
  const uprightRef = useRef(upright);
  uprightRef.current = upright;
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  const changeQuality = useCallback((q: Quality) => {
    setQuality(q);
    trackerRef.current?.setQuality(q); // live model switch (reloads briefly)
  }, []);

  const controllerRef = useRef<AvatarController | null>(null);
  const controlledVrm = useRef<VRM | null>(null);

  useEffect(() => {
    if (controllerRef.current) controllerRef.current.smoothing = responsiveness;
  }, [responsiveness]);
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.uprightLock = upright;
  }, [upright]);

  const calibrate = useCallback(() => controllerRef.current?.calibrate(), []);
  const resetCalibration = useCallback(() => controllerRef.current?.clearCalibration(), []);

  // ── Local capture pipeline (feeds the same solver the relay path uses) ────
  const schedule = useCallback((cb: () => void) => {
    const v = videoRef.current as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (v?.requestVideoFrameCallback) rvfcRef.current = v.requestVideoFrameCallback(() => cb());
    else rafRef.current = requestAnimationFrame(() => cb());
  }, []);

  const onResult = useCallback(
    (r: DetectResult) => {
      const f = filterByMode(r, modeRef.current);
      const video = videoRef.current;

      // Draw tracking overlay
      drawOverlay(canvasRef.current, video, f);

      const frame: LandmarkFrame = {
        type: "landmarks",
        timestamp: Date.now(),
        pose: f.pose,
        poseWorld: f.poseWorld,
        face: f.face,
        leftHand: f.leftHand,
        rightHand: f.rightHand,
        imageSize: video
          ? { width: video.videoWidth, height: video.videoHeight }
          : undefined,
      };
      ingest(frame);
    },
    [ingest]
  );

  const pump = useCallback(async () => {
    if (!runningRef.current) return;
    const v = videoRef.current;
    const t = trackerRef.current;
    if (v && t && v.readyState >= 2) {
      try {
        await t.send(v);
      } catch {
        /* transient */
      }
    }
    if (runningRef.current) schedule(pump);
  }, [schedule]);

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
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((s) => s.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    setPhase("starting");
    setStatusMsg("requesting camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();

      setStatusMsg("loading models…");
      const t = await Tracker.create(setStatusMsg, qualityRef.current);
      t.onResult(onResult);
      trackerRef.current = t;

      runningRef.current = true;
      setPhase("running");
      pump();
    } catch (e) {
      console.error(e);
      setStatusMsg(e instanceof Error ? e.message : "failed to start");
      setPhase("error");
    }
  }, [onResult, pump]);

  // Auto-start on entry — "Launch Studio" navigates here within the same SPA
  // document, so the click's user-activation still covers getUserMedia. If the
  // browser blocks it, the error state offers a Retry (a fresh gesture).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    start();
  }, [start]);

  // ── Avatar drive + render FPS ─────────────────────────────────────────────
  const frames = useRef(0);
  const lastSample = useRef(performance.now());
  const handleFrame = useMemo(
    () =>
      ({ vrm, delta }: { vrm: VRM | null; delta: number; time: number }) => {
        if (vrm) {
          if (controlledVrm.current !== vrm) {
            controlledVrm.current = vrm;
            const c = new AvatarController(vrm, respRef.current);
            c.uprightLock = uprightRef.current;
            controllerRef.current = c;
          }
          controllerRef.current!.apply(solvedRef.current, delta);
        }
        frames.current += 1;
        const now = performance.now();
        const elapsed = now - lastSample.current;
        if (elapsed >= 500) {
          setRenderFps((frames.current * 1000) / elapsed);
          frames.current = 0;
          lastSample.current = now;
        }
      },
    [solvedRef]
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-3 px-[1.15rem] py-[0.65rem] bg-bg border-b border-border-line select-none">
        <span className="inline-flex items-center gap-[0.55rem] font-bold text-[0.95rem] tracking-[-0.01em] text-text">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-[9px] bg-accent text-accent-ink">
            <PersonStanding size={15} />
          </span>
          mocap-rs
        </span>
        <span className="text-[0.78rem] text-faint tracking-[0.01em] pl-3 border-l border-border-line">web studio</span>
        <div className="ml-auto flex items-center gap-2">
          <SettingsPanel
            mode={mode}
            onModeChange={setMode}
            background={background}
            onBackgroundChange={setBackground}
            responsiveness={responsiveness}
            onResponsivenessChange={setResponsiveness}
            quality={quality}
            onQualityChange={changeQuality}
            upright={upright}
            onUprightChange={setUpright}
            onCalibrate={calibrate}
            onReset={resetCalibration}
          />
        </div>
      </header>

      <div className={`relative flex-1 min-h-0 flex ${isSplitView ? "flex-row" : ""}`}>
        <AvatarCanvas
          modelUrl={model}
          background={background}
          framing={mode}
          onStatus={setAvatar}
          onFrame={handleFrame}
        />

        {/* Camera preview (corner). Click to toggle split view. */}
        <video
          ref={videoRef}
          className={`absolute bottom-4 left-4 w-44 max-w-[32vw] aspect-[4/3] object-cover border border-border-strong rounded bg-black shadow-[0_14px_36px_var(--color-shadow)] z-[4] cursor-pointer pointer-events-auto [transform:scaleX(-1)] ${isSplitView ? "static w-[40%] h-full flex-[0_0_auto] flex-grow-0 rounded-none border-0 border-r-2 border-border-strong shadow-none m-0 ml-0 [transform:scaleX(-1)] order-1 object-cover" : ""}`}
          playsInline
          muted
          onClick={(e) => {
            console.log("Camera clicked!", isSplitView);
            e.stopPropagation();
            setIsSplitView(!isSplitView);
          }}
          title="Click to toggle split view"
        />

        {/* Tracking overlay canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute bottom-4 left-4 w-44 max-w-[32vw] aspect-[4/3] rounded z-[5] pointer-events-none [transform:scaleX(-1)] ${isSplitView ? "w-[40%] h-full aspect-auto rounded-none" : ""}`}
        />

        <AnimatePresence>
          {phase !== "running" && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-bg z-[8]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.45 } }}
            >
              {phase === "error" ? (
                <motion.div
                  className="flex flex-col items-center gap-[1.1rem] text-center px-8 max-w-[34rem]"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="m-0 inline-flex items-center gap-[0.45rem] text-bad text-base">
                    <AlertTriangle size={16} /> {statusMsg}
                  </p>
                  <motion.button className="inline-flex items-center gap-[0.55rem] mt-1 px-10 py-[0.95rem] text-[1.02rem] font-bold tracking-[0.01em] text-accent-ink bg-accent border-0 rounded-full cursor-pointer touch-manipulation shadow-[0_14px_36px_var(--color-shadow)] hover:bg-accent-strong" onClick={start} whileTap={{ scale: 0.96 }}>
                    <Play size={18} /> Retry
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div className="flex flex-col items-center gap-[1.1rem] text-center px-8 max-w-[34rem]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {avatar.kind === "loading" && avatar.progress > 0 ? (
                    <div className="text-[clamp(3rem,11vw,5.5rem)] font-extrabold tracking-[-0.04em] leading-none text-text text-tabular">
                      {Math.round(avatar.progress * 100)}
                      <span className="text-[0.38em] font-bold text-accent ml-[0.08em]">%</span>
                    </div>
                  ) : (
                    <div className="w-[3.2rem] h-[3.2rem] rounded-full border-[3px] border-surface-3 border-t-accent animate-[spin_0.9s_linear_infinite]" />
                  )}
                  <p className="m-0 text-muted text-base leading-[1.6] after:content-['…']">
                    {avatar.kind === "loading" ? "loading avatar" : statusMsg || "starting"}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <StatusBar
        connected={phase === "running"}
        renderFps={renderFps}
        inferenceFps={inferenceFps}
        tracking={tracking}
        avatar={avatar}
      />
    </div>
  );
}

type Conn = ReadonlyArray<readonly [number, number]>;
const mpConns = () =>
  window as unknown as {
    POSE_CONNECTIONS?: Conn;
    HAND_CONNECTIONS?: Conn;
    FACEMESH_TESSELATION?: Conn;
  };

function drawConnectors(
  ctx: CanvasRenderingContext2D,
  pts: any[],
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
  pts: any[],
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
  video: HTMLVideoElement | null,
  r: any
) {
  if (!canvas || !video) return;
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
