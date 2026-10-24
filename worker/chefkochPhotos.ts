// Chefkoch-Fotos kommen aus dem Browser, nicht aus dem Worker: das Chefkoch-CDN (img.chefkoch-cdn.de) weist Abrufe aus Cloudflare-Workers
// mit 403 ab (Cron wie Anfragen), aus dem Browser der Nutzer klappt es (CORS erlaubt, geprüft am 24.10.2026).
// Ablauf: Die App fragt `chefkochPhotoTodo` (Rezepte ohne Foto samt Bild-Adresse von der Rezeptseite), lädt die Bilder selbst und
// schickt sie an `saveChefkochPhoto`.
import type { Sql } from "./db";
import { loadChefkochRecipe } from "./chefkoch";
import { storeImage } from "./images";
import { UserError } from "./http";

/** Höchstens so viele Versuche je Rezept (jede Ausgabe in der Aufgabenliste zählt einen) */
export const PHOTO_ATTEMPTS = 5;
export const MAX_PHOTO_BYTES = 4_000_000;
/** Nur von diesem Host darf die App Fotos laden */
export const CHEFKOCH_IMAGE_HOST = "img.chefkoch-cdn.de";

/** Bildformat an den ersten Bytes erkennen (JPEG, PNG, WebP); alles andere → null */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Ist die Adresse ein Chefkoch-Bild? (https, richtiger Host) */
export function isChefkochImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === CHEFKOCH_IMAGE_HOST;
  } catch {
    return false;
  }
}

/**
 * Rezepte der Familie ohne Foto (Chefkoch-Import, noch keine 5 Versuche, Foto nicht bewusst entfernt) samt Bild-Adresse.
 * Die Adresse steht auf der Rezeptseite (www.chefkoch.de, die der Worker abrufen darf). Jede Ausgabe zählt einen Versuch.
 */
export async function chefkochPhotoTodo(sql: Sql, profileId: string, limit = 3): Promise<{ name: string; photoUrl: string }[]> {
  const rows = await sql`SELECT r.name, r.source_url FROM recipes r
    WHERE r.profile_id = ${profileId} AND r.source = 'import' AND r.source_url LIKE '%chefkoch.de%' AND r.photo_attempts < ${PHOTO_ATTEMPTS}
      AND NOT EXISTS (SELECT 1 FROM meal_images mi WHERE mi.profile_id = r.profile_id AND mi.meal_name = r.name
        AND (mi.image_data IS NOT NULL OR mi.source = 'removed'))
    ORDER BY r.created_at DESC LIMIT ${limit}`;
  const items: { name: string; photoUrl: string }[] = [];
  for (const row of rows) {
    const name = row.name as string;
    await sql`UPDATE recipes SET photo_attempts = photo_attempts + 1 WHERE profile_id = ${profileId} AND name = ${name}`;
    try {
      const d = await loadChefkochRecipe(row.source_url as string);
      if (d.imageUrl && isChefkochImageUrl(d.imageUrl)) items.push({ name, photoUrl: d.imageUrl });
    } catch {
      // Seite gerade nicht erreichbar: der Versuch ist verbraucht, beim nächsten App-Start geht es weiter
    }
  }
  return items;
}

/** Foto aus dem Browser speichern – nur für ein Chefkoch-Rezept der Familie, das noch kein Foto hat */
export async function saveChefkochPhoto(sql: Sql, profileId: string, name: string, base64: string): Promise<string> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length < 16) throw new UserError("Das Foto ist ungültig.");
  if (Math.floor((base64.length * 3) / 4) > MAX_PHOTO_BYTES) throw new UserError("Das Foto ist größer als 4 MB.");
  const type = sniffImageType(Uint8Array.from(atob(base64.slice(0, 24)), (c) => c.charCodeAt(0)));
  if (!type) throw new UserError("Das Foto hat kein erlaubtes Bildformat (JPEG, PNG oder WebP).");
  const rows = await sql`SELECT r.source_url FROM recipes r
    WHERE r.profile_id = ${profileId} AND r.name = ${name} AND r.source = 'import' AND r.source_url LIKE '%chefkoch.de%'
      AND NOT EXISTS (SELECT 1 FROM meal_images mi WHERE mi.profile_id = r.profile_id AND mi.meal_name = r.name
        AND (mi.image_data IS NOT NULL OR mi.source = 'removed'))`;
  if (!rows[0]) throw new UserError("Für dieses Rezept wird kein Foto gebraucht.", 409);
  return storeImage(sql, name, { base64, contentType: type, source: "chefkoch", creditName: "Chefkoch", creditUrl: rows[0].source_url as string }, profileId);
}
