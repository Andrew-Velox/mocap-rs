#!/usr/bin/env bash
# Downloads the large runtime assets that are NOT committed to git:
#   - MediaPipe model files (.task)
#   - MediaPipe WASM runtime (copied from node_modules)
#   - a sample VRM avatar
#
# Run AFTER `npm install`:  npm run fetch-assets
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules/@mediapipe/holistic ]; then
  echo "error: run 'npm install' first (need @mediapipe/holistic)." >&2
  exit 1
fi

dl() {
  echo "  ↓ $2"
  curl -fL --retry 3 --max-time 120 "$1" -o "$2"
}

echo "[1/2] Copying MediaPipe Holistic runtime + models…"
mkdir -p public/mediapipe/holistic
cp node_modules/@mediapipe/holistic/holistic.js \
   node_modules/@mediapipe/holistic/holistic_solution_* \
   node_modules/@mediapipe/holistic/holistic.binarypb \
   node_modules/@mediapipe/holistic/*.tflite \
   public/mediapipe/holistic/

echo "[2/2] Downloading sample VRM avatars (clean VRoid rigs)…"
mkdir -p public/models
VRM_BASE="https://raw.githubusercontent.com/madjin/vrm-samples/master"
dl "$VRM_BASE/vroid/beta/Sendagaya_Shino.vrm" public/models/shino.vrm
dl "$VRM_BASE/vroid/fem_vroid.vrm"            public/models/fem.vrm
dl "$VRM_BASE/Avatar_Orion.vrm"              public/models/orion.vrm

echo "Done. Assets are in public/. (Swap public/models/avatar.vrm for your own VRM if you like.)"
