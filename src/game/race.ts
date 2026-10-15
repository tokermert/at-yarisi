import { HOLES } from "./config";
import { aimAt, createBall, stepBall, type Ball } from "./physics";

export type RacePhase = "lobby" | "countdown" | "racing" | "finished";

export interface SlotView {
  slot: number;
  name: string;
  bot: boolean;
  connected: boolean;
  pos: number;
  throws: number;
  finishedAt: number;
}

export interface Banner {
  id: number;
  text: string;
  slot: number;
}

/** Odadaki herkese gönderilen yarış durumu. */
export interface RaceSnapshot {
  phase: RacePhase;
  steps: number;
  slots: (SlotView | null)[];
  /** Geri sayımın bitmesine kalan süre (ms), gönderildiği andan itibaren. */
  countdownMs: number;
  banner: Banner | null;
  round: number;
}

/** İstemci → oda sahibi */
export type ClientMsg =
  | { t: "hello"; name: string }
  | { t: "throw" }
  | { t: "score"; points: number; round: number };

/** Oda sahibi → istemci */
export type HostMsg =
  | { t: "welcome"; slot: number }
  | { t: "full" }
  | { t: "state"; state: RaceSnapshot };

export const MAX_SLOTS = 4;
const COUNTDOWN_MS = 3600;

interface Slot extends SlotView {
  owner: string | null;
  ball: Ball | null;
  botTimer: number;
}

/**
 * Oda sahibinin cihazında çalışan yetkili yarış durumu.
 * Oyuncular kendi atışlarını kendi cihazlarında simüle eder ve yalnızca
 * kazandıkları puanı bildirir; botlar burada görünmeden atış yapar.
 */
export class RaceHost {
  private slots: (Slot | null)[] = Array(MAX_SLOTS).fill(null);
  private phase: RacePhase = "lobby";
  private steps = 12;
  private countdownEnd = 0;
  private banner: Banner | null = null;
  private bannerId = 0;
  private finishOrder = 0;
  private leader = -1;
  private stretch = new Set<number>();
  private round = 0;
  private acc = 0;

  constructor(private onChange: () => void) {}

  get currentPhase() {
    return this.phase;
  }

  setSteps(steps: number) {
    if (this.phase !== "lobby" && this.phase !== "finished") return;
    this.steps = steps;
    this.onChange();
  }

  /** Bir insan oyuncuyu ilk boş koltuğa (botların yerine de) oturtur. */
  join(owner: string, name: string): number {
    const existing = this.slots.findIndex((s) => s?.owner === owner);
    if (existing >= 0) return existing;
    if (this.phase === "countdown" || this.phase === "racing") return -1;
    let slot = this.slots.findIndex((s) => s === null);
    if (slot < 0) slot = this.slots.findIndex((s) => s?.bot);
    if (slot < 0) return -1;
    this.slots[slot] = this.makeSlot(slot, name, owner, false);
    this.onChange();
    return slot;
  }

  leave(owner: string) {
    const i = this.slots.findIndex((s) => s?.owner === owner);
    if (i < 0) return;
    const s = this.slots[i]!;
    if (this.phase === "racing" || this.phase === "countdown") {
      s.connected = false;
    } else {
      this.slots[i] = null;
    }
    this.onChange();
  }

  rename(owner: string, name: string) {
    const s = this.slots.find((x) => x?.owner === owner);
    if (s) {
      s.name = cleanName(name, s.slot);
      this.onChange();
    }
  }

  toggleBot(slot: number) {
    if (this.phase === "countdown" || this.phase === "racing") return;
    const s = this.slots[slot];
    if (s && !s.bot) return;
    this.slots[slot] = s ? null : this.makeSlot(slot, "", null, true);
    this.onChange();
  }

  activeCount() {
    return this.slots.filter(Boolean).length;
  }

  start() {
    if (this.activeCount() < 1) return;
    // Bağlantısı kopmuş oyuncular yeni yarışa alınmaz.
    this.slots = this.slots.map((s) => (s && !s.bot && !s.connected ? null : s));
    for (const s of this.slots) {
      if (!s) continue;
      s.pos = 0;
      s.throws = 0;
      s.finishedAt = 0;
      s.ball = s.bot ? createBall() : null;
      s.botTimer = 0.6 + Math.random() * 0.8;
    }
    this.banner = null;
    this.finishOrder = 0;
    this.leader = -1;
    this.stretch.clear();
    this.round++;
    this.phase = "countdown";
    this.countdownEnd = performance.now() + COUNTDOWN_MS;
    this.onChange();
  }

