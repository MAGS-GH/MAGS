import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createSalonModel } from "./model";

export type SalonSceneState = { station: number | null; confirmed: boolean };

type Point = [number, number, number];
type Shot = { at: number; position: Point; target: Point; fieldOfView: number; offset: number };

const shots: Shot[] = [
  { at: 0, position: [-1.45, 1.61, 4.07], target: [.46, 1.43, -2.66], fieldOfView: 44, offset: .12 },
  { at: .22, position: [.86, 1.65, 2.56], target: [2.48, 1.04, .82], fieldOfView: 42, offset: .16 },
  { at: .46, position: [1.64, 1.52, 2.22], target: [-.28, 1.36, -2.29], fieldOfView: 48, offset: .12 },
  { at: .72, position: [-1.43, 1.79, 1.04], target: [.41, 1.22, -2.22], fieldOfView: 47, offset: .14 },
  { at: 1, position: [-1.17, 1.99, 4.37], target: [.48, 1.39, -2.64], fieldOfView: 43, offset: .1 },
];

export async function mountSalon(canvas: HTMLCanvasElement, onUnavailable: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ac9b85");
  const camera = new THREE.PerspectiveCamera(40, 1, .08, 45);
  let model: Awaited<ReturnType<typeof createSalonModel>>;
  try {
    model = await createSalonModel();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  scene.add(model.root);

  const studio = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, .06);
  scene.environment = environment.texture;
  scene.environmentIntensity = .36;
  scene.environmentRotation.y = Math.PI * .32;
  studio.dispose();
  generator.dispose();

  const sun = new THREE.DirectionalLight("#ffe3bf", 2.15);
  sun.position.set(-6.5, 5.1, 2.65);
  sun.target.position.set(1, .1, -1.05);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -6.8;
  sun.shadow.camera.right = 6.8;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -.00024;
  sun.shadow.normalBias = .022;
  sun.shadow.radius = 3.5;
  sun.shadow.intensity = .78;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  const windowLight = new THREE.RectAreaLight("#fff2dd", 4.1, 4.6, 2.3);
  windowLight.position.set(-4.19, 1.75, -.35);
  windowLight.lookAt(.5, 1, -.55);
  const bouncedLight = new THREE.HemisphereLight("#fbf3e6", "#a08a6f", .88);
  const ceilingBounce = new THREE.RectAreaLight("#fff3df", 1.38, 4.8, 3.3);
  ceilingBounce.position.set(.6, 3.13, -.75);
  ceilingBounce.lookAt(.55, .65, -1.7);
  scene.add(sun, sun.target, windowLight, bouncedLight, ceilingBounce);

  const target = new THREE.Vector3();
  let width = 0;
  let height = 0;
  let lastProgress = -1;
  let lastStation: number | null = null;
  let lastConfirmed = false;
  let changingLight = false;
  let contextLost = false;

  function render(progress: number, { station, confirmed }: SalonSceneState, elapsed: number) {
    if (contextLost || document.hidden) return false;
    const newWidth = canvas.clientWidth;
    const newHeight = canvas.clientHeight;
    if (!newWidth || !newHeight) return false;
    const resized = width !== newWidth || height !== newHeight;
    if (resized) {
      width = newWidth;
      height = newHeight;
      const pixelRatio = Math.min(window.devicePixelRatio, width < 790 ? 1.25 : 1.5, Math.sqrt(2_500_000 / (width * height)));
      renderer.setDrawingBufferSize(width, height, pixelRatio);
      model.resize(width);
    }

    const highlighted = progress >= .32 ? station : null;
    const booked = confirmed && progress >= .82;
    const changedLight = highlighted !== lastStation || booked !== lastConfirmed || changingLight;
    if (!resized && progress === lastProgress && !changedLight) return false;
    changingLight = model.update(highlighted, booked, lastProgress < 0 ? 10000 : elapsed);
    lastStation = highlighted;
    lastConfirmed = booked;

    if (resized || progress !== lastProgress) {
      const index = Math.max(1, shots.findIndex(({ at }) => at >= progress));
      const from = shots[index - 1];
      const to = shots[index];
      const linear = (progress - from.at) / (to.at - from.at);
      const amount = THREE.MathUtils.smoothstep(linear, 0, 1);
      const arc = Math.sin(linear * Math.PI) ** 2;
      const { lerp } = THREE.MathUtils;
      const aspect = width / height;
      const wide = width > 790;
      const framing = wide ? lerp(from.offset, to.offset, amount) : 0;
      const fieldOfView = lerp(from.fieldOfView, to.fieldOfView, amount);

      camera.position.set(
        lerp(from.position[0], to.position[0], amount) + arc * (index % 2 ? -.17 : .23),
        lerp(from.position[1], to.position[1], amount) + arc * .09,
        lerp(from.position[2], to.position[2], amount) + arc * .2,
      );
      target.set(
        lerp(from.target[0], to.target[0], amount),
        lerp(from.target[1], to.target[1], amount),
        lerp(from.target[2], to.target[2], amount),
      );
      camera.fov = aspect < 1.3 ? Math.min(64, fieldOfView + (1.3 - aspect) * 27) : fieldOfView;
      camera.lookAt(target);
      camera.setViewOffset(width, height, -framing * width, 0, width, height);
      lastProgress = progress;
    }

    renderer.render(scene, camera);
    return changingLight;
  }

  function handleContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    onUnavailable();
  }
  canvas.addEventListener("webglcontextlost", handleContextLost);

  return {
    render,
    dispose() {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      model.dispose();
      sun.shadow.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
