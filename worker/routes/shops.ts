// Shops: Einstellungen, Verbinden (Picnic mit SMS-Code), Suche, Preise, Warenkorb
import type { Ctx } from "../http";
import { json } from "../http";
import {
  knusprLogin, knusprSearch, knusprAddToCart, knusprGetCart, knusprGetCartSummary, knusprRemoveFromCart, knusprSetQuantity,
  picnicLogin, picnicVerify, picnicSearch, picnicGetCartSummary, picnicAddToCart, picnicSetQuantity, picnicClearCart, type CartItem,
} from "../shops";
import { SHOP_LABELS, parsePrice, prefKey } from "../shoppingList";
import { enableShopLabel, getShopState, loadConnection, saveConnection } from "../shopAccounts";
import { getProfile } from "../repo";


export async function shopRoutes({ request, env, sql, body, parts, user }: Ctx): Promise<Response | null> {
  // ---------- Shops (Einstellungen, Verbinden, Suche, Warenkorb) ----------
  if (parts[0] === "shops") {
    const p = await getProfile(sql, user);
    const provider = parts[1];
    const action = parts[2];

    if (request.method === "GET" && !provider) return json(await getShopState(sql, p.id));

    if (provider === "settings" && request.method === "PUT") {
      await sql`UPDATE profiles SET standard_label = ${body.standardLabel ?? null},
        metzger_auto = ${body.metzgerAuto !== false} WHERE id = ${p.id}`;
      return json(await getShopState(sql, p.id));
    }

    if (!provider || !SHOP_LABELS[provider]) return json({ error: "Unbekannter Shop" }, 404);

    // Mindestbestellwert und Liefergebühr eines Shops
    if (action === "rules" && request.method === "PUT") {
      const minOrder = parsePrice(body.minOrder);
      const deliveryFee = parsePrice(body.deliveryFee) ?? 0;
      if (minOrder == null || minOrder < 0 || minOrder > 1000 || deliveryFee < 0 || deliveryFee > 100) {
        return json({ error: "Bitte gültige Beträge angeben" }, 400);
      }
      await sql`INSERT INTO shop_rules (profile_id, provider, min_order, delivery_fee)
        VALUES (${p.id}, ${provider}, ${minOrder}, ${deliveryFee})
        ON CONFLICT (profile_id, provider) DO UPDATE SET min_order = EXCLUDED.min_order, delivery_fee = EXCLUDED.delivery_fee`;
      return json(await getShopState(sql, p.id));
    }

    if (action === "connect" && request.method === "POST") {
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      if (!email || !password) return json({ error: "E-Mail und Passwort angeben" }, 400);
      if (provider === "knuspr") {
        await knusprLogin(email, password); // prüft die Zugangsdaten
        await saveConnection(env, sql, p.id, "knuspr", email, password, null);
      } else if (provider === "picnic") {
        const login = await picnicLogin(email, password);
        if (login.needs2fa) {
          // Noch nichts speichern – erst nach dem SMS-Code
          return json({ needs2fa: true, tempAuthKey: login.authKey, deviceId: login.deviceId });
        }
        await saveConnection(env, sql, p.id, "picnic", email, login.authKey, login.deviceId);
      } else {
        return json({ error: "Dieser Shop braucht kein Konto" }, 400);
      }
      await enableShopLabel(sql, p.id, provider);
      return json(await getShopState(sql, p.id));
    }

    if (provider === "picnic" && action === "verify" && request.method === "POST") {
      const authKey = await picnicVerify(String(body.tempAuthKey), String(body.deviceId), String(body.code ?? ""));
      await saveConnection(env, sql, p.id, "picnic", String(body.email ?? ""), authKey, String(body.deviceId));
      await enableShopLabel(sql, p.id, "picnic");
      return json(await getShopState(sql, p.id));
    }

    // Shop trennen bzw. deaktivieren (Liste weg, Artikel fallen auf die Standard-Liste zurück)
    if (request.method === "DELETE" && !action) {
      await sql`DELETE FROM shop_connections WHERE profile_id = ${p.id} AND provider = ${provider}`;
      await sql`DELETE FROM shopping_labels WHERE profile_id = ${p.id} AND id = ${provider}`;
      return json(await getShopState(sql, p.id));
    }

    if (action === "search" && request.method === "POST") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ results: [] });
      const conn = await loadConnection(env, sql, p.id, provider);
      if (!conn) return json({ error: "not_connected" }, 409);
      const results =
        provider === "knuspr"
          ? await knusprSearch(await knusprLogin(conn.email, conn.secret), query)
          : await picnicSearch(conn.secret, conn.deviceId ?? "", query);
      return json({ results });
    }

    // Preise der verknüpften Produkte frisch abfragen (für den Listen-Vergleich)
    if (action === "prices" && request.method === "POST") {
      const conn = await loadConnection(env, sql, p.id, provider);
      if (!conn) return json({ error: "not_connected" }, 409);
      const names: string[] = (Array.isArray(body.names) ? body.names : []).map((n: unknown) => String(n).trim()).filter(Boolean).slice(0, 40);
      const links = await sql`SELECT name_key, product_id, product_name FROM product_links
        WHERE profile_id = ${p.id} AND provider = ${provider} AND name_key = ANY(${names.map(prefKey)})`;
      const cookie = provider === "knuspr" ? await knusprLogin(conn.email, conn.secret) : "";
      const search = (q: string) =>
        provider === "knuspr" ? knusprSearch(cookie, q) : picnicSearch(conn.secret, conn.deviceId ?? "", q);
      let updated = 0;
      const missing: string[] = [];
      // Nacheinander in kleinen Gruppen, damit der Shop nicht blockiert
      for (let i = 0; i < links.length; i += 4) {
        await Promise.all(
          links.slice(i, i + 4).map(async (l) => {
            try {
              const hit = (await search(String(l.product_name ?? l.name_key))).find((r) => r.productId === l.product_id);
              if (!hit) {
                missing.push(String(l.product_name ?? l.name_key));
                return;
              }
              await sql`UPDATE product_links SET price = ${parsePrice(hit.price)}, amount = ${hit.amount ?? null}, updated_at = now()
                WHERE profile_id = ${p.id} AND provider = ${provider} AND name_key = ${l.name_key}`;
              updated++;
            } catch {
              missing.push(String(l.product_name ?? l.name_key));
            }
          })
        );
      }
      return json({ updated, missing });
    }

    // ---------- Warenkorb (Knuspr und Picnic) ----------
    if (action === "cart" && (provider === "knuspr" || provider === "picnic")) {
      const conn = await loadConnection(env, sql, p.id, provider);
      if (!conn) return json({ error: "not_connected" }, 409);
      // Einheitliche Schnittstelle für beide Shops
      const cart =
        provider === "knuspr"
          ? await (async () => {
              const cookie = await knusprLogin(conn.email, conn.secret);
              return {
                summary: () => knusprGetCartSummary(cookie),
                add: (id: string, q: number) => knusprAddToCart(cookie, id, q),
                setQuantity: (item: CartItem, q: number) => knusprSetQuantity(cookie, item, q),
                clear: async () => {
                  for (const item of await knusprGetCart(cookie)) {
                    if (item.orderFieldId) await knusprRemoveFromCart(cookie, item.orderFieldId);
                  }
                  return knusprGetCartSummary(cookie);
                },
              };
            })()
          : {
              summary: () => picnicGetCartSummary(conn.secret, conn.deviceId ?? ""),
              add: (id: string, q: number) => picnicAddToCart(conn.secret, conn.deviceId ?? "", id, q),
              setQuantity: (item: CartItem, q: number) => picnicSetQuantity(conn.secret, conn.deviceId ?? "", item, q),
              clear: () => picnicClearCart(conn.secret, conn.deviceId ?? ""),
            };

      // Was liegt im Warenkorb (mit Summe)?
      if (request.method === "GET") return json(await cart.summary());

      // Ausgewählte Produkte mit Menge in den Warenkorb legen
      if (request.method === "POST") {
        // { items: [{ productId, quantity }] } oder (älter) { productIds: [...] }
        const wanted: { productId: string; quantity: number }[] = Array.isArray(body.items)
          ? body.items.map((i: { productId?: unknown; quantity?: unknown }) => ({ productId: String(i.productId), quantity: Math.min(Math.max(Math.round(Number(i.quantity) || 1), 1), 50) }))
          : (Array.isArray(body.productIds) ? body.productIds : []).map((pid: unknown) => ({ productId: String(pid), quantity: 1 }));
        let added = 0;
        const failed: string[] = [];
        for (const w of wanted) {
          if (await cart.add(w.productId, w.quantity)) added++;
          else failed.push(w.productId);
        }
        return json({ added, failed });
      }

      // Menge ändern (0 = entfernen)
      if (request.method === "PATCH") {
        const item = (await cart.summary()).items.find((c) => c.productId === String(body.productId));
        if (!item) return json({ error: "Artikel liegt nicht (mehr) im Warenkorb" }, 404);
        await cart.setQuantity(item, Math.min(Math.max(Math.round(Number(body.quantity) || 0), 0), 50));
        return json(await cart.summary());
      }

      // Warenkorb leeren
      if (request.method === "DELETE") {
        const rest = await cart.clear();
        if (rest.items.length) return json({ error: `${rest.items.length} Artikel konnten nicht entfernt werden.` }, 502);
        return json(rest);
      }
    }

    return json({ error: "Unbekannte Shop-Aktion" }, 404);
  }

  return null;
}
