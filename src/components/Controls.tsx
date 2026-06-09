import { useEffect, useState } from "react";
import type { TrackingMode } from "../lib/landmarks";

interface ModelEntry {
  name: string;
  file: string;
}

interface ControlsProps {
  modelUrl: string;
  onModelChange: (url: string) => void;
  mode: TrackingMode;
  onModeChange: (mode: TrackingMode) => void;
}

const MODE_LABELS: Record<TrackingMode, string> = {
  face: "Face only",
  upper: "Upper body",
  full: "Full body",
};

/**
 * Desktop controls: pick the VRM model and the tracking mode. Changing the
 * mode notifies the phone (via the parent's WebSocket sender) so it only runs
 * the landmarkers it needs.
 */
export function Controls({ modelUrl, onModelChange, mode, onModeChange }: ControlsProps) {
  const [models, setModels] = useState<ModelEntry[]>([]);

  // Discover available VRMs from the static manifest.
  useEffect(() => {
    let cancelled = false;
    fetch("/models/index.json")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((data: { models?: ModelEntry[] }) => {
        if (!cancelled && Array.isArray(data.models)) setModels(data.models);
      })
      .catch(() => {
        /* manifest optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="controls">
      <label className="control">
        <span>Avatar</span>
        <select
          value={modelUrl}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {/* Always show the current model even if not in the manifest. */}
          {!models.some((m) => `/models/${m.file}` === modelUrl) && (
            <option value={modelUrl}>Current</option>
          )}
          {models.map((m) => (
            <option key={m.file} value={`/models/${m.file}`}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="control">
        <span>Tracking</span>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as TrackingMode)}
        >
          {(Object.keys(MODE_LABELS) as TrackingMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
