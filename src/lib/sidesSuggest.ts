import { PlanSide, Side } from '../types';
import { SIDES } from '../data/sides';
import { toPlanSide } from './sides';

/** Einstellung „Beilagen“: aus / nur vorschlagen / beim Planen automatisch ergänzen */
export type SidesMode = 'off' | 'suggest' | 'auto';
export const SIDES_MODES: SidesMode[] = ['off', 'suggest', 'auto'];

export function parseSidesMode(raw: unknown): SidesMode {
  return SIDES_MODES.includes(raw as SidesMode) ? (raw as SidesMode) : 'off';
}

/** Gericht ist schon „komplett“: hat Nudeln, Reis, Kartoffeln, Brot, Teig … oder ist Suppe/Eintopf/Auflauf */
const COMPLETE_RE =
  /nudel|pasta|spaghetti|penne|tagliatelle|fusilli|maccheroni|rigatoni|lasagne|cannelloni|ravioli|tortellini|maultasche|\breis(?!essig|wein|mehl)|risotto|paella|kartoffel|püree|pommes|rösti|gnocchi|knödel|klöße|kloß|spätzle|schupfnudel|nockerl|brot\b|brötchen|baguette|semmel(?!brösel)|toast|ciabatta|fladenbrot|naan|couscous|bulgur|polenta|hirse|quinoa|wrap|tortilla|pizza|teig|burger|flammkuchen|quiche|pfannkuchen|crêpe|schmarrn|dampfnudel|linsen|kichererbsen|eintopf|suppe|auflauf|gratin|salat|bowl|brei|haferflocken|arme ritter|reibekuchen|puffer/i;

/** Gericht enthält Gemüse – dann braucht es keinen Salat dazu */
const VEG_RE =
  /gemüse|brokkoli|zucchini|paprika|möhre|karotte|spinat|kohl|tomate|gurke|erbse|bohne|lauch|pilz|champignon|aubergine|fenchel|kürbis|mangold|spargel|sellerie|blumenkohl|rosenkohl|mais|salat/i;

const RICE_HINT = /curry|thai|asia|wok|gyros|kebab|döner|teriyaki|geschnetzelt|ragout|chili con|szegediner|hähnchenbrust/i;
const DUMPLING_HINT = /braten|haxe|roulade|gulasch|rouladen|schweinebraten|sauerbraten/i;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Wähle aus `candidates` die am seltensten genutzte (bei Gleichstand stabil nach Gerichtname) */
function pick(candidates: Side[], used: Record<string, number>, seed: string): Side | null {
  if (!candidates.length) return null;
  const min = Math.min(...candidates.map((c) => used[c.name] ?? 0));
  const least = candidates.filter((c) => (used[c.name] ?? 0) === min);
  return least[hash(seed) % least.length];
}

export interface SuggestInput {
  name: string;
  ingredients: string[];
  brotzeit?: boolean;
}

/**
 * Vorschlag für Beilage und/oder Salat zu einem Gericht. Eine Sättigungsbeilage nur, wenn Nudeln, Reis, Kartoffeln, Brot o. Ä.
 * fehlen (Nudeln werden nicht vorgeschlagen, damit die Mengen-Regel „höchstens n× Nudeln“ nicht umgangen wird); ein Salat
 * nur, wenn auch kein Gemüse drin ist. `used` zählt, wie oft eine Beilage schon vergeben wurde (für Abwechslung im Plan).
 */
export function suggestSides(meal: SuggestInput, used: Record<string, number> = {}): PlanSide[] {
  if (meal.brotzeit || !meal.ingredients.length) return [];
  const text = `${meal.name} ${meal.ingredients.join(' ')}`;
  const out: Side[] = [];

  if (!COMPLETE_RE.test(text)) {
    const carbs: Side['carb'][] = RICE_HINT.test(meal.name)
      ? ['reis']
      : DUMPLING_HINT.test(meal.name)
        ? ['kartoffel', 'knoedel']
        : ['kartoffel', 'reis'];
    const side = pick(
      SIDES.filter((s) => s.kind === 'beilage' && s.carb && carbs.includes(s.carb)),
      used,
      meal.name
    );
    if (side) out.push(side);
  }
  if (!VEG_RE.test(text)) {
    const salat = pick(SIDES.filter((s) => s.kind === 'salat' && !s.carb), used, `${meal.name}-salat`);
    if (salat) out.push(salat);
  }
  return out.map(toPlanSide);
}
