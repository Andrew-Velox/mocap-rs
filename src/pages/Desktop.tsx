import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VRM } from "@pixiv/three-vrm";
import { AvatarCanvas, type AvatarStatus, type BackgroundMode } from "../components/AvatarCanvas";
import { StatusBar } from "../components/StatusBar";
import { SettingsPanel } from "../components/SettingsPanel";
import { PairPanel } from "../components/PairPanel";
import { useWebSocket } from "../hooks/useWebSocket";
import { useLandmarks } from "../hooks/useLandmarks";
import { AvatarController } from "../lib/avatarController";
import { isCalibrateMessage, type ModeMessage, type TrackingMode } from "../lib/landmarks";

const DEFAULT_MODEL = "/models/shino.vrm";

// The desktop is a WebSocket *client* of the Rust relay (default port 8080).
// In dev the SPA is served by Vite on another port, so target the relay host
// explicitly rather than location.host.
const RELAY_WS_URL = `wss://${location.hostname || "localhost"}:8080/ws`;

/**
 * Desktop view: VRM avatar driven by landmark frames relayed from the phone.
 * The render loop reads the latest solved pose from a ref and applies it to the
 * humanoid with per-frame interpolation (smooth regardless of network jitter).
 */
export function Desktop() {
  const [avatar, setAvatar] = useState<AvatarStatus>({ kind: "loading" });
  const [renderFps, setRenderFps] = useState(0);
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL);
  const [mode, setMode] = useState<TrackingMode>("full");
  const [background, setBackground] = useState<BackgroundMode>("studio");
  const [responsiveness, setResponsiveness] = useState(14);
  const [upright, setUpright] = useState(true);

  const { solvedRef, ingest, tracking, inferenceFps } = useLandmarks();

  // Controller is (re)created whenever the VRM instance changes.
  const controllerRef = useRef<AvatarController | null>(null);
  const controlledVrm = useRef<VRM | null>(null);
  // Mirror settings into refs so the (memoized) frame loop reads current values.
  const respRef = useRef(responsiveness);
  respRef.current = responsiveness;
  const uprightRef = useRef(upright);
  uprightRef.current = upright;

  // Live-update the existing controller when settings change.
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.smoothing = responsiveness;
  }, [responsiveness]);
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.uprightLock = upright;
  }, [upright]);

  // Inbound messages: landmark frames → solve; calibrate → (re)capture neutral.
  const onMessage = useCallback(
    (data: unknown) => {
      if (isCalibrateMessage(data)) {
        if (data.reset) controllerRef.current?.clearCalibration();
        else controllerRef.current?.calibrate();
        return;
      }
      ingest(data);
    },
    [ingest]
  );

  const { status, send } = useWebSocket(RELAY_WS_URL, { onMessage });

  // Push tracking-mode changes to the phone over the relay.
  const handleModeChange = useCallback(
    (m: TrackingMode) => {
      setMode(m);
      const msg: ModeMessage = { type: "mode", mode: m };
      send(msg);
    },
    [send]
  );

  const calibrate = useCallback(() => controllerRef.current?.calibrate(), []);
  const resetCalibration = useCallback(() => controllerRef.current?.clearCalibration(), []);

  // Render-FPS sampling (publish ~2x/sec).
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
        <span className="subtitle">real-time avatar</span>
        <div className="topbar-right">
          <SettingsPanel
            modelUrl={modelUrl}
            onModelChange={setModelUrl}
            mode={mode}
            onModeChange={handleModeChange}
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
        <PairPanel />
      </div>

      <StatusBar
        connected={status === "open"}
        renderFps={renderFps}
        inferenceFps={inferenceFps}
        tracking={tracking}
        avatar={avatar}
      />
    </div>
  );
}