  backToLobby() {
    this.phase = "lobby";
    this.slots = this.slots.map((s) => (s && !s.bot && !s.connected ? null : s));
    for (const s of this.slots) if (s) s.pos = 0;
    this.banner = null;
    this.onChange();
  }

  recordThrow(slot: number) {
    const s = this.slots[slot];
    if (s && this.phase === "racing") s.throws++;
  }

  score(slot: number, points: number, round: number) {
    const s = this.slots[slot];
    if (!s || this.phase !== "racing" || round !== this.round) return;
    const p = Math.max(1, Math.min(3, Math.round(points)));
    const before = this.leaderSlot();
    s.pos = Math.min(this.steps, s.pos + p);
    const after = this.leaderSlot();

    if (s.pos >= this.steps) {
      s.finishedAt = ++this.finishOrder;
      this.phase = "finished";
      this.say(`${s.name} kazandı!`, slot);
    } else if (after !== before && after === slot) {
      this.say(`${s.name} öne geçti!`, slot);
    } else if (p === 3) {
      this.say(`Müthiş atış! ${s.name} +3`, slot);
    } else if (s.pos >= this.steps - 3 && !this.stretch.has(slot)) {
      this.stretch.add(slot);
      this.say(`Son düzlük: ${s.name}!`, slot);
    }
    this.leader = after;
    this.onChange();
  }

  /** Geri sayımı ve botları ilerletir. */
  tick(dt: number) {
    if (this.phase === "countdown" && performance.now() >= this.countdownEnd) {
      this.phase = "racing";
      this.say("Ve koşu başladı!", -1);
      this.onChange();
    }
    if (this.phase !== "racing") return;

    const STEP = 1 / 60;
    this.acc += Math.min(dt, 0.5);
    while (this.acc >= STEP && this.phase === "racing") {
      this.acc -= STEP;
      for (const s of this.slots) {
        if (!s?.bot || !s.ball) continue;
        if (s.ball.state === "hand") {
          s.botTimer -= STEP;
          if (s.botTimer <= 0) {
            s.botTimer = 0.3 + Math.random() * 0.6;
            const r = Math.random();
            const row = r < 0.3 ? 0 : r < 0.62 ? 1 : 2;
            const options = HOLES.filter((h) => h.row === row);
            const target = options[Math.floor(Math.random() * options.length)];
            const v = aimAt(target, 1.1);
            s.ball.vx = v.vx;
            s.ball.vy = v.vy;
            s.ball.state = "rolling";
            s.throws++;
          }
          continue;
        }
        const ev = stepBall(s.ball, STEP);
        if (ev?.type === "score") this.score(s.slot, ev.hole.points, this.round);
      }
    }
  }

  snapshot(): RaceSnapshot {
    return {
      phase: this.phase,
      steps: this.steps,
      slots: this.slots.map((s) =>
        s
          ? {
              slot: s.slot,
              name: s.name,
              bot: s.bot,
              connected: s.connected,
              pos: s.pos,
              throws: s.throws,
              finishedAt: s.finishedAt,
            }
          : null,
      ),
      countdownMs: this.phase === "countdown" ? Math.max(0, this.countdownEnd - performance.now()) : 0,
      banner: this.banner,
      round: this.round,
    };
  }

  private makeSlot(slot: number, name: string, owner: string | null, bot: boolean): Slot {
    return {
      slot,
      name: bot ? `${BOT_NAMES[slot]} Bot` : cleanName(name, slot),
      bot,
      connected: true,
      owner,
      pos: 0,
      throws: 0,
      finishedAt: 0,
      ball: bot ? createBall() : null,
      botTimer: 1,
    };
  }

  private say(text: string, slot: number) {
    this.banner = { id: ++this.bannerId, text, slot };
  }

  private leaderSlot() {
    let best = -1;
    let bestPos = 0;
    let tie = false;
    for (const s of this.slots) {
      if (!s) continue;
      if (s.pos > bestPos) {
        best = s.slot;
        bestPos = s.pos;
        tie = false;
      } else if (s.pos === bestPos && bestPos > 0) {
        tie = true;
      }
    }
    return tie ? this.leader : best;
  }
}

const BOT_NAMES = ["Kırmızı", "Mavi", "Sarı", "Yeşil"];

export function cleanName(name: string, slot: number) {
  const n = name.replace(/\s+/g, " ").trim().slice(0, 12);
  return n || `Oyuncu ${slot + 1}`;
}

export function ranking(state: RaceSnapshot): SlotView[] {
  return state.slots
    .filter((s): s is SlotView => s !== null)
    .sort((a, b) => {
      if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
      if (a.finishedAt) return -1;
      if (b.finishedAt) return 1;
      return b.pos - a.pos;
    });
}
