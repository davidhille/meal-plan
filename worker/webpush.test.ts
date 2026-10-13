import { describe, expect, test } from "bun:test";
import { b64urlDecode, b64urlEncode, encryptPayload, generateVapidKeys, sendWebPush, vapidAuthorization } from "./webpush";

const enc = new TextEncoder();

async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
const cat = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of p) (out.set(x, o), (o += x.length));
  return out;
};

/** Ein „Browser“: Schlüsselpaar + Auth-Geheimnis, und Entschlüsseln wie im RFC 8291 beschrieben */
async function fakeBrowser() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const uaPublic = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: "https://push.example.com/abc", p256dh: b64urlEncode(uaPublic), auth: b64urlEncode(auth) };
  const decrypt = async (body: Uint8Array) => {
    const salt = body.slice(0, 16);
    const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
    const idlen = body[20];
    const asPublic = body.slice(21, 21 + idlen);
    const ciphertext = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, pair.privateKey, 256));
    const prkKey = await hmac(auth, secret);
    const ikm = await hmac(prkKey, cat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
    const prk = await hmac(salt, ikm);
    const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
    const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
    const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, ciphertext));
    return { rs, idlen, delimiter: plain[plain.length - 1], text: new TextDecoder().decode(plain.slice(0, -1)) };
  };
  return { sub, decrypt };
}

describe("Web Push", () => {
  test("base64url hin und zurück", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(65));
    expect(b64urlDecode(b64urlEncode(bytes))).toEqual(bytes);
    expect(b64urlEncode(bytes)).not.toMatch(/[+/=]/);
  });

  test("Browser kann die Nachricht entschlüsseln (aes128gcm)", async () => {
    const browser = await fakeBrowser();
    const payload = JSON.stringify({ title: "Wie war das Essen?", body: "„Käsespätzle“ – kurz bewerten?" });
    const out = await browser.decrypt(await encryptPayload(browser.sub, payload));
    expect(out).toEqual({ rs: 4096, idlen: 65, delimiter: 2, text: payload });
  });

  test("VAPID: gültige ES256-Signatur, Empfänger ist der Push-Dienst", async () => {
    const keys = await generateVapidKeys();
    expect(b64urlDecode(keys.publicKey)).toHaveLength(65);
    const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/xyz", keys, "https://example.com");
    const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
    expect(m[4]).toBe(keys.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2])));
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("https://example.com");
    const pub = await crypto.subtle.importKey("raw", b64urlDecode(keys.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64urlDecode(m[3]), enc.encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });

  test("Antworten des Push-Dienstes: 201 ok, 410 Abo weg", async () => {
    const browser = await fakeBrowser();
    const keys = await generateVapidKeys();
    let seen: RequestInit | undefined;
    const ok = await sendWebPush(browser.sub, "{}", keys, "https://example.com", (async (_u: string, init: RequestInit) => {
      seen = init;
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch);
    expect(ok).toBe("ok");
    expect((seen!.headers as Record<string, string>)["Content-Encoding"]).toBe("aes128gcm");
    const gone = await sendWebPush(browser.sub, "{}", keys, "https://example.com", (async () =>
      new Response(null, { status: 410 })) as unknown as typeof fetch);
    expect(gone).toBe("gone");
  });
});

describe("RFC 8291, Anhang A", () => {
  test("Testvektor lässt sich mit derselben Schlüsselableitung entschlüsseln", async () => {
    const uaPublic = b64urlDecode("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
    const uaPrivate = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: b64urlEncode(uaPublic.slice(1, 33)), y: b64urlEncode(uaPublic.slice(33)), d: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94" },
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );
    const auth = b64urlDecode("BTBZMqHH6r4Tts7J_aSIgg");
    const body = b64urlDecode(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
    );
    const salt = body.slice(0, 16);
    const asPublic = body.slice(21, 21 + body[20]);
    const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPrivate, 256));
    const ikm = await hmac(await hmac(auth, secret), cat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
    const prk = await hmac(salt, ikm);
    const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
    const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
    const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, body.slice(21 + body[20])));
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe("When I grow up, I want to be a watermelon");
  });
});
