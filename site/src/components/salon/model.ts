import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { stylists, treatments } from "./availability";
const stationPositions = [-2.5, -0.15, 2.2];

function paintTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void, color = true) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Salon texture canvas is unavailable");
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function noise(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function arch(width: number, height: number, depth: number) {
  const radius = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-radius, -height / 2);
  shape.lineTo(radius, -height / 2);
  shape.lineTo(radius, height / 2 - radius);
  shape.absarc(0, height / 2 - radius, radius, 0, Math.PI, false);
  shape.closePath();
  return depth === 0
    ? new THREE.ShapeGeometry(shape, 20)
    : new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20, steps: 1 });
}

export async function createSalonModel() {
  const root = new THREE.Group();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const textures: THREE.Texture[] = [];
  const boxes = new Map<string, THREE.BufferGeometry>();
  const cylinders = new Map<string, THREE.BufferGeometry>();

  function storeGeometry<T extends THREE.BufferGeometry>(geometry: T) {
    geometries.push(geometry);
    return geometry;
  }

  function storeMaterial<T extends THREE.Material>(material: T) {
    materials.push(material);
    return material;
  }

  function texture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void, color = true) {
    const image = paintTexture(width, height, draw, color);
    textures.push(image);
    return image;
  }

  const standard = (properties: THREE.MeshStandardMaterialParameters) => storeMaterial(new THREE.MeshStandardMaterial(properties));
  const physical = (properties: THREE.MeshPhysicalMaterialParameters) => storeMaterial(new THREE.MeshPhysicalMaterial(properties));
  const basic = (properties: THREE.MeshBasicMaterialParameters) => storeMaterial(new THREE.MeshBasicMaterial(properties));

  const textureLoader = new THREE.TextureLoader();
  async function photograph(name: string, color: boolean, repeatX = 1, repeatY = 1) {
    try {
      const image = await textureLoader.loadAsync(`/salon/materials/${name}.webp`);
      if (color) image.colorSpace = THREE.SRGBColorSpace;
      image.anisotropy = 8;
      image.wrapS = image.wrapT = THREE.RepeatWrapping;
      image.repeat.set(repeatX, repeatY);
      textures.push(image);
      return image;
    } catch {
      return undefined;
    }
  }

  // CC0 Poly Haven scans: oak_wood_planks, white_oak_veneer and beige_wall_001.
  const [floorMap, floorNormal, oakMap, oakNormal, plasterMap, plasterNormal] = await Promise.all([
    photograph("floor-color", true, 3, 3.4),
    photograph("floor-normal", false, 3, 3.4),
    photograph("oak-color", true),
    photograph("oak-normal", false),
    photograph("plaster-color", true, 4, 2),
    photograph("plaster-normal", false, 4, 2),
  ]);
  const fineGrain = texture(256, 256, (context) => {
    const random = noise(91823);
    const image = context.createImageData(256, 256);
    for (let i = 0; i < image.data.length; i += 4) {
      const level = 113 + Math.floor(random() * 28);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = level;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }, false);
  fineGrain.wrapS = fineGrain.wrapT = THREE.RepeatWrapping;
  fineGrain.repeat.set(7, 7);
  const leatherMap = texture(512, 512, (context) => {
    const random = noise(12221);
    context.fillStyle = "#b88159";
    context.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 17000; i++) {
      context.fillStyle = random() > .52 ? "rgba(94, 54, 38, .12)" : "rgba(251, 193, 137, .13)";
      context.beginPath();
      context.ellipse(random() * 512, random() * 512, .5 + random() * 2.5, .4 + random() * 1.4, random() * 2.7, 0, Math.PI * 2);
      context.fill();
    }
  });
  const leatherBump = texture(256, 256, (context) => {
    const random = noise(3758);
    context.fillStyle = "#929292";
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) {
      context.fillStyle = random() > .5 ? "#a3a3a3" : "#747474";
      context.fillRect(random() * 256, random() * 256, 1 + random(), 1);
    }
  }, false);

  const oak = standard({ color: oakMap ? "#f1e6d8" : "#c29a72", map: oakMap ?? null, normalMap: oakNormal ?? null, normalScale: new THREE.Vector2(.5, .5), roughness: .72 });
  const oiledOak = standard({ color: oakMap ? "#ceb199" : "#a27758", map: oakMap ?? null, normalMap: oakNormal ?? null, normalScale: new THREE.Vector2(.42, .42), roughness: .52 });
  const floor = standard({ color: floorMap ? "#efebdf" : "#b69577", map: floorMap ?? null, normalMap: floorNormal ?? null, normalScale: new THREE.Vector2(.8, .8), roughness: .62 });
  const plaster = standard({ color: plasterMap ? "#fff8ed" : "#ece3d5", map: plasterMap ?? null, normalMap: plasterNormal ?? null, normalScale: new THREE.Vector2(.55, .55), roughness: .96 });
  const windowPlaster = standard({ color: "#d9cdb8", roughness: .88, bumpMap: fineGrain, bumpScale: .01 });
  const stone = standard({ color: "#c9b7a4", roughness: .72, bumpMap: fineGrain, bumpScale: .024 });
  const ivory = standard({ color: "#eae2d1", roughness: .83 });
  const linen = standard({ color: "#c4aa88", roughness: 1, bumpMap: fineGrain, bumpScale: .022 });
  const matteBlack = standard({ color: "#25241e", roughness: .63, metalness: .25 });
  const bronze = standard({ color: "#a68155", metalness: .79, roughness: .32 });
  const chrome = standard({ color: "#e5dfd8", metalness: .94, roughness: .22, envMapIntensity: 1.5 });
  const tintGlass = physical({ color: "#e1e9de", roughness: .06, metalness: .08, transparent: true, opacity: .12, depthWrite: false });
  const leather = physical({ color: "#bd957a", map: leatherMap, bumpMap: leatherBump, bumpScale: .012, roughness: .63, clearcoat: .08, sheen: .24, sheenColor: new THREE.Color("#b88d6c"), sheenRoughness: .83 });
  const leatherEdge = physical({ color: "#885135", roughness: .72, sheen: .19 });
  const ceramic = standard({ color: "#d3c2a9", roughness: .81, bumpMap: fineGrain, bumpScale: .024 });
  const earth = standard({ color: "#423423", roughness: 1 });
  const lampGlow = basic({ color: "#ffe8bb", toneMapped: false });

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group, x: number, y: number, z: number, shadow = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = shadow;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(parent: THREE.Group, material: THREE.Material, size: [number, number, number], at: [number, number, number], radius = 0, shadow = true) {
    const key = [...size, radius].join("/");
    let geometry = boxes.get(key);
    if (!geometry) {
      geometry = storeGeometry(radius ? new RoundedBoxGeometry(...size, 2, radius) : new THREE.BoxGeometry(...size));
      boxes.set(key, geometry);
    }
    return mesh(geometry, material, parent, ...at, shadow);
  }

  function cylinder(parent: THREE.Group, material: THREE.Material, top: number, bottom: number, height: number, at: [number, number, number], shadow = true) {
    const key = [top, bottom, height].join("/");
    let geometry = cylinders.get(key);
    if (!geometry) {
      geometry = storeGeometry(new THREE.CylinderGeometry(top, bottom, height, 24));
      cylinders.set(key, geometry);
    }
    return mesh(geometry, material, parent, ...at, shadow);
  }

  function group(parent: THREE.Group, x: number, y: number, z: number) {
    const child = new THREE.Group();
    child.position.set(x, y, z);
    parent.add(child);
    return child;
  }

  const floorPlane = storeGeometry(new THREE.PlaneGeometry(8.6, 6.7));
  mesh(floorPlane, floor, root, 0, 0, .05, false).rotation.x = -Math.PI / 2;
  box(root, matteBlack, [8.6, .11, 6.7], [0, -.075, .05], .015, false);
  box(root, plaster, [8.6, 3.27, .18], [0, 1.63, -3.32], 0, false);
  box(root, windowPlaster, [.14, 3.27, 3.83], [4.31, 1.63, -1.46], 0, false);
  box(root, windowPlaster, [.16, 3.27, 1.07], [-4.31, 1.63, -2.82], 0, false);
  box(root, windowPlaster, [.16, 3.27, .50], [-4.31, 1.63, 3.16], 0, false);
  box(root, windowPlaster, [.16, .31, 5.24], [-4.31, .15, .31], 0, false);
  box(root, windowPlaster, [.16, .33, 5.24], [-4.31, 3.105, .31], 0, false);
  box(root, oiledOak, [8.56, .10, .055], [0, .055, -3.185], .009, false);
  box(root, oiledOak, [.055, .10, 3.8], [4.215, .055, -1.43], .009, false);
  box(root, ivory, [8.54, .12, .25], [0, 3.185, -3.12], 0, false);
  box(root, ivory, [.25, .12, 6.64], [-4.165, 3.185, 0], 0, false);
  box(root, ivory, [.24, .12, 3.79], [4.16, 3.185, -1.43], 0, false);
  box(root, ivory, [8.60, .16, 6.68], [0, 3.28, .025], 0, false);

  const outsideMap = texture(1024, 512, (context) => {
    const sky = context.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#c6d5d7");
    sky.addColorStop(.55, "#f7f1df");
    sky.addColorStop(1, "#bdb7a1");
    context.fillStyle = sky;
    context.fillRect(0, 0, 1024, 512);
    const random = noise(243);
    context.filter = "blur(10px)";
    for (let i = 0; i < 17; i++) {
      const x = random() * 1024;
      const canopy = 85 + random() * 145;
      context.fillStyle = i % 3 === 0 ? "#a29e75" : i % 3 === 1 ? "#aeb493" : "#c1c4a1";
      context.fillRect(x, 332, 4 + random() * 15, 180);
      context.beginPath();
      context.ellipse(x, 378 + random() * 100, canopy * .65, canopy, -.4 + random() * .8, 0, Math.PI * 2);
      context.fill();
    }
    context.filter = "none";
  });
  mesh(storeGeometry(new THREE.PlaneGeometry(8.3, 4.5)), basic({ map: outsideMap, toneMapped: false }), root, -5.9, 1.86, .2, false).rotation.y = Math.PI / 2;
  mesh(storeGeometry(new THREE.PlaneGeometry(5.2, 2.62)), tintGlass, root, -4.36, 1.62, .30, false).rotation.y = Math.PI / 2;
  for (const z of [-2.28, -.98, .31, 1.60, 2.90]) box(root, matteBlack, [.10, 2.64, .047], [-4.245, 1.62, z], .003, false);
  for (const y of [.31, 2.23, 2.94]) box(root, matteBlack, [.10, .047, 5.2], [-4.245, y, .31], .003, false);
  box(root, oak, [.30, .05, 5.23], [-4.155, .31, .31], .008, false);

  // Warm strip lighting and spot fixtures give the daylight an architectural counterpoint.
  box(root, lampGlow, [8.32, .019, .035], [0, 3.105, -3.045], .006, false);
  for (const z of [-1.90, .70]) {
    box(root, matteBlack, [6.3, .029, .065], [-.10, 3.085, z], .007, false);
    for (const x of [-2.4, -.3, 1.8]) {
      cylinder(root, matteBlack, .058, .058, .15, [x, 3.001, z], false);
      cylinder(root, lampGlow, .039, .039, .005, [x, 2.924, z], false);
    }
  }

  const contactMap = texture(96, 96, (context) => {
    const shadow = context.createRadialGradient(48, 48, 2, 48, 48, 48);
    shadow.addColorStop(0, "rgba(33, 23, 14, .58)");
    shadow.addColorStop(.48, "rgba(33, 23, 14, .29)");
    shadow.addColorStop(1, "rgba(33, 23, 14, 0)");
    context.fillStyle = shadow;
    context.fillRect(0, 0, 96, 96);
  });
  const contact = basic({ map: contactMap, transparent: true, depthWrite: false });
  const contactPlane = storeGeometry(new THREE.PlaneGeometry(1.28, 1.28));

  const mirrorFrame = storeGeometry(arch(1.38, 1.72, .025));
  const mirrorHalo = storeGeometry(arch(1.294, 1.634, .022));
  const mirrorFace = storeGeometry(arch(1.244, 1.585, 0));
  const fauxMirrorMap = texture(320, 400, (context) => {
    const wash = context.createLinearGradient(0, 0, 310, 400);
    wash.addColorStop(0, "#dddbd0");
    wash.addColorStop(.27, "#aca394");
    wash.addColorStop(.57, "#c9bbaa");
    wash.addColorStop(1, "#91816f");
    context.fillStyle = wash;
    context.fillRect(0, 0, 320, 400);
    const angle = context.createLinearGradient(60, 0, 240, 0);
    angle.addColorStop(0, "rgba(248,248,230,0)");
    angle.addColorStop(.35, "rgba(250,247,218,.45)");
    angle.addColorStop(.43, "rgba(250,246,218,.32)");
    angle.addColorStop(.55, "rgba(248,248,230,0)");
    context.fillStyle = angle;
    context.fillRect(0, 0, 320, 400);
  });
  const mirrorUvs = mirrorFace.getAttribute("uv");
  for (let index = 0; index < mirrorUvs.count; index++) {
    mirrorUvs.setXY(index, mirrorUvs.getX(index) / 1.244 + .5, mirrorUvs.getY(index) / 1.585 + .5);
  }
  const mirrorGlass = physical({ color: "#ddd8cb", map: fauxMirrorMap, metalness: .65, roughness: .11, envMapIntensity: .76, clearcoat: 1 });
  const mirrorLights: THREE.MeshBasicMaterial[] = [];
  const plateColors = ["#594334", "#4d5448", "#3a4443"];
  const nameGeometry = storeGeometry(new THREE.PlaneGeometry(.31, .076));
  const amberBottle = standard({ color: "#71503a", roughness: .40 });
  const greenBottle = standard({ color: "#495542", roughness: .46 });

  function bottle(parent: THREE.Group, x: number, y: number, z: number, color: THREE.Material, tall: boolean) {
    const height = tall ? .19 : .135;
    cylinder(parent, color, .044, .049, height, [x, y + height / 2, z]);
    cylinder(parent, matteBlack, .027, .027, .036, [x, y + height + .013, z]);
    cylinder(parent, ivory, .046, .048, .050, [x, y + .078, z], false);
    if (tall) box(parent, matteBlack, [.062, .017, .024], [x + .015, y + height + .036, z], .006);
  }

  function chair(parent: THREE.Group, x: number, z: number, rotation: number) {
    mesh(contactPlane, contact, parent, x, .002, z, false).rotation.x = -Math.PI / 2;
    const seat = group(parent, x, 0, z);
    seat.rotation.y = rotation;
    cylinder(seat, matteBlack, .335, .365, .034, [0, .025, 0]);
    cylinder(seat, chrome, .335, .354, .046, [0, .060, 0]);
    cylinder(seat, chrome, .080, .107, .37, [0, .264, 0]);
    cylinder(seat, chrome, .047, .055, .17, [0, .513, 0]);
    box(seat, matteBlack, [.44, .07, .42], [0, .557, 0], .025);
    box(seat, leatherEdge, [.69, .10, .63], [0, .612, -.035], .045);
    box(seat, leather, [.696, .123, .646], [0, .680, -.039], .055);
    const back = group(seat, 0, .855, .245);
    back.rotation.x = -.135;
    box(back, leatherEdge, [.711, .447, .125], [0, .111, .017], .061);
    box(back, leather, [.685, .418, .150], [0, .113, -.029], .062);
    box(back, leatherEdge, [.561, .014, .014], [0, .095, -.105], .005, false);
    for (const x of [-.345, .345]) {
      box(seat, chrome, [.044, .205, .044], [x, .741, -.174], .018);
      box(seat, chrome, [.044, .205, .044], [x, .741, .132], .018);
      box(seat, leatherEdge, [.091, .069, .425], [x, .860, -.024], .028);
      box(seat, leather, [.094, .045, .424], [x, .886, -.024], .021);
    }
    for (const x of [-.245, .245]) {
      const bar = box(seat, chrome, [.027, .371, .027], [x, .425, -.353], .011);
      bar.rotation.x = .46;
    }
    box(seat, chrome, [.529, .025, .047], [0, .254, -.442], .011);
    box(seat, matteBlack, [.377, .026, .111], [0, .267, -.442], .009);
    cylinder(seat, chrome, .015, .015, .22, [.16, .40, .14]).rotation.z = Math.PI / 2.5;
    cylinder(seat, matteBlack, .029, .029, .04, [.255, .442, .14]);
  }

  const stations: THREE.Group[] = [];
  const mirroredFaces: THREE.Mesh[] = [];
  for (const [index, x] of stationPositions.entries()) {
    const station = group(root, x, 0, -3.09);
    stations.push(station);
    const halo = basic({ color: "#ffdda4", toneMapped: false });
    mirrorLights.push(halo);
    mesh(mirrorFrame, bronze, station, 0, 1.93, 0);
    mesh(mirrorHalo, halo, station, 0, 1.93, .026, false);
    const face = mesh(mirrorFace, mirrorGlass, station, 0, 1.93, .051, false);
    mirroredFaces.push(face);
    box(station, matteBlack, [.338, .093, .026], [0, 1.017, .021], .009);
    const name = texture(256, 64, (context) => {
      context.fillStyle = plateColors[index];
      context.fillRect(0, 0, 256, 64);
      context.fillStyle = "#f5ddbc";
      context.font = "500 29px Georgia, serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(stylists[index].name, 128, 34);
    });
    mesh(nameGeometry, basic({ map: name, toneMapped: false }), station, 0, 1.017, .037, false);
    box(station, oak, [1.74, .108, .444], [0, .899, .178], .020);
    box(station, oiledOak, [1.51, .163, .312], [0, .791, .14], .018);
    box(station, bronze, [.228, .014, .022], [0, .815, .302], .006, false);
    box(station, matteBlack, [.31, .018, .170], [-.55, .967, .21], .009);
    bottle(station, -.62, .979, .209, amberBottle, true);
    bottle(station, -.50, .979, .219, greenBottle, false);
    box(station, linen, [.221, .064, .186], [.59, .976, .229], .029);
    box(station, ivory, [.212, .051, .177], [.59, 1.025, .23], .025);
    box(station, ivory, [.184, .020, .014], [.59, 1.014, .315], .006, false);
    chair(root, x + (index === 2 ? .06 : 0), -1.56, [.08, -.09, -.12][index]);
  }

  // Only the centre mirror incurs a reflection pass, and only on wide viewports.
  const reflector = new Reflector(mirrorFace, { color: "#e1d7c7", textureWidth: 320, textureHeight: 408, multisample: 0 });
  reflector.position.set(0, 1.93, .053);
  reflector.visible = false;
  stations[1].add(reflector);

  const trolley = group(root, -3.44, 0, -1.99);
  const trolleyTray = standard({ color: "#3d3b31", metalness: .22, roughness: .61 });
  for (const y of [.29, .55, .81]) {
    box(trolley, trolleyTray, [.40, .044, .49], [0, y, 0], .013);
    box(trolley, matteBlack, [.40, .054, .019], [0, y + .025, .23], .007);
  }
  for (const x of [-.168, .168]) {
    for (const z of [-.196, .196]) {
      cylinder(trolley, matteBlack, .012, .012, .785, [x, .455, z]);
      cylinder(trolley, matteBlack, .047, .047, .034, [x, .06, z]).rotation.z = Math.PI / 2;
    }
  }
  box(trolley, linen, [.18, .046, .211], [.072, .594, .075], .016);
  bottle(trolley, -.105, .833, -.12, amberBottle, true);
  bottle(trolley, .002, .833, -.12, greenBottle, false);

  // The entrance-side reception has rounded stone edges and a slatted oak front.
  const reception = group(root, 2.72, 0, .93);
  reception.rotation.y = -.14;
  const receptionShadow = mesh(contactPlane, contact, reception, 0, .003, .03, false);
  receptionShadow.rotation.x = -Math.PI / 2;
  receptionShadow.scale.set(1.94, .86, 1);
  box(reception, oiledOak, [1.89, .115, .648], [0, .063, 0], .041);
  box(reception, oak, [1.97, .94, .698], [0, .537, 0], .087);
  box(reception, stone, [2.03, .105, .782], [0, 1.001, .012], .038);
  for (let index = 0; index < 29; index++) {
    const x = (index - 14) * .061;
    box(reception, index % 4 === 0 ? oiledOak : oak, [.036, .842, .025], [x, .541, .355], .010, false);
  }
  const tablet = group(reception, -.44, 1.23, .018);
  tablet.rotation.x = -.25;
  box(reception, matteBlack, [.208, .020, .171], [-.44, 1.066, -.015], .010);
  box(reception, matteBlack, [.051, .16, .052], [-.44, 1.143, -.044], .014).rotation.x = -.20;
  box(tablet, matteBlack, [.455, .322, .036], [0, 0, 0], .027);
  const tabletInk = texture(512, 360, (context) => {
    context.fillStyle = "#eee7d8";
    context.fillRect(0, 0, 512, 360);
    context.fillStyle = "#44382d";
    context.font = "42px Georgia, serif";
    context.fillText("Salonbooking", 40, 82);
    context.fillStyle = "#7b6854";
    context.font = "18px Arial, sans-serif";
    context.fillText("Vælg din behandling", 42, 125);
    for (const [line, treatment] of Object.values(treatments).entries()) {
      const y = 154 + 64 * line;
      context.fillStyle = line === 0 ? "#a79078" : "#d8cbb7";
      context.beginPath();
      context.roundRect(40, y, 432, 46, 8);
      context.fill();
      context.fillStyle = line === 0 ? "#f9f0dd" : "#483d2d";
      context.font = "21px Arial, sans-serif";
      context.fillText(treatment.name, 57, y + 30);
    }
  });
  const tabletPlane = storeGeometry(new THREE.PlaneGeometry(.414, .278));
  mesh(tabletPlane, basic({ map: tabletInk, toneMapped: false }), tablet, 0, 0, .019, false);
  const confirmedMap = texture(512, 360, (context) => {
    context.fillStyle = "#e6e6d7";
    context.fillRect(0, 0, 512, 360);
    context.fillStyle = "#4c624b";
    context.beginPath();
    context.arc(256, 122, 39, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#f6eee3";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(240, 123);
    context.lineTo(252, 134);
    context.lineTo(273, 110);
    context.stroke();
    context.fillStyle = "#3b4b38";
    context.font = "39px Georgia, serif";
    context.textAlign = "center";
    context.fillText("Tid reserveret", 256, 220);
    context.fillStyle = "#646b59";
    context.font = "20px Arial, sans-serif";
    context.fillText("Eksempel på en bekræftelse", 256, 262);
  });
  const confirmationScreen = mesh(tabletPlane, basic({ map: confirmedMap, toneMapped: false }), tablet, 0, 0, .020, false);
  confirmationScreen.visible = false;
  const receptionTray = box(reception, bronze, [.39, .018, .192], [.60, 1.068, .092], .012);
  receptionTray.rotation.y = -.08;
  box(reception, ivory, [.193, .012, .106], [.58, 1.083, .101], .006, false).rotation.y = -.14;
  box(reception, matteBlack, [.123, .013, .013], [.73, 1.089, .119], .006, false).rotation.y = .33;
  cylinder(reception, ceramic, .071, .045, .115, [.54, 1.122, -.204]);

  // Bench by the glazing, with narrow ash legs and an upholstered cushion.
  const bench = group(root, -3.70, 0, .59);
  bench.rotation.y = Math.PI / 2;
  for (const x of [-.74, .74]) {
    for (const z of [-.191, .191]) box(bench, oiledOak, [.064, .336, .064], [x, .175, z], .013);
  }
  box(bench, oak, [1.77, .070, .526], [0, .355, 0], .024);
  box(bench, linen, [1.709, .123, .501], [0, .44, 0], .051);
  box(bench, ivory, [.31, .024, .23], [-.54, .515, -.014], .009).rotation.y = .16;
  box(bench, matteBlack, [.24, .013, .16], [-.58, .535, -.023], .005).rotation.y = -.19;

  const leafMaterials = ["#596442", "#768056", "#526249", "#87926a"].map((color) => standard({ color, roughness: .73, side: THREE.DoubleSide }));
  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0);
  leaf.bezierCurveTo(-.075, .090, -.071, .218, 0, .292);
  leaf.bezierCurveTo(.068, .216, .091, .075, 0, 0);
  const leafMesh = storeGeometry(new THREE.ShapeGeometry(leaf, 7));
  const plantStem = standard({ color: "#6d6542", roughness: .94 });

  function plant(x: number, z: number, size: number) {
    const pot = group(root, x, 0, z);
    pot.scale.setScalar(size);
    const shade = mesh(contactPlane, contact, pot, 0, .003, 0, false);
    shade.rotation.x = -Math.PI / 2;
    shade.scale.setScalar(.63);
    cylinder(pot, ceramic, .246, .160, .395, [0, .203, 0]);
    cylinder(pot, stone, .251, .237, .048, [0, .385, 0]);
    cylinder(pot, earth, .221, .221, .015, [0, .414, 0], false);
    const random = noise(87621);
    for (let branch = 0; branch < 7; branch++) {
      const heading = branch * 2.39996;
      const rise = .48 + random() * .48;
      const off = .22 + random() * .22;
      const base = new THREE.Vector3(Math.cos(heading) * .043, .42, Math.sin(heading) * .043);
      const tip = new THREE.Vector3(Math.cos(heading) * off, .42 + rise, Math.sin(heading) * off);
      const stemGeometry = storeGeometry(new THREE.CylinderGeometry(.006, .011, base.distanceTo(tip), 5));
      const stem = mesh(stemGeometry, plantStem, pot, ...(base.clone().lerp(tip, .5).toArray() as [number, number, number]));
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(base).normalize());
      for (let blade = 0; blade < 5; blade++) {
        const point = base.clone().lerp(tip, .3 + blade * .155);
        const object = mesh(leafMesh, leafMaterials[(branch + blade) % leafMaterials.length], pot, point.x, point.y, point.z, false);
        object.rotation.set((blade % 2 ? 1 : -1) * (.49 + random() * .6), heading + blade * 1.83, (blade % 2 ? -1 : 1) * (.49 + random() * .64));
        object.scale.setScalar(.60 + random() * .55);
      }
    }
  }

  plant(-3.76, 2.23, 1.17);
  plant(3.69, -2.50, 1.0);

  // Chairs, foliage, slats and shelving share geometry and materials across the room.
  const batches = new Map<string, THREE.Mesh[]>();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object === reflector || object === mirroredFaces[1]) return;
    const { geometry, material, castShadow } = object;
    if (Array.isArray(material) || material.transparent) return;
    const key = `${geometry.id}/${material.id}/${castShadow}`;
    const batch = batches.get(key) ?? [];
    batch.push(object);
    batches.set(key, batch);
  });
  const instances: THREE.InstancedMesh[] = [];
  for (const batch of batches.values()) {
    if (batch.length < 3) continue;
    const { geometry, material, castShadow, receiveShadow } = batch[0];
    const repeated = new THREE.InstancedMesh(geometry, material, batch.length);
    repeated.castShadow = castShadow;
    repeated.receiveShadow = receiveShadow;
    for (const [index, object] of batch.entries()) {
      repeated.setMatrixAt(index, object.matrixWorld);
      object.removeFromParent();
    }
    instances.push(repeated);
    root.add(repeated);
  }

  const idleLight = new THREE.Color("#f3d3a3");
  const selectedLight = new THREE.Color("#fff5d9");
  const bookedLight = new THREE.Color("#d3e8bb");
  const current = [0, 0, 0];
  const booked = [0, 0, 0];

  function update(station: number | null, confirmed: boolean, elapsed: number) {
    let changing = false;
    const weight = -Math.expm1(-Math.max(0, elapsed) / 145);
    for (let index = 0; index < mirrorLights.length; index++) {
      const active = station === index ? 1 : 0;
      const done = confirmed && station === index ? 1 : 0;
      current[index] += (active - current[index]) * weight;
      booked[index] += (done - booked[index]) * weight;
      if (Math.abs(active - current[index]) < .004) current[index] = active;
      if (Math.abs(done - booked[index]) < .004) booked[index] = done;
      changing ||= current[index] !== active || booked[index] !== done;
      mirrorLights[index].color.copy(idleLight).lerp(selectedLight, current[index]).lerp(bookedLight, booked[index]);
    }
    confirmationScreen.visible = confirmed;
    return changing;
  }

  return {
    root,
    update,
    resize(width: number) {
      reflector.visible = width >= 920;
      mirroredFaces[1].visible = !reflector.visible;
    },
    dispose() {
      reflector.dispose();
      for (const instance of instances) instance.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const image of textures) image.dispose();
    },
  };
}
