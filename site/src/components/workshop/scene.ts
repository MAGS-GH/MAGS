import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createWorkshopModel } from "./model";

type Point = [number, number, number];
type Frame = [number, number];

const cameraPoses: {
  at: number;
  target: Point;
  azimuth: number;
  elevation: number;
  distance: number;
  frame: Frame;
  portrait: Frame;
}[] = [
  { at: 0, target: [0, 0.45, 0], azimuth: 25, elevation: 30, distance: 15.3, frame: [0.67, 0.52], portrait: [0.51, 0.62] },
  { at: 0.22, target: [-2.9, 1.20, -0.68], azimuth: -29, elevation: 17, distance: 6.0, frame: [0.62, 0.42], portrait: [0.49, 0.39] },
  { at: 0.46, target: [0.32, 0.74, -0.97], azimuth: 37, elevation: 44, distance: 7.1, frame: [0.53, 0.40], portrait: [0.49, 0.40] },
  { at: 0.72, target: [-1.73, 1.03, 1.66], azimuth: -19, elevation: 19, distance: 5.65, frame: [0.60, 0.41], portrait: [0.49, 0.38] },
  { at: 1, target: [2.55, 0.68, 1.19], azimuth: 34, elevation: 34, distance: 6.75, frame: [0.54, 0.44], portrait: [0.49, 0.41] },
];

// Each transition adds a curved camera move between the readable chapter frames.
const cameraArcs = [
  { elevation: 13, distance: -1.6, roll: -7.5 },
  { elevation: 20, distance: 1.2, roll: 8 },
  { elevation: 12, distance: -1.15, roll: -7.5 },
  { elevation: 13, distance: 1.4, roll: 8.5 },
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
  renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 150);
  const model = createWorkshopModel();
  scene.add(model.root);

  const studio = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.47;
  scene.environmentRotation.y = -Math.PI / 6;
  studio.dispose();
  generator.dispose();

  // Low window light gives the platform a long shadow; softer fill keeps the labels readable.
  const daylight = new THREE.DirectionalLight("#ffdab9", 3.4);
  daylight.position.set(-7.4, 6.7, 3.1);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1024, 1024);
  daylight.shadow.camera.left = -6.5;
  daylight.shadow.camera.right = 6.5;
  daylight.shadow.camera.top = 5.5;
  daylight.shadow.camera.bottom = -5.5;
  daylight.shadow.camera.near = 2;
  daylight.shadow.camera.far = 20;
  daylight.shadow.camera.updateProjectionMatrix();
  daylight.shadow.bias = -0.0003;
  daylight.shadow.normalBias = 0.035;
  daylight.shadow.radius = 5.5;
  daylight.shadow.intensity = 0.86;
  const fill = new THREE.HemisphereLight("#fff5ee", "#956759", 1.2);
  const rim = new THREE.DirectionalLight("#ffece2", 1.55);
  rim.position.set(4, 5, -7);
  scene.add(daylight, fill, rim);

  const floorGeometry = new THREE.PlaneGeometry(160, 160);
  const floorMaterial = new THREE.ShadowMaterial({ color: "#4e2c24", opacity: 0.24, depthWrite: false });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.550;
  floor.receiveShadow = true;
  scene.add(floor);

  const target = new THREE.Vector3();
  const nextTarget = new THREE.Vector3();
  const orbit = new THREE.Spherical();
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
    const aspect = width / height;
    const fraction = (progress - left.at) / (right.at - left.at);
    const local = THREE.MathUtils.smoothstep(fraction, 0, 1);
    const sweep = Math.sin(Math.PI * fraction) ** 2;
    const arc = cameraArcs[rightIndex - 1];
    const lean = THREE.MathUtils.smoothstep(aspect, 0.65, 1.45);
    const opening = 1 - THREE.MathUtils.smoothstep(progress, 0, cameraPoses[1].at);
    const { lerp, degToRad } = THREE.MathUtils;
    const elevation = lerp(left.elevation, right.elevation, local) + sweep * arc.elevation;
    const distance = lerp(left.distance, right.distance, local) + sweep * arc.distance;
    const portraitFit = Math.max(1, lerp(0.65, 1.04, opening) / aspect);
    orbit.set(distance * portraitFit, degToRad(90 - elevation), degToRad(lerp(left.azimuth, right.azimuth, local)));
    target.set(...left.target).lerp(nextTarget.set(...right.target), local);
    camera.position.setFromSpherical(orbit).add(target);
    camera.lookAt(target);
    camera.rotateZ(degToRad(sweep * arc.roll * lerp(0.45, 1, lean)));

    // Compose the shot around floating page text, which moves above the scene on portrait screens.
    const focusX = lerp(lerp(left.portrait[0], right.portrait[0], local), lerp(left.frame[0], right.frame[0], local), lean);
    const focusY = lerp(lerp(left.portrait[1], right.portrait[1], local), lerp(left.frame[1], right.frame[1], local), lean);
    camera.setViewOffset(width, height, (0.5 - focusX) * width, (0.5 - focusY) * height, width, height);

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
    const pixelBudget = Math.sqrt(3_000_000 / (width * height));
    const pixelRatio = Math.min(window.devicePixelRatio, pixelBudget, width < 500 ? 1 : 1.5);
    renderer.setDrawingBufferSize(width, height, pixelRatio);
    draw();
  }

  function render(nextProgress: number, nextOccupied: boolean) {
    if (disposed || contextLost) return;
    const clampedProgress = THREE.MathUtils.clamp(nextProgress, 0, 1);
    if (rendered && clampedProgress === progress && nextOccupied === occupied) return;
    progress = clampedProgress;
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
