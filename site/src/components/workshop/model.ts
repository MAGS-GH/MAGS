import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ink, workshopSurfaces } from "./surfaces";

type Point = [number, number, number];

export function createWorkshopModel() {
  const root = new THREE.Group();
  const surfaces = workshopSurfaces();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const matte = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.61, ...options });
    materials.add(material);
    return material;
  };
  const porcelain = matte("#f3decb", { map: surfaces.stone, roughness: 0.69 });
  const walnut = matte("#fff6ed", { map: surfaces.walnut, roughness: 0.47 });
  const ivory = matte("#f6e1ca", { roughness: 0.45 });
  const paper = matte("#fff3df", { roughness: 0.78 });
  const cream = matte("#d0aa90");
  const brown = matte("#553427", { roughness: 0.55 });
  const fileBeige = matte("#b88056");
  const fileTan = matte("#d1a176");
  const fileAccent = matte("#9f694e");
  const copper = matte("#c78e68", { metalness: 0.72, roughness: 0.29 });
  const dark = new THREE.MeshPhysicalMaterial({
    color: ink,
    metalness: 0.14,
    roughness: 0.36,
    clearcoat: 0.55,
    clearcoatRoughness: 0.24,
  });
  materials.add(dark);
  const conveyor = matte("#533b42", { roughness: 0.89 });
  const red = matte("#b43d27", { roughness: 0.62 });
  const redEdge = matte("#b24e36");
  const cordLight = matte("#e76b34", { emissive: "#ff541f", emissiveIntensity: 0.48 });
  const selected = matte("#503654", { emissive: "#402747", emissiveIntensity: 0.14 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#d7a886",
    roughness: 0.30,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
    transparent: true,
    opacity: 0.40,
    depthWrite: false,
  });
  materials.add(glass);
  const glassRim = new THREE.MeshPhysicalMaterial({
    color: "#a8755c",
    metalness: 0.08,
    roughness: 0.28,
    clearcoat: 0.85,
    transparent: true,
    opacity: 0.39,
    depthWrite: false,
  });
  materials.add(glassRim);

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group, point: Point) {
    const piece = new THREE.Mesh(geometry, material);
    piece.position.set(...point);
    piece.castShadow = !material.transparent;
    piece.receiveShadow = true;
    geometries.add(geometry);
    parent.add(piece);
    return piece;
  }

  function box(
    parent: THREE.Group, material: THREE.Material,
    size: Point, point: Point, bevel = 0.06, smooth = 2,
  ) {
    const geometry = bevel > 0
      ? new RoundedBoxGeometry(...size, smooth, bevel)
      : new THREE.BoxGeometry(...size);
    return mesh(geometry, material, parent, point);
  }

  function cylinder(parent: THREE.Group, material: THREE.Material, radius: number, height: number, point: Point) {
    return mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material, parent, point);
  }

  function group(parent: THREE.Group, point: Point, rotation = 0) {
    const child = new THREE.Group();
    child.position.set(...point);
    child.rotation.y = rotation;
    parent.add(child);
    return child;
  }

  function inset(
    parent: THREE.Group, texture: THREE.CanvasTexture,
    width: number, height: number, point: Point,
  ) {
    // Graphics printed on the model remain legible as the camera gets close.
    const material = new THREE.MeshBasicMaterial({
      map: texture, toneMapped: false, alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -1,
    });
    materials.add(material);
    const panel = mesh(new THREE.PlaneGeometry(width, height), material, parent, point);
    panel.castShadow = false;
    panel.receiveShadow = false;
    return panel;
  }

  function plinth(parent: THREE.Group, width: number, depth: number, material = walnut) {
    box(parent, material, [width, 0.20, depth], [0, 0.13, 0], 0.10);
    box(parent, brown, [width - 0.08, 0.045, depth - 0.08], [0, 0.04, 0], 0.022, 1);
  }

  function tube(parent: THREE.Group, path: THREE.Curve<THREE.Vector3>, radius: number, material: THREE.Material, segments: number) {
    return mesh(new THREE.TubeGeometry(path, segments, radius, 7, false), material, parent, [0, 0, 0]);
  }

  function line(parent: THREE.Group, points: Point[], radius: number, material: THREE.Material) {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < points.length; i++) {
      path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    }
    return tube(parent, path, radius, material, points.length - 1);
  }

  function track(points: Point[]) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    tube(root, curve, 0.054, red, 54);
    return curve;
  }

  function badge(parent: THREE.Group, x: number, y: number, z: number, radius = 0.16) {
    const mark = group(parent, [x, y, z]);
    const disc = cylinder(mark, dark, radius, 0.07, [0, 0, 0]);
    disc.rotation.x = Math.PI / 2;
    line(mark, [[-0.074, 0, 0.043], [-0.022, -0.053, 0.043], [0.077, 0.064, 0.043]], 0.017, ivory);
    return mark;
  }

  const contact = new THREE.MeshBasicMaterial({ map: surfaces.shadow, transparent: true, depthWrite: false });
  materials.add(contact);
  const ambientShadow = mesh(new THREE.PlaneGeometry(13.8, 9.1), contact, root, [0.25, -0.546, 0.2]);
  ambientShadow.rotation.x = -Math.PI / 2;
  ambientShadow.receiveShadow = false;
  box(root, walnut, [9.55, 0.26, 6.40], [0, -0.38, 0], 0.13, 3);
  box(root, porcelain, [9.6, 0.32, 6.45], [0, -0.15, 0], 0.16, 3);
  box(root, copper, [9.46, 0.025, 6.31], [0, -0.32, 0], 0.012, 2);
  box(root, brown, [9.2, 0.045, 6.05], [0, -0.52, 0], 0.021, 2);

  const inquiry = group(root, [-3.35, 0, -0.83], -0.20);
  plinth(inquiry, 1.88, 1.10);
  const inquiryScreen = group(inquiry, [0, 1.52, -0.06]);
  inquiryScreen.rotation.x = -0.08;
  box(inquiryScreen, glass, [1.67, 2.56, 0.24], [0, 0, 0], 0.10, 3);
  box(inquiryScreen, glassRim, [1.61, 2.51, 0.18], [0, 0, -0.07], 0.08, 3);
  inset(inquiryScreen, surfaces.form, 1.31, 1.94, [0, -0.08, 0.125]);
  for (const x of [-0.52, -0.38, -0.24]) {
    const dot = cylinder(inquiryScreen, copper, 0.037, 0.022, [x, 1.05, 0.135]);
    dot.rotation.x = Math.PI / 2;
  }
  for (const x of [-0.57, 0.57]) {
    cylinder(inquiry, copper, 0.09, 0.21, [x, 0.31, -0.06]);
  }

  const rail = group(root, [-0.88, 0, -0.89]);
  box(rail, brown, [4.65, 0.18, 0.83], [0.13, 0.26, 0], 0.07, 2);
  box(rail, conveyor, [4.57, 0.09, 0.71], [0.13, 0.40, 0], 0.04);
  for (const z of [-0.44, 0.44]) {
    box(rail, copper, [4.65, 0.12, 0.10], [0.13, 0.38, z], 0.039);
    for (const x of [-2.03, -1.56, 1.39, 1.88, 2.23]) {
      const bolt = cylinder(rail, ivory, 0.042, 0.032, [x, 0.38, z * 1.13]);
      bolt.rotation.x = Math.PI / 2;
    }
  }
  for (const x of [-1.6, -1.20, 1.32, 1.72]) {
    box(rail, copper, [0.017, 0.007, 0.52], [x, 0.448, 0], 0);
  }

  const engine = group(root, [-1.00, 0, -0.88], -0.04);
  plinth(engine, 2.12, 1.76);
  // Three solid pieces form a tunnel through the hub, leaving the conveyor visible.
  for (const z of [-0.63, 0.63]) {
    box(engine, dark, [1.72, 1.19, 0.42], [0, 0.84, z], 0.16, 3);
  }
  box(engine, dark, [1.72, 0.66, 1.68], [0, 1.66, 0], 0.20, 4);
  box(engine, copper, [1.46, 0.077, 0.89], [0, 1.305, 0], 0.033);
  box(engine, cordLight, [1.24, 0.029, 0.17], [0, 1.255, 0], 0.012, 1);
  for (const z of [-0.46, -0.31, -0.16]) {
    box(engine, copper, [0.36, 0.022, 0.034], [-0.36, 1.994, z], 0.009, 1);
  }
  const hubPlate = box(engine, copper, [0.68, 0.49, 0.048], [0, 1.68, 0.842], 0.024);
  hubPlate.castShadow = false;
  box(engine, dark, [0.61, 0.41, 0.053], [0, 1.68, 0.867], 0.026);
  const gearShape = new THREE.Shape();
  for (let step = 0; step <= 32; step++) {
    const angle = step * Math.PI * 2 / 32;
    const radius = step % 4 < 2 ? 0.157 : 0.126;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (step === 0) gearShape.moveTo(x, y);
    else gearShape.lineTo(x, y);
  }
  const gearHole = new THREE.Path();
  gearHole.absarc(0, 0, 0.057, 0, 2 * Math.PI, true);
  gearShape.holes.push(gearHole);
  const gear = mesh(new THREE.ShapeGeometry(gearShape, 12), ivory, engine, [0, 1.68, 0.90]);
  const hubSocket = cylinder(engine, copper, 0.17, 0.075, [0.25, 2.02, 0.07]);
  hubSocket.castShadow = true;
  cylinder(engine, cordLight, 0.098, 0.03, [0.25, 2.067, 0.07]);

  const filing = group(root, [1.82, 0, -1.63], -0.07);
  plinth(filing, 2.06, 1.44);
  box(filing, cream, [1.83, 0.08, 1.19], [0, 0.25, 0], 0.034);
  for (const x of [-0.93, 0.93]) {
    box(filing, glass, [0.087, 0.70, 1.23], [x, 0.61, 0], 0.04, 3);
  }
  box(filing, glassRim, [1.89, 0.55, 0.085], [0, 0.51, 0.58], 0.041, 3);
  const folders: THREE.Group[] = [];
  for (let index = 0; index < 5; index++) {
    const folder = group(filing, [0, 0.61 + 0.045 * (4 - index), -0.47 + index * 0.19]);
    folder.rotation.x = -0.12;
    box(folder, index % 2 === 0 ? fileTan : fileBeige, [1.38, 0.70, 0.105], [0, 0, 0], 0.052, 3);
    box(folder, fileAccent, [0.48, 0.15, 0.10], [-0.38 + (index % 3) * 0.30, 0.34, -0.005], 0.045);
    folders.push(folder);
  }
  const existingCustomer = inset(folders[4], surfaces.customer, 1.22, 0.61, [0, 0, 0.056]);
  const newCase = inset(folders[4], surfaces.caseFile, 0.87, 0.56, [0, 0, 0.058]);
  const inquiryCard = group(root, [0, 0, 0]);
  box(inquiryCard, paper, [0.70, 0.12, 0.48], [0, 0, 0], 0.045);
  const cardFace = inset(inquiryCard, surfaces.caseFile, 0.62, 0.41, [0, 0.062, 0]);
  cardFace.rotation.x = -Math.PI / 2;
  const cardRoute = new THREE.CatmullRomCurve3([
    [-3.20, 1.04, -0.39], [-2.80, 0.62, -0.78], [-1.84, 0.53, -0.86],
    [-0.46, 0.53, -0.86], [0.75, 0.64, -0.95], [1.78, 1.03, -1.11],
  ].map((point) => new THREE.Vector3(...point)));

  const calendar = group(root, [-1.94, 0, 1.78], -0.12);
  plinth(calendar, 2.64, 1.45);
  const calendarScreen = group(calendar, [0, 1.03, -0.07]);
  box(calendarScreen, glass, [2.40, 1.53, 0.21], [0, 0, 0], 0.102, 4);
  box(calendarScreen, glassRim, [2.32, 1.45, 0.14], [0, 0, -0.08], 0.067, 3);
  inset(calendarScreen, surfaces.calendar, 2.15, 1.35, [0, 0, 0.111]);
  const timeBlock = group(calendarScreen, [-0.019, -0.188, 0.145]);
  box(timeBlock, selected, [0.305, 0.16, 0.026], [0, 0, 0], 0.012).castShadow = false;
  const firstSlot = inset(timeBlock, surfaces.firstSlot, 0.28, 0.144, [0, 0, 0.016]);
  const secondSlot = inset(timeBlock, surfaces.secondSlot, 0.28, 0.144, [0, 0, 0.016]);
  const timeConflict = group(calendarScreen, [-0.019, -0.188, 0.144]);
  box(timeConflict, redEdge, [0.305, 0.16, 0.026], [0, 0, 0], 0.012).castShadow = false;
  inset(timeConflict, surfaces.firstSlot, 0.28, 0.144, [0, 0, 0.016]);
  const bookedMark = badge(calendarScreen, 0.81, 0.46, 0.123, 0.102);
  bookedMark.scale.setScalar(0.82);
  for (const x of [-0.86, 0.86]) {
    cylinder(calendar, copper, 0.078, 0.19, [x, 0.29, 0.14]);
  }

  const envelopeStation = group(root, [3.45, 0, 0.46], -0.26);
  plinth(envelopeStation, 1.92, 1.12, porcelain);
  const envelope = group(envelopeStation, [0, 0.84, -0.03]);
  box(envelope, glass, [1.72, 1.06, 0.19], [0, 0, 0], 0.092, 3);
  box(envelope, paper, [1.56, 0.92, 0.091], [0, 0, 0.04], 0.041, 3);
  line(envelope, [[-0.72, 0.34, 0.097], [0, -0.17, 0.104], [0.72, 0.34, 0.097]], 0.016, cream);
  line(envelope, [[-0.71, -0.38, 0.096], [-0.32, 0.01, 0.096]], 0.012, cream);
  line(envelope, [[0.71, -0.38, 0.096], [0.32, 0.01, 0.096]], 0.012, cream);
  const seal = badge(envelope, 0, -0.14, 0.13);

  const taskStation = group(root, [3.30, 0, 2.04], -0.25);
  plinth(taskStation, 2.00, 1.03);
  const task = group(taskStation, [0, 0.64, 0]);
  task.rotation.x = -0.32;
  box(task, glassRim, [1.86, 0.93, 0.17], [0, 0, 0], 0.08, 3);
  inset(task, surfaces.checklist, 1.70, 0.78, [0, 0, 0.09]);

  const mainCord = track([
    [-2.43, 0.18, -0.35], [-1.84, 0.15, 0.03], [-1.45, 0.20, 0.18],
    [-0.86, 0.29, -0.04], [-0.53, 0.67, -0.045], [-0.50, 0.34, 0.10],
    [-0.44, 0.15, 0.53], [-0.62, 0.15, 1.27], [-0.83, 0.25, 1.63],
  ]);
  const outgoingCord = track([
    [-0.73, 0.16, 1.85], [-0.08, 0.14, 2.09], [0.58, 0.14, 1.75], [1.15, 0.13, 1.23],
  ]);
  const inviteCord = track([
    [1.16, 0.14, 1.23], [1.81, 0.13, 1.05], [2.19, 0.13, 0.67],
    [2.74, 0.18, 0.43],
  ]);
  const taskCord = track([
    [1.16, 0.14, 1.23], [1.57, 0.13, 1.79], [2.10, 0.13, 2.12],
    [2.55, 0.19, 2.02],
  ]);
  cylinder(root, copper, 0.18, 0.17, [1.15, 0.115, 1.23]);
  cylinder(root, ivory, 0.095, 0.027, [1.15, 0.211, 1.23]);
  cylinder(root, copper, 0.11, 0.12, [-0.82, 0.18, 1.64]);
  for (const point of [[2.66, 0.15, 0.43], [2.45, 0.15, 2.04]] as Point[]) {
    const clip = cylinder(root, copper, 0.092, 0.21, point);
    clip.rotation.z = Math.PI / 2;
  }
  const signalMaterial = new THREE.MeshBasicMaterial({ color: "#ffd08b", toneMapped: false });
  materials.add(signalMaterial);
  const trailMaterial = matte("#ff6b28", { emissive: "#ff571a", emissiveIntensity: 1.15 });
  const pulseGeometry = new THREE.SphereGeometry(1, 12, 8);
  const signalRoutes = [mainCord, outgoingCord, inviteCord, taskCord].map((curve) => ({
    curve,
    markers: Array.from({ length: 5 }, (_, index) => {
      const marker = mesh(pulseGeometry, index === 0 ? signalMaterial : trailMaterial, root, [0, 0, 0]);
      marker.castShadow = false;
      marker.receiveShadow = false;
      return marker;
    }),
  }));
  const signalLight = new THREE.PointLight("#ff632c", 3.6, 2.2, 2);
  const signalAxis = new THREE.Vector3(1, 0, 0);
  const signalDirection = new THREE.Vector3();
  root.add(signalLight);

  const limit = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
  const interval = (value: number, from: number, to: number) => limit((value - from) / (to - from));
  const ease = (value: number, from: number, to: number) => THREE.MathUtils.smoothstep(value, from, to);

  function moveSignal(routeIndex: number, progress: number, from: number, to: number) {
    const { curve, markers } = signalRoutes[routeIndex];
    const travel = (progress - from) / (to - from);
    markers.forEach((marker, index) => {
      const tail = travel - index * 0.054;
      marker.visible = tail >= 0 && tail <= 1;
      if (!marker.visible) return;
      curve.getPointAt(tail, marker.position);
      marker.position.y += 0.076;
      curve.getTangentAt(tail, signalDirection);
      marker.quaternion.setFromUnitVectors(signalAxis, signalDirection);
      const scale = index === 0 ? 0.15 : 0.09 * (1 - index / markers.length);
      marker.scale.set(scale * (index === 0 ? 1.65 : 1.25), scale, scale);
    });
    return markers[0];
  }

  function update(progress: number, conflict: number) {
    const inquiryFocus = ease(progress, 0.03, 0.22) * (1 - ease(progress, 0.24, 0.40));
    inquiryScreen.position.y = 1.52 + inquiryFocus * 0.19;
    inquiryScreen.rotation.y = 0.23 * inquiryFocus;
    const cardProgress = ease(progress, 0.11, 0.51);
    const cardLift = Math.sin(Math.PI * interval(progress, 0.085, 0.23));
    inquiryCard.visible = progress >= 0.07 && progress < 0.52;
    cardRoute.getPointAt(cardProgress, inquiryCard.position);
    inquiryCard.position.y += 0.42 * cardLift;
    inquiryCard.position.z += 0.31 * cardLift;
    inquiryCard.rotation.set(0.87 * cardLift, -0.2 + cardProgress * 0.45, 0.3 * cardLift);
    inquiryCard.scale.setScalar(Math.max(0.01, (1 + 0.38 * cardLift) * ease(progress, 0.07, 0.14) * (1 - ease(progress, 0.47, 0.52))));
    const processing = ease(progress, 0.26, 0.53);
    gear.rotation.z = -processing * Math.PI * 3;
    newCase.visible = progress >= 0.37;
    existingCustomer.visible = !newCase.visible;
    const filingLift = ease(progress, 0.38, 0.46) * (1 - ease(progress, 0.49, 0.64));
    folders[4].position.y = 0.61 + filingLift * 0.58;
    folders[4].rotation.x = -0.12 + filingLift * 0.24;

    const calendarFocus = ease(progress, 0.48, 0.71) * (1 - ease(progress, 0.77, 0.92));
    calendarScreen.rotation.set(-0.35 + calendarFocus * 0.28, calendarFocus * 0.12, 0);
    calendarScreen.position.y = 1.03 + calendarFocus * 0.20;
    const markScale = ease(progress, 0.52, 0.70);
    timeBlock.position.y = THREE.MathUtils.lerp(-0.188, -0.402, conflict);
    timeBlock.scale.setScalar(Math.max(0.001, markScale));
    timeBlock.visible = markScale > 0;
    firstSlot.visible = conflict < 0.5;
    secondSlot.visible = !firstSlot.visible;
    timeConflict.visible = markScale > 0 && conflict > 0;
    timeConflict.scale.setScalar(Math.max(0.001, markScale * conflict));
    bookedMark.scale.setScalar(Math.max(0.001, ease(progress, 0.65, 0.73) * 0.82));

    const invitationSent = ease(progress, 0.85, 0.96);
    const taskReady = ease(progress, 0.86, 0.99);
    envelope.rotation.x = -0.45 + invitationSent * 0.39;
    envelope.position.y = 0.84 + invitationSent * 0.37;
    seal.scale.setScalar(0.58 + invitationSent * 0.64);
    task.rotation.x = -0.69 + taskReady * 0.54;
    task.position.y = 0.64 + taskReady * 0.28;

    const intake = moveSignal(0, progress, 0.055, 0.72);
    const outgoing = moveSignal(1, progress, 0.72, 0.83);
    const invitation = moveSignal(2, progress, 0.83, 0.97);
    moveSignal(3, progress, 0.83, 1);
    const lead = intake.visible ? intake : outgoing.visible ? outgoing : invitation;
    signalLight.visible = lead.visible;
    if (lead.visible) {
      signalLight.position.copy(lead.position);
      signalLight.position.y += 0.23;
    }
  }

  return {
    root,
    update,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of Object.values(surfaces)) texture.dispose();
    },
  };
}
