import { useCallback, useMemo, useRef, useState } from "react";
import type { VRM } from "@pixiv/three-vrm";
import { AvatarCanvas, type AvatarStatus } from "../components/AvatarCanvas";
import { StatusBar } from "../components/StatusBar";
import { Controls } from "../components/Controls";
import { PairPanel } from "../components/PairPanel";
import { useWebSocket } from "../hooks/useWebSocket";
import { useLandmarks } from "../hooks/useLandmarks";
import { AvatarController } from "../lib/avatarController";
import type { ModeMessage, TrackingMode } from "../lib/landmarks";

const DEFAULT_MODEL = "/models/avatar.vrm";

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

  const { solvedRef, ingest, tracking, inferenceFps } = useLandmarks();
  const { status, send } = useWebSocket(RELAY_WS_URL, { onMessage: ingest });

  // Push tracking-mode changes to the phone over the relay.
  const handleModeChange = useCallback(
    (m: TrackingMode) => {
      setMode(m);
      const msg: ModeMessage = { type: "mode", mode: m };
      send(msg);
    },
    [send]
  );

  // Controller is (re)created whenever the VRM instance changes.
  const controllerRef = useRef<AvatarController | null>(null);
  const controlledVrm = useRef<VRM | null>(null);

  // Render-FPS sampling (publish ~2x/sec).
  const frames = useRef(0);
  const lastSample = useRef(performance.now());

  const handleFrame = useMemo(
    () =>
      ({ vrm, delta }: { vrm: VRM | null; delta: number; time: number }) => {
        if (vrm) {
          if (controlledVrm.current !== vrm) {
            controlledVrm.current = vrm;
            controllerRef.current = new AvatarController(vrm);
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
        <Controls
          modelUrl={modelUrl}
          onModelChange={setModelUrl}
          mode={mode}
          onModeChange={handleModeChange}
        />
      </header>

      <div className="stage">
        <AvatarCanvas modelUrl={modelUrl} onStatus={setAvatar} onFrame={handleFrame} />
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
