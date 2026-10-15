import { Sfx } from "./audio";
import {
  BALL_R,
  CELEBRATION_SECONDS,
  CONFETTI_FADE_SECONDS,
  HAND_X,
  HAND_Y,
  PLAYER_THEMES,
  RAMP_H,
} from "./config";
import {
  drawBall,
  drawHorse,
  paintRamp,
  paintTrackBackground,
  rampGeom,
  roundRect,
  trackGeom,
  type Ctx,
  type RampGeom,
  type TrackGeom,
} from "./draw";
import { createBall, stepBall, throwBall, type Ball } from "./physics";
import type { RacePhase, RaceSnapshot, SlotView } from "./race";

interface Horse {
  shown: number;
  phase: number;
  gallop: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  life: number;
  size: number;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
}

interface Aim {
  angle: number;
  power: number;
}

export interface ViewHooks {
  onThrow: () => void;
  onScore: (points: number, round: number) => void;
}

const STEP = 1 / 120;
const SHOW_SPEED = 3.2;
const MIN_THROW = 160;
const THROW_RANGE = 180;

/**
 * Bir cihazın ekranı: üstte tüm atların koştuğu pist, altta yalnızca bu
 * cihazdaki oyuncunun atış masası ve güç çubuğu. Yarış durumu oda
 * sahibinden gelir; top fiziği yerelde çalışır.
 */
export class GameView {
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private bg: HTMLCanvasElement;
  private hooks: ViewHooks;
  readonly sfx = new Sfx();

  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private bgKey = "";

  private state: RaceSnapshot | null = null;
  private mySlot: number | null = null;
  private countdownEnd = 0;
  private lastCount = 0;
  private bannerId = 0;
  private banner: { text: string; color: string; t: number } | null = null;
  private horses = new Map<number, Horse>();
  private popups: Popup[] = [];
  private confetti: Confetti[] = [];
  /** Kutlamanın kalan süresi (sn); bu sırada sürekli konfeti patlar. */
  private celebrate = 0;
  private burstTimer = 0;

  private ball: Ball = createBall();
  private ballRound = -1;
  private drag: { id: number; sx: number; sy: number; cx: number; cy: number } | null = null;
  private keyHeld: number | null = null;
  private thrown = 0;

  private track: TrackGeom | null = null;
  private ramp: RampGeom | null = null;
  private panel: { x: number; y: number; w: number; h: number } | null = null;
  private side: { x: number; y: number; w: number; h: number } | null = null;
  private finger: { x: number; y: number; w: number; h: number } | null = null;

  constructor(canvas: HTMLCanvasElement, hooks: ViewHooks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D desteklenmiyor");
    this.ctx = ctx;
    this.bg = document.createElement("canvas");
    this.hooks = hooks;

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.sfx.close();
  }

  setMuted(m: boolean) {
    this.sfx.setMuted(m);
  }

  /** null: yalnızca pist gösterilir (TV / ekran modu). */
  setMySlot(slot: number | null) {
    this.mySlot = slot;
    this.layout();
  }

  setState(next: RaceSnapshot) {
    const prev = this.state;
    const prevPhase: RacePhase | null = prev?.phase ?? null;
    this.state = next;

    if (next.phase === "countdown") {
      this.countdownEnd = performance.now() + next.countdownMs;
      if (prevPhase !== "countdown") this.lastCount = 0;
    }
    if (next.round !== this.ballRound && (next.phase === "countdown" || next.phase === "racing")) {
      this.ballRound = next.round;
      this.ball = createBall();
      this.thrown = 0;
      this.popups = [];
      this.confetti = [];
      this.celebrate = 0;
      for (const h of this.horses.values()) h.shown = 0;
    }
    if (next.phase === "lobby") {
      for (const h of this.horses.values()) h.shown = 0;
      this.ball = createBall();
    }
    if (next.banner && next.banner.id !== this.bannerId) {
      this.bannerId = next.banner.id;
      const color = next.banner.slot >= 0 ? PLAYER_THEMES[next.banner.slot].silk : "#ffffff";
      this.banner = { text: next.banner.text, color, t: 0 };
    }
    if (next.phase === "racing" && prevPhase !== "racing") {
      if (prevPhase === "countdown") this.sfx.countdown(true);
      this.sfx.startCommentary();
    }
    if (next.phase === "finished" && prevPhase === "racing") {
      this.sfx.stopCommentary(0.5);
      this.sfx.winner();
      this.celebrate = CELEBRATION_SECONDS;
      this.burstTimer = 0;
    }
    if (next.phase === "lobby" || next.phase === "countdown") this.sfx.stopCommentary(0.3);
    if (prev) {
      for (const s of next.slots) {
        const before = prev.slots[s?.slot ?? -1];
        if (s && before && s.pos > before.pos) this.sfx.gallop();
      }
    }
    this.layout();
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.bgKey = "";
    this.layout();
  }

