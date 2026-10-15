"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { PLAYER_THEMES, TRACK_LENGTHS } from "@/game/config";
import { GameView } from "@/game/engine";
import { hostRoom, joinRoom, normalizeCode, type ClientLink, type HostLink } from "@/game/net";
import { MAX_SLOTS, RaceHost, ranking, type ClientMsg, type HostMsg, type RaceSnapshot } from "@/game/race";

type Session =
  | { role: "none" }
  | { role: "host"; host: RaceHost; link: HostLink | null; mySlot: number | null; timer: number }
  | { role: "client"; link: ClientLink; mySlot: number | null };

const SELF = "__self__";
const MEDALS = ["🥇", "🥈", "🥉", "4."];

function readStored(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* depolama kapalı olabilir */
  }
}

export default function Game() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GameView | null>(null);
  const sessionRef = useRef<Session>({ role: "none" });

  const [name, setName] = useState(() => readStored("atyarisi:name"));
  const [joinCode, setJoinCode] = useState(() =>
    normalizeCode(new URLSearchParams(window.location.search).get("oda") ?? ""),
  );
  const [role, setRole] = useState<Session["role"]>("none");
  const [code, setCode] = useState("");
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [snap, setSnap] = useState<RaceSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = code ? `${window.location.origin}${window.location.pathname}?oda=${code}` : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const view = new GameView(canvas, {
      onThrow: () => {
        const s = sessionRef.current;
        if (s.role === "host" && s.mySlot !== null) s.host.recordThrow(s.mySlot);
        else if (s.role === "client") s.link.send({ t: "throw" });
      },
      onScore: (points, round) => {
        const s = sessionRef.current;
        if (s.role === "host" && s.mySlot !== null) s.host.score(s.mySlot, points, round);
        else if (s.role === "client") s.link.send({ t: "score", points, round });
      },
    });
    viewRef.current = view;
    // Lobi arka planında örnek bir pist göster.
    view.setState(demoSnapshot());
    view.setMySlot(null);
    const ro = new ResizeObserver(() => view.resize(wrap.clientWidth, wrap.clientHeight));
    ro.observe(wrap);
    view.resize(wrap.clientWidth, wrap.clientHeight);
    return () => {
      ro.disconnect();
      view.destroy();
      viewRef.current = null;
      closeSession(sessionRef.current);
      sessionRef.current = { role: "none" };
    };
  }, []);

  useEffect(() => {
    viewRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (!shareUrl) return;
    let alive = true;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 320, color: { dark: "#052e16", light: "#ffffff" } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [shareUrl]);

  function endSession() {
    closeSession(sessionRef.current);
    sessionRef.current = { role: "none" };
  }

  function leave(message: string | null = null) {
    endSession();
    setRole("none");
    setCode("");
    setSnap(null);
    setMySlot(null);
    setQr(null);
    setNotice(message);
    const view = viewRef.current;
    if (view) {
      view.setMySlot(null);
      view.setState(demoSnapshot());
    }
  }

  function applyState(state: RaceSnapshot) {
    viewRef.current?.setState(state);
    setSnap(state);
  }

  function rememberName() {
    store("atyarisi:name", name.trim());
  }

  async function createRoom(asScreen: boolean) {
    rememberName();
    setError(null);
    setNotice(null);
    setBusy("Oda kuruluyor…");
    viewRef.current?.sfx.unlock();

    let link: HostLink | null = null;
    const host = new RaceHost(() => {
      const state = host.snapshot();
      link?.broadcast({ t: "state", state });
      applyState(state);
    });
    const owners = new Map<string, number>();
    const slotOf = (peerId: string) => owners.get(peerId) ?? -1;

    try {
      link = await hostRoom({
        onMessage: (peerId, msg: ClientMsg) => {
          if (msg.t === "hello") {
            const slot = host.join(peerId, msg.name);
            if (slot < 0) {
              link?.sendTo(peerId, { t: "full" } satisfies HostMsg);
              return;
            }
            owners.set(peerId, slot);
            link?.sendTo(peerId, { t: "welcome", slot });
            link?.sendTo(peerId, { t: "state", state: host.snapshot() });
          } else if (msg.t === "throw") {
            const slot = slotOf(peerId);
            if (slot >= 0) host.recordThrow(slot);
          } else if (msg.t === "score") {
            const slot = slotOf(peerId);
            if (slot >= 0) host.score(slot, msg.points, msg.round);
          }
        },
        onLeave: (peerId) => {
          host.leave(peerId);
          owners.delete(peerId);
        },
        onError: (m) => setError(`Bağlantı hatası: ${m}`),
      });
      setCode(link.code);
    } catch {
      link = null;
      setNotice("İnternet odası açılamadı. Bu cihazda botlara karşı oynayabilirsin.");
    }

    const mine = asScreen ? null : host.join(SELF, name);
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      host.tick((now - last) / 1000);
      last = now;
    }, 33);
    sessionRef.current = { role: "host", host, link, mySlot: mine, timer };
    setRole("host");
    setMySlot(mine);
    viewRef.current?.setMySlot(mine);
    applyState(host.snapshot());
    setBusy(null);
  }

  async function join() {
    const c = normalizeCode(joinCode);
    if (c.length < 4) {
      setError("4 haneli oda kodunu yaz.");
      return;
    }
    rememberName();
    setError(null);
    setNotice(null);
    setBusy("Odaya bağlanılıyor…");
    viewRef.current?.sfx.unlock();
    try {
      const link = await joinRoom(c, {
        onMessage: (msg: HostMsg) => {
          if (msg.t === "welcome") {
            const s = sessionRef.current;
            if (s.role === "client") s.mySlot = msg.slot;
            setMySlot(msg.slot);
            viewRef.current?.setMySlot(msg.slot);
          } else if (msg.t === "full") {
            leave("Oda dolu ya da yarış başlamış.");
          } else if (msg.t === "state") {
            applyState(msg.state);
          }
        },
        onClose: () => leave("Oda sahibiyle bağlantı koptu."),
      });
      sessionRef.current = { role: "client", link, mySlot: null };
      link.send({ t: "hello", name });
      setRole("client");
      setCode(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Odaya bağlanılamadı.");
    }
    setBusy(null);
  }

  function hostDo(fn: (h: RaceHost) => void) {
    const s = sessionRef.current;
    if (s.role === "host") fn(s.host);
  }

  async function share() {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "At Yarışı", text: `At yarışına gel! Oda kodu: ${code}`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* kullanıcı paylaşımı iptal etti */
    }
  }

  const phase = snap?.phase ?? "lobby";
  const isHost = role === "host";
  const activeCount = snap?.slots.filter(Boolean).length ?? 0;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#0b2a17] text-white">
      <div ref={wrapRef} className="absolute inset-0 touch-none">
        <canvas ref={canvasRef} className="block touch-none" aria-label="At yarışı oyun alanı" />
      </div>

      {role !== "none" && (phase === "countdown" || phase === "racing") && (
        <div className="absolute left-2 top-2 flex gap-2">
          <IconButton label={muted ? "Sesi aç" : "Sesi kapat"} onClick={() => setMuted((m) => !m)}>
            {muted ? "🔇" : "🔊"}
          </IconButton>
          <IconButton
            label="Odadan çık"
            onClick={() => {
              if (window.confirm(isHost ? "Odayı kapatmak istiyor musun? Herkes çıkarılır." : "Odadan çıkılsın mı?"))
                leave();
            }}
          >
            ✕
          </IconButton>
        </div>
      )}

      {role === "none" && (
        <Overlay>
          <Title />
          {notice && <Note>{notice}</Note>}

          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">Adın</span>
            <input
              value={name}
              maxLength={12}
              placeholder="Örn. Mert"
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-black/25 px-3 py-2.5 font-semibold text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </label>

          <div className="mt-4 rounded-2xl bg-black/20 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">Arkadaşının odasına katıl</p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                inputMode="text"
                autoCapitalize="characters"
                placeholder="KOD"
                maxLength={6}
                onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && join()}
                className="w-0 flex-1 rounded-xl bg-black/30 px-3 py-2.5 text-center font-mono text-xl font-black tracking-[0.35em] text-white placeholder:tracking-normal placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                type="button"
                disabled={!!busy}
                onClick={join}
                className="rounded-xl bg-white px-5 font-black text-slate-900 transition-transform active:scale-95 disabled:opacity-50"
              >
                Katıl
              </button>
            </div>
          </div>

          <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-white/40">
            <span className="h-px flex-1 bg-white/15" /> ya da <span className="h-px flex-1 bg-white/15" />
          </div>

          <PrimaryButton disabled={!!busy} onClick={() => createRoom(false)}>
            Oda kur 🏇
          </PrimaryButton>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => createRoom(true)}
            className="mt-2 w-full rounded-2xl bg-white/10 py-2.5 text-sm font-bold text-white/85 transition-colors hover:bg-white/15 disabled:opacity-50"
          >
            📺 Bu cihaz sadece pist ekranı olsun (TV / tablet)
          </button>

          {busy && <p className="mt-3 text-center text-sm font-semibold text-amber-200">{busy}</p>}
          {error && <p className="mt-3 text-center text-sm font-semibold text-rose-300">{error}</p>}
          <HowTo />
        </Overlay>
      )}

      {role !== "none" && phase === "lobby" && snap && (
        <Overlay>
          {notice && <Note>{notice}</Note>}
          {code ? (
            <div className="flex items-center gap-4">
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Odaya katılma QR kodu" className="h-28 w-28 shrink-0 rounded-xl bg-white p-1" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">Oda kodu</p>
                <p className="font-mono text-5xl font-black tracking-[0.18em] text-amber-300">{code}</p>
                {isHost && (
                  <button
                    type="button"
                    onClick={share}
                    className="mt-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold transition-colors hover:bg-white/20"
                  >
                    {copied ? "Bağlantı kopyalandı ✓" : "Davet bağlantısını paylaş"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <Title />
          )}

          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-white/60">
            Atlar ({activeCount}/{MAX_SLOTS})
          </p>
          <ul className="mt-2 space-y-1.5">
            {snap.slots.map((s, i) => {
              const theme = PLAYER_THEMES[i];
              return (
                <li key={theme.label} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ring-2 ring-white"
                    style={{ background: theme.silk, opacity: s ? 1 : 0.35 }}
                  >
                    {i + 1}
                  </span>
                  <span className={`flex-1 truncate font-bold ${s ? "" : "text-white/40"}`}>
                    {s ? s.name : "Boş"}
                    {s && i === mySlot && <span className="ml-1.5 text-xs text-amber-300">SEN</span>}
                    {s?.bot && <span className="ml-1.5 text-xs text-white/50">BOT</span>}
                  </span>
                  {isHost && (!s || s.bot) && (
                    <button
                      type="button"
                      onClick={() => hostDo((h) => h.toggleBot(i))}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold transition-colors hover:bg-white/20"
                    >
                      {s ? "Botu çıkar" : "+ Bot ekle"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {isHost ? (
            <>
              <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wider text-white/60">Pist uzunluğu</p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1">
                {TRACK_LENGTHS.map((t) => (
                  <button
                    key={t.steps}
                    type="button"
                    onClick={() => hostDo((h) => h.setSteps(t.steps))}
                    className={`rounded-lg py-1.5 text-sm font-bold transition-colors ${
                      snap.steps === t.steps ? "bg-amber-300 text-slate-900" : "text-white/70 hover:text-white"
                    }`}
                  >
                    {t.label} <span className="font-medium opacity-70">· {t.steps}</span>
                  </button>
                ))}
              </div>
              <div className="mt-5">
                <PrimaryButton disabled={activeCount < 2} onClick={() => hostDo((h) => h.start())}>
                  {activeCount < 2 ? "Oyuncu ya da bot bekleniyor…" : "Yarışı Başlat 🏁"}
                </PrimaryButton>
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-xl bg-black/20 p-3 text-center text-sm font-semibold text-white/80">
              Oda sahibinin yarışı başlatması bekleniyor…
            </p>
          )}
          <button
            type="button"
            onClick={() => leave()}
            className="mt-3 w-full text-center text-xs font-semibold text-white/50 hover:text-white"
          >
            {isHost ? "Odayı kapat" : "Odadan çık"}
          </button>
        </Overlay>
      )}

      {role !== "none" && phase === "finished" && snap && (
        <Results
          snap={snap}
          mySlot={mySlot}
          isHost={isHost}
          onRematch={() => hostDo((h) => h.start())}
          onLobby={() => hostDo((h) => h.backToLobby())}
          onLeave={() => leave()}
        />
      )}
    </div>
  );
}

function Results({
  snap,
  mySlot,
  isHost,
  onRematch,
  onLobby,
  onLeave,
}: {
  snap: RaceSnapshot;
  mySlot: number | null;
  isHost: boolean;
  onRematch: () => void;
  onLobby: () => void;
  onLeave: () => void;
}) {
  // Kazanan at bitiş çizgisine varsın diye sonuç ekranı biraz gecikmeli açılır.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1600);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  const list = ranking(snap);
  const winner = list[0];
  return (
    <Overlay>
      <div className="text-center">
        <div className="text-5xl">{winner?.slot === mySlot ? "🏆" : "🏁"}</div>
        <h2 className="mt-2 font-serif text-3xl font-black italic" style={{ color: "#fff" }}>
          {winner?.slot === mySlot ? "Kazandın!" : `${winner?.name} kazandı!`}
        </h2>
      </div>
      <ol className="mt-5 space-y-2">
        {list.map((r, i) => {
          const theme = PLAYER_THEMES[r.slot];
          return (
            <li
              key={r.slot}
              className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5"
              style={i === 0 ? { boxShadow: `inset 0 0 0 2px ${theme.silk}` } : undefined}
            >
              <span className="w-8 text-center text-xl">{MEDALS[i]}</span>
              <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white" style={{ background: theme.silk }} />
              <span className="flex-1 truncate font-bold">
                {r.name}
                {r.slot === mySlot && <span className="ml-1.5 text-xs text-amber-300">SEN</span>}
                {r.bot && <span className="ml-1.5 text-xs font-semibold text-white/50">BOT</span>}
              </span>
              <span className="text-right text-xs text-white/60">
                <b className="text-sm text-white">
                  {r.pos}/{snap.steps}
                </b>
                <br />
                {r.throws} atış
              </span>
            </li>
          );
        })}
      </ol>
      {isHost ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onLobby}
            className="rounded-2xl bg-white/10 py-3 font-bold text-white transition-colors hover:bg-white/20"
          >
            Lobi
          </button>
          <button
            type="button"
            onClick={onRematch}
            className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-3 font-black text-slate-900 shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-[0_1px_0_#b45309]"
          >
            Rövanş!
          </button>
        </div>
      ) : (
        <>
          <p className="mt-5 rounded-xl bg-black/20 p-3 text-center text-sm font-semibold text-white/80">
            Rövanş için oda sahibini bekle…
          </p>
          <button
            type="button"
            onClick={onLeave}
            className="mt-3 w-full text-center text-xs font-semibold text-white/50 hover:text-white"
          >
            Odadan çık
          </button>
        </>
      )}
    </Overlay>
  );
}

function closeSession(s: Session) {
  if (s.role === "host") {
    clearInterval(s.timer);
    s.link?.close();
  } else if (s.role === "client") {
    s.link.close();
  }
}

function demoSnapshot(): RaceSnapshot {
  return {
    phase: "lobby",
    steps: 12,
    slots: PLAYER_THEMES.map((t, i) => ({
      slot: i,
      name: t.label,
      bot: false,
      connected: true,
      pos: 0,
      throws: 0,
      finishedAt: 0,
    })),
    countdownMs: 0,
    banner: null,
    round: 0,
  };
}

function Title() {
  return (
    <div className="text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">Panayır klasiği</p>
      <h1 className="mt-1 font-serif text-4xl font-black italic drop-shadow sm:text-5xl" style={{ color: "#fff" }}>
        At Yarışı
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-white/75">
        Herkes kendi telefonundan oynar. Topu yuvarla, deliğe sok, atın koşsun!
      </p>
    </div>
  );
}

function HowTo() {
  return (
    <details className="mt-4 rounded-xl bg-black/20 p-3 text-sm text-white/80">
      <summary className="cursor-pointer font-bold text-white">Nasıl oynanır?</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Biri oda kurar, diğerleri oda koduyla ya da QR ile katılır. En fazla 4 at; boş yerlere bot eklenebilir.</li>
        <li>
          Herkes ekranında tüm atları ve yalnızca <b>kendi atış masasını</b> görür. Sıra yok, herkes aynı anda atar.
        </li>
        <li>
          Topu yukarı kaydır ya da sapan gibi aşağı çekip bırak. Toptan çıkan <b>ok</b> ne kadar uzun ve kırmızıysa
          atış o kadar sert. Masa pürüzlü, top her zaman tam istediğin yere gitmez!
        </li>
        <li>
          Bilgisayarda <kbd>Boşluk</kbd> tuşunu basılı tut: ok sağa sola, güç aşağı yukarı gider. Doğru anda bırak!
        </li>
        <li>
          <span className="font-bold text-yellow-300">Sarı +1</span>,{" "}
          <span className="font-bold text-blue-300">mavi +2</span>,{" "}
          <span className="font-bold text-rose-400">kırmızı +3</span> adım. Top yavaşlarken deliğe düşer; çok sert
          atarsan geri döner.
        </li>
      </ul>
    </details>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-xl bg-amber-300/15 p-3 text-center text-sm font-semibold text-amber-100">{children}</p>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-3.5 text-lg font-black text-slate-900 shadow-[0_6px_0_#b45309] transition-transform active:translate-y-1 active:shadow-[0_2px_0_#b45309] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-slate-950/55 backdrop-blur-[3px]">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-b from-[#14532d]/95 to-[#052e16]/95 p-5 shadow-2xl sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/55 text-lg text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-950/75"
    >
      {children}
    </button>
  );
}
