import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { stylists } from "./availability";
import type { SalonDisplayState } from "./display-state";
import { createSalonModel, stationPositions } from "./model";

type Point = [number, number, number];
type Shot = { at: number; position: Point; target: Point; fieldOfView: number; offset: number };

const shots: Shot[] = [
  { at: 0, position: [-1.45, 1.61, 4.07], target: [.46, 1.43, -2.66], fieldOfView: 44, offset: .12 },
  { at: .22, position: [1.13, 1.52, 2.24], target: [2.29, 1.18, .93], fieldOfView: 40, offset: .16 },
  { at: .46, position: [1.95, 1.62, 2.23], target: [2.33, 1.19, .94], fieldOfView: 43, offset: .16 },
  { at: .72, position: [1.02, 1.57, 2.69], target: [.09, 1.48, -2.46], fieldOfView: 45, offset: .16 },
  { at: 1, position: [-1.04, 1.96, 4.51], target: [.65, 1.39, -2.52], fieldOfView: 44, offset: .06 },
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
  let lastDisplay: SalonDisplayState | null = null;
  let changing = false;
  let stationBlend = 0;
  let stationX = 0;
  let contextLost = false;

  function render(progress: number, display: SalonDisplayState, elapsed: number) {
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

    if (!resized && progress === lastProgress && display === lastDisplay && !changing) return false;
    const firstFrame = lastProgress < 0;
    const { lerp, smoothstep } = THREE.MathUtils;
    const station = stylists.find(({ id }) => id === display.slot?.stylistId);
    const desiredBlend = station && progress >= .59 && progress < .86 ? 1 : 0;
    const desiredX = station ? stationPositions[station.station] : stationX;
    const weight = firstFrame ? 1 : -Math.expm1(-elapsed / 190);
    const nextBlend = Math.abs(stationBlend - desiredBlend) < .002 ? desiredBlend : lerp(stationBlend, desiredBlend, weight);
    const nextX = stationBlend === 0 || Math.abs(stationX - desiredX) < .002 ? desiredX : lerp(stationX, desiredX, weight);
    const stationCameraChanged = stationBlend !== nextBlend || stationX !== nextX;
    stationBlend = nextBlend;
    stationX = nextX;
    const movingBetweenStations = stationBlend !== desiredBlend || (stationBlend > 0 && stationX !== desiredX);
    const stationWeight = stationBlend * smoothstep(progress, .51, .72) * (1 - smoothstep(progress, .72, .89));
    const changingMirror = model.update(display, progress, firstFrame ? 10000 : elapsed);
    changing = movingBetweenStations || changingMirror;
    lastDisplay = display;

    if (resized || progress !== lastProgress || stationCameraChanged) {
      const index = Math.max(1, shots.findIndex(({ at }) => at >= progress));
      const from = shots[index - 1];
      const to = shots[index];
      const linear = (progress - from.at) / (to.at - from.at);
      const amount = smoothstep(linear, 0, 1);
      const arc = Math.sin(linear * Math.PI) ** 2;
      const aspect = width / height;
      const wide = width > 790;
      const framing = wide ? lerp(lerp(from.offset, to.offset, amount), .18, stationWeight) : 0;
      const staffWidening = wide ? 7 * (1 - smoothstep(Math.abs(progress - .72), 0, .25)) : 0;
      const portraitFinale = wide ? 0 : smoothstep(progress, .72, 1);
      const fieldOfView = lerp(lerp(from.fieldOfView, to.fieldOfView, amount) + staffWidening + portraitFinale * 5, 44, stationWeight);

      camera.position.set(
        lerp(lerp(from.position[0], to.position[0], amount) + arc * (index % 2 ? -.17 : .23), stationX + .49, stationWeight),
        lerp(lerp(from.position[1], to.position[1], amount) + arc * .09, 1.65, stationWeight),
        lerp(lerp(from.position[2], to.position[2], amount) + arc * .2 + portraitFinale * .65, .57, stationWeight),
      );
      target.set(
        lerp(lerp(from.target[0], to.target[0], amount) + portraitFinale * .4, stationX, stationWeight),
        lerp(lerp(from.target[1], to.target[1], amount), 1.48, stationWeight),
        lerp(lerp(from.target[2], to.target[2], amount), -2.68, stationWeight),
      );
      camera.fov = aspect < 1.3 ? Math.min(64, fieldOfView + (1.3 - aspect) * 27) : fieldOfView;
      camera.lookAt(target);
      camera.setViewOffset(width, height, -framing * width, 0, width, height);
      lastProgress = progress;
    }

    renderer.render(scene, camera);
    return changing;
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
