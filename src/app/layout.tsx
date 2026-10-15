import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["700", "900"],
  style: ["italic"],
  display: "swap",
});

// Vercel'de canlı alan adı otomatik gelir; link önizlemelerinde mutlak adres için gerekli.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const TITLE = "At Yarışı — Panayırların efsanesi, şimdi telefonunda";
const DESCRIPTION =
  "Topu yuvarla, deliğe sok, atın koşsun! Oda kur, arkadaşların kodla katılsın; 4 kişiye kadar online, gerçek yarış anlatımıyla.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { type: "website", locale: "tr_TR", siteName: "At Yarışı", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  title: "At Yarışı — Panayır klasiği, herkes kendi telefonundan",
  description:
    "Panayırların klasik at yarışı oyunu: topu deliğe yuvarla, atını koştur. Oda kur, arkadaşların kodla katılsın; 4 kişiye kadar aynı anda.",
  applicationName: "At Yarışı",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b2a17",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${manrope.variable} ${playfair.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
