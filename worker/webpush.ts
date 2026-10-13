// Web Push ohne Bibliothek: Nachricht verschlüsseln (RFC 8291, aes128gcm) und mit VAPID signieren (RFC 8292).
// Nur WebCrypto – läuft im Worker und in Tests (bun).

export interface PushSubscriptionKeys {
  endpoint: string;
  /** Öffentlicher Schlüssel des Geräts (base64url, 65 Byte unkomprimiert) */
  p256dh: string;
  /** Auth-Geheimnis des Geräts (base64url, 16 Byte) */
  auth: string;
}

export interface VapidKeys {
  /** Öffentlicher Schlüssel (base64url, 65 Byte) – geht als applicationServerKey an den Browser */
  publicKey: string;
  /** Privater Schlüssel als JWK */
  privateJwk: JsonWebKey;
}

const enc = new TextEncoder();
const text = (s: string): Bytes => new Uint8Array(enc.encode(s));

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Bytes mit eigenem ArrayBuffer (so passen sie überall, wo WebCrypto/fetch BufferSource erwarten) */
type Bytes = Uint8Array<ArrayBuffer>;

export function b64urlDecode(s: string): Bytes {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** Neues VAPID-Schlüsselpaar */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const privateJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return { publicKey: b64urlEncode(raw), privateJwk };
}

/** VAPID-Header für den Push-Dienst des Geräts (gilt 12 Stunden) */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string): Promise<string> {
  const header = b64urlEncode(text(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    text(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }))
  );
  const key = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto liefert die Signatur schon im JWT-Format (r‖s, 64 Byte)
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, text(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${keys.publicKey}`;
}

/** Nutzdaten für ein Gerät verschlüsseln (aes128gcm, ein Datensatz) */
export async function encryptPayload(sub: PushSubscriptionKeys, payload: string, salt: Bytes = crypto.getRandomValues(new Uint8Array(16))): Promise<Bytes> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);

  // Einmal-Schlüsselpaar des Servers und gemeinsames Geheimnis (ECDH)
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // Standard heißt das Feld „public“, die Workers-Typen nennen es „$public“ – beides mitgeben
  const ecdhParams = { name: "ECDH", public: uaKey, $public: uaKey } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0];
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdhParams, local.privateKey, 256));

  // RFC 8291, Abschnitt 3.3/3.4 (HKDF mit je einem Block)
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(text("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(text("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(text("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  // Ein Datensatz: Inhalt + Trennbyte 0x02 (letzter Datensatz)
  const plaintext = concat(text(payload), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plaintext));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export type PushResult = "ok" | "gone" | "failed";

/** Nachricht an ein Gerät schicken. „gone“ = Abo ungültig (abbestellt/abgelaufen) → löschen */
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: string,
  keys: VapidKeys,
  subject: string,
  fetcher: typeof fetch = fetch
): Promise<PushResult> {
  const body = await encryptPayload(sub, payload);
  const res = await fetcher(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(12 * 3600),
      Urgency: "normal",
    },
    body,
  });
  if (res.status === 404 || res.status === 410) return "gone";
  if (!res.ok) {
    console.warn(`Push an ${new URL(sub.endpoint).host} fehlgeschlagen: ${res.status} ${await res.text().catch(() => "")}`);
    return "failed";
  }
  return "ok";
}
