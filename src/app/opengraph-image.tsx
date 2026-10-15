import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "At Yarışı: panayırların efsanesi, şimdi telefonunda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  { color: "#dc2647", holes: 2, w: 230 },
  { color: "#2563eb", holes: 3, w: 330 },
  { color: "#facc15", holes: 4, w: 430 },
];
const SILKS = ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e"];

/** WhatsApp, Instagram vb. link önizlemesinde görünen kart. */
export default async function OpenGraphImage() {
  const dir = join(process.cwd(), "assets/fonts");
  const [manrope, playfair, playfairExt] = await Promise.all([
    readFile(join(dir, "Manrope-ExtraBold.ttf")),
    readFile(join(dir, "playfair-display-latin-900-italic.woff")),
    readFile(join(dir, "playfair-display-latin-ext-900-italic.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(120% 120% at 30% 30%, #1f7a3d 0%, #0b3a1c 55%, #04170a 100%)",
          color: "white",
          fontFamily: "Manrope",
        }}
      >
        {/* Bayrak süsü */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 20px" }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 0,
                height: 0,
                borderLeft: "22px solid transparent",
                borderRight: "22px solid transparent",
                borderTop: `44px solid ${["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#ffffff"][i % 5]}`,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 80px", width: 680 }}>
          <div style={{ fontSize: 30, letterSpacing: 10, color: "#fcd34d" }}>PANAYIRLARIN EFSANESİ</div>
          <div style={{ fontFamily: "Playfair", fontStyle: "italic", fontWeight: 900, fontSize: 140, lineHeight: 1.05, marginTop: 10, color: "#fde68a" }}>At Yarışı</div>
          <div style={{ fontSize: 36, marginTop: 22, color: "#f0fdf4" }}>Topu yuvarla, atın koşsun!</div>
          <div style={{ display: "flex", gap: 14, marginTop: 34 }}>
            {SILKS.map((c, i) => (
              <div
                key={c}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: c,
                  border: "4px solid white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                {i + 1}
              </div>
            ))}
            <div style={{ fontSize: 28, marginLeft: 10, alignSelf: "center", color: "#d1fae5" }}>4 kişiye kadar online</div>
          </div>
        </div>

        {/* Atış masası */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              width: 440,
              height: 500,
              padding: "50px 0",
              borderRadius: 28,
              background: "#f7f3ea",
              border: "22px solid #a8743f",
              transform: "rotate(4deg)",
            }}
          >
            {ROWS.map((r) => (
              <div
                key={r.color}
                style={{
                  width: r.w * 0.85,
                  height: 92,
                  background: r.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                }}
              >
                {Array.from({ length: r.holes }).map((_, i) => (
                  <div key={i} style={{ width: 62, height: 62, borderRadius: 31, background: "#0f172a" }} />
                ))}
              </div>
            ))}
            <div style={{ marginTop: 30, width: 46, height: 46, borderRadius: 23, background: "radial-gradient(circle at 35% 35%, #fff 0%, #f87171 30%, #b91c1c 100%)" }} />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Manrope", data: manrope, style: "normal", weight: 800 },
        { name: "Playfair", data: playfair, style: "italic", weight: 900 },
        { name: "Playfair", data: playfairExt, style: "italic", weight: 900 },
      ],
    },
  );
}
