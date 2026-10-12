// Anbindung an Online-Shops (inoffizielle, reverse-engineerte Schnittstellen – können sich jederzeit ändern).
// Übernommen aus der Juli-Version (Supabase Edge Functions knuspr-* / picnic-*), angepasst an Cloudflare Workers.
//   Knuspr: rohlik-mcp / knuspr-api (GitHub)   Picnic: MRVDH/picnic-api (GitHub)

export interface ShopEnv {
  CREDENTIALS_KEY?: string;
  DATABASE_URL: string;
}

export interface ProductResult {
  productId: string;
  name: string;
  price?: string;
  amount?: string;
  imageUrl?: string;
}

// ---------- Verschlüsselung (AES-GCM) ----------
// Schlüssel aus dem Secret CREDENTIALS_KEY; ohne Secret ersatzweise aus DATABASE_URL abgeleitet
// (dann müssen Shops nach einer Änderung des Datenbank-Passworts neu verbunden werden).

async function aesKey(env: ShopEnv): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`meal-plan-credentials:${env.CREDENTIALS_KEY || env.DATABASE_URL}`);
  const hash = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encrypt(env: ShopEnv, value: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), new TextEncoder().encode(value));
  return { ciphertext: toB64(new Uint8Array(enc)), iv: toB64(iv) };
}

export async function decrypt(env: ShopEnv, ciphertext: string, iv: string): Promise<string> {
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await aesKey(env), fromB64(ciphertext));
  return new TextDecoder().decode(dec);
}

export class ShopError extends Error {
  code: "login_failed" | "not_connected" | "failed";
  constructor(message: string, code: "login_failed" | "not_connected" | "failed" = "failed") {
    super(message);
    this.code = code;
  }
}

// ---------- Knuspr ----------

const KNUSPR = "https://www.knuspr.de";
const KNUSPR_CDN = "https://cdn.knuspr.de";
const BROWSER_UA = "Mozilla/5.0 (compatible; MealPlanningApp/1.0)";

/** Login → Cookie-Header für Folgeanfragen */
export async function knusprLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${KNUSPR}/services/frontend-service/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": BROWSER_UA },
    body: JSON.stringify({ email, password, name: "" }),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ") || res.headers.get("set-cookie") || "";
  if (!res.ok || !cookieHeader) throw new ShopError("Knuspr-Login fehlgeschlagen – bitte Zugangsdaten prüfen", "login_failed");
  return cookieHeader;
}

export async function knusprSearch(cookie: string, query: string): Promise<ProductResult[]> {
  const params = new URLSearchParams({ search: query, offset: "0", limit: "8", companyId: "1", canCorrect: "true" });
  const res = await fetch(`${KNUSPR}/services/frontend-service/search-metadata?${params}`, {
    headers: { Cookie: cookie, "User-Agent": BROWSER_UA },
  });
  if (!res.ok) throw new ShopError(`Knuspr-Suche fehlgeschlagen (${res.status})`);
  const data = (await res.json()) as any;
  return (data?.data?.productList ?? []).map((p: any) => ({
    productId: String(p.productId),
    name: p.productName,
    price: p.price ? `${p.price.full} ${p.price.currency}` : undefined,
    amount: p.textualAmount,
    imageUrl: p.imgPath ? `${KNUSPR_CDN}${p.imgPath}` : undefined,
  }));
}

export async function knusprAddToCart(cookie: string, productId: string, quantity = 1): Promise<boolean> {
  const res = await fetch(`${KNUSPR}/services/frontend-service/v2/cart`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", "User-Agent": BROWSER_UA },
    body: JSON.stringify({ actionId: null, productId: Number(productId), quantity, recipeId: null, source: "true:Meal Planning App" }),
  });
  return res.ok;
}

export interface CartItem {
  productId: string;
  /** Kennung der Warenkorb-Zeile (zum Entfernen) */
  orderFieldId?: string;
  name: string;
  quantity: number;
  price?: string;
  /** Preis der Zeile (Menge × Stückpreis) */
  lineTotal?: number;
  imageUrl?: string;
}

