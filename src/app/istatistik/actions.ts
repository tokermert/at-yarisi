"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STATS_COOKIE, safeEqual, sessionToken } from "@/lib/stats";

export async function login(formData: FormData) {
  const pw = String(formData.get("sifre") ?? "");
  const expected = process.env.STATS_PASSWORD;
  if (!expected || !safeEqual(pw, expected)) redirect("/istatistik?hata=1");
  const store = await cookies();
  store.set(STATS_COOKIE, sessionToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/istatistik",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/istatistik");
}

export async function logout() {
  const store = await cookies();
  store.delete({ name: STATS_COOKIE, path: "/istatistik" });
  redirect("/istatistik");
}
