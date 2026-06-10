import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VRM } from "@pixiv/three-vrm";
import { AvatarCanvas, type AvatarStatus, type BackgroundMode } from "../components/AvatarCanvas";
import { StatusBar } from "../components/StatusBar";
import { SettingsPanel } from "../components/SettingsPanel";
import { useLandmarks } from "../hooks/useLandmarks";
import { AvatarController } from "../lib/avatarController";
import { Tracker, filterByMode, type DetectResult } from "../lib/tracker";
import { asset } from "../lib/assets";
import type { LandmarkFrame, TrackingMode } from "../lib/landmarks";

const DEFAULT_MODEL = asset("models/shino.vrm");

type Phase = "idle" | "starting" | "running" | "error";

/**
 * Standalone web studio: camera + MediaPipe + avatar all in ONE browser tab —
 * no relay, no second device. This is the page deployed to GitHub Pages.
 */
export function Studio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<Tracker | null>(null);
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const rvfcRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [avatar, setAvatar] = useState<AvatarStatus>({ kind: "loading" });
  const [renderFps, setRenderFps] = useState(0);
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL);
  const [mode, setMode] = useState<TrackingMode>("full");
  const [background, setBackground] = useState<BackgroundMode>("studio");
  const [responsiveness, setResponsiveness] = useState(14);
  const [upright, setUpright] = useState(true);

  const { solvedRef, ingest, tracking, inferenceFps } = useLandmarks();

  // Settings mirrored into refs for the (memoized) frame/capture callbacks.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const respRef = useRef(responsiveness);
  respRef.current = responsiveness;
  const uprightRef = useRef(upright);
  uprightRef.current = upright;

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
      const t = await Tracker.create(setStatusMsg);
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
    <div className="desktop">
      <header className="topbar">
        <span className="brand">mocap-rs</span>
        <span className="subtitle">web studio</span>
        <div className="topbar-right">
          <SettingsPanel
            modelUrl={modelUrl}
            onModelChange={setModelUrl}
            mode={mode}
            onModeChange={setMode}
            background={background}
            onBackgroundChange={setBackground}
            responsiveness={responsiveness}
            onResponsivenessChange={setResponsiveness}
            upright={upright}
            onUprightChange={setUpright}
            onCalibrate={calibrate}
            onReset={resetCalibration}
          />
        </div>
      </header>

      <div className="stage">
        <AvatarCanvas
          modelUrl={modelUrl}
          background={background}
          framing={mode}
          onStatus={setAvatar}
          onFrame={handleFrame}
        />

        {/* Camera preview (corner). Always mounted so getUserMedia has a target. */}
        <video ref={videoRef} className="studio-cam" playsInline muted />

        {phase !== "running" && (
          <div className="phone-cover">
            {phase === "idle" && (
              <>
                <h1>mocap-rs studio</h1>
                <p>Runs entirely in your browser — nothing is uploaded. Tap start and allow the camera.</p>
                <button className="start-btn" onClick={start}>
                  Start
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
