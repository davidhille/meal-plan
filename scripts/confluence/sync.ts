// Gleicht zwei Seiten im Confluence-Space MP mit dem Repo ab:
//   - „Funktionen (Benutzerhandbuch)“ ← PROJEKTUEBERSICHT.md
//   - „Änderungshistorie“            ← gemergte Pull Requests auf GitHub (neueste oben)
// Die übrigen Seiten (Architektur, Datenbank, Betrieb, Startseite) pflegt man von Hand bzw. mit Claude.
//
// Aufruf:  bun scripts/confluence/sync.ts [--dry-run]
// Umgebung: CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN (Atlassian-API-Token), GITHUB_TOKEN (nur für die Historie, im Actions-Lauf vorhanden)
// Ohne Zugangsdaten läuft nur --dry-run; der Actions-Lauf meldet das und bricht nicht ab.
import { infoPanel, markdownToStorage, escapeHtml } from './markdown';

const BASE = 'https://davidhille.atlassian.net/wiki';
const REPO = 'davidhille/meal-plan';
const PAGES = { features: '14221313', history: '14417921' } as const;

const dryRun = process.argv.includes('--dry-run');
const email = process.env.CONFLUENCE_EMAIL;
const token = process.env.CONFLUENCE_API_TOKEN;

type Pr = { number: number; title: string; merged_at: string | null };

async function loadMergedPrs(): Promise<Pr[]> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'miyummy-confluence-sync' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const all: Pr[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=closed&per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`);
    const batch = (await res.json()) as Pr[];
    all.push(...batch.filter((p) => p.merged_at));
    if (batch.length < 100) break;
  }
  return all.sort((a, b) => b.number - a.number);
}

export function historyBody(prs: Pr[], stand: string): string {
  const byDay = new Map<string, Pr[]>();
  for (const p of prs) {
    const day = p.merged_at!.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  const parts = [
    infoPanel(
      `Automatisch aus den gemergten Pull Requests von <a href="https://github.com/${REPO}">${REPO}</a> erzeugt (Stand ${stand}); nicht von Hand ändern, die Seite wird überschrieben. Neueste oben.`,
    ),
  ];
  for (const [day, list] of [...byDay].sort((a, b) => b[0].localeCompare(a[0]))) {
    const [y, m, d] = day.split('-');
    parts.push(`<h2>${d}.${m}.${y}</h2>`);
    parts.push(
      `<ul>${list.map((p) => `<li><a href="https://github.com/${REPO}/pull/${p.number}">#${p.number}</a> ${escapeHtml(p.title)}</li>`).join('')}</ul>`,
    );
  }
  return parts.join('\n');
}

async function readFeatures(): Promise<string> {
  const md = await Bun.file(new URL('../../PROJEKTUEBERSICHT.md', import.meta.url)).text();
  const withoutTitle = md.replace(/^# .*\n/, '');
  return (
    infoPanel(
      `Automatisch aus <code>PROJEKTUEBERSICHT.md</code> im Repo <a href="https://github.com/${REPO}">${REPO}</a> erzeugt; nicht von Hand ändern, die Seite wird überschrieben. Änderungen gehören in die Datei im Repo.`,
    ) +
    '\n' +
    markdownToStorage(withoutTitle)
  );
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

async function updatePage(id: string, value: string, message: string): Promise<void> {
  const cur = await api(`/api/v2/pages/${id}`);
  if (!cur.ok) throw new Error(`Seite ${id} lesen: HTTP ${cur.status}`);
  const page = (await cur.json()) as { title: string; version: { number: number } };
  const res = await api(`/api/v2/pages/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      id,
      status: 'current',
      title: page.title,
      version: { number: page.version.number + 1, message },
      body: { representation: 'storage', value },
    }),
  });
  if (!res.ok) throw new Error(`Seite ${id} schreiben: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  console.log(`Seite „${page.title}“ aktualisiert (Version ${page.version.number + 1}).`);
}

async function main(): Promise<void> {
  const stand = new Date().toISOString().slice(0, 10);
  const features = await readFeatures();
  const history = historyBody(await loadMergedPrs(), stand);
  if (dryRun) {
    console.log(`Trockenlauf: Funktionen ${features.length} Zeichen, Historie ${history.length} Zeichen.`);
    return;
  }
  if (!email || !token) {
    console.log('CONFLUENCE_EMAIL/CONFLUENCE_API_TOKEN fehlen – nichts übertragen (siehe SETUP_NEON_CLOUDFLARE.md, Abschnitt Confluence).');
    return;
  }
  const message = `Automatisch aus dem Repo (${stand})`;
  await updatePage(PAGES.features, features, message);
  await updatePage(PAGES.history, history, message);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
