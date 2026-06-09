import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The same SPA is served two ways:
//   * Desktop  → inside the Tauri webview (route "/")
//   * Phone    → from the Rust relay over HTTPS (route "/phone")
// so we build to ./dist, which the axum server serves as static files.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    target: "esnext",
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  // MediaPipe ships large WASM; don't inline it.
  assetsInclude: ["**/*.wasm", "**/*.vrm"],
});
