import type { AvatarStatus } from "./AvatarCanvas";

export interface StatusBarProps {
  connected: boolean;
  /** Desktop render FPS. */
  renderFps: number;
  /** Inference FPS reported by the phone (0 until Phase 3). */
  inferenceFps?: number;
  /** Which landmark groups are currently arriving. */
  tracking?: { pose: boolean; face: boolean; hands: boolean };
  avatar: AvatarStatus;
}

function Dot({ on }: { on: boolean }) {
  return <span className={`dot ${on ? "on" : "off"}`} />;
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
      ? "loading…"
      : avatar.kind === "error"
        ? `error: ${avatar.message}`
        : avatar.source === "vrm"
          ? "VRM"
          : "placeholder";

  return (
    <div className="status-bar">
      <div className="status-group">
        <Dot on={connected} />
        <span>{connected ? "Connected" : "Waiting for phone"}</span>
      </div>

      <div className="status-group">
        <span className="label">render</span>
        <span className="value">{renderFps.toFixed(0)} fps</span>
      </div>

      <div className="status-group">
        <span className="label">inference</span>
        <span className="value">{inferenceFps.toFixed(0)} fps</span>
      </div>

      {tracking && (
        <div className="status-group">
          <span className="label">tracking</span>
          <span className={`tag ${tracking.pose ? "on" : ""}`}>pose</span>
          <span className={`tag ${tracking.face ? "on" : ""}`}>face</span>
          <span className={`tag ${tracking.hands ? "on" : ""}`}>hands</span>
        </div>
      )}

      <div className="status-group">
        <span className="label">avatar</span>
        <span className="value">{avatarLabel}</span>
      </div>
    </div>
  );
}
