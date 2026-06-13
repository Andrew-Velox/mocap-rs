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
    <div className="flex flex-wrap items-center gap-[1.35rem] px-[1.15rem] py-[0.55rem] bg-bg border-t border-border-line text-[0.82rem] text-muted">
      <div className={`flex items-center gap-[0.45rem] ${connected ? "text-good" : "text-faint font-semibold"}`}>
        {connected ? <Wifi size={14} className="text-good" /> : <WifiOff size={14} className="text-faint" />}
        <span>{connected ? "Connected" : "Waiting"}</span>
      </div>

      <div className="flex items-center gap-[0.45rem] text-faint">
        <MonitorPlay size={14} />
        <span className="text-faint uppercase text-[0.64rem] tracking-[0.08em]">render</span>
        <span className="text-text text-tabular font-semibold">{renderFps.toFixed(0)} fps</span>
      </div>

      <div className="flex items-center gap-[0.45rem] text-faint">
        <Cpu size={14} />
        <span className="text-faint uppercase text-[0.64rem] tracking-[0.08em]">inference</span>
        <span className="text-text text-tabular font-semibold">{inferenceFps.toFixed(0)} fps</span>
      </div>

      {tracking && (
        <div className="flex items-center gap-[0.45rem] text-faint">
          <span className={`inline-flex items-center gap-[0.3rem] px-[0.6rem] py-[0.16rem] rounded-full border border-border-strong text-faint text-[0.68rem] font-semibold tracking-[0.02em] ${tracking.pose ? "text-accent bg-accent-soft border-accent-strong" : ""}`}>
            <PersonStanding size={12} /> pose
          </span>
          <span className={`inline-flex items-center gap-[0.3rem] px-[0.6rem] py-[0.16rem] rounded-full border border-border-strong text-faint text-[0.68rem] font-semibold tracking-[0.02em] ${tracking.face ? "text-accent bg-accent-soft border-accent-strong" : ""}`}>
            <ScanFace size={12} /> face
          </span>
          <span className={`inline-flex items-center gap-[0.3rem] px-[0.6rem] py-[0.16rem] rounded-full border border-border-strong text-faint text-[0.68rem] font-semibold tracking-[0.02em] ${tracking.hands ? "text-accent bg-accent-soft border-accent-strong" : ""}`}>
            <Hand size={12} /> hands
          </span>
        </div>
      )}

      <div className="flex items-center gap-[0.45rem] text-faint">
        <Box size={14} />
        <span className="text-faint uppercase text-[0.64rem] tracking-[0.08em]">avatar</span>
        <span className="text-text text-tabular font-semibold">{avatarLabel}</span>
      </div>
    </div>
  );
}
