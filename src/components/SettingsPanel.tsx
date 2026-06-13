import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Settings,
  ScanFace,
  Image as ImageIcon,
  Gauge,
  Sparkles,
  ArrowUpFromLine,
  Crosshair,
  RotateCcw,
} from "lucide-react";
import type { TrackingMode } from "../lib/landmarks";
import type { BackgroundMode } from "./AvatarCanvas";
import type { Quality } from "../lib/tracker";

export interface SettingsPanelProps {
  mode: TrackingMode;
  onModeChange: (mode: TrackingMode) => void;
  background: BackgroundMode;
  onBackgroundChange: (bg: BackgroundMode) => void;
  /** Responsiveness (controller smoothing). */
  responsiveness: number;
  onResponsivenessChange: (v: number) => void;
  /** Quality control only applies where capture runs locally (Studio). */
  quality?: Quality;
  onQualityChange?: (q: Quality) => void;
  upright: boolean;
  onUprightChange: (v: boolean) => void;
  onCalibrate: () => void;
  onReset: () => void;
}

const QUALITY_LABELS: Record<Quality, string> = {
  0: "Lite (fastest)",
  1: "Full (default)",
  2: "Heavy (best, needs GPU)",
};

const MODE_LABELS: Record<TrackingMode, string> = {
  face: "Face only",
  upper: "Upper body",
  full: "Full body",
};

const BG_LABELS: Record<BackgroundMode, string> = {
  studio: "Studio",
  camera: "Camera (room / AR)",
  green: "Green screen",
  blue: "Blue screen",
  black: "Black",
  white: "White",
  transparent: "Transparent",
};

/** Gear-button popover holding all desktop controls. */
export function SettingsPanel(props: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <motion.button
        className={`inline-flex items-center justify-center w-[2.25rem] h-[2.25rem] p-0 rounded-[10px] bg-surface-2 text-text border border-border-strong text-[0.8rem] font-semibold tracking-[0.01em] cursor-pointer transition-[background,border-color,color] duration-150 ease-out hover:bg-surface-3 hover:border-accent ${open ? "border-accent text-accent bg-accent-soft" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Settings"
        aria-label="Settings"
        whileTap={{ scale: 0.92 }}
      >
        <Settings size={17} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full right-0 mt-[0.6rem] w-[17.5rem] flex flex-col gap-[0.9rem] p-[1.05rem] bg-surface border border-border-line rounded shadow-[0_20px_50px_var(--color-shadow)] z-20 origin-top-right"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
          >
            <label className="flex flex-col gap-[0.45rem] text-[0.68rem] uppercase tracking-[0.07em] text-faint">
              <span className="inline-flex items-center gap-[0.4rem]">
                <ScanFace size={13} className="text-accent" /> Tracking
              </span>
              <select
                value={props.mode}
                onChange={(e) => props.onModeChange(e.target.value as TrackingMode)}
                className="bg-surface-2 text-text border border-border-strong rounded-[10px] px-[0.65rem] py-[0.45rem] text-[0.84rem] font-medium tracking-normal normal-case cursor-pointer hover:border-accent focus:outline-none focus:border-accent"
              >
                {(Object.keys(MODE_LABELS) as TrackingMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-[0.45rem] text-[0.68rem] uppercase tracking-[0.07em] text-faint">
              <span className="inline-flex items-center gap-[0.4rem]">
                <ImageIcon size={13} className="text-accent" /> Background
              </span>
              <select
                value={props.background}
                onChange={(e) => props.onBackgroundChange(e.target.value as BackgroundMode)}
                className="bg-surface-2 text-text border border-border-strong rounded-[10px] px-[0.65rem] py-[0.45rem] text-[0.84rem] font-medium tracking-normal normal-case cursor-pointer hover:border-accent focus:outline-none focus:border-accent"
              >
                {(Object.keys(BG_LABELS) as BackgroundMode[]).map((b) => (
                  <option key={b} value={b}>
                    {BG_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>

            {props.onQualityChange && (
              <label className="flex flex-col gap-[0.45rem] text-[0.68rem] uppercase tracking-[0.07em] text-faint">
                <span className="inline-flex items-center gap-[0.4rem]">
                  <Sparkles size={13} className="text-accent" /> Quality
                </span>
                <select
                  value={props.quality ?? 1}
                  onChange={(e) => props.onQualityChange?.(Number(e.target.value) as Quality)}
                  className="bg-surface-2 text-text border border-border-strong rounded-[10px] px-[0.65rem] py-[0.45rem] text-[0.84rem] font-medium tracking-normal normal-case cursor-pointer hover:border-accent focus:outline-none focus:border-accent"
                >
                  {([0, 1, 2] as Quality[]).map((q) => (
                    <option key={q} value={q}>
                      {QUALITY_LABELS[q]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-[0.45rem] text-[0.68rem] uppercase tracking-[0.07em] text-faint">
              <span className="inline-flex items-center gap-[0.4rem]">
                <Gauge size={13} className="text-accent" /> Responsiveness
              </span>
              <input
                type="range"
                min={6}
                max={28}
                step={1}
                value={props.responsiveness}
                onChange={(e) => props.onResponsivenessChange(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </label>

            <label className="flex flex-row items-center justify-between gap-[0.45rem] text-[0.68rem] uppercase tracking-[0.07em] text-faint">
              <span className="inline-flex items-center gap-[0.4rem]">
                <ArrowUpFromLine size={13} className="text-accent" /> Keep upright
              </span>
              <input
                type="checkbox"
                checked={props.upright}
                onChange={(e) => props.onUprightChange(e.target.checked)}
                className="w-[1.05rem] h-[1.05rem] accent-accent cursor-pointer"
              />
            </label>

            <div className="flex gap-2 pt-[0.15rem]">
              <motion.button
                className="inline-flex items-center justify-center gap-[0.45rem] flex-1 bg-accent border border-accent text-accent-ink rounded-full px-4 py-[0.45rem] text-[0.8rem] font-semibold tracking-[0.01em] cursor-pointer transition-[background,border-color,color] duration-150 ease-out hover:bg-accent-strong hover:border-accent-strong"
                onClick={props.onCalibrate}
                whileTap={{ scale: 0.96 }}
              >
                <Crosshair size={14} /> Calibrate
              </motion.button>
              <motion.button
                className="inline-flex items-center justify-center gap-[0.45rem] flex-1 bg-surface text-muted border border-border-strong rounded-full px-4 py-[0.45rem] text-[0.8rem] font-semibold tracking-[0.01em] cursor-pointer transition-[background,border-color,color] duration-150 ease-out hover:bg-surface-3 hover:border-accent"
                onClick={props.onReset}
                whileTap={{ scale: 0.96 }}
              >
                <RotateCcw size={14} /> Reset
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