/** Zahl aus Preisangaben wie 1.99, "1,99" oder { full: 1.99 } */
function num(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "object") return num(v.full ?? v.amount ?? v.value);
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && String(v).trim() !== "" ? n : null;
}

/** Aktueller Knuspr-Warenkorb mit Summe (Antwortformat defensiv lesen – die API ist nicht offiziell dokumentiert) */
export async function knusprGetCartSummary(cookie: string): Promise<{ items: CartItem[]; total: number | null }> {
  const res = await fetch(`${KNUSPR}/services/frontend-service/v2/cart`, {
    headers: { Cookie: cookie, "User-Agent": BROWSER_UA },
  });
  if (!res.ok) throw new ShopError(`Knuspr-Warenkorb nicht lesbar (${res.status})`);
  const data = (await res.json()) as any;
  const root = data?.data ?? data;
  const raw = root?.items ?? [];
  const list: any[] = Array.isArray(raw) ? raw : Object.values(raw);
  const items = list
    .map((p) => {
      const quantity = Number(p.quantity ?? p.amount ?? 1) || 1;
      const unit = num(p.price);
      const lineTotal = num(p.totalPrice) ?? (unit != null ? unit * quantity : null);
      const currency = p.price?.currency ?? p.totalPrice?.currency ?? "€";
      const img = p.imgPath ?? p.image ?? p.imageUrl;
      const orderFieldId = p.orderFieldId ?? p.orderFieldID ?? p.cartItemId;
      return {
        productId: String(p.productId ?? p.id ?? ""),
        orderFieldId: orderFieldId != null ? String(orderFieldId) : undefined,
        name: String(p.productName ?? p.name ?? ""),
        quantity,
        price: unit != null ? `${unit.toFixed(2).replace(".", ",")} ${currency === "EUR" ? "€" : currency}` : undefined,
        lineTotal: lineTotal ?? undefined,
        imageUrl: typeof img === "string" ? (img.startsWith("http") ? img : `${KNUSPR_CDN}${img}`) : undefined,
      };
    })
    .filter((i) => i.productId);
  const summed = items.every((i) => i.lineTotal != null) ? items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) : null;
  const total = num(root?.totalPrice) ?? summed;
  return { items, total: total != null ? Math.round(total * 100) / 100 : null };
}

export async function knusprGetCart(cookie: string): Promise<CartItem[]> {
  return (await knusprGetCartSummary(cookie)).items;
}

/** Eine Zeile aus dem Knuspr-Warenkorb entfernen */
export async function knusprRemoveFromCart(cookie: string, orderFieldId: string): Promise<boolean> {
  const res = await fetch(`${KNUSPR}/services/frontend-service/v2/cart?orderFieldId=${encodeURIComponent(orderFieldId)}`, {
    method: "DELETE",
    headers: { Cookie: cookie, "User-Agent": BROWSER_UA },
  });
  return res.ok;
}

/** Menge eines Produkts setzen: Zeile entfernen und mit der neuen Menge wieder hinzufügen (0 = nur entfernen) */
export async function knusprSetQuantity(cookie: string, item: CartItem, quantity: number): Promise<void> {
  if (!item.orderFieldId) throw new ShopError("Dieser Artikel lässt sich im Knuspr-Warenkorb nicht ändern.");
  if (!(await knusprRemoveFromCart(cookie, item.orderFieldId))) throw new ShopError("Knuspr hat die Änderung abgelehnt.");
  if (quantity > 0 && !(await knusprAddToCart(cookie, item.productId, quantity))) {
    throw new ShopError("Die neue Menge konnte nicht gespeichert werden – bitte im Knuspr-Warenkorb prüfen.");
  }
}

// ---------- Picnic ----------

const PICNIC = "https://storefront-prod.de.picnicinternational.com/api/15";
const PICNIC_AGENT = "30100;1.236.1-15553;";

function picnicHeaders(auth?: string, deviceId?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    "User-Agent": "okhttp/4.9.0",
    "Accept-Language": "de",
    "x-picnic-agent": PICNIC_AGENT,
  };
  if (auth) h["x-picnic-auth"] = auth;
  if (deviceId) h["x-picnic-did"] = deviceId;
  return h;
}

