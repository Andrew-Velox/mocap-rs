import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

export type AvatarStatus =
  | { kind: "loading"; progress: number } // 0..1 download progress
  | { kind: "ready"; source: "vrm" | "placeholder" }
  | { kind: "error"; message: string };

export type BackgroundMode =
  | "studio"
  | "green"
  | "blue"
  | "black"
  | "white"
  | "transparent"
  | "camera";

// Clear color + alpha per background. `studio` keeps the CSS radial gradient
// (alpha 0 lets it show); `transparent`/`camera` make the canvas see-through
// (camera shows a live room feed behind); the rest are solid fills.
const BACKGROUNDS: Record<BackgroundMode, { color: number; alpha: number }> = {
  studio: { color: 0x000000, alpha: 0 },
  green: { color: 0x00b140, alpha: 1 },
  blue: { color: 0x0047bb, alpha: 1 },
  black: { color: 0x000000, alpha: 1 },
  white: { color: 0xffffff, alpha: 1 },
  transparent: { color: 0x000000, alpha: 0 },
  camera: { color: 0x000000, alpha: 0 },
};

function applyBackground(
  renderer: THREE.WebGLRenderer,
  mount: HTMLElement,
  mode: BackgroundMode
) {
  const { color, alpha } = BACKGROUNDS[mode];
  renderer.setClearColor(color, alpha);
  const seeThrough = mode === "transparent" || mode === "camera";
  mount.style.background = seeThrough ? "transparent" : "";
  document.body.style.background = mode === "transparent" ? "transparent" : "";
}

// Camera framing per tracking mode — reframes onto the relevant body part
// (tuned for a ~1.5 m VRoid avatar with feet grounded at y=0).
// Avatar render cap (fps). Lower leaves CPU headroom for MediaPipe inference on
// machines without a strong GPU; the avatar still looks smooth at this rate.
const RENDER_FPS_CAP = 45;

export type FramingMode = "face" | "upper" | "full";
const FRAMINGS: Record<FramingMode, { cam: [number, number, number]; target: [number, number, number] }> = {
  face: { cam: [0, 1.42, 0.72], target: [0, 1.42, 0] },
  upper: { cam: [0, 1.2, 1.65], target: [0, 1.12, 0] },
  full: { cam: [0, 1.0, 3.0], target: [0, 0.9, 0] },
};

interface AvatarCanvasProps {
  /** URL of the VRM to load (under /public). */
  modelUrl: string;
  /** Scene background mode. */
  background?: BackgroundMode;
  /** Camera framing (follows the tracking mode). */
  framing?: FramingMode;
  /** Reports load/render status to the parent (status bar). */
  onStatus?: (status: AvatarStatus) => void;
  /**
   * Called once per rendered frame *before* `vrm.update(delta)`. Phase 4 uses
   * this to apply solved pose to the humanoid bones. `vrm` is null while a
   * procedural placeholder is shown.
   */
  onFrame?: (ctx: { vrm: VRM | null; delta: number; time: number }) => void;
}

/**
 * Three.js scene that loads and renders a VRM avatar with orbit controls and
 * studio lighting. Falls back to a simple procedural figure if the VRM cannot
 * be loaded, so the desktop always shows *something*.
 */
