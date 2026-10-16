import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { STATS_COOKIE, fetchDashboard, safeEqual, sessionToken, type Bucket, type Dashboard } from "@/lib/stats";
import { login, logout } from "./actions";
import DailyChart from "./DailyChart";

export const metadata: Metadata = {
  title: "İstatistikler — At Yarışı",
  robots: { index: false, follow: false },
};

const RANGES = [
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
  { days: 90, label: "90 gün" },
  { days: 0, label: "Tümü" },
];

// Koyu yüzey için doğrulanmış kategorik renkler (mavi, turuncu, su yeşili).
const THEME = {
  "--page": "#0a120c",
  "--surface-1": "#0f1a12",
  "--surface-2": "#18261b",
  "--grid": "rgba(255,255,255,0.07)",
  "--text-primary": "#f0efec",
  "--text-secondary": "#c3c2b7",
  "--text-muted": "#8f8e86",
  "--series-1": "#3987e5",
  "--series-2": "#d95926",
  "--series-3": "#199e70",
} as React.CSSProperties;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ aralik?: string; hata?: string }>;
}) {
  const { aralik, hata } = await searchParams;
  const store = await cookies();
  const token = sessionToken();
  const cookie = store.get(STATS_COOKIE)?.value;
  const authed = !!token && !!cookie && safeEqual(cookie, token);

  return (
    <div style={THEME} className="min-h-full bg-[var(--page)] text-[var(--text-primary)]">
      {authed ? <Panel days={Number(aralik ?? 30)} /> : <Login error={!!hata} configured={!!token} />}
    </div>
  );
}

function Login({ error, configured }: { error: boolean; configured: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="w-full max-w-sm rounded-2xl bg-[var(--surface-1)] p-6 ring-1 ring-white/10">
        <h1 className="font-serif text-3xl font-black italic">İstatistikler</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">At Yarışı yönetim paneli</p>
        {!configured && (
          <p className="mt-4 rounded-lg bg-amber-400/15 p-3 text-sm text-amber-100">
            Vercel&apos;de <code>STATS_PASSWORD</code> tanımlı değil.
          </p>
        )}
        <input
          name="sifre"
          type="password"
          autoFocus
          placeholder="Şifre"
          className="mt-5 w-full rounded-xl bg-black/30 px-3 py-2.5 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        {error && <p className="mt-2 text-sm text-rose-300">Şifre yanlış.</p>}
        <button className="mt-4 w-full rounded-xl bg-amber-400 py-2.5 font-black text-slate-900">Giriş</button>
      </form>
    </div>
  );
}

async function Panel({ days }: { days: number }) {
  const range = RANGES.find((r) => r.days === days) ?? RANGES[1];
  let data: Dashboard | null = null;
  let error: string | null = null;
  try {
    data = await fetchDashboard(range.days);
  } catch (e) {
    error = e instanceof Error ? e.message : "Veri alınamadı.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">At Yarışı</p>
          <h1 className="font-serif text-3xl font-black italic sm:text-4xl">İstatistikler</h1>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-xl bg-[var(--surface-1)] p-1 ring-1 ring-white/10">
            {RANGES.map((r) => (
              <Link
                key={r.days}
                href={`/istatistik?aralik=${r.days}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                  r.days === range.days ? "bg-amber-400 text-slate-900" : "text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button className="rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] hover:text-white">Çıkış</button>
          </form>
        </div>
      </header>

      {error && <p className="mt-6 rounded-xl bg-rose-500/15 p-4 text-sm text-rose-100">{error}</p>}

      {data && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Ziyaret eden cihaz" value={data.kpi.visitors} />
            <Tile
              label="En az bir yarış oynayan"
              value={data.kpi.players}
              note={data.kpi.visitors ? `ziyaretçilerin %${Math.round((100 * data.kpi.players) / data.kpi.visitors)}'i` : undefined}
            />
            <Tile label="Kurulan oda" value={data.kpi.rooms} note={`${data.kpi.joins} kez odaya katılındı`} />
            <Tile
              label="Başlatılan yarış"
              value={data.kpi.races_started}
              note={`${data.kpi.races_finished} tanesi bitti${
                data.kpi.races_started
                  ? ` (%${Math.round((100 * data.kpi.races_finished) / data.kpi.races_started)})`
                  : ""
              }`}
            />
            <Tile label="Ortalama yarış süresi" value={data.kpi.avg_duration_s} unit="sn" />
            <Tile label="Yarış başına atış (toplam)" value={data.kpi.avg_throws} />
            <Tile label="Botların kazanma oranı" value={data.kpi.bot_win_pct} unit="%" />
            <Tile
              label="Sadece canlı oyuncularla yarış"
              value={data.race_types.find((b) => b.label === "Sadece canlı oyuncular")?.n ?? 0}
            />
          </section>

          <section className="mt-3 rounded-2xl bg-[var(--surface-1)] p-4 ring-1 ring-white/10 sm:p-5">
            <h2 className="text-sm font-bold text-[var(--text-secondary)]">Günlük</h2>
            <div className="mt-3">
              <DailyChart rows={data.daily} />
            </div>
          </section>

          <section className="mt-3 grid gap-3 md:grid-cols-2">
            <Bars title="Yarış türü" items={data.race_types} unit="yarış" />
            <Bars title="Yarıştaki canlı oyuncu sayısı" items={data.humans} unit="yarış" />
            <Bars title="Cihaz türü" items={data.devices.map(deviceLabel)} unit="cihaz" />
            <Bars title="İşletim sistemi" items={data.os} unit="cihaz" />
            <Bars title="Pist uzunluğu" items={data.steps} unit="yarış" />
            <Bars title="Oda türü" items={data.rooms_online} unit="oda" />
          </section>

          <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
            Cihazlar anonim kimlikle sayılır; aynı kişi farklı telefon/tarayıcıdan girerse ayrı sayılır.
          </p>
        </>
      )}
    </div>
  );
}

function deviceLabel(b: Bucket): Bucket {
  const map: Record<string, string> = { mobile: "Mobil", desktop: "Masaüstü", tablet: "Tablet" };
  return { ...b, label: map[b.label] ?? b.label };
}

function Tile({ label, value, unit, note }: { label: string; value: number | null; unit?: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-1)] p-4 ring-1 ring-white/10">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums">
        {value === null ? "—" : value.toLocaleString("tr-TR")}
        {value !== null && unit && <span className="ml-1 text-base font-bold text-[var(--text-secondary)]">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-xs text-[var(--text-muted)]">{note}</p>}
    </div>
  );
}

function Bars({ title, items, unit }: { title: string; items: Bucket[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const total = items.reduce((s, i) => s + i.n, 0);
  return (
    <div className="rounded-2xl bg-[var(--surface-1)] p-4 ring-1 ring-white/10 sm:p-5">
      <h2 className="text-sm font-bold text-[var(--text-secondary)]">{title}</h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">Henüz veri yok.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((i) => (
            <li key={i.label} title={`${i.label}: ${i.n} ${unit}`}>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-primary)]">{i.label}</span>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  <b className="text-[var(--text-primary)]">{i.n.toLocaleString("tr-TR")}</b>
                  <span className="ml-1.5 text-xs">%{total ? Math.round((100 * i.n) / total) : 0}</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded bg-white/5">
                <div className="h-2 rounded bg-[var(--series-1)]" style={{ width: `${(100 * i.n) / max}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
