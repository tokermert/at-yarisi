export type PlayerKind = "human" | "bot" | "off";

export interface PlayerSetup {
  kind: PlayerKind;
  name: string;
}

export interface PlayerTheme {
  label: string;
  silk: string;
  silkDark: string;
  cap: string;
  coat: string;
  coatDark: string;
  mane: string;
  ball: string;
  ballDark: string;
  key: string;
}

export const PLAYER_THEMES: PlayerTheme[] = [
  {
    label: "Kırmızı",
    silk: "#ef4444",
    silkDark: "#b91c1c",
    cap: "#fde047",
    coat: "#8b5a2b",
    coatDark: "#5c3a1a",
    mane: "#2a1a0e",
    ball: "#f87171",
    ballDark: "#b91c1c",
    key: "A",
  },
  {
    label: "Mavi",
    silk: "#3b82f6",
    silkDark: "#1d4ed8",
    cap: "#ffffff",
    coat: "#2f2a28",
    coatDark: "#151211",
    mane: "#0a0908",
    ball: "#60a5fa",
    ballDark: "#1d4ed8",
    key: "F",
  },
  {
    label: "Sarı",
    silk: "#f59e0b",
    silkDark: "#b45309",
    cap: "#111827",
    coat: "#e7e1d6",
    coatDark: "#b3aa9b",
    mane: "#8f8778",
    ball: "#fbbf24",
    ballDark: "#b45309",
    key: "J",
  },
  {
    label: "Yeşil",
    silk: "#22c55e",
    silkDark: "#15803d",
    cap: "#f472b6",
    coat: "#b8642a",
    coatDark: "#7c3f15",
    mane: "#f3e3c3",
    ball: "#4ade80",
    ballDark: "#15803d",
    key: "L",
  },
];

export const TRACK_LENGTHS = [
  { label: "Kısa", steps: 8 },
  { label: "Normal", steps: 12 },
  { label: "Uzun", steps: 18 },
] as const;

/** Atış masası yerel koordinat sistemi (birim). */
export const RAMP_W = 100;
export const RAMP_H = 190;
export const WALL_TOP = 8;
export const BALL_R = 5.6;
export const HOLE_R = 8.6;
export const LAUNCH_Y = 150;
export const HAND_X = RAMP_W / 2;
export const HAND_Y = 172;

/** Masa eğiminden gelen, topu oyuncuya doğru çeken ivme. */
export const GRAVITY = 230;
export const FRICTION = 0.12;
export const MIN_SPEED = 70;
export const MAX_SPEED = 340;

export interface HoleRow {
  y: number;
  xs: number[];
  points: number;
  color: string;
  colorDark: string;
  /** Satır bandının üst ve alt genişliği (yamuk görünüm için). */
  topW: number;
  bottomW: number;
}

export const HOLE_ROWS: HoleRow[] = [
  { y: 32, xs: [37, 63], points: 3, color: "#dc2647", colorDark: "#9f1239", topW: 46, bottomW: 62 },
  { y: 57, xs: [22, 50, 78], points: 2, color: "#2563eb", colorDark: "#1e3a8a", topW: 70, bottomW: 86 },
  { y: 82, xs: [12.5, 37.5, 62.5, 87.5], points: 1, color: "#facc15", colorDark: "#a16207", topW: 94, bottomW: 100 },
];

export interface Hole {
  x: number;
  y: number;
  points: number;
  row: number;
}

export const HOLES: Hole[] = HOLE_ROWS.flatMap((row, i) =>
  row.xs.map((x) => ({ x, y: row.y, points: row.points, row: i })),
);
