import type { DataConnection, Peer as PeerT, PeerOptions } from "peerjs";
import type { ClientMsg, HostMsg } from "./race";

const ID_PREFIX = "atyarisi-v1-";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

/**
 * Varsayılan olarak PeerJS'in ücretsiz bulut sunucusu kullanılır.
 * Kendi PeerServer'ını kullanmak için NEXT_PUBLIC_PEER_* değişkenlerini tanımla.
 */
function peerOptions(): PeerOptions {
  const host = process.env.NEXT_PUBLIC_PEER_HOST;
  if (!host) return { debug: 0 };
  return {
    host,
    port: Number(process.env.NEXT_PUBLIC_PEER_PORT || 443),
    path: process.env.NEXT_PUBLIC_PEER_PATH || "/",
    secure: process.env.NEXT_PUBLIC_PEER_SECURE !== "false",
    debug: 0,
  };
}

async function createPeer(id?: string): Promise<PeerT> {
  const { Peer } = await import("peerjs");
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const fail = (err: Error & { type?: string }) => {
      peer.destroy();
      reject(err);
    };
    peer.once("open", () => {
      peer.off("error", fail);
      resolve(peer);
    });
    peer.once("error", fail);
  });
}

export interface HostLink {
  code: string;
  broadcast(msg: HostMsg): void;
  sendTo(peerId: string, msg: HostMsg): void;
  close(): void;
}

export async function hostRoom(handlers: {
  onMessage: (peerId: string, msg: ClientMsg) => void;
  onLeave: (peerId: string) => void;
  onError: (message: string) => void;
}): Promise<HostLink> {
  let peer: PeerT | null = null;
  let code = "";
  for (let attempt = 0; attempt < 4 && !peer; attempt++) {
    code = randomCode();
    try {
      peer = await createPeer(ID_PREFIX + code);
    } catch (e) {
      if ((e as { type?: string }).type !== "unavailable-id") throw e;
    }
  }
  if (!peer) throw new Error("Oda kodu alınamadı");

  const conns = new Map<string, DataConnection>();
  peer.on("connection", (conn) => {
    conn.on("open", () => conns.set(conn.peer, conn));
    conn.on("data", (data) => handlers.onMessage(conn.peer, data as ClientMsg));
    const drop = () => {
      if (conns.get(conn.peer) === conn) {
        conns.delete(conn.peer);
        handlers.onLeave(conn.peer);
      }
    };
    conn.on("close", drop);
    conn.on("error", drop);
  });
  peer.on("disconnected", () => {
    // Sinyal sunucusu bağlantısı koptu; mevcut oyuncular etkilenmez, yeni katılım için yeniden bağlan.
    if (!peer?.destroyed) peer?.reconnect();
  });
  peer.on("error", (err) => {
    if ((err as { type?: string }).type === "peer-unavailable") return;
    handlers.onError(err.message);
  });

  const p = peer;
  return {
    code,
    broadcast(msg) {
      for (const c of conns.values()) if (c.open) c.send(msg);
    },
    sendTo(peerId, msg) {
      const c = conns.get(peerId);
      if (c?.open) c.send(msg);
    },
    close() {
      p.destroy();
    },
  };
}

export interface ClientLink {
  send(msg: ClientMsg): void;
  close(): void;
}

export async function joinRoom(
  code: string,
  handlers: { onMessage: (msg: HostMsg) => void; onClose: () => void },
): Promise<ClientLink> {
  const peer = await createPeer();
  return new Promise((resolve, reject) => {
    const conn = peer.connect(ID_PREFIX + normalizeCode(code), { reliable: true });
    let opened = false;
    const timer = setTimeout(() => {
      if (!opened) {
        peer.destroy();
        reject(new Error("Odaya bağlanılamadı. Kodu kontrol et."));
      }
    }, 12000);
    peer.on("error", (err) => {
      if (opened) return;
      clearTimeout(timer);
      peer.destroy();
      const type = (err as { type?: string }).type;
      reject(new Error(type === "peer-unavailable" ? "Bu kodla açık bir oda yok." : err.message));
    });
    conn.on("open", () => {
      opened = true;
      clearTimeout(timer);
      resolve({
        send(msg) {
          if (conn.open) conn.send(msg);
        },
        close() {
          peer.destroy();
        },
      });
    });
    conn.on("data", (data) => handlers.onMessage(data as HostMsg));
    conn.on("close", () => {
      if (opened) handlers.onClose();
    });
  });
}
