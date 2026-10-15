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

export const metadata: Metadata = {
  title: "At Yarışı — Lunapark klasiği, herkes kendi telefonundan",
  description:
    "Lunaparkların klasik at yarışı oyunu: topu deliğe yuvarla, atını koştur. Oda kur, arkadaşların kodla katılsın; 4 kişiye kadar aynı anda.",
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
