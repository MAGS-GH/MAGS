import { CanvasTexture, SRGBColorSpace } from "three";

export const ink = "#32243c";
const sand = "#e9d3c0";
const linen = "#fbefe2";

function createTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable");
  paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function polyline(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath();
  for (const [index, [x, y]] of points.entries()) {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function randomSource(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function workshopSurfaces() {
  const random = randomSource(7183);
  const walnut = createTexture(512, 256, (ctx) => {
    const wash = ctx.createLinearGradient(0, 0, 0, 256);
    wash.addColorStop(0, "#9c694e");
    wash.addColorStop(0.27, "#79513c");
    wash.addColorStop(0.62, "#ab7352");
    wash.addColorStop(1, "#81543b");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 300; i++) {
      const y = random() * 256;
      const x = random() * 660 - 148;
      const length = 40 + random() * 550;
      const bend = (random() - 0.5) * 19;
      ctx.strokeStyle = random() > 0.65
        ? `rgba(243,193,148,${random() * 0.30})`
        : `rgba(53,23,20,${random() * 0.32})`;
      ctx.lineWidth = 0.4 + random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + length / 4, y + bend, x + length / 2, y - bend, x + length, y + bend / 2);
      ctx.stroke();
    }
  });
  const stone = createTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#f0dbca";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = random() > 0.65
        ? `rgba(255,253,245,${random() * 0.35})`
        : `rgba(107,72,51,${random() * 0.19})`;
      const size = 0.25 + random() * 2;
      ctx.fillRect(random() * 256, random() * 256, size, size);
    }
  });
  const shadow = createTexture(64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
    gradient.addColorStop(0, "rgba(57,31,19,.60)");
    gradient.addColorStop(0.58, "rgba(57,31,19,.23)");
    gradient.addColorStop(1, "rgba(57,31,19,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });
  const form = createTexture(384, 480, (ctx) => {
    rect(ctx, 5, 5, 374, 470, 34, linen);
    ctx.fillStyle = ink;
    ctx.font = "600 36px Georgia, serif";
    ctx.fillText("Forespørgsel", 40, 145);
    ctx.font = "500 22px Arial, sans-serif";
    ctx.fillText("Navn", 42, 195);
    ctx.fillText("Hvad skal vi hjælpe med?", 42, 286);
    rect(ctx, 40, 210, 304, 43, 10, sand);
    rect(ctx, 40, 302, 304, 53, 10, sand);
    rect(ctx, 40, 385, 304, 58, 13, ink);
    ctx.fillStyle = linen;
    ctx.font = "600 23px Arial, sans-serif";
    ctx.fillText("Send forespørgsel", 94, 423);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeRect(43, 50, 64, 39);
    polyline(ctx, [[44, 52], [75, 75], [106, 52]]);
  });
  const caseFile = createTexture(384, 280, (ctx) => {
    rect(ctx, 1, 1, 382, 278, 29, linen);
    rect(ctx, 25, 30, 64, 60, 14, "#e6d1d9");
    ctx.fillStyle = ink;
    ctx.font = "600 31px Georgia, serif";
    ctx.fillText("Ny sag", 113, 70);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    polyline(ctx, [[39, 60], [50, 70], [70, 48]]);
    rect(ctx, 28, 115, 274, 14, 7, sand);
    rect(ctx, 28, 154, 315, 14, 7, sand);
    rect(ctx, 28, 193, 228, 14, 7, sand);
  });
  const customer = createTexture(384, 210, (ctx) => {
    rect(ctx, 1, 1, 382, 208, 28, "#f1dfca");
    rect(ctx, 30, 37, 62, 58, 13, ink);
    ctx.fillStyle = "#f6eadb";
    ctx.beginPath();
    ctx.arc(61, 57, 9, 0, 2 * Math.PI);
    ctx.fill();
    rect(ctx, 47, 69, 28, 11, 5, "#f6eadb");
    ctx.fillStyle = ink;
    ctx.font = "600 34px Georgia, serif";
    ctx.fillText("Kundeoverblik", 114, 72);
    rect(ctx, 32, 121, 260, 12, 5, "#a18569");
    rect(ctx, 32, 154, 186, 12, 5, "#a18569");
  });
  const calendar = createTexture(512, 340, (ctx) => {
    rect(ctx, 1, 1, 510, 338, 32, linen);
    ctx.fillStyle = ink;
    ctx.font = "600 36px Georgia, serif";
    ctx.fillText("Kalender", 40, 72);
    ctx.font = "500 19px Arial, sans-serif";
    ["Man", "Tir", "Ons", "Tor", "Fre"].forEach((label, index) => {
      ctx.fillText(label, 49 + 88 * index, 122);
      for (let row = 0; row < 3; row++) {
        rect(ctx, 38 + 88 * index, 142 + 54 * row, 75, 42, 10, sand);
      }
    });
    ctx.font = "600 19px Arial, sans-serif";
    ctx.fillStyle = ink;
    ctx.fillText("10.00", 229, 224);
    ctx.fillText("10.30", 229, 278);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    polyline(ctx, [[454, 48], [465, 59], [454, 70]]);
  });
  const timeLabel = (value: string) => createTexture(128, 66, (ctx) => {
    ctx.font = "600 32px Arial, sans-serif";
    ctx.fillStyle = "#fff4e8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, 64, 34);
  });
  const checklist = createTexture(432, 270, (ctx) => {
    rect(ctx, 1, 1, 430, 268, 28, linen);
    ctx.fillStyle = ink;
    ctx.font = "600 35px Georgia, serif";
    ctx.fillText("Opfølgningsopgave", 32, 71);
    for (let row = 0; row < 2; row++) {
      const y = 116 + row * 62;
      rect(ctx, 35, y, 32, 32, 5, "#e6d1d9");
      rect(ctx, 86, y + 8, 260 - 45 * row, 13, 6, sand);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    polyline(ctx, [[42, 132], [50, 139], [63, 121]]);
  });
  return {
    walnut, stone, shadow, form, caseFile, customer, calendar, checklist,
    firstSlot: timeLabel("10.00"),
    secondSlot: timeLabel("10.30"),
  };
}
