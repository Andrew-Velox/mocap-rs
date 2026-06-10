import { useEffect, useState } from "react";
import type { TrackingMode } from "../lib/landmarks";
import type { BackgroundMode } from "./AvatarCanvas";

interface ModelEntry {
  name: string;
  file: string;
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

  useEffect(() => {
    let cancelled = false;
    fetch("/models/index.json")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d: { models?: ModelEntry[] }) => {
        if (!cancelled && Array.isArray(d.models)) setModels(d.models);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="settings">
      <button
        className="btn icon"
        onClick={() => setOpen((v) => !v)}
        title="Settings"
        aria-label="Settings"
      >
        ⚙
      </button>

      {open && (
        <div className="settings-popover">
          <label className="field">
            <span>Avatar</span>
            <select value={props.modelUrl} onChange={(e) => props.onModelChange(e.target.value)}>
              {!models.some((m) => `/models/${m.file}` === props.modelUrl) && (
                <option value={props.modelUrl}>Current</option>
              )}
              {models.map((m) => (
                <option key={m.file} value={`/models/${m.file}`}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tracking</span>
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
            <span>Background</span>
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
            <span>Responsiveness</span>
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
            <span>Keep upright</span>
            <input
              type="checkbox"
              checked={props.upright}
              onChange={(e) => props.onUprightChange(e.target.checked)}
            />
          </label>

          <div className="field-actions">
            <button className="btn primary" onClick={props.onCalibrate}>
              Calibrate
            </button>
            <button className="btn ghost" onClick={props.onReset}>
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
