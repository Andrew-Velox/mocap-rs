import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

export type AvatarStatus =
  | { kind: "loading" }
  | { kind: "ready"; source: "vrm" | "placeholder" }
  | { kind: "error"; message: string };

interface AvatarCanvasProps {
  /** URL of the VRM to load (under /public). */
  modelUrl: string;
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
export function AvatarCanvas({ modelUrl, onStatus, onFrame }: AvatarCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Keep the latest onFrame without re-running the heavy setup effect.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ─────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ── Scene + camera ───────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      30,
      mount.clientWidth / mount.clientHeight,
      0.1,
      20
    );
    camera.position.set(0, 1.35, 2.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = true;
    controls.update();

    // ── Lighting (lightweight — no shadow maps; iGPU friendly) ────────────
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(1, 2, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.4);
    rim.position.set(-2, 1, -1.5);
    scene.add(rim);

    // Ground grid for spatial reference.
    const grid = new THREE.GridHelper(10, 20, 0x223044, 0x16202c);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
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
    onStatusRef.current?.({ kind: "loading" });
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let placeholder: THREE.Group | null = null;

    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        const vrm = gltf.userData.vrm as VRM;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        vrm.scene.traverse((o) => (o.frustumCulled = false));
        // Face the camera. VRM 0.x looks -Z by default; rotate the *scene
        // object* (not the hips bone) 180° so the pose solver can still drive
        // the hips freely. (Using VRMUtils.rotateVRM0 bakes the turn into the
        // hips bone, which then fights the per-frame hips slerp and twists the
        // body off-axis — this matches SysMoCap's approach.)
        if (vrm.meta?.metaVersion === "0") {
          vrm.scene.rotation.y = Math.PI;
        }
        scene.add(vrm.scene);
        currentVrm = vrm;
        onStatusRef.current?.({ kind: "ready", source: "vrm" });
      },
      undefined,
      (err) => {
        if (disposed) return;
        console.warn("VRM load failed, using placeholder:", err);
        placeholder = buildPlaceholder();
        onStatusRef.current?.({ kind: "ready", source: "placeholder" });
      }
    );

    // ── Render loop ──────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.elapsedTime;

      onFrameRef.current?.({ vrm: currentVrm, delta, time });

      // Gentle idle sway for the placeholder so it's clearly "live".
      if (placeholder) placeholder.rotation.y = Math.sin(time * 0.5) * 0.3;

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

  return <div ref={mountRef} className="avatar-canvas" />;
}
