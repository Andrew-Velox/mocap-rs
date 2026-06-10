import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Settings,
  User,
  ScanFace,
  Image as ImageIcon,
  Gauge,
  ArrowUpFromLine,
  Crosshair,
  RotateCcw,
} from "lucide-react";
import type { TrackingMode } from "../lib/landmarks";
import type { BackgroundMode } from "./AvatarCanvas";
import { asset, modelUrl } from "../lib/assets";

interface ModelEntry {
  name: string;
  file: string;
  cdn?: string;
}

export interface SettingsPanelProps {
  modelUrl: string;
  onModelChange: (url: string) => void;
  mode: TrackingMode;
  onModeChange: (mode: TrackingMode) => void;
  background: BackgroundMode;
  onBackgroundChange: (bg: BackgroundMode) => void;
  /** Responsiveness (controller smoothing). */
  responsiveness: number;
  onResponsivenessChange: (v: number) => void;
  upright: boolean;
  onUprightChange: (v: boolean) => void;
  onCalibrate: () => void;
  onReset: () => void;
}

const MODE_LABELS: Record<TrackingMode, string> = {
  face: "Face only",
  upper: "Upper body",
  full: "Full body",
};

const BG_LABELS: Record<BackgroundMode, string> = {
  studio: "Studio",
  green: "Green screen",
  blue: "Blue screen",
  black: "Black",
  white: "White",
  transparent: "Transparent",
};

/** Gear-button popover holding all desktop controls. */
export function SettingsPanel(props: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(asset("models/index.json"))
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d: { models?: ModelEntry[] }) => {
        if (!cancelled && Array.isArray(d.models)) setModels(d.models);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
                <User size={13} /> Avatar
              </span>
              <select value={props.modelUrl} onChange={(e) => props.onModelChange(e.target.value)}>
                {!models.some((m) => modelUrl(m) === props.modelUrl) && (
                  <option value={props.modelUrl}>Current</option>
                )}
                {models.map((m) => (
                  <option key={m.file} value={modelUrl(m)}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

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
