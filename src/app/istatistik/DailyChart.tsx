"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyRow } from "@/lib/stats";

/** Günlük ziyaretçi / oynayan / yarış çizgileri; tek eksen, üzerine gelince değerler. */
const SERIES = [
  { key: "visitors", label: "Ziyaretçi", color: "var(--series-1)" },
  { key: "players", label: "Oynayan", color: "var(--series-2)" },
  { key: "races", label: "Yarış", color: "var(--series-3)" },
] as const;

const PAD = { l: 36, r: 16, t: 12, b: 26 };

function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const fmtDay = (d: string) => {
  const [, m, day] = d.split("-");
  return `${Number(day)}.${Number(m)}`;
};

export default function DailyChart({ rows }: { rows: DailyRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Grafik kabın gerçek genişliğinde çizilir; böylece telefonda yazılar küçülmez.
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 500 ? 200 : 240;
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-[var(--text-muted)]">Henüz veri yok.</p>;

  const max = niceMax(Math.max(1, ...rows.flatMap((r) => [r.visitors, r.players, r.races])));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (rows.length === 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(max * k));
  const labelEvery = Math.max(1, Math.ceil(rows.length / (W < 500 ? 4 : 8)));
  const step = rows.length > 1 ? iw / (rows.length - 1) : iw;
  const h = hover === null ? null : rows[hover];

  return (
    <div ref={boxRef} className="relative">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label="Günlük ziyaretçi, oynayan ve yarış sayıları"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round((px - PAD.l) / step);
          setHover(Math.max(0, Math.min(rows.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {t}
            </text>
          </g>
        ))}
        {rows.map((r, i) =>
          i % labelEvery === 0 || i === rows.length - 1 ? (
            <text key={r.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
              {fmtDay(r.day)}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
        )}
        {SERIES.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={rows.map((r, i) => `${x(i)},${y(r[s.key])}`).join(" ")}
            />
            {(rows.length === 1 || hover !== null) && (
              <circle
                cx={x(hover ?? 0)}
                cy={y(rows[hover ?? 0][s.key])}
                r={4.5}
                fill={s.color}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            )}
          </g>
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-8 rounded-lg border border-white/10 bg-[var(--surface-2)] px-3 py-2 text-xs shadow-xl"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${x(hover) > W * 0.7 ? "-105%" : "8px"})`,
          }}
        >
          <div className="mb-1 font-bold text-[var(--text-primary)]">{fmtDay(h.day)}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              <b className="ml-auto pl-3 text-[var(--text-primary)]">{h[s.key]}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
