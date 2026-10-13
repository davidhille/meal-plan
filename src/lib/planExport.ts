import { MealPlan, PlanMeal } from '../types';
import { RECIPE_BASE_PORTIONS, formatPortions, scaleIngredient } from './portions';

const TYPE_LABEL: Record<string, string> = {
  vegetarisch: 'Vegetarisch',
  fleisch: 'Fleisch',
  wochenende: 'Wochenende',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** „2026-10-14“ → „Mittwoch, 14.10.2026“ */
function longDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
const shortDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

/** Zubereitung in Schritte zerlegen („1. …“-Zeilen oder Absätze) */
function steps(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

function recipeBlock(title: string, ingredients: string[], instructions: string, meta: string[]): string {
  const st = steps(instructions);
  return `
    <h3>${esc(title)}</h3>
    ${meta.length ? `<p class="meta">${meta.map(esc).join(' · ')}</p>` : ''}
    <div class="cols">
      <div>
        <h4>Zutaten</h4>
        <ul>${ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>
      <div>
        <h4>Zubereitung</h4>
        ${st.length > 1 ? `<ol>${st.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : `<p>${esc(instructions || '–')}</p>`}
      </div>
    </div>`;
}

/** Speiseplan mit allen Rezepten als eigenständige, druckbare HTML-Seite */
export function buildPlanHtml(plan: MealPlan, meals: PlanMeal[], portions: number): string {
  const factor = portions / RECIPE_BASE_PORTIONS;
  const list = meals.filter((m) => !m.rejected).sort((a, b) => a.meal_date.localeCompare(b.meal_date));
  const range = `${shortDate(plan.start_date)} – ${shortDate(plan.end_date)}`;

  const overview = list
    .map((m) => `<tr><td>${esc(longDate(m.meal_date))}</td><td>${esc(m.meal_name)}${m.dessert ? ` <span class="dessert">+ ${esc(m.dessert.name)}</span>` : ''}</td></tr>`)
    .join('');

  const recipes = list
    .map((m) => {
      const meta = [
        TYPE_LABEL[m.meal_type] ?? '',
        m.duration_min ? `${m.duration_min} Min` : '',
        `für ${formatPortions(portions)} Portionen`,
      ].filter(Boolean);
      const dessert = m.dessert
        ? `<div class="dessert-box">${recipeBlock(
            `Nachtisch: ${m.dessert.name}`,
            m.dessert.ingredients,
            m.dessert.instructions,
            [m.dessert.durationMin ? `${m.dessert.durationMin} Min` : '', m.dessert.yield ? `ergibt ${m.dessert.yield}` : ''].filter(Boolean)
          )}</div>`
        : '';
      return `
      <section class="recipe">
        <p class="day">${esc(longDate(m.meal_date))}</p>
        ${recipeBlock(m.meal_name, m.ingredients.map((i) => scaleIngredient(i, factor)), m.instructions, meta)}
        ${dessert}
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Speiseplan ${esc(range)}</title>
<style>
  body { font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif; color: #241628; background: #fff; margin: 0 auto; max-width: 820px; padding: 24px; line-height: 1.45; }
  h1 { color: #6B2E7A; font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 8px; color: #6B2E7A; }
  h3 { font-size: 19px; margin: 2px 0 2px; }
  h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #6B5870; margin: 10px 0 4px; }
  .sub, .meta { color: #6B5870; font-size: 13px; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 6px 8px; border-bottom: 1px solid #E6DEE8; vertical-align: top; }
  td:first-child { white-space: nowrap; color: #6B5870; width: 1%; }
  .dessert { color: #9A3A24; }
  .recipe { border-top: 2px solid #E6DEE8; padding-top: 14px; margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
  .day { color: #6B2E7A; font-weight: 700; font-size: 13px; margin: 0; }
  .cols { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 20px; }
  ul, ol { margin: 0; padding-left: 20px; font-size: 14px; }
  li { margin: 2px 0; }
  p { font-size: 14px; }
  .dessert-box { margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: #FFF4F1; }
  .hint { margin-top: 24px; font-size: 12px; color: #6B5870; }
  @media (max-width: 560px) { .cols { grid-template-columns: 1fr; gap: 4px; } }
  @media print { body { padding: 0; } .hint { display: none; } }
</style>
</head>
<body>
  <h1>Speiseplan ${esc(range)}</h1>
  <p class="sub">${list.length} Gerichte · Mengen für ${esc(formatPortions(portions))} Portionen · erstellt am ${esc(new Date().toLocaleDateString('de-DE'))}</p>
  <h2>Übersicht</h2>
  <table>${overview}</table>
  <h2>Rezepte</h2>
  ${recipes}
  <p class="hint">Tipp: Über „Drucken“ → „Als PDF speichern“ hast du den Plan dauerhaft als PDF.</p>
</body>
</html>`;
}

/** Plan in neuem Fenster öffnen und Drucken/PDF anbieten; ohne Pop-up als HTML-Datei herunterladen */
export function exportPlan(plan: MealPlan, meals: PlanMeal[], portions: number): void {
  const html = buildPlanHtml(plan, meals, portions);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => setTimeout(() => win.print(), 300));
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Speiseplan-${plan.start_date}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
