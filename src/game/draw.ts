import {
  HOLE_R,
  HOLE_ROWS,
  LAUNCH_Y,
  RAMP_H,
  RAMP_W,
  WALL_TOP,
  type PlayerTheme,
} from "./config";

export type Ctx = CanvasRenderingContext2D;

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Tekrarlanabilir rastgele sayı üreteci (kalabalık, çim deseni vb. için). */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* At                                                                   */
/* ------------------------------------------------------------------ */

interface Leg {
  hipX: number;
  hipY: number;
  offset: number;
  front: boolean;
}

const LEGS_FAR: Leg[] = [
  { hipX: -0.27, hipY: -0.47, offset: 0.6, front: false },
  { hipX: 0.24, hipY: -0.47, offset: 2.4, front: true },
];
const LEGS_NEAR: Leg[] = [
  { hipX: -0.3, hipY: -0.47, offset: 0, front: false },
  { hipX: 0.21, hipY: -0.47, offset: 1.8, front: true },
];

function drawLeg(ctx: Ctx, leg: Leg, phase: number, gallop: number, color: string, hoof: string) {
  const swing = Math.sin(phase + leg.offset);
  const upperLen = 0.2;
  const lowerLen = 0.21;
  const idle = leg.front ? 0.05 : -0.05;
  const a1 = idle + swing * 0.62 * gallop;
  // Ön bacakta diz arkaya, arka bacakta hock öne bükülür.
  const bend = Math.max(0, Math.sin(phase + leg.offset + (leg.front ? 1.3 : -0.9))) * 1.25 * gallop;
  const a2 = a1 + (leg.front ? -bend : bend * 0.8);
  const kx = leg.hipX + Math.sin(a1) * upperLen;
  const ky = leg.hipY + Math.cos(a1) * upperLen;
  const fx = kx + Math.sin(a2) * lowerLen;
  const fy = ky + Math.cos(a2) * lowerLen;

  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.085;
  ctx.beginPath();
  ctx.moveTo(leg.hipX, leg.hipY - 0.04);
  ctx.lineTo(kx, ky);
  ctx.stroke();
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.fillStyle = hoof;
  ctx.beginPath();
  ctx.ellipse(fx + 0.012, fy, 0.034, 0.024, a2, 0, Math.PI * 2);
  ctx.fill();
}

export interface HorseLook {
  coat: string;
  coatDark: string;
  mane: string;
  silk: string;
  silkDark: string;
  cap: string;
  number: number;
}

/**
 * Sağa bakan, dörtnala koşan bir at ve jokey çizer.
 * (x, y) toynakların bastığı zemin noktası; size atın boy uzunluğu (px).
 */
