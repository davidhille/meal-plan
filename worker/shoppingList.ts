// Einkaufsliste eines Plans zusammenstellen: berechnete Zutaten + gespeicherter Zustand + eigene Artikel,
// dazu Listen (Labels), Produkt-Verknüpfungen und Shop-Regeln.
import type { Row, Sql } from "./db";
import { buildPlanItems, familyPortions, pantryOverview } from "./shopping";

/** Start-Listen einer neuen Familie; Knuspr/Picnic kommen erst beim Verbinden des Shops dazu */
export const DEFAULT_LABELS = [
  { id: "einkauf", name: "Einkauf", color: "#3b82f6", provider: null },
  { id: "metzger", name: "Metzger", color: "#f97316", provider: null },
];

/** Online-Shops, die sich in den Einstellungen aktivieren lassen (Label-ID = Provider) */
export const SHOP_LABELS: Record<string, { name: string; color: string }> = {
  knuspr: { name: "Knuspr", color: "#22c55e" },
  picnic: { name: "Picnic", color: "#e11d48" },
};

export const prefKey = (name: string) => name.trim().toLowerCase();

export async function getLabels(sql: Sql, profileId: string) {
  let rows = await sql`SELECT id, name, color, provider FROM shopping_labels WHERE profile_id = ${profileId} ORDER BY sort, name`;
  if (rows.length === 0) {
    for (const [i, l] of DEFAULT_LABELS.entries()) {
      await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort, provider)
        VALUES (${profileId}, ${l.id}, ${l.name}, ${l.color}, ${i}, ${l.provider}) ON CONFLICT DO NOTHING`;
    }
    rows = await sql`SELECT id, name, color, provider FROM shopping_labels WHERE profile_id = ${profileId} ORDER BY sort, name`;
  }
  return rows;
}

/** Komplette Einkaufsliste eines Plans: berechnete Zutaten + gespeicherter Zustand + eigene Artikel */
export async function getShopping(sql: Sql, profileId: string, planId: string, range?: { from: string; to: string }, since?: string) {
  // Vergangene Tage weglassen (Häkchen-Schlüssel bleiben am Wochenbeginn)
  const from = since && since > (range?.from ?? "") ? since : range?.from ?? "0001-01-01";
  const to = range?.to ?? "9999-12-31";
  // Pro Woche eigene Häkchen: Schlüssel bekommt das Wochen-Startdatum vorangestellt
  // Mehrere Wochen zusammen haben eigene Häkchen (andere Mengen als die einzelnen Wochen)
  const multiWeek = range && (Date.parse(range.to) - Date.parse(range.from)) / 86400000 > 7;
  const keyPrefix = range ? (multiWeek ? `${range.from}..${range.to}:` : `${range.from}:`) : "";
  const [labels, meals, members, states, extras, prefs, links, settingsRows, pantry] = await Promise.all([
    getLabels(sql, profileId),
    // Nach Datum sortiert: die Gerichtszeile an den Artikeln nennt so zuerst das Gericht, das als Nächstes gekocht wird
    sql`SELECT meal_name, ingredients, dessert, guests FROM plan_meals WHERE plan_id = ${planId} AND NOT rejected
      AND meal_date BETWEEN ${from}::date AND ${to}::date ORDER BY meal_date, created_at`,
    sql`SELECT type, age FROM family_members WHERE profile_id = ${profileId}`,
    sql`SELECT item_key, checked, label FROM shopping_item_state WHERE plan_id = ${planId}`,
    sql`SELECT id, name, label, checked, is_basic FROM shopping_extras WHERE plan_id = ${planId} ORDER BY created_at`,
    sql`SELECT name_key, label FROM ingredient_prefs WHERE profile_id = ${profileId}`,
    sql`SELECT name_key, provider, product_id, product_name, image_url, price, amount FROM product_links WHERE profile_id = ${profileId}`,
    sql`SELECT standard_label, metzger_auto FROM profiles WHERE id = ${profileId}`,
    sql`SELECT name_key, name, excluded FROM pantry_items WHERE profile_id = ${profileId} ORDER BY name`,
  ]);
  const shopRules = await getShopRules(sql, profileId);
  const labelIds = new Set(labels.map((l) => l.id));
  const portions = familyPortions(members as { type: string; age: number | null }[]);
  // Eigener Vorrat vs. aus dem Standard-Vorrat herausgenommen
  const custom = pantry.filter((r) => !r.excluded);
  const excluded = new Set(pantry.filter((r) => r.excluded).flatMap((r) => String(r.name).toLowerCase().split(/\s+/)));
  const withDessert = meals.filter((m) => m.dessert?.ingredients);
  const built = buildPlanItems(
    meals.map((m) => m.ingredients as string[]),
    portions,
    new Set(custom.map((r) => r.name_key as string)),
    // Nachtische haben eine feste Menge (z. B. ein ganzer Kuchen) und werden nicht umgerechnet
    withDessert.map((m) => m.dessert.ingredients as string[]),
    excluded,
    // Gäste an diesem Tag: zusätzliche Portionen nur für dieses Gericht
    meals.map((m) => Number(m.guests) || 0),
    // Wofür die Zutat gebraucht wird (Gerichtszeile unter dem Artikel)
    meals.map((m) => String(m.meal_name)),
    withDessert.map((m) => String(m.dessert.name ?? "Nachtisch"))
  );
  const stateBy = new Map(states.map((r) => [r.item_key, r]));
  const prefBy = new Map(prefs.map((r) => [r.name_key, r]));
  const validLabel = (l: string | null | undefined, fallback: string) => (l && labelIds.has(l) ? l : fallback);
  const settings = settingsRows[0] ?? {};
  const standard = validLabel(
    settings.standard_label,
    labelIds.has("einkauf") ? "einkauf" : labelIds.has("knuspr") ? "knuspr" : (labels[0]?.id as string)
  );
  const meatLabel = settings.metzger_auto !== false && labelIds.has("metzger") ? "metzger" : standard;
  const providerOf = new Map(labels.map((l) => [l.id as string, l.provider as string | null]));
  const linkBy = new Map(links.map((r) => [`${r.name_key}|${r.provider}`, r]));
  const linkInfo = (link: Row) => ({
    productId: link.product_id as string,
    productName: link.product_name as string,
    productImage: (link.image_url as string | null) ?? undefined,
    productPrice: link.price != null ? Number(link.price) : undefined,
    productAmount: (link.amount as string | null) ?? undefined,
  });
  // Verknüpfungen in allen Shops (für den Preisvergleich)
  const linksFor = (name: string) => {
    const out: Record<string, ReturnType<typeof linkInfo>> = {};
    for (const prov of ["knuspr", "picnic"]) {
      const l = linkBy.get(`${prefKey(name)}|${prov}`);
      if (l) out[prov] = linkInfo(l);
    }
    return Object.keys(out).length ? { links: out } : {};
  };
  const productFor = (name: string, label: string) => {
    const provider = providerOf.get(label);
    const link = provider ? linkBy.get(`${prefKey(name)}|${provider}`) : undefined;
    return link
      ? {
          productId: link.product_id as string,
          productName: link.product_name as string,
          productImage: link.image_url as string | undefined,
          productPrice: link.price != null ? Number(link.price) : undefined,
          productAmount: (link.amount as string | null) ?? undefined,
        }
      : {};
  };

  const items = [
    ...built.items.map((i) => {
      const st = stateBy.get(keyPrefix + i.key);
      const pref = prefBy.get(prefKey(i.baseName));
      const label = validLabel(st?.label ?? pref?.label, i.defaultLabel === "metzger" ? meatLabel : standard);
      return {
        id: `p:${keyPrefix}${i.key}`,
        name: i.display,
        baseName: i.baseName,
        label,
        checked: !!st?.checked,
        isBasic: false,
        usedIn: i.usedIn,
        ...productFor(i.baseName, label),
        ...linksFor(i.baseName),
      };
    }),
    ...extras.map((x) => {
      const label = validLabel(x.label, standard);
      return {
        id: `x:${x.id}`,
        name: x.name,
        baseName: x.name,
        label,
        checked: x.checked,
        isBasic: x.is_basic,
        ...productFor(x.name, label),
        ...linksFor(x.name),
      };
    }),
  ];
  return {
    labels,
    items,
    pantry: pantryOverview(built.pantryNeeded, custom.map((r) => r.name as string), excluded),
    shopRules,
    portions,
    standardLabel: standard,
  };
}

/** Mindestbestellwert und Liefergebühr je Shop (änderbar in den Einstellungen) */
const DEFAULT_SHOP_RULES: Record<string, { minOrder: number; deliveryFee: number }> = {
  knuspr: { minOrder: 79, deliveryFee: 0 },
  picnic: { minOrder: 45, deliveryFee: 0 },
};

export async function getShopRules(sql: Sql, profileId: string) {
  const rows = await sql`SELECT provider, min_order, delivery_fee FROM shop_rules WHERE profile_id = ${profileId}`;
  const rules = structuredClone(DEFAULT_SHOP_RULES);
  for (const r of rows) {
    if (rules[r.provider]) rules[r.provider] = { minOrder: Number(r.min_order), deliveryFee: Number(r.delivery_fee) };
  }
  return rules;
}

/** „1,99 €“, „1.99 EUR“ oder 1.99 → 1.99 */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const m = String(raw ?? "").replace(/\s/g, "").match(/(\d+(?:[.,]\d{1,2})?)/);
  return m ? Number(m[1].replace(",", ".")) : null;
}
