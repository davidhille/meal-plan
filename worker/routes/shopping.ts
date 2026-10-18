// Einkaufsliste, Produkt-Verknüpfungen, eigener Vorrat, Listen (Labels)
import type { Ctx } from "../http";
import { json } from "../http";
import { isPantry, mergeKey } from "../shopping";
import { DEFAULT_LABELS, getLabels, getShopping, parsePrice, prefKey } from "../shoppingList";
import { getProfile, planOwned } from "../repo";


export async function shoppingRoutes({ request, sql, body, parts, route, id }: Ctx): Promise<Response | null> {
  // ---------- Einkaufsliste ----------
  if (parts[0] === "plans" && id && parts[2] === "shopping") {
    const p = await getProfile(sql);
    if (!(await planOwned(sql, p.id, id))) return json({ error: "Plan nicht gefunden" }, 404);
    const itemId = parts[3] ? decodeURIComponent(parts[3]) : "";

    const qs = new URL(request.url).searchParams;
    const range = qs.get("from") && qs.get("to") ? { from: qs.get("from")!, to: qs.get("to")! } : undefined;
    if (request.method === "GET" && !itemId) return json(await getShopping(sql, p.id, id, range));

    // Eigenen Artikel / Basic hinzufügen (oder mehrere auf einmal, z. B. Zutaten eines Nachtischs)
    if (request.method === "POST" && !itemId) {
      const names = (Array.isArray(body.names) ? body.names : [body.name])
        .map((n: unknown) => String(n ?? "").trim())
        .filter(Boolean)
        .slice(0, 50);
      if (!names.length) return json({ error: "Name fehlt" }, 400);
      await sql`INSERT INTO shopping_extras (plan_id, name, label, is_basic)
        SELECT ${id}, n, ${body.label || "knuspr"}, ${!!body.isBasic} FROM unnest(${names}::text[]) AS n`;
      return json(await getShopping(sql, p.id, id, range));
    }

    // Abhaken / Label ändern
    if (request.method === "PATCH" && itemId) {
      if (itemId.startsWith("x:")) {
        const xid = itemId.slice(2);
        if (body.checked !== undefined) await sql`UPDATE shopping_extras SET checked = ${!!body.checked} WHERE id = ${xid} AND plan_id = ${id}`;
        if (body.label) {
          await sql`UPDATE shopping_extras SET label = ${body.label} WHERE id = ${xid} AND plan_id = ${id}`;
          if (!body.isBasic && body.baseName) {
            await sql`INSERT INTO ingredient_prefs (profile_id, name_key, label) VALUES (${p.id}, ${prefKey(body.baseName)}, ${body.label})
              ON CONFLICT (profile_id, name_key) DO UPDATE SET label = EXCLUDED.label, updated_at = now()`;
          }
        }
      } else if (itemId.startsWith("p:")) {
        const key = itemId.slice(2);
        await sql`INSERT INTO shopping_item_state (plan_id, item_key, checked, label)
          VALUES (${id}, ${key}, ${!!body.checked}, ${body.label ?? null})
          ON CONFLICT (plan_id, item_key) DO UPDATE SET
            checked = CASE WHEN ${body.checked === undefined} THEN shopping_item_state.checked ELSE EXCLUDED.checked END,
            label = COALESCE(EXCLUDED.label, shopping_item_state.label)`;
        // Label für künftige Pläne merken
        if (body.label && body.baseName) {
          await sql`INSERT INTO ingredient_prefs (profile_id, name_key, label) VALUES (${p.id}, ${prefKey(body.baseName)}, ${body.label})
            ON CONFLICT (profile_id, name_key) DO UPDATE SET label = EXCLUDED.label, updated_at = now()`;
        }
      }
      return json({ ok: true });
    }

    // Eigenen Artikel / Basic entfernen
    if (request.method === "DELETE" && itemId.startsWith("x:")) {
      await sql`DELETE FROM shopping_extras WHERE id = ${itemId.slice(2)} AND plan_id = ${id}`;
      return json({ ok: true });
    }
  }

  // Produkt eines Shops pro Zutat merken (gilt für alle Pläne)
  if (route === "PUT /product-links") {
    const p = await getProfile(sql);
    const name = String(body.name ?? "").trim();
    if (!name || !body.provider || !body.productId) return json({ error: "Angaben fehlen" }, 400);
    await sql`INSERT INTO product_links (profile_id, name_key, provider, product_id, product_name, image_url, price, amount)
      VALUES (${p.id}, ${prefKey(name)}, ${body.provider}, ${String(body.productId)}, ${body.productName ?? null}, ${body.imageUrl ?? null},
              ${parsePrice(body.price)}, ${body.amount ? String(body.amount).slice(0, 60) : null})
      ON CONFLICT (profile_id, name_key, provider) DO UPDATE SET product_id = EXCLUDED.product_id,
        product_name = EXCLUDED.product_name, image_url = EXCLUDED.image_url,
        price = EXCLUDED.price, amount = EXCLUDED.amount, updated_at = now()`;
    return json({ ok: true });
  }

  // Verknüpfung wieder lösen (Zutat hat dann kein festes Produkt mehr)
  if (route === "DELETE /product-links") {
    const p = await getProfile(sql);
    const name = String(new URL(request.url).searchParams.get("name") ?? "").trim();
    const provider = String(new URL(request.url).searchParams.get("provider") ?? "");
    if (!name || !provider) return json({ error: "Angaben fehlen" }, 400);
    await sql`DELETE FROM product_links WHERE profile_id = ${p.id} AND name_key = ${prefKey(name)} AND provider = ${provider}`;
    return json({ ok: true });
  }

  // ---------- Vorrat (kommt nicht auf die Liste) ----------
  // Hinzufügen: herausgenommenen Standard-Eintrag zurückholen, sonst eigener Eintrag
  if (route === "POST /pantry") {
    const p = await getProfile(sql);
    const name = String(body.name ?? "").replace(/\(.*?\)/g, "").trim().slice(0, 80);
    if (!name) return json({ error: "Name fehlt" }, 400);
    const key = mergeKey(name);
    const restored = await sql`DELETE FROM pantry_items WHERE profile_id = ${p.id} AND name_key = ${key} AND excluded RETURNING name_key`;
    if (!restored[0] && !isPantry(name)) {
      await sql`INSERT INTO pantry_items (profile_id, name_key, name, excluded) VALUES (${p.id}, ${key}, ${name}, false)
        ON CONFLICT (profile_id, name_key) DO UPDATE SET excluded = false, name = EXCLUDED.name`;
    }
    return json({ ok: true });
  }
  // Aus dem Vorrat nehmen: eigener Eintrag wird gelöscht, Standard-Eintrag als herausgenommen gemerkt
  if (parts[0] === "pantry" && id && request.method === "DELETE") {
    const p = await getProfile(sql);
    const name = decodeURIComponent(id).trim();
    const key = mergeKey(name);
    const removed = await sql`DELETE FROM pantry_items WHERE profile_id = ${p.id} AND name_key = ${key} AND NOT excluded RETURNING name_key`;
    if (!removed[0]) {
      await sql`INSERT INTO pantry_items (profile_id, name_key, name, excluded) VALUES (${p.id}, ${key}, ${name}, true)
        ON CONFLICT (profile_id, name_key) DO UPDATE SET excluded = true`;
    }
    return json({ ok: true });
  }

  // ---------- Einkaufs-Labels ----------
  if (route === "GET /labels") {
    const p = await getProfile(sql);
    return json(await getLabels(sql, p.id));
  }
  if (route === "POST /labels") {
    const p = await getProfile(sql);
    const name = String(body.name ?? "").trim();
    if (!name) return json({ error: "Name fehlt" }, 400);
    const labelId = name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "") || `label-${Date.now()}`;
    await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort)
      VALUES (${p.id}, ${labelId}, ${name}, ${body.color || "#3b82f6"},
              (SELECT COALESCE(MAX(sort), 0) + 1 FROM shopping_labels WHERE profile_id = ${p.id}))
      ON CONFLICT (profile_id, id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color`;
    return json(await getLabels(sql, p.id));
  }
  if (parts[0] === "labels" && id && request.method === "PUT") {
    const p = await getProfile(sql);
    const name = String(body.name ?? "").trim();
    if (!name) return json({ error: "Name fehlt" }, 400);
    // Shop- und Standard-Listen behalten ihren Namen
    await sql`UPDATE shopping_labels SET name = ${name}, color = ${body.color || "#3b82f6"}
      WHERE profile_id = ${p.id} AND id = ${id} AND provider IS NULL AND id <> 'metzger'`;
    return json(await getLabels(sql, p.id));
  }
  if (parts[0] === "labels" && id && request.method === "DELETE") {
    if (DEFAULT_LABELS.some((l) => l.id === id)) return json({ error: "Standard-Labels können nicht gelöscht werden" }, 400);
    const p = await getProfile(sql);
    await sql`DELETE FROM shopping_labels WHERE profile_id = ${p.id} AND id = ${id}`;
    // Artikel mit diesem Label wandern zurück zu Knuspr
    await sql`UPDATE ingredient_prefs SET label = NULL WHERE profile_id = ${p.id} AND label = ${id}`;
    await sql`UPDATE shopping_item_state SET label = NULL WHERE label = ${id}
      AND plan_id IN (SELECT id FROM meal_plans WHERE profile_id = ${p.id})`;
    await sql`UPDATE shopping_extras SET label = 'knuspr' WHERE label = ${id}
      AND plan_id IN (SELECT id FROM meal_plans WHERE profile_id = ${p.id})`;
    return json(await getLabels(sql, p.id));
  }

  return null;
}