export function drawHorse(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  look: HorseLook,
  phase: number,
  gallop: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);

  // Gölge
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 0.02, 0.48, 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  const bob = Math.sin(phase * 2) * 0.025 * gallop;
  const pitch = Math.sin(phase + 0.6) * 0.05 * gallop;
  ctx.translate(0, bob - (gallop > 0 ? 0.02 : 0));
  ctx.rotate(pitch);

  for (const leg of LEGS_FAR) drawLeg(ctx, leg, phase, gallop, look.coatDark, "#1b1410");

  // Kuyruk
  const tailWave = Math.sin(phase * 1.5) * 0.07 * (0.4 + gallop);
  ctx.strokeStyle = look.mane;
  ctx.lineCap = "round";
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(-0.44, -0.6);
  ctx.quadraticCurveTo(-0.62, -0.62 + tailWave, -0.68, -0.42 + tailWave * 1.4);
  ctx.stroke();
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(-0.45, -0.58);
  ctx.quadraticCurveTo(-0.6, -0.55 + tailWave, -0.63, -0.36 + tailWave * 1.6);
  ctx.stroke();

  // Gövde
  const body = ctx.createLinearGradient(0, -0.72, 0, -0.36);
  body.addColorStop(0, look.coat);
  body.addColorStop(1, look.coatDark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-0.44, -0.6);
  ctx.bezierCurveTo(-0.46, -0.72, -0.3, -0.73, -0.16, -0.66);
  ctx.bezierCurveTo(-0.02, -0.62, 0.12, -0.66, 0.24, -0.7);
  ctx.bezierCurveTo(0.36, -0.7, 0.4, -0.56, 0.34, -0.45);
  ctx.bezierCurveTo(0.26, -0.37, 0.1, -0.4, -0.05, -0.41);
  ctx.bezierCurveTo(-0.22, -0.4, -0.38, -0.38, -0.43, -0.48);
  ctx.closePath();
  ctx.fill();

  // Boyun ve baş
  const headBob = Math.sin(phase + 2.2) * 0.04 * gallop;
  ctx.save();
  ctx.translate(0.22, -0.62);
  ctx.rotate(headBob);
  ctx.fillStyle = look.coat;
  ctx.beginPath();
  ctx.moveTo(-0.06, -0.06);
  ctx.bezierCurveTo(0.02, -0.2, 0.12, -0.28, 0.2, -0.3);
  ctx.lineTo(0.27, -0.24);
  ctx.bezierCurveTo(0.2, -0.16, 0.16, -0.04, 0.12, 0.1);
  ctx.closePath();
  ctx.fill();
  // Baş
  ctx.save();
  ctx.translate(0.27, -0.26);
  ctx.rotate(0.72);
  ctx.fillStyle = look.coat;
  ctx.beginPath();
  ctx.ellipse(0.07, 0, 0.13, 0.058, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.coatDark;
  ctx.beginPath();
  ctx.ellipse(0.17, 0.012, 0.045, 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  // Göz
  ctx.fillStyle = "#0b0b0b";
  ctx.beginPath();
  ctx.arc(0.0, -0.022, 0.014, 0, Math.PI * 2);
  ctx.fill();
  // Dizgin/başlık
  ctx.strokeStyle = "rgba(20,10,5,0.75)";
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(-0.03, -0.05);
  ctx.lineTo(-0.02, 0.05);
  ctx.moveTo(-0.02, 0.0);
  ctx.lineTo(0.15, 0.03);
  ctx.stroke();
  ctx.restore();
  // Kulak
  ctx.fillStyle = look.coatDark;
  ctx.beginPath();
  ctx.moveTo(0.17, -0.31);
  ctx.lineTo(0.15, -0.39);
  ctx.lineTo(0.215, -0.32);
  ctx.closePath();
  ctx.fill();
  // Yele
  ctx.strokeStyle = look.mane;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(0.17, -0.3);
  ctx.bezierCurveTo(0.06, -0.24, 0.0, -0.14, -0.08, -0.05);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const mx = 0.14 - t * 0.2;
    const my = -0.28 + t * 0.22;
    const flick = Math.sin(phase * 2 + i) * 0.02 * gallop;
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - 0.07, my + 0.02 + flick);
    ctx.stroke();
  }
  ctx.restore();

  // Eyer örtüsü ve numara
  ctx.fillStyle = look.silk;
  roundRect(ctx, -0.17, -0.67, 0.25, 0.17, 0.03);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 0.12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(look.number), -0.045, -0.575);

  for (const leg of LEGS_NEAR) drawLeg(ctx, leg, phase, gallop, look.coat, "#1b1410");

  // Jokey
  const lean = Math.sin(phase * 2 + 0.5) * 0.02 * gallop;
  ctx.save();
  ctx.translate(lean, 0);
  // Bacak/çizme
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 0.05;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-0.07, -0.78);
  ctx.lineTo(0.03, -0.7);
  ctx.lineTo(-0.02, -0.6);
  ctx.stroke();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(-0.02, -0.62);
  ctx.lineTo(-0.035, -0.55);
  ctx.stroke();
  // Gövde (öne eğik)
  ctx.fillStyle = look.silk;
  ctx.beginPath();
  ctx.ellipse(0.02, -0.86, 0.13, 0.065, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.silkDark;
  ctx.beginPath();
  ctx.ellipse(-0.02, -0.84, 0.05, 0.05, -0.35, 0, Math.PI * 2);
  ctx.fill();
  // Kol
  ctx.strokeStyle = look.silk;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(0.08, -0.88);
  ctx.lineTo(0.2, -0.79);
  ctx.lineTo(0.3, -0.8);
  ctx.stroke();
  // Baş ve kask
  ctx.fillStyle = "#f2c9a0";
  ctx.beginPath();
  ctx.arc(0.15, -0.96, 0.048, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.cap;
  ctx.beginPath();
  ctx.arc(0.15, -0.975, 0.052, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(0.15, -0.982, 0.08, 0.016);
  ctx.restore();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Pist                                                                 */
/* ------------------------------------------------------------------ */

export interface TrackGeom {
  x: number;
  y: number;
  w: number;
  h: number;
  standH: number;
  laneTop: number;
  laneH: number;
  lanes: number;
  startX: number;
  finishX: number;
}

export function trackGeom(x: number, y: number, w: number, h: number, lanes: number): TrackGeom {
  const standH = Math.round(h * 0.3);
  const railH = Math.max(6, h * 0.04);
  const laneTop = y + standH + railH;
  const laneH = (h - standH - railH * 2) / lanes;
  const labelW = Math.min(110, Math.max(48, w * 0.12));
  return {
    x,
    y,
    w,
    h,
    standH,
    laneTop,
    laneH,
    lanes,
    startX: x + labelW + laneH * 0.62,
    finishX: x + w - Math.max(26, w * 0.05),
  };
}

const CROWD_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#f8fafc", "#a855f7", "#ec4899", "#0ea5e9", "#fde047"];

/** Statik pist arka planını (tribün, çim, kulvarlar) ayrı bir tuvale çizer. */
export function paintTrackBackground(ctx: Ctx, g: TrackGeom, steps: number) {
  const { x, y, w, standH } = g;
  const rnd = seeded(7);

  // Gökyüzü
  const sky = ctx.createLinearGradient(0, y, 0, y + standH);
  sky.addColorStop(0, "#7dd3fc");
  sky.addColorStop(1, "#e0f2fe");
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, standH);

  // Tribün
  const roofH = standH * 0.2;
  const standTop = y + standH * 0.22;
  ctx.fillStyle = "#14532d";
  ctx.beginPath();
  ctx.moveTo(x, standTop);
  ctx.lineTo(x + w, standTop);
  ctx.lineTo(x + w, standTop - roofH * 0.55);
  ctx.lineTo(x, standTop - roofH);
  ctx.closePath();
  ctx.fill();
  // Çatı saçağı (çizgili tente)
  const flapW = Math.max(16, w / 40);
  for (let fx = x, i = 0; fx < x + w; fx += flapW, i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#dc2626";
    ctx.beginPath();
    ctx.moveTo(fx, standTop);
    ctx.lineTo(fx + flapW, standTop);
    ctx.lineTo(fx + flapW, standTop + roofH * 0.25);
    ctx.arc(fx + flapW / 2, standTop + roofH * 0.25, flapW / 2, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  const seatsTop = standTop + roofH * 0.25;
  const seatsBottom = y + standH;
  const grad = ctx.createLinearGradient(0, seatsTop, 0, seatsBottom);
  grad.addColorStop(0, "#334155");
  grad.addColorStop(1, "#64748b");
  ctx.fillStyle = grad;
  ctx.fillRect(x, seatsTop, w, seatsBottom - seatsTop);
  // Seyirciler
  const rows = 5;
  const rowH = (seatsBottom - seatsTop) / rows;
  const r = Math.max(2.2, rowH * 0.28);
  for (let row = 0; row < rows; row++) {
    const cy = seatsTop + rowH * (row + 0.62);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, seatsTop + rowH * (row + 1) - 2, w, 2);
    for (let cx = x + (row % 2) * r * 1.3; cx < x + w; cx += r * 2.6) {
      if (rnd() < 0.12) continue;
      const c = CROWD_COLORS[Math.floor(rnd() * CROWD_COLORS.length)];
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.9, r * 1.05, r * 0.9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ["#f2c9a0", "#d9a274", "#8d5a3b", "#f5d0b5"][Math.floor(rnd() * 4)];
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Bayrak süsleri
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  const bunY = y + standH * 0.06;
  const bunStep = Math.max(22, w / 26);
  ctx.beginPath();
  for (let bx = x; bx <= x + w; bx += bunStep) {
    ctx.lineTo(bx, bunY);
  }
  ctx.stroke();
  let fi = 0;
  for (let bx = x + bunStep * 0.25; bx < x + w; bx += bunStep * 0.5, fi++) {
    ctx.fillStyle = CROWD_COLORS[fi % 6];
    ctx.beginPath();
    ctx.moveTo(bx - bunStep * 0.16, bunY);
    ctx.lineTo(bx + bunStep * 0.16, bunY);
    ctx.lineTo(bx, bunY + bunStep * 0.32);
    ctx.closePath();
    ctx.fill();
  }

  // Üst korkuluk
  const railH = g.laneTop - (y + standH);
  drawRail(ctx, x, y + standH, w, railH);

  // Kulvarlar (biçilmiş çim)
  for (let i = 0; i < g.lanes; i++) {
    const ly = g.laneTop + i * g.laneH;
    ctx.fillStyle = i % 2 ? "#3f9b4a" : "#47a752";
    ctx.fillRect(x, ly, w, g.laneH);
    const stripeW = Math.max(30, w / 16);
    for (let sx = x, k = 0; sx < x + w; sx += stripeW, k++) {
      if (k % 2) {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(sx, ly, stripeW, g.laneH);
      }
    }
    // Toprak koşu yolu
    const dirtH = g.laneH * 0.22;
    const dirt = ctx.createLinearGradient(0, ly + g.laneH - dirtH, 0, ly + g.laneH);
    dirt.addColorStop(0, "rgba(166,124,82,0)");
    dirt.addColorStop(1, "rgba(120,84,50,0.45)");
    ctx.fillStyle = dirt;
    ctx.fillRect(x, ly + g.laneH - dirtH, w, dirtH);
    if (i > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(x, ly);
      ctx.lineTo(x + w, ly);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  const lanesBottom = g.laneTop + g.laneH * g.lanes;
  drawRail(ctx, x, lanesBottom, w, railH);

  // Mesafe işaretleri
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let s = 1; s < steps; s++) {
    const mx = g.startX + ((g.finishX - g.startX) * s) / steps;
    ctx.fillRect(mx - 0.75, g.laneTop, 1.5, g.laneH * g.lanes);
  }

  // Başlangıç çizgisi
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(g.startX - 2, g.laneTop, 4, g.laneH * g.lanes);

  // Bitiş: dama desenli şerit
  const cw = Math.max(5, Math.min(10, g.laneH / 6));
  const fh = g.laneH * g.lanes;
  for (let row = 0; row * cw < fh; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 ? "#111827" : "#ffffff";
      ctx.fillRect(g.finishX + col * cw, g.laneTop + row * cw, cw, Math.min(cw, fh - row * cw));
    }
  }
  // Bitiş direği
  const postX = g.finishX + cw;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(postX - 2, y + standH * 0.35, 4, g.laneTop - (y + standH * 0.35));
  const signH = Math.max(16, Math.min(26, standH * 0.2));
  const signW = Math.max(46, signH * 3);
  ctx.fillStyle = "#dc2626";
  roundRect(ctx, postX - signW / 2, y + standH * 0.33 - signH, signW, signH, 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(signH * 0.58)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BİTİŞ", postX, y + standH * 0.33 - signH / 2 + 1);

  // Kulvar etiketleri için koyu zemin
  const labelW = g.startX - g.laneH * 0.62 - x;
  const lg = ctx.createLinearGradient(x, 0, x + labelW, 0);
  lg.addColorStop(0, "rgba(6,40,20,0.55)");
  lg.addColorStop(1, "rgba(6,40,20,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(x, g.laneTop, labelW, g.laneH * g.lanes);
}

function drawRail(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#14532d";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, y + h * 0.15, w, Math.max(2, h * 0.32));
  const postStep = Math.max(24, w / 30);
  for (let px = x + postStep / 2; px < x + w; px += postStep) {
    ctx.fillRect(px - 1.5, y + h * 0.15, 3, h * 0.85);
  }
}

/* ------------------------------------------------------------------ */
/* Atış masası                                                          */
/* ------------------------------------------------------------------ */

export interface RampGeom {
  /** Ekrandaki kolon dikdörtgeni. */
  colX: number;
  colY: number;
  colW: number;
  colH: number;
  /** Yerel (0..RAMP_W, 0..RAMP_H) koordinatı ekrana çeviren ölçek ve öteleme. */
  ox: number;
  oy: number;
  scale: number;
  headerH: number;
}

export function rampGeom(colX: number, colY: number, colW: number, colH: number, header?: number): RampGeom {
  const headerH = header ?? Math.max(26, Math.min(40, colH * 0.07));
  const pad = Math.max(6, colW * 0.06);
  const frame = 0.08; // çerçeve kalınlığı, ölçeğe oranla
  const availW = colW - pad * 2;
  const availH = colH - headerH - pad * 1.5;
  const scale = Math.min(availW / (RAMP_W * (1 + frame * 2)), availH / (RAMP_H + RAMP_W * frame * 2));
  const w = RAMP_W * scale;
  const ox = colX + (colW - w) / 2;
  const oy = colY + headerH + pad * 0.5 + RAMP_W * frame * scale + (availH - (RAMP_H + RAMP_W * frame * 2) * scale) / 2;
  return { colX, colY, colW, colH, ox, oy, scale, headerH };
}

/** Atış masasının statik görünümü (ahşap çerçeve, renkli bantlar, delikler). */
export function paintRamp(ctx: Ctx, g: RampGeom, theme: PlayerTheme, index: number) {
  const s = g.scale;
  const fw = RAMP_W * 0.08 * s;
  const W = RAMP_W * s;
  const H = RAMP_H * s;
  ctx.save();

  // Ahşap çerçeve
  const wood = ctx.createLinearGradient(g.ox - fw, 0, g.ox + W + fw, 0);
  wood.addColorStop(0, "#9a6b3c");
  wood.addColorStop(0.5, "#c08a52");
  wood.addColorStop(1, "#8a5d32");
  ctx.fillStyle = wood;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, g.ox - fw, g.oy - fw, W + fw * 2, H + fw * 1.4, fw * 0.8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Damar çizgileri
  ctx.strokeStyle = "rgba(60,30,10,0.18)";
  ctx.lineWidth = 1;
  const r = seeded(index * 31 + 3);
  for (let i = 0; i < 10; i++) {
    const gx = g.ox - fw + r() * (W + fw * 2);
    ctx.beginPath();
    ctx.moveTo(gx, g.oy - fw);
    ctx.bezierCurveTo(gx + 4, g.oy + H * 0.3, gx - 4, g.oy + H * 0.7, gx + 2, g.oy + H);
    ctx.stroke();
  }

  // Masa yüzeyi (yukarı doğru hafif koyulaşan eğim)
  const surf = ctx.createLinearGradient(0, g.oy, 0, g.oy + H);
  surf.addColorStop(0, "#e8e2d6");
  surf.addColorStop(0.55, "#f7f3ea");
  surf.addColorStop(1, "#fffdf8");
  ctx.fillStyle = surf;
  ctx.fillRect(g.ox, g.oy, W, H);
  // Üst duvar
  ctx.fillStyle = "#cbbfa8";
  ctx.fillRect(g.ox, g.oy, W, WALL_TOP * s);
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(g.ox, g.oy + WALL_TOP * s, W, 2);

  // Renkli yamuk bantlar
  const bandH = 22;
  for (const row of HOLE_ROWS) {
    const top = g.oy + (row.y - bandH / 2) * s;
    const bot = g.oy + (row.y + bandH / 2) * s;
    const cx = g.ox + W / 2;
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.moveTo(cx - (row.topW / 2) * s, top);
    ctx.lineTo(cx + (row.topW / 2) * s, top);
    ctx.lineTo(cx + (row.bottomW / 2) * s, bot);
    ctx.lineTo(cx - (row.bottomW / 2) * s, bot);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(cx - (row.topW / 2) * s, top, row.topW * s, 2);

    for (const hx of row.xs) {
      const hcx = g.ox + hx * s;
      const hcy = g.oy + row.y * s;
      const hr = HOLE_R * s;
      const hole = ctx.createRadialGradient(hcx, hcy - hr * 0.35, hr * 0.1, hcx, hcy, hr);
      hole.addColorStop(0, "#020617");
      hole.addColorStop(0.75, "#1e293b");
      hole.addColorStop(1, "#475569");
      ctx.fillStyle = hole;
      ctx.beginPath();
      ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, s * 0.6);
      ctx.beginPath();
      ctx.arc(hcx, hcy, hr, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    // Puan etiketleri deliklerin arasındaki boşluklara
    ctx.fillStyle = row.points === 1 ? "rgba(113,63,18,0.8)" : "rgba(255,255,255,0.9)";
    ctx.font = `800 ${Math.max(7, 5.2 * s)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const gaps = row.xs.slice(1).map((hx, k) => (hx + row.xs[k]) / 2);
    const labelXs = gaps.length % 2 ? [gaps[(gaps.length - 1) / 2]] : [gaps[0], gaps[gaps.length - 1]];
    for (const lx of labelXs) ctx.fillText(`+${row.points}`, g.ox + lx * s, g.oy + row.y * s);
  }

  // Atış çizgisi ve oyuncu numarası
  ctx.strokeStyle = "rgba(15,23,42,0.25)";
  ctx.lineWidth = Math.max(1, s * 0.6);
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(g.ox + 4, g.oy + LAUNCH_Y * s);
  ctx.lineTo(g.ox + W - 4, g.oy + LAUNCH_Y * s);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = theme.silk;
  ctx.globalAlpha = 0.85;
  ctx.font = `italic 900 ${Math.round(18 * s)}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(index + 1), g.ox + 6 * s, g.oy + (RAMP_H - 6) * s);
  ctx.globalAlpha = 1;

  // Cam yansıması
  ctx.save();
  ctx.beginPath();
  ctx.rect(g.ox, g.oy, W, H);
  ctx.clip();
  const glare = ctx.createLinearGradient(g.ox, g.oy, g.ox + W, g.oy + H * 0.6);
  glare.addColorStop(0, "rgba(255,255,255,0)");
  glare.addColorStop(0.45, "rgba(255,255,255,0)");
  glare.addColorStop(0.5, "rgba(255,255,255,0.22)");
  glare.addColorStop(0.56, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(g.ox, g.oy, W, H);
  ctx.restore();

  ctx.restore();
}

export function drawBall(ctx: Ctx, cx: number, cy: number, r: number, theme: PlayerTheme, alpha = 1, spin = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.25, cy + r * 0.45, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.25, theme.ball);
  g.addColorStop(1, theme.ballDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Dönme izlenimi için şerit
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = r * 0.18;
  ctx.beginPath();
  const sy = Math.sin(spin) * r * 0.7;
  ctx.ellipse(cx, cy + sy * 0.3, r * 0.82, Math.abs(Math.cos(spin)) * r * 0.5 + 0.5, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}
