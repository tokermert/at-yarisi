import { createHash, timingSafeEqual } from "node:crypto";

export interface Bucket {
  label: string;
  n: number;
}

export interface DailyRow {
  day: string;
  visitors: number;
  players: number;
  races: number;
}

export interface Dashboard {
  kpi: {
    visitors: number;
    players: number;
    rooms: number;
    joins: number;
    races_started: number;
    races_finished: number;
    avg_duration_s: number | null;
    avg_throws: number | null;
    bot_win_pct: number | null;
  };
  daily: DailyRow[];
  race_types: Bucket[];
  humans: Bucket[];
  devices: Bucket[];
  os: Bucket[];
  steps: Bucket[];
  rooms_online: Bucket[];
}

export const STATS_COOKIE = "atyarisi_stats";

/** Şifreden türetilen oturum değeri; şifrenin kendisi çerezde tutulmaz. */
export function sessionToken(): string | null {
  const pw = process.env.STATS_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update(`atyarisi-istatistik:${pw}`).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function fetchDashboard(days: number): Promise<Dashboard> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY ya da NEXT_PUBLIC_SUPABASE_URL tanımlı değil.");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  // Eski tip (JWT) service_role anahtarı Authorization başlığı da ister.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/rpc/stats_dashboard`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_days: days }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Dashboard;
}