async function md5Hex(value: string): Promise<string> {
  // Picnic verlangt das Passwort MD5-gehasht. Cloudflare Workers können MD5 in crypto.subtle,
  // ersatzweise über node:crypto (nodejs_compat ist aktiv).
  try {
    const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(value));
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // @ts-ignore – node:crypto ist über nodejs_compat verfügbar
    const nodeCrypto: any = await import("node:crypto");
    return nodeCrypto.createHash("md5").update(value, "utf8").digest("hex");
  }
}

/** Schritt 1: Login. Verlangt Picnic eine SMS-Bestätigung, wird der Code direkt angefordert. */
export async function picnicLogin(
  email: string,
  password: string
): Promise<{ authKey: string; deviceId: string; needs2fa: boolean }> {
  const deviceId = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const res = await fetch(`${PICNIC}/user/login`, {
    method: "POST",
    headers: picnicHeaders(undefined, deviceId),
    body: JSON.stringify({ key: email, secret: await md5Hex(password), client_id: 30100 }),
  });
  const authKey = res.headers.get("x-picnic-auth");
  if (!res.ok || !authKey) throw new ShopError("Picnic-Login fehlgeschlagen – bitte Zugangsdaten prüfen", "login_failed");
  const data = (await res.json().catch(() => ({}))) as any;
  if (data?.second_factor_authentication_required) {
    const gen = await fetch(`${PICNIC}/user/2fa/generate`, {
      method: "POST",
      headers: picnicHeaders(authKey, deviceId),
      body: JSON.stringify({ channel: "SMS" }),
    });
    if (!gen.ok) throw new ShopError("Picnic konnte keinen SMS-Code senden");
    return { authKey, deviceId, needs2fa: true };
  }
  return { authKey, deviceId, needs2fa: false };
}

/** Schritt 2 (nur bei SMS-Bestätigung): Code prüfen → endgültiger Sitzungs-Token */
export async function picnicVerify(tempAuthKey: string, deviceId: string, code: string): Promise<string> {
  const res = await fetch(`${PICNIC}/user/2fa/verify`, {
    method: "POST",
    headers: picnicHeaders(tempAuthKey, deviceId),
    body: JSON.stringify({ otp: code.trim() }),
  });
  const authKey = res.headers.get("x-picnic-auth");
  if (!res.ok || !authKey) throw new ShopError("SMS-Code ungültig oder abgelaufen", "login_failed");
  return authKey;
}

/** Picnic liefert einen verschachtelten Seitenbaum – alle „sellingUnit“-Objekte darin einsammeln */
function extractSellingUnits(node: unknown, out: any[] = []): any[] {
  if (Array.isArray(node)) for (const item of node) extractSellingUnits(item, out);
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "sellingUnit" && value && typeof value === "object") out.push(value);
      else extractSellingUnits(value, out);
    }
  }
  return out;
}

export async function picnicSearch(authKey: string, deviceId: string, query: string): Promise<ProductResult[]> {
  const res = await fetch(`${PICNIC}/pages/search-page-results?search_term=${encodeURIComponent(query)}`, {
    headers: picnicHeaders(authKey, deviceId),
  });
  if (res.status === 401 || res.status === 403) {
    throw new ShopError("Picnic-Sitzung abgelaufen – bitte neu verbinden", "not_connected");
  }
  if (!res.ok) throw new ShopError(`Picnic-Suche fehlgeschlagen (${res.status})`);
  const seen = new Set<string>();
  return extractSellingUnits(await res.json())
    .filter((su) => su?.id && !seen.has(su.id) && seen.add(su.id))
    .slice(0, 8)
    .map((su) => ({
      productId: String(su.id),
      name: su.name,
      price: typeof su.display_price === "number" ? `${(su.display_price / 100).toFixed(2).replace(".", ",")} €` : undefined,
      amount: su.unit_quantity,
      imageUrl: su.image_id
        ? `https://storefront-prod.de.picnicinternational.com/static/images/${su.image_id}/medium.png`
        : undefined,
    }));
}
