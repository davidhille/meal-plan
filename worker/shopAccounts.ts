// Shop-Konten (Knuspr, Picnic): Verbindungen verschlüsselt speichern/laden, Zustand für die Einstellungen.
import type { Sql } from "./db";
import type { Env } from "./http";
import { encrypt, decrypt } from "./shops";
import { SHOP_LABELS, getLabels, getShopRules } from "./shoppingList";

export async function enableShopLabel(sql: Sql, profileId: string, provider: string) {
  const meta = SHOP_LABELS[provider];
  await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort, provider)
    VALUES (${profileId}, ${provider}, ${meta.name}, ${meta.color},
            (SELECT COALESCE(MAX(sort), 0) + 1 FROM shopping_labels WHERE profile_id = ${profileId}), ${provider})
    ON CONFLICT (profile_id, id) DO UPDATE SET provider = EXCLUDED.provider`;
}

export async function saveConnection(env: Env, sql: Sql, profileId: string, provider: string, email: string, secret: string, deviceId: string | null) {
  const enc = await encrypt(env, secret);
  await sql`INSERT INTO shop_connections (profile_id, provider, email, secret_enc, secret_iv, device_id, updated_at)
    VALUES (${profileId}, ${provider}, ${email}, ${enc.ciphertext}, ${enc.iv}, ${deviceId}, now())
    ON CONFLICT (profile_id, provider) DO UPDATE SET email = EXCLUDED.email, secret_enc = EXCLUDED.secret_enc,
      secret_iv = EXCLUDED.secret_iv, device_id = EXCLUDED.device_id, updated_at = now()`;
}

export async function loadConnection(env: Env, sql: Sql, profileId: string, provider: string) {
  const rows = await sql`SELECT email, secret_enc, secret_iv, device_id FROM shop_connections
    WHERE profile_id = ${profileId} AND provider = ${provider}`;
  if (!rows[0]) return null;
  try {
    return {
      email: rows[0].email as string,
      secret: await decrypt(env, rows[0].secret_enc, rows[0].secret_iv),
      deviceId: rows[0].device_id as string | null,
    };
  } catch {
    // Schlüssel geändert → Verbindung unbrauchbar, neu verbinden lassen
    return null;
  }
}

/** Zustand für die Einstellungen: Standard-Liste, Metzger-Automatik, aktive Shops, Verbindungen, Regeln */
export async function getShopState(sql: Sql, profileId: string) {
  const [labels, settings, conns, rules] = await Promise.all([
    getLabels(sql, profileId),
    sql`SELECT standard_label, metzger_auto FROM profiles WHERE id = ${profileId}`,
    sql`SELECT provider, email, updated_at FROM shop_connections WHERE profile_id = ${profileId}`,
    getShopRules(sql, profileId),
  ]);
  const ids = new Set(labels.map((l) => l.id));
  return {
    labels,
    standardLabel: settings[0]?.standard_label && ids.has(settings[0].standard_label) ? settings[0].standard_label : ids.has("knuspr") ? "knuspr" : labels[0]?.id,
    metzgerAuto: settings[0]?.metzger_auto !== false,
    activeShops: labels.filter((l) => l.provider).map((l) => l.provider),
    connections: Object.fromEntries(conns.map((c) => [c.provider, { email: c.email, since: c.updated_at }])),
    rules,
  };
}