  /* -------------------------------------------------------------- */
  /* Yerleşim                                                         */
  /* -------------------------------------------------------------- */

  private lanes(): SlotView[] {
    return (this.state?.slots ?? []).filter((s): s is SlotView => s !== null);
  }

  private layout() {
    const { w, h } = this;
    if (!w || !h) return;
    const lanes = this.lanes();
    const laneCount = Math.max(1, lanes.length);
    const steps = this.state?.steps ?? 10;
    const key = `${w}x${h}|${laneCount}|${steps}|${this.mySlot}`;
    if (key === this.bgKey) return;
    this.bgKey = key;

    // Geniş ekranlarda atlar devleşmesin: pist yüksekliği kulvar sayısına göre sınırlanır ve dikeyde ortalanır.
    const fitTrack = (tw: number) => {
      const th = Math.round(Math.min(h, 150 + laneCount * 130, tw * 0.75));
      return trackGeom(0, Math.round((h - th) / 2), tw, th, laneCount);
    };
    if (this.mySlot === null) {
      this.track = fitTrack(w);
      this.panel = null;
      this.ramp = null;
    } else if (w > h * 1.05) {
      const pw = Math.round(Math.min(w * 0.42, h * 0.72));
      this.track = fitTrack(w - pw);
      this.panel = { x: w - pw, y: 0, w: pw, h };
    } else {
      const th = Math.round(Math.max(160, h * 0.3));
      this.track = trackGeom(0, 0, w, th, laneCount);
      this.panel = { x: 0, y: th, w, h: h - th };
    }

    this.side = null;
    this.finger = null;
    if (this.panel) {
      const p = this.panel;
      // Dikey ekranda masanın altında parmağın rahat hareket edeceği boş bir alan bırakılır.
      const fingerH = p.y > 0 ? Math.round(Math.max(70, p.h * 0.17)) : 0;
      const sideW = Math.round(Math.max(34, Math.min(46, p.w * 0.1)));
      const gap = 10;
      this.ramp = rampGeom(p.x + sideW + gap, p.y, p.w - (sideW + gap) * 2, p.h - fingerH, 6);
      const g = this.ramp;
      const fw = 100 * 0.08 * g.scale;
      // İsim şeridi masanın soluna, dikey olarak yerleşir.
      this.side = {
        x: g.ox - fw - gap - sideW,
        y: g.oy - fw,
        w: sideW,
        h: RAMP_H * g.scale + fw * 2.4,
      };
      if (fingerH) this.finger = { x: p.x, y: p.y + p.h - fingerH, w: p.w, h: fingerH };
    }
    this.paintBackground(steps);
  }

  private paintBackground(steps: number) {
    const { w, h, dpr } = this;
    this.bg.width = Math.round(w * dpr);
    this.bg.height = Math.round(h * dpr);
    const ctx = this.bg.getContext("2d");
    if (!ctx || !this.track) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#14532d";
    ctx.fillRect(0, 0, w, h);

    if (this.panel) {
      const { x, y, w: pw, h: ph } = this.panel;
      const counter = ctx.createLinearGradient(0, y, 0, y + ph);
      counter.addColorStop(0, "#7f1d1d");
      counter.addColorStop(0.08, "#b91c1c");
      counter.addColorStop(1, "#7f1d1d");
      ctx.fillStyle = counter;
      ctx.fillRect(x, y, pw, ph);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, pw, ph);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let sx = x - ph; sx < x + pw; sx += 46) {
        ctx.beginPath();
        ctx.moveTo(sx, y + ph);
        ctx.lineTo(sx + 18, y + ph);
        ctx.lineTo(sx + 18 + ph, y);
        ctx.lineTo(sx + ph, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#facc15";
      if (y > 0) ctx.fillRect(x, y, pw, 4);
      else ctx.fillRect(x, 0, 4, ph);
    }

    paintTrackBackground(ctx, this.track, steps);

    if (this.ramp && this.mySlot !== null) {
      const theme = PLAYER_THEMES[this.mySlot];
      const g = this.ramp;
      if (this.side) {
        const b = this.side;
        ctx.fillStyle = theme.silkDark;
        roundRect(ctx, b.x + 2, b.y, b.w, b.h, b.w / 2);
        ctx.fill();
        ctx.fillStyle = theme.silk;
        roundRect(ctx, b.x, b.y, b.w, b.h, b.w / 2);
        ctx.fill();
      }
      paintRamp(ctx, g, theme, this.mySlot);
    }
  }

