import { PLAYER_THEMES } from "./config";
import { drawHorse, roundRect } from "./draw";
import type { SlotView } from "./race";

const W = 1080;
const H = 1920;

/**
 * Yarış sonucunu Instagram story boyutunda (1080x1920) bir PNG'ye çizer.
 * Kazananın atı büyük, altında sıralama ve sitenin adresi yer alır.
 */
export async function renderResultCard(list: SlotView[], steps: number, mySlot: number | null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  await document.fonts?.ready;
  const serif = getComputedStyle(document.body).getPropertyValue("--font-playfair") || "serif";
  const sans = getComputedStyle(document.body).getPropertyValue("--font-manrope") || "system-ui";

  // Arka plan
  const bg = ctx.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.4, H * 0.8);
  bg.addColorStop(0, "#1f7a3d");
  bg.addColorStop(0.5, "#0b3a1c");
  bg.addColorStop(1, "#04170a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Işık huzmeleri
  ctx.save();
  ctx.translate(W / 2, H * 0.36);
  ctx.fillStyle = "rgba(255,230,140,0.06)";
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-60, -1400);
    ctx.lineTo(60, -1400);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Bayraklar
  const flags = ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#ffffff", "#ec4899"];
  for (let i = 0; i < 18; i++) {
    const x = 30 + i * 60;
    ctx.fillStyle = flags[i % flags.length];
    ctx.beginPath();
    ctx.moveTo(x - 22, 40);
    ctx.lineTo(x + 22, 40);
    ctx.lineTo(x, 90);
    ctx.closePath();
    ctx.fill();
  }
  // Konfeti
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H * 0.62;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * 6);
    ctx.fillStyle = flags[i % flags.length];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-9, -5, 18, 10);
    ctx.restore();
  }

  const winner = list[0];
  const wt = PLAYER_THEMES[winner.slot];
  const mine = mySlot !== null && winner.slot === mySlot;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fcd34d";
  ctx.font = `800 40px ${sans}, system-ui, sans-serif`;
  ctx.fillText("A T   Y A R I Ş I", W / 2, 200);

  ctx.font = `110px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.fillText("🏆", W / 2, 360);

  ctx.fillStyle = "#ffffff";
  ctx.font = `italic 900 104px ${serif}, Georgia, serif`;
  ctx.fillText(fit(ctx, mine ? "Kazandım!" : `${winner.name} kazandı!`, W - 120), W / 2, 500);

  // Kazananın atı
  drawHorse(
    ctx,
    W / 2,
    1010,
    470,
    {
      coat: wt.coat,
      coatDark: wt.coatDark,
      mane: wt.mane,
      silk: wt.silk,
      silkDark: wt.silkDark,
      cap: wt.cap,
      number: winner.slot + 1,
    },
    1.2,
    1,
  );

  // Sıralama
  const medals = ["🥇", "🥈", "🥉", "4."];
  const top = 1090;
  list.forEach((s, i) => {
    const y = top + i * 132;
    const t = PLAYER_THEMES[s.slot];
    ctx.fillStyle = s.slot === mySlot ? "rgba(253,224,71,0.18)" : "rgba(0,0,0,0.32)";
    roundRect(ctx, 110, y, W - 220, 112, 56);
    ctx.fill();
    if (i === 0) {
      ctx.strokeStyle = t.silk;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `56px system-ui, "Apple Color Emoji", sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(medals[i], 190, y + 58);
    ctx.fillStyle = t.silk;
    ctx.beginPath();
    ctx.arc(275, y + 56, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 50px ${sans}, system-ui, sans-serif`;
    const label = s.slot === mySlot ? `${s.name} (ben)` : s.bot ? `${s.name}` : s.name;
    ctx.fillText(fit(ctx, label, 520), 325, y + 58);
    ctx.textAlign = "right";
    ctx.font = `800 44px ${sans}, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(`${s.pos}/${steps}`, W - 150, y + 58);
  });

  // Alt bilgi
  const footY = top + list.length * 132 + 90;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fde68a";
  ctx.font = `italic 900 76px ${serif}, Georgia, serif`;
  ctx.fillText("At koşar, baht coşar!", W / 2, Math.min(footY, H - 170));
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `800 44px ${sans}, system-ui, sans-serif`;
  ctx.fillText(`Sen de yarış: ${window.location.host}`, W / 2, Math.min(footY + 80, H - 90));

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Görsel oluşturulamadı"))), "image/png"),
  );
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Görseli paylaşım menüsüyle paylaşır; desteklenmiyorsa indirir. */
export async function shareResultCard(blob: Blob, text: string) {
  const file = new File([blob], "at-yarisi-sonuc.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "at-yarisi-sonuc.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
