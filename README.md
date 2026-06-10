# mocap-rs

Real-time, browser-based motion capture for **VRM avatars**. Your webcam drives a
3D avatar's face, hands, and full body — running entirely on-device, offline, and
**without a GPU**.

> **Live demo:** open the deployed site, click **Start**, allow the camera.

Built with MediaPipe Holistic + Kalidokit + three-vrm, with an optional Rust
relay for phone-camera → desktop streaming.

## Features

- 🎭 **Full-body tracking** — pose, hands (per-finger), face, eye gaze, blink
- 🧍 **Upright lock**, **foot grounding**, and **neutral-pose calibration**
- 🎥 **Backgrounds** — studio / green-screen / transparent (OBS-ready)
- 🎚️ Live **responsiveness**, **avatar switcher**, and face/upper/full framing
- 🌐 Two ways to run: **standalone web app** or **phone → desktop** over the LAN
- ⚡ CPU-friendly (no discrete GPU needed); works offline

## Quick start (standalone web app)

```bash
npm install
npm run fetch-assets   # downloads MediaPipe models + sample VRMs
npm run dev            # open the printed URL, go to /studio
```

Everything runs in one browser tab — camera, tracking, and avatar. Nothing is
uploaded.

## Phone → desktop (LAN relay)

Use your phone as the camera and watch the avatar on another screen. Served over
HTTPS (required for camera access) with a self-signed cert.

```bash
npm install && npm run fetch-assets && npm run build
cargo run --manifest-path src-tauri/Cargo.toml   # prints a LAN URL + QR code
```

- **Capture device:** open `https://<lan-ip>:8080/phone` (scan the QR), tap Start
- **Viewer:** open `https://<lan-ip>:8080/` to see the avatar

The Rust server is just a TLS WebSocket relay + static file host — it never
inspects your video. It also builds on Termux/Android (uses `ring` for TLS).

## Deploy (static hosting)

The standalone app is a static site — deploy to Vercel, Netlify, Cloudflare
Pages, or GitHub Pages (free, HTTPS included).

```bash
npm run build          # outputs dist/
```

For GitHub Pages (served from a sub-path), build with
`VITE_BASE=/<repo>/ VITE_STANDALONE=1` — a workflow is included in
`.github/workflows/deploy.yml`.

## Custom avatars

Drop any `.vrm` into `public/models/` and add it to `public/models/index.json`;
it appears in the in-app avatar switcher.

## Stack

| Layer    | Tech |
|----------|------|
| Tracking | MediaPipe Holistic, Kalidokit |
| Render   | Three.js, @pixiv/three-vrm |
| Frontend | React, Vite, TypeScript |
| Relay    | Rust — axum, tokio, rustls (ring), rcgen |

## License

MIT
