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
    <div className="settings" ref={rootRef}>
      <motion.button
        className={`btn icon ${open ? "active" : ""}`}
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
            className="settings-popover"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
          >
            <label className="field">
              <span>
                <ScanFace size={13} /> Tracking
              </span>
              <select
                value={props.mode}
                onChange={(e) => props.onModeChange(e.target.value as TrackingMode)}
              >
                {(Object.keys(MODE_LABELS) as TrackingMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>
                <ImageIcon size={13} /> Background
              </span>
              <select
                value={props.background}
                onChange={(e) => props.onBackgroundChange(e.target.value as BackgroundMode)}
              >
                {(Object.keys(BG_LABELS) as BackgroundMode[]).map((b) => (
                  <option key={b} value={b}>
                    {BG_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>

            {props.onQualityChange && (
              <label className="field">
                <span>
                  <Sparkles size={13} /> Quality
                </span>
                <select
                  value={props.quality ?? 1}
                  onChange={(e) => props.onQualityChange?.(Number(e.target.value) as Quality)}
                >
                  {([0, 1, 2] as Quality[]).map((q) => (
                    <option key={q} value={q}>
                      {QUALITY_LABELS[q]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>
                <Gauge size={13} /> Responsiveness
              </span>
              <input
                type="range"
                min={6}
                max={28}
                step={1}
                value={props.responsiveness}
                onChange={(e) => props.onResponsivenessChange(Number(e.target.value))}
              />
            </label>

            <label className="field row">
              <span>
                <ArrowUpFromLine size={13} /> Keep upright
              </span>
              <input
                type="checkbox"
                checked={props.upright}
                onChange={(e) => props.onUprightChange(e.target.checked)}
              />
            </label>

            <div className="field-actions">
              <motion.button
                className="btn primary"
                onClick={props.onCalibrate}
                whileTap={{ scale: 0.96 }}
              >
                <Crosshair size={14} /> Calibrate
              </motion.button>
              <motion.button
                className="btn ghost"
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
