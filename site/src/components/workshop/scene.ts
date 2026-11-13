import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createWorkshopModel } from "./model";

const cameraPoses: { at: number; target: [number, number, number]; offset: [number, number, number]; height: number }[] = [
  { at: 0, target: [0.00, 0.30, 0.00], offset: [3.4, 5.6, 9.4], height: 9.24 },
  { at: 0.22, target: [-2.35, 1.00, -0.53], offset: [1.6, 2.7, 7.6], height: 4.6 },
  { at: 0.46, target: [0.10, 0.88, -0.90], offset: [2.5, 3.25, 7.2], height: 5.0 },
  { at: 0.72, target: [-1.61, 0.89, 1.32], offset: [0.5, 2.4, 7.3], height: 4.15 },
  { at: 1, target: [2.06, 0.60, 1.03], offset: [2.1, 3.3, 7.4], height: 4.4 },
];

export function mountWorkshop(canvas: HTMLCanvasElement, onUnavailable: () => void) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 60);
  const model = createWorkshopModel();
  scene.add(model.root);

  const studio = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  studio.dispose();
  generator.dispose();

  const daylight = new THREE.DirectionalLight("#fff1e4", 2.85);
  daylight.position.set(-5.5, 10, 3);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1024, 1024);
  daylight.shadow.camera.left = -7;
  daylight.shadow.camera.right = 7;
  daylight.shadow.camera.top = 6;
  daylight.shadow.camera.bottom = -6;
  daylight.shadow.camera.far = 28;
  daylight.shadow.bias = -0.00055;
  daylight.shadow.normalBias = 0.045;
  daylight.shadow.radius = 4;
  const fill = new THREE.HemisphereLight("#fff7ed", "#a47969", 1.72);
  const rim = new THREE.DirectionalLight("#ffe6d0", 1.40);
  rim.position.set(4, 5, -6);
  scene.add(daylight, fill, rim);

  const floorGeometry = new THREE.PlaneGeometry(160, 160);
  const floorMaterial = new THREE.ShadowMaterial({ color: "#483225", opacity: 0.24 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.609;
  floor.receiveShadow = true;
  scene.add(floor);

  const target = new THREE.Vector3();
  const offset = new THREE.Vector3();
  let width = 0;
  let height = 0;
  let progress = 0;
  let occupied = false;
  let displayedConflict = 0;
  let transition = 0;
  let frame = 0;
  let rendered = false;
  let disposed = false;
  let contextLost = false;

  function draw() {
    if (disposed || contextLost || document.hidden || width === 0 || height === 0) return;
    const rightIndex = Math.max(1, cameraPoses.findIndex((pose) => pose.at >= progress));
    const left = cameraPoses[rightIndex - 1];
    const right = cameraPoses[rightIndex];
    const local = THREE.MathUtils.smoothstep(progress, left.at, right.at);
    target.set(...left.target).lerp(offset.set(...right.target), local);
    offset.set(...left.offset);
    offset.x = THREE.MathUtils.lerp(offset.x, right.offset[0], local);
    offset.y = THREE.MathUtils.lerp(offset.y, right.offset[1], local);
    offset.z = THREE.MathUtils.lerp(offset.z, right.offset[2], local);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);

    const aspect = width / height;
    const halfHeight = THREE.MathUtils.lerp(left.height, right.height, local) / 2
      * Math.max(1, 1.3 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();

    model.update(progress, displayedConflict);
    renderer.render(scene, camera);
    rendered = true;
  }

  function resize() {
    const nextWidth = Math.round(canvas.clientWidth);
    const nextHeight = Math.round(canvas.clientHeight);
    if (nextWidth < 1 || nextHeight < 1 || (width === nextWidth && height === nextHeight)) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 500 ? 1 : 1.5));
    renderer.setSize(width, height, false);
    draw();
  }

  function render(nextProgress: number, nextOccupied: boolean) {
    if (disposed || contextLost) return;
    progress = THREE.MathUtils.clamp(nextProgress, 0, 1);
    if (nextOccupied !== occupied) {
      occupied = nextOccupied;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      const end = occupied ? 1 : 0;
      if (rendered && progress >= 0.51 && progress < 0.84) {
        const start = displayedConflict;
        transition = performance.now();
        const animate = (now: number) => {
          frame = 0;
          const tween = THREE.MathUtils.smoothstep(now - transition, 0, 325);
          displayedConflict = THREE.MathUtils.lerp(start, end, tween);
          draw();
          if (tween < 1 && !document.hidden && !contextLost) frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      } else {
        displayedConflict = end;
      }
    }
    draw();
  }

  function handleContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    if (frame) cancelAnimationFrame(frame);
    onUnavailable();
  }

  function handleVisibility() {
    if (!document.hidden) {
      if (!frame) displayedConflict = occupied ? 1 : 0;
      draw();
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener("webglcontextlost", handleContextLost);
  document.addEventListener("visibilitychange", handleVisibility);
  resize();

  return {
    render,
    dispose() {
      disposed = true;
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (frame) cancelAnimationFrame(frame);
      model.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      daylight.shadow.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
