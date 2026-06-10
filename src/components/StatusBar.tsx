import { Wifi, WifiOff, MonitorPlay, Cpu, PersonStanding, ScanFace, Hand, Box } from "lucide-react";
import type { AvatarStatus } from "./AvatarCanvas";

export interface StatusBarProps {
  connected: boolean;
  /** Desktop render FPS. */
  renderFps: number;
  /** Inference FPS reported by the phone (0 until streaming). */
  inferenceFps?: number;
  /** Which landmark groups are currently arriving. */
  tracking?: { pose: boolean; face: boolean; hands: boolean };
  avatar: AvatarStatus;
}

export function StatusBar({
  connected,
  renderFps,
  inferenceFps = 0,
  tracking,
  avatar,
}: StatusBarProps) {
  const avatarLabel =
    avatar.kind === "loading"
      ? `${Math.round(avatar.progress * 100)}%`
      : avatar.kind === "error"
        ? `error: ${avatar.message}`
        : avatar.source === "vrm"
          ? "VRM"
          : "placeholder";

  return (
    <div className="status-bar">
      <div className={`status-group conn ${connected ? "on" : ""}`}>
        {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
        <span>{connected ? "Connected" : "Waiting"}</span>
      </div>

      <div className="status-group">
        <MonitorPlay size={14} />
        <span className="label">render</span>
        <span className="value">{renderFps.toFixed(0)} fps</span>
      </div>

      <div className="status-group">
        <Cpu size={14} />
        <span className="label">inference</span>
        <span className="value">{inferenceFps.toFixed(0)} fps</span>
      </div>

      {tracking && (
        <div className="status-group">
          <span className={`tag ${tracking.pose ? "on" : ""}`}>
            <PersonStanding size={12} /> pose
          </span>
          <span className={`tag ${tracking.face ? "on" : ""}`}>
            <ScanFace size={12} /> face
          </span>
          <span className={`tag ${tracking.hands ? "on" : ""}`}>
            <Hand size={12} /> hands
          </span>
        </div>
      )}

      <div className="status-group">
        <Box size={14} />
        <span className="label">avatar</span>
        <span className="value">{avatarLabel}</span>
      </div>
    </div>
  );
}
