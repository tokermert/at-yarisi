import {
  BALL_R,
  FRICTION,
  GRAVITY,
  HAND_X,
  HAND_Y,
  HOLE_R,
  HOLES,
  LAUNCH_Y,
  MAX_SPEED,
  MIN_SPEED,
  RAMP_W,
  WALL_TOP,
  type Hole,
} from "./config";

export type BallState = "hand" | "rolling" | "sinking" | "returning";

export interface Ball {
  state: BallState;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** sinking/returning durumlarında geri sayım (sn). */
  timer: number;
  hole: Hole | null;
  spin: number;
}

export function createBall(): Ball {
  return { state: "hand", x: HAND_X, y: HAND_Y, vx: 0, vy: 0, timer: 0, hole: null, spin: 0 };
}

export function throwBall(ball: Ball, vx: number, vy: number): boolean {
  if (ball.state !== "hand") return false;
  let speed = Math.hypot(vx, vy);
  if (vy >= 0 || speed < 1) return false;
  speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
  // Yanlara çok sert atışları sınırla (±40°).
  const maxAngle = (40 * Math.PI) / 180;
  const angle = Math.max(-maxAngle, Math.min(maxAngle, Math.atan2(vx, -vy)));
  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ball.state = "rolling";
  return true;
}

const SINK_TIME = 0.32;
const RETURN_TIME = 0.55;
const CAPTURE_DIST = HOLE_R * 0.5;
const CAPTURE_SPEED = 72;
const PULL = 950;
const WOBBLE = 1100;

export type StepEvent = { type: "score"; hole: Hole } | { type: "bounce"; strength: number } | { type: "back" };

/** Topu sabit bir zaman adımında ilerletir; oluşan olayları döndürür. */
export function stepBall(ball: Ball, dt: number, rand: () => number = Math.random): StepEvent | null {
  if (ball.state === "hand") return null;

  if (ball.state === "sinking") {
    ball.timer -= dt;
    if (ball.hole) {
      ball.x += (ball.hole.x - ball.x) * Math.min(1, dt * 18);
      ball.y += (ball.hole.y - ball.y) * Math.min(1, dt * 18);
    }
    if (ball.timer <= 0) {
      ball.state = "returning";
      ball.timer = RETURN_TIME;
    }
    return null;
  }

  if (ball.state === "returning") {
    ball.timer -= dt;
    if (ball.timer <= 0) {
      Object.assign(ball, createBall());
    }
    return null;
  }

  let event: StepEvent | null = null;

  // Masadaki pürüzler: top yuvarlanırken hafifçe sağa sola sapar, aynı atış hep aynı yere gitmez.
  ball.vx += (rand() - 0.5) * WOBBLE * dt;
  ball.vy += GRAVITY * dt;
  const damp = 1 - FRICTION * dt;
  ball.vx *= damp;
  ball.vy *= damp;

  // Deliklerin kenarı topu içeri çeker: yavaş top düşer, hızlı top savrulup geçer.
  for (const hole of HOLES) {
    const dx = hole.x - ball.x;
    const dy = hole.y - ball.y;
    const d = Math.hypot(dx, dy);
    if (d < HOLE_R) {
      const pull = PULL * (1 - d / HOLE_R);
      if (d > 0.001) {
        ball.vx += (dx / d) * pull * dt;
        ball.vy += (dy / d) * pull * dt;
      }
      const speed = Math.hypot(ball.vx, ball.vy);
      if (d < CAPTURE_DIST && speed < CAPTURE_SPEED) {
        ball.state = "sinking";
        ball.timer = SINK_TIME;
        ball.hole = hole;
        ball.vx = 0;
        ball.vy = 0;
        return { type: "score", hole };
      }
      // Hızlı geçişte ufak bir sekme.
      ball.vx += (rand() - 0.5) * 30 * dt * (speed / 100);
    }
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.spin += ball.vy * dt * 0.15;

  if (ball.x < BALL_R) {
    ball.x = BALL_R;
    ball.vx = Math.abs(ball.vx) * 0.6;
    event = { type: "bounce", strength: Math.abs(ball.vx) };
  } else if (ball.x > RAMP_W - BALL_R) {
    ball.x = RAMP_W - BALL_R;
    ball.vx = -Math.abs(ball.vx) * 0.6;
    event = { type: "bounce", strength: Math.abs(ball.vx) };
  }
  if (ball.y < WALL_TOP + BALL_R) {
    ball.y = WALL_TOP + BALL_R;
    ball.vy = Math.abs(ball.vy) * 0.42;
    ball.vx *= 0.8;
    event = { type: "bounce", strength: ball.vy };
  }

  if (ball.y > LAUNCH_Y + 6 && ball.vy > 0) {
    ball.state = "returning";
    ball.timer = RETURN_TIME * 0.6;
    ball.hole = null;
    return { type: "back" };
  }

  return event;
}

/** Botun hedef deliğe atış hızını hesaplar (sürtünme için ufak düzeltmeyle). */
export function aimAt(hole: Hole, error: number, rand: () => number = Math.random): { vx: number; vy: number } {
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const dy = HAND_Y - hole.y;
  const vy0 = Math.sqrt(2 * GRAVITY * dy) * (1 + FRICTION * 0.55);
  const t = vy0 / GRAVITY;
  const vx = (hole.x - HAND_X) / t / (1 - FRICTION * t * 0.5);
  return {
    vx: vx + gauss() * 14 * error,
    vy: -vy0 * (1 + gauss() * 0.07 * error),
  };
}
