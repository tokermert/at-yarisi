/**
 * Anonim kullanım istatistikleri (Supabase). İsim ya da kişisel veri gönderilmez;
 * her cihaz rastgele bir kimlikle sayılır. Ortam değişkenleri yoksa hiçbir şey yapmaz.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type EventType =
  | "visit"
  | "room_created"
  | "room_joined"
  | "race_played"
  | "race_started"
  | "race_finished";

let deviceId: string | null = null;

function getDeviceId() {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem("atyarisi:device");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("atyarisi:device", deviceId);
    }
  } catch {
    deviceId = "anon";
  }
  return deviceId;
}

export function track(type: EventType, roomCode: string | null = null, data: Record<string, unknown> = {}) {
  if (!URL || !KEY || typeof window === "undefined") return;
  fetch(`${URL}/rest/v1/events`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ type, device_id: getDeviceId(), room_code: roomCode, data }),
    keepalive: true,
  }).catch(() => {
    /* istatistik gönderilemezse oyun etkilenmesin */
  });
}