  /* -------------------------------------------------------------- */
  /* Döngü                                                           */
  /* -------------------------------------------------------------- */

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.update(dt);
    this.render();
  };

  private update(dt: number) {
    this.time += dt;
    const st = this.state;

    if (st?.phase === "countdown") {
      const n = Math.ceil((this.countdownEnd - performance.now()) / 1000);
      if (n !== this.lastCount && n > 0) {
        this.lastCount = n;
        this.sfx.countdown(false);
      }
    }

    this.acc += dt;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const ev = stepBall(this.ball, STEP);
      if (!ev) continue;
      if (ev.type === "score") this.onScore(ev.hole.x, ev.hole.y, ev.hole.points);
      else if (ev.type === "bounce" && ev.strength > 25) this.sfx.bounce(ev.strength);
    }

    for (const s of this.lanes()) {
      let horse = this.horses.get(s.slot);
      if (!horse) {
        horse = { shown: s.pos, phase: s.slot * 1.7, gallop: 0 };
        this.horses.set(s.slot, horse);
      }
      if (s.pos > horse.shown + 0.001) {
        horse.shown = Math.min(s.pos, horse.shown + SHOW_SPEED * dt);
        horse.gallop = Math.min(1, horse.gallop + dt * 6);
      } else {
        horse.shown = Math.min(horse.shown, s.pos);
        horse.gallop = Math.max(0, horse.gallop - dt * 3);
      }
      horse.phase += dt * (2 + 15 * horse.gallop);
    }

    for (const pp of this.popups) pp.t += dt;
    this.popups = this.popups.filter((pp) => pp.t < pp.life);
    if (this.celebrate > 0) {
      this.celebrate -= dt;
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.burstTimer = 0.4 + Math.random() * 0.25;
        this.burstConfetti(70);
      }
      this.rainConfetti(dt);
      // Kutlama bitince havadaki konfeti kısa sürede sönsün.
      if (this.celebrate <= 0) for (const c of this.confetti) c.life = Math.min(c.life, CONFETTI_FADE_SECONDS);
    }
    for (const c of this.confetti) {
      c.vy += 380 * dt;
      c.vx *= 1 - dt * 0.8;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0 && c.y < this.h + 20);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 2.4) this.banner = null;
    }
  }

  private onScore(hx: number, hy: number, points: number) {
    const color = points === 3 ? "#f43f5e" : points === 2 ? "#60a5fa" : "#facc15";
    if (this.ramp) {
      this.popups.push({
        x: this.ramp.ox + hx * this.ramp.scale,
        y: this.ramp.oy + hy * this.ramp.scale,
        text: `+${points}`,
        color,
        t: 0,
        life: 1.1,
        size: Math.max(22, this.ramp.scale * 14),
      });
    }
    this.sfx.score(points);
    if (this.state?.phase === "racing") this.hooks.onScore(points, this.state.round);
    navigator.vibrate?.(points * 25);
  }

  private fire(aim: Aim) {
    if (this.state?.phase !== "racing" || this.mySlot === null) return;
    // El hiçbir zaman tam aynı atmaz: hıza ve yöne ufak bir sapma eklenir.
    const jitter = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const speed = (MIN_THROW + aim.power * THROW_RANGE) * (1 + jitter() * 0.04);
    const angle = aim.angle + jitter() * ((1.5 * Math.PI) / 180);
    if (throwBall(this.ball, Math.sin(angle) * speed, -Math.cos(angle) * speed)) {
      this.thrown++;
      this.sfx.roll();
      this.hooks.onThrow();
    }
  }

  private burstConfetti(count: number) {
    const ox = this.w * (0.15 + Math.random() * 0.7);
    const oy = this.h * (0.2 + Math.random() * 0.25);
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: ox,
        y: oy,
        vx: (Math.random() - 0.5) * 900,
        vy: -300 - Math.random() * 600,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 14,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        life: 2.5 + Math.random() * 2,
      });
    }
  }

  /** Ekranın üstünden yağan konfeti. */
  private rainConfetti(dt: number) {
    const n = Math.round(dt * 60 + Math.random());
    for (let i = 0; i < n; i++) {
      this.confetti.push({
        x: Math.random() * this.w,
        y: -10,
        vx: (Math.random() - 0.5) * 80,
        vy: 40 + Math.random() * 120,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 10,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        life: 4,
      });
    }
  }

  /* -------------------------------------------------------------- */
  /* Girişler                                                        */
  /* -------------------------------------------------------------- */

  private canAim() {
    const ph = this.state?.phase;
    return this.mySlot !== null && (ph === "racing" || ph === "countdown");
  }

  private onPointerDown = (e: PointerEvent) => {
    this.sfx.unlock();
    if (!this.canAim() || !this.panel || this.drag) return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const p = this.panel;
    if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* yakalama desteklenmeyebilir */
    }
    this.drag = { id: e.pointerId, sx: x, sy: y, cx: x, cy: y };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const r = this.canvas.getBoundingClientRect();
    this.drag.cx = e.clientX - r.left;
    this.drag.cy = e.clientY - r.top;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const aim = this.dragAim();
    this.drag = null;
    if (aim) this.fire(aim);
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (this.drag?.id === e.pointerId) this.drag = null;
  };

  /** Yukarı kaydırma doğrudan atış, aşağı çekme sapan gibi çalışır; mesafe gücü belirler. */
  private dragAim(): Aim | null {
    if (!this.drag || !this.ramp) return null;
    let dx = this.drag.cx - this.drag.sx;
    let dy = this.drag.cy - this.drag.sy;
    const len = Math.hypot(dx, dy);
    if (len < 10) return null;
    if (dy > 0) {
      dx = -dx;
      dy = -dy;
    }
    const maxAngle = (40 * Math.PI) / 180;
    const angle = Math.max(-maxAngle, Math.min(maxAngle, Math.atan2(dx, -dy)));
    const power = Math.min(1, len / (RAMP_H * this.ramp.scale * 0.6));
    return { angle, power };
  }

  private keyAim(): Aim | null {
    if (this.keyHeld === null) return null;
    const t = this.time - this.keyHeld;
    return { angle: Math.sin(t * 2.4) * 0.42, power: (1 - Math.cos(t * 2.8)) / 2 };
  }

  private isThrowKey(e: KeyboardEvent) {
    return e.code === "Space" || e.key === "Enter";
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.isThrowKey(e) || e.repeat || !this.canAim()) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "BUTTON")) return;
    e.preventDefault();
    this.sfx.unlock();
    this.keyHeld = this.time;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.isThrowKey(e) || this.keyHeld === null) return;
    const aim = this.keyAim();
    this.keyHeld = null;
    if (aim) this.fire(aim);
  };

  /* -------------------------------------------------------------- */
  /* Çizim                                                           */
  /* -------------------------------------------------------------- */

  private render() {
    const { ctx, w, h, dpr } = this;
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.bg, 0, 0, w, h);
    if (!this.track) return;

    this.renderTrack(this.track);
    this.renderPanel();

    for (const pp of this.popups) {
      const k = pp.t / pp.life;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `900 ${pp.size * (1 + Math.min(1, pp.t * 6) * 0.3)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(15,23,42,0.85)";
      const y = pp.y - k * 40;
      ctx.strokeText(pp.text, pp.x, y);
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, pp.x, y);
      ctx.restore();
    }

    if (this.state?.phase === "countdown") {
      const remain = Math.max(0, (this.countdownEnd - performance.now()) / 1000);
      const n = Math.max(1, Math.ceil(remain));
      const frac = remain - Math.floor(remain);
      ctx.save();
      ctx.fillStyle = "rgba(2,6,23,0.35)";
      ctx.fillRect(0, 0, w, h);
      const size = Math.min(w, h) * 0.24 * (0.8 + frac * 0.4);
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = size * 0.08;
      ctx.strokeStyle = "#0f172a";
      ctx.strokeText(String(n), w / 2, h / 2);
      ctx.fillStyle = "#facc15";
      ctx.fillText(String(n), w / 2, h / 2);
      ctx.restore();
    }

    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = Math.min(1, c.life);
      ctx.fillStyle = c.color;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }
  }

  private renderTrack(g: TrackGeom) {
    const { ctx } = this;
    const lanes = this.lanes();
    const steps = this.state?.steps ?? 10;
    const size = Math.min(g.laneH * 0.98, (g.finishX - g.startX) / 4);
    const span = g.finishX - g.startX;

    lanes.forEach((s, lane) => {
      const theme = PLAYER_THEMES[s.slot];
      const ly = g.laneTop + lane * g.laneH;
      const mine = s.slot === this.mySlot;
      if (mine) {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(g.x, ly, g.w, g.laneH);
      }
      const r = Math.min(g.laneH * 0.3, 14);
      const cx = g.x + 8 + r;
      const cy = ly + g.laneH / 2;
      ctx.globalAlpha = s.connected ? 1 : 0.45;
      ctx.fillStyle = theme.silk;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${Math.round(r * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(s.slot + 1), cx, cy + 1);
      const labelRight = g.startX - size * 0.62;
      const tx = cx + r + 5;
      if (labelRight - tx > 26) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.round(Math.min(13, g.laneH * 0.26))}px system-ui, sans-serif`;
        ctx.fillText(fitText(ctx, mine ? `${s.name} (sen)` : s.name, labelRight - tx), tx, cy - g.laneH * 0.14);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `600 ${Math.round(Math.min(11, g.laneH * 0.22))}px system-ui, sans-serif`;
        const status = s.connected ? `${s.pos}/${steps}` : "koptu";
        ctx.fillText(status, tx, cy + g.laneH * 0.18);
      }
      ctx.globalAlpha = 1;
    });

    lanes.forEach((s, lane) => {
      const theme = PLAYER_THEMES[s.slot];
      const horse = this.horses.get(s.slot);
      const shown = horse?.shown ?? 0;
      const groundY = g.laneTop + (lane + 0.9) * g.laneH;
      const x = g.startX - size * 0.42 + (shown / steps) * span;
      const gallop = horse?.gallop ?? 0;
      drawHorse(
        ctx,
        x,
        groundY,
        size,
        {
          coat: theme.coat,
          coatDark: theme.coatDark,
          mane: theme.mane,
          silk: theme.silk,
          silkDark: theme.silkDark,
          cap: theme.cap,
          number: s.slot + 1,
        },
        horse?.phase ?? 0,
        gallop,
      );
      if (gallop > 0.3) {
        ctx.fillStyle = `rgba(214,190,150,${0.35 * gallop})`;
        for (let k = 0; k < 3; k++) {
          const off = ((this.time * 3 + k / 3) % 1) * size * 0.5;
          ctx.beginPath();
          ctx.arc(x - size * 0.45 - off, groundY - size * 0.05, size * (0.05 + off / size / 6), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    if (this.banner) {
      const b = this.banner;
      const appear = Math.min(1, b.t * 6);
      const fade = b.t > 2 ? 1 - (b.t - 2) / 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      const fs = Math.max(14, Math.min(24, g.standH * 0.22));
      ctx.font = `900 ${fs}px system-ui, sans-serif`;
      const tw = Math.min(g.w - 20, ctx.measureText(b.text).width + fs * 1.6);
      const bx = g.x + g.w / 2 - tw / 2;
      const by = g.y + g.standH * 0.42 - (1 - appear) * 20;
      ctx.fillStyle = "rgba(15,23,42,0.88)";
      roundRect(ctx, bx, by, tw, fs * 1.8, fs * 0.9);
      ctx.fill();
      ctx.fillStyle = b.color;
      roundRect(ctx, bx, by, fs * 0.5, fs * 1.8, fs * 0.25);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fitText(ctx, b.text, tw - fs), g.x + g.w / 2 + fs * 0.15, by + fs * 0.92);
      ctx.restore();
    }
  }

  private renderPanel() {
    const g = this.ramp;
    if (!g || this.mySlot === null) return;
    const { ctx } = this;
    const theme = PLAYER_THEMES[this.mySlot];
    const me = this.state?.slots[this.mySlot];
    const s = g.scale;

    // İsim şeridi: altta numara, üstte ilerleme, arada dikey isim
    const side = this.side;
    if (side) {
      const cx = side.x + side.w / 2;
      const r = side.w / 2 - 4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, side.y + side.h - side.w / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.silkDark;
      ctx.font = `900 ${Math.round(r * 1.15)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(this.mySlot + 1), cx, side.y + side.h - side.w / 2 + 1);

      const progress = me ? `${me.pos}/${this.state?.steps ?? 10}` : "";
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${Math.round(Math.min(14, side.w * 0.32))}px system-ui, sans-serif`;
      ctx.fillText(progress, cx, side.y + side.w * 0.55);

      const top = side.y + side.w * 1.05;
      const bottom = side.y + side.h - side.w * 1.1;
      ctx.save();
      ctx.translate(cx, (top + bottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = `800 ${Math.round(Math.min(17, side.w * 0.42))}px system-ui, sans-serif`;
      ctx.fillText(fitText(ctx, me?.name ?? theme.label, bottom - top), 0, 1);
      ctx.restore();
    }

    if (this.finger && (this.state?.phase === "racing" || this.state?.phase === "countdown") && !this.drag) {
      const f = this.finger;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `700 ${Math.round(Math.min(14, f.h * 0.18))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("☝ Parmağını burada da kaydırabilirsin", f.x + f.w / 2, f.y + f.h * 0.5);
    }

    // Top
    const r = BALL_R * s;
    const ball = this.ball;
    let aim: Aim | null = null;
    if (ball.state === "rolling") {
      drawBall(ctx, g.ox + ball.x * s, g.oy + ball.y * s, r, theme, 1, ball.spin);
    } else if (ball.state === "sinking") {
      const k = Math.max(0, ball.timer / 0.32);
      drawBall(ctx, g.ox + ball.x * s, g.oy + ball.y * s, r * (0.45 + 0.55 * k), theme, 0.3 + 0.7 * k, ball.spin);
    } else if (ball.state === "hand") {
      const hx2 = g.ox + HAND_X * s;
      const hy2 = g.oy + HAND_Y * s;
      aim = this.canAim() ? (this.drag ? this.dragAim() : this.keyAim()) : null;
      if (aim) this.renderAim(hx2, hy2, aim, s);
      const hint = this.state?.phase === "racing" && this.thrown === 0 && !aim;
      if (hint) {
        const k = (Math.sin(this.time * 5) + 1) / 2;
        ctx.strokeStyle = `rgba(15,23,42,${0.25 + k * 0.35})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx2, hy2, r * (1.6 + k * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(15,23,42,0.6)";
        ctx.font = `700 ${Math.max(11, Math.min(15, 6.5 * s))}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Kaydır ve at!", hx2, hy2 - r * 3.4);
      }
      drawBall(ctx, hx2, hy2, r, theme);
    }

  }

  private renderAim(hx: number, hy: number, aim: Aim, s: number) {
    const { ctx } = this;
    const len = (22 + aim.power * 70) * s;
    const dx = Math.sin(aim.angle);
    const dy = -Math.cos(aim.angle);
    const hue = 120 - aim.power * 120;
    ctx.save();
    ctx.strokeStyle = `hsla(${hue}, 85%, 45%, 0.9)`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(3, 2.2 * s);
    ctx.setLineDash([2.5 * s, 2.5 * s]);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + dx * len, hy + dy * len);
    ctx.stroke();
    ctx.setLineDash([]);
    const ax = hx + dx * len;
    const ay = hy + dy * len;
    const as = 5 * s;
    ctx.beginPath();
    ctx.moveTo(ax + dx * as, ay + dy * as);
    ctx.lineTo(ax - dy * as * 0.7, ay + dx * as * 0.7);
    ctx.lineTo(ax + dy * as * 0.7, ay - dx * as * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

const CONFETTI_COLORS = ["#ef4444", "#3b82f6", "#facc15", "#22c55e", "#ffffff", "#ec4899"];

function fitText(ctx: Ctx, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
