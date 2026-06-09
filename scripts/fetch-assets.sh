#!/usr/bin/env bash
# Downloads the large runtime assets that are NOT committed to git:
#   - MediaPipe model files (.task)
#   - MediaPipe WASM runtime (copied from node_modules)
#   - a sample VRM avatar
#
# Run AFTER `npm install`:  npm run fetch-assets
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules/@mediapipe/tasks-vision ]; then
  echo "error: run 'npm install' first (need @mediapipe/tasks-vision)." >&2
  exit 1
fi

dl() {
  echo "  ↓ $2"
  curl -fL --retry 3 --max-time 120 "$1" -o "$2"
}

echo "[1/3] Copying MediaPipe WASM runtime…"
mkdir -p public/mediapipe/wasm
cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/

echo "[2/3] Downloading MediaPipe models…"
mkdir -p public/models/mediapipe
BASE="https://storage.googleapis.com/mediapipe-models"
dl "$BASE/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task" \
   public/models/mediapipe/pose_landmarker_full.task
dl "$BASE/face_landmarker/face_landmarker/float16/latest/face_landmarker.task" \
   public/models/mediapipe/face_landmarker.task
dl "$BASE/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task" \
   public/models/mediapipe/hand_landmarker.task

echo "[3/3] Downloading sample VRM avatar…"
mkdir -p public/models
dl "https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm" \
   public/models/avatar.vrm

echo "Done. Assets are in public/. (Swap public/models/avatar.vrm for your own VRM if you like.)"
