"use client";

import dynamic from "next/dynamic";

// Oyun tamamen tarayıcıda çalışır (kanvas, WebRTC, localStorage).
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#0b2a17]" />,
});

export default function ClientGame() {
  return <Game />;
}