export function AvatarCanvas({
  modelUrl,
  background = "studio",
  framing = "full",
  onStatus,
  onFrame,
}: AvatarCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const arVideoRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const framingRef = useRef(framing);
  framingRef.current = framing;
  // Keep the latest onFrame without re-running the heavy setup effect.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  // Apply background changes without rebuilding the scene.
  useEffect(() => {
    const renderer = rendererRef.current;
    const mount = mountRef.current;
    if (renderer && mount) applyBackground(renderer, mount, background);
  }, [background]);

  // "Camera (room)" AR background: show the back camera behind the avatar.
  useEffect(() => {
    const video = arVideoRef.current;
    if (!video) return;
    if (background !== "camera") {
      const s = video.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      video.style.display = "none";
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        video.style.display = "block";
        void video.play();
      })
      .catch((e) => console.warn("AR camera unavailable:", e));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [background]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ─────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    applyBackground(renderer, mount, backgroundRef.current);

    // ── Scene + camera ───────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      30,
      mount.clientWidth / mount.clientHeight,
      0.1,
      20
    );
    const initFraming = FRAMINGS[framingRef.current];
    camera.position.set(...initFraming.cam);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initFraming.target);
    controls.enableDamping = true;
    controls.update();

    // Smooth reframe when the tracking mode changes. While transitioning we
    // drive the camera directly (controls disabled), then hand back to orbit.
    let appliedFraming: FramingMode = framingRef.current;
    let transition = 0; // 0 = idle, else remaining 0..1 progress
    const fromCam = new THREE.Vector3();
    const fromTarget = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const toTarget = new THREE.Vector3();

    // ── Lighting (lightweight — no shadow maps; iGPU friendly) ────────────
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(1, 2, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.4);
    rim.position.set(-2, 1, -1.5);
    scene.add(rim);

    // Ground grid for spatial reference (solid colors, no transparency).
    const grid = new THREE.GridHelper(10, 20, 0x1a2030, 0x12161f);
    scene.add(grid);

    let currentVrm: VRM | null = null;
    let disposed = false;

    function buildPlaceholder() {
      // Minimal humanoid silhouette so the desktop isn't empty.
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x5b8cff,
        roughness: 0.5,
        metalness: 0.1,
      });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 6, 12), mat);
      torso.position.y = 1.05;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), mat);
      head.position.y = 1.5;
      group.add(torso, head);
      scene.add(group);
      return group;
    }

    // ── Load VRM ─────────────────────────────────────────────────────────
    onStatusRef.current?.({ kind: "loading", progress: 0 });
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let placeholder: THREE.Group | null = null;

    const onVrmLoaded = (gltf: { scene: THREE.Object3D; userData: { vrm: VRM } }) => {
      if (disposed) return;
      const vrm = gltf.userData.vrm;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      vrm.scene.traverse((o) => (o.frustumCulled = false));
      // Face the camera. VRM 0.x looks -Z by default; rotate the *scene object*
      // (not the hips bone) 180° so the pose solver can still drive the hips.
      if (vrm.meta?.metaVersion === "0") vrm.scene.rotation.y = Math.PI;
      scene.add(vrm.scene);
      currentVrm = vrm;
      onStatusRef.current?.({ kind: "ready", source: "vrm" });
    };

    const onVrmError = (err: unknown) => {
      if (disposed) return;
      console.warn("VRM load failed, using placeholder:", err);
      placeholder = buildPlaceholder();
      onStatusRef.current?.({ kind: "ready", source: "placeholder" });
    };

    // Stream the download for an accurate, dynamic percentage (GLTFLoader's own
    // onProgress is unreliable with compression), then parse the buffer.
    (async () => {
      try {
        const res = await fetch(modelUrl);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const total = Number(res.headers.get("content-length")) || 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (disposed) return;
          chunks.push(value);
          received += value.length;
          onStatusRef.current?.({
            kind: "loading",
            progress: total > 0 ? received / total : 0,
          });
        }
        if (disposed) return;
        const buf = new Uint8Array(received);
        let off = 0;
        for (const c of chunks) {
          buf.set(c, off);
          off += c.length;
        }
        // resourcePath lets the parser resolve any external refs relative to the
        // model URL (VRMs are self-contained glb, so this is just a safe base).
        const base = modelUrl.slice(0, modelUrl.lastIndexOf("/") + 1);
        loader.parse(buf.buffer, base, onVrmLoaded as never, onVrmError);
      } catch (err) {
        onVrmError(err);
      }
    })();

    // ── Render loop ──────────────────────────────────────────────────────
    // The render loop and MediaPipe inference share the main thread. Capping
    // render frees CPU for inference (tighter tracking) on machines without a
    // strong GPU. We still rAF every frame (cheap) but only do the heavy
    // render/update at the cap; the lerp uses the real delta so smoothing stays
    // frame-rate-independent.
    const clock = new THREE.Clock();
    let raf = 0;
    let acc = 0;
    const frameInterval = 1 / RENDER_FPS_CAP;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      acc += clock.getDelta();
      if (acc < frameInterval) return; // skip — yield the thread to inference
      const delta = acc;
      acc = 0;
      const time = clock.elapsedTime;

      onFrameRef.current?.({ vrm: currentVrm, delta, time });

      // Gentle idle sway for the placeholder so it's clearly "live".
      if (placeholder) placeholder.rotation.y = Math.sin(time * 0.5) * 0.3;

      // Reframe on tracking-mode change.
      if (framingRef.current !== appliedFraming && transition === 0) {
        const to = FRAMINGS[framingRef.current];
        fromCam.copy(camera.position);
        fromTarget.copy(controls.target);
        toCam.set(...to.cam);
        toTarget.set(...to.target);
        appliedFraming = framingRef.current;
        transition = 0.0001;
        controls.enabled = false;
      }
      if (transition > 0) {
        transition = Math.min(1, transition + delta / 0.6); // ~0.6s ease
        const e = transition * transition * (3 - 2 * transition); // smoothstep
        camera.position.lerpVectors(fromCam, toCam, e);
        controls.target.lerpVectors(fromTarget, toTarget, e);
        if (transition >= 1) {
          transition = 0;
          controls.enabled = true;
        }
      }

      currentVrm?.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ───────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    // ── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  return (
    <div ref={mountRef} className="avatar-canvas">
      {/* AR room background (back camera); behind the transparent WebGL canvas */}
      <video ref={arVideoRef} className="ar-bg" playsInline muted style={{ display: "none" }} />
    </div>
  );
}
