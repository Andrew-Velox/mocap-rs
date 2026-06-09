# mocap-rs

Real-time motion capture + VRM avatar animation. Your **phone** runs MediaPipe
(pose / face / hands) locally on its GPU and streams 3D landmarks over WebSocket
to a small **Rust relay**; your **desktop** receives them and animates a VRM
avatar with kalidokit + three-vrm. Fully offline — no cloud, no desktop GPU
required.

```
Phone browser ──(WSS landmarks)──▶ Rust relay (axum) ──(WSS)──▶ Desktop (Tauri/Three.js)
  getUserMedia                       port 8080,                   kalidokit → VRM bones
  MediaPipe WASM                     relay + static files         three-vrm render
```

The Rust server is **only** a relay + static file server. MediaPipe runs
**only** in the phone browser — never on the desktop.

## Requirements

- Rust (stable), Node 18+
- For the desktop **Tauri** app on Linux: `webkit2gtk-4.1` and the usual Tauri
  build deps. On Arch:
  ```bash
  sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
                 gtk3 libappindicator-gtk3 librsvg
  ```

## Project layout

```
src-tauri/          Rust: relay server (+ optional Tauri shell)
  src/server.rs       axum HTTP + WebSocket relay, TLS
  src/session.rs      connected-client registry / broadcast
  src/tls.rs          rcgen self-signed cert
  src/net.rs          LAN IP + QR (terminal & SVG)
  src/main.rs         headless relay runner (default build)
  src/app.rs          Tauri desktop entry (feature "tauri-app")
src/                Frontend (React + Vite)
  pages/Desktop.tsx   avatar canvas + controls + status
  pages/Phone.tsx     camera + MediaPipe + WS sender
  components/         AvatarCanvas, StatusBar, Controls, PairPanel
  hooks/              useWebSocket, useLandmarks
  lib/                tracker (MediaPipe), poseSolver, avatarController, landmarks
public/
  models/avatar.vrm           the avatar (swap in your own)
  models/mediapipe/*.task      MediaPipe models (offline)
  mediapipe/wasm/*             MediaPipe runtime (offline)
```

## Run

Everything is served over **HTTPS/WSS** with a self-signed cert (mobile camera
access requires a secure context). The first time, accept the certificate
warning on both phone and desktop.

### Quick start (browser-first, no webkit needed)

```bash
npm install
npm run fetch-assets                # download VRM + MediaPipe models/WASM (not in git)
npm run build                       # build the SPA into dist/

# Terminal 1 — the relay (prints the phone URL + a QR code):
cargo run --manifest-path src-tauri/Cargo.toml

# Desktop: open https://localhost:8080/  in a browser
# Phone:   scan the QR / open https://<LAN-IP>:8080/phone, tap "Start capture"
```

For frontend hot-reload during development, run `npm run dev` (Vite on :5173)
alongside the relay; the desktop page connects to the relay on :8080.

### Desktop app (Tauri)

Once `webkit2gtk-4.1` is installed:

```bash
npm run tauri dev          # dev window with hot reload
npm run tauri build        # production bundle
```

This compiles the relay with `--features tauri-app` and spawns it from the app's
setup hook, then opens the desktop webview.

## How it works

- **Phone** (`Phone.tsx` + `lib/tracker.ts`): `getUserMedia` → MediaPipe
  PoseLandmarker / FaceLandmarker / HandLandmarker (VIDEO mode, GPU) → builds a
  landmark frame each video frame → sends JSON over WSS. Overlay + FPS shown.
- **Relay** (`server.rs`): receives frames, broadcasts to all *other* clients.
  Also serves the SPA, MediaPipe assets, `/api/info`, and `/qr.svg`.
- **Desktop** (`Desktop.tsx`): `useWebSocket` → `useLandmarks` (kalidokit
  `solvePose`) → `AvatarController` applies bone rotations to the VRM with
  frame-rate-independent smoothing. Tracking mode (face / upper / full) is sent
  back to the phone so it only runs the landmarkers it needs.

### Landmark message format

```json
{
  "type": "landmarks", "timestamp": 0,
  "pose":  [{ "x": 0, "y": 0, "z": 0, "visibility": 0.9 }],
  "poseWorld": [{ "x": 0, "y": 0, "z": 0 }],
  "face":  [{ "x": 0, "y": 0, "z": 0 }],
  "leftHand":  [{ "x": 0, "y": 0, "z": 0 }],
  "rightHand": [{ "x": 0, "y": 0, "z": 0 }]
}
```

## Swapping the avatar

Drop any `.vrm` into `public/models/` and add it to `public/models/index.json`;
it appears in the desktop's Avatar dropdown.
```
