// Resolve a public asset path against the app's base URL. Locally the base is
// "/" (served by the Rust relay or Vite); on GitHub Pages it's "/<repo>/".
// Always pass a path WITHOUT a leading slash, e.g. asset("models/x.vrm").
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}

// CDN mode (web deploys): serve the heavy MediaPipe + VRM assets from a CDN so
// the hosting output stays tiny (~1 MB) instead of bundling ~95 MB. The relay /
// offline build keeps everything local.
const CDN = import.meta.env.VITE_CDN_ASSETS === "1";

export const MEDIAPIPE_BASE = CDN
  ? "https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629"
  : asset("mediapipe/holistic");

export interface ModelRef {
  file: string;
  /** Absolute CDN URL used in CDN mode. */
  cdn?: string;
}

/** Resolve a model to a loadable URL (CDN when enabled, else local). */
export function modelUrl(m: ModelRef): string {
  return CDN && m.cdn ? m.cdn : asset(`models/${m.file}`);
}
