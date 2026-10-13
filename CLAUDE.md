# CLAUDE.md – Familien-Speiseplaner

Deutschsprachige Web-App für die Essensplanung einer Familie: Wochenplan, Rezepte, Einkaufsliste mit
Anbindung an Knuspr und Picnic. Live unter https://meal-plan.davidshille.workers.dev/ (installierbar als PWA).
Nutzerdoku/Funktionsübersicht: `PROJEKTUEBERSICHT.md`. Einrichtung: `SETUP_NEON_CLOUDFLARE.md`.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind, Icons `lucide-react`. Kein Router (Bereich steht im URL-Hash).
- **Backend:** ein Cloudflare Worker (`worker/`), der `/api/*` beantwortet und sonst die statische App aus `dist/` ausliefert.
- **Datenbank:** Neon Postgres über `@neondatabase/serverless` (HTTP, `neon(env.DATABASE_URL)`).
- **KI:** Cloudflare Workers AI (Binding `AI`): Rezepte (Llama 3.3 70B, JSON-Modus), Bildbeschreibung (Llama 3.1 8B), Bilder (FLUX.1 schnell).
- **Paketmanager:** bun (`bun.lock`). Deploy: jeder Push auf `main` → Cloudflare Workers Builds (`bun run build` + `wrangler deploy`).

## Befehle

```bash
bun install
bun run typecheck   # Frontend (tsconfig.app.json) + Worker (worker/tsconfig.json)
bun run lint
bun test            # Tests der Kernlogik (*.test.ts neben dem Code, bun:test)
bun run build       # vite build – prüft KEINE Typen, deshalb typecheck separat
bun run dev:worker  # App + API lokal (braucht .dev.vars, siehe .dev.vars.example)
```

Dieselben Prüfungen (typecheck, lint, test, build) laufen bei jedem PR in GitHub Actions (`.github/workflows/check.yml`).

## Arbeitsweise

- Neue Arbeit auf einem Branch, Merge nach `main` per Pull Request (Squash). `main` wird automatisch deployt.
- UI-Texte, Kommentare, Commit- und PR-Texte auf **Deutsch**. Code-Bezeichner und DB-Spalten Englisch, DB in snake_case.
- PR-Beschreibung: „## Was“ mit Stichpunkten, bei Fehlerbehebungen zuerst „## Problem“.
- Nach Änderungen an Funktionen `PROJEKTUEBERSICHT.md` mitpflegen; bei neuen Secrets `SETUP_NEON_CLOUDFLARE.md`.

## Architektur

### Worker (`worker/`)

| Datei | Inhalt |
|---|---|
| `index.ts` | Einstieg: `/api/*` → `handleApi`, sonst Assets; `scheduled` (Cron alle 15 Min) → `runRoutines` |
| `api.ts` | **Alle** Routen (ein großer Router über `route === "GET /…"` bzw. `parts[0]`), Schema-Migration, Plan-Erstellung, Einkaufsliste, Shops, Routinen-Cron |
| `meals.ts` | Rezept-Typ, Grundsammlung `MEAL_DATABASE`, Scoring (`scoreMeal`), Auswahl (`pickMeal`, `pickReplacement`), Gesundheitsfilter, Ähnlichkeit (`isSimilarDish`) |
| `recipes/*.ts` | Feste Rezeptsammlung (vegetarisch, fleisch, wochenende, `mealdb` = 231 übersetzte TheMealDB-Rezepte mit Foto-URL) |
| `aiRecipes.ts` | KI-Rezepte erzeugen, mit eigenen Filtern nachprüfen, in Tabelle `recipes` speichern |
| `recipeImport.ts` | Rezept per Link (schema.org JSON-LD, z. B. Chefkoch) → auf 4 Portionen umrechnen |
| `images.ts` | Bilder: TheMealDB-Originalfoto → KI-Bild → Ersatzfoto (Pexels/Pixabay/Openverse); gespeichert als `bytea` in `meal_images` |
| `shopping.ts` | Einkaufsliste aus Plan-Zutaten: parsen, auf Portionen skalieren, zusammenfassen, Vorrat aussortieren |
| `shops.ts` | Knuspr/Picnic (inoffizielle APIs): Login, Suche, Warenkorb; AES-GCM-Verschlüsselung der Zugangsdaten |

### Frontend (`src/`)

- `App.tsx` hält den globalen Zustand (Profil, Familie, Plan, Favoriten …) und schaltet die Bereiche:
  `speiseplan | einkaufsliste | rezepte | favoriten | einstellungen` (`ViewTab`, im URL-Hash gemerkt).
- `lib/api.ts`: **alle** Serveraufrufe. Komponenten rufen nie selbst `fetch` auf.
- Jede Ansicht/jedes Fenster ist eine eigene Komponente (`…View`, `…Modal`, `…Sheet`).
- Fenster nutzen `useDialog` (Escape schließt das oberste, Fokus, Scroll-Sperre); Bestätigungen über `ConfirmDialog`, nie `alert()`/`confirm()`.
- Nachtische sind reine Frontend-Daten (`data/desserts.ts`, eigener Chunk); am Gericht gespeichert in `plan_meals.dessert` (jsonb).
- Preisvergleich/Grundpreis: `lib/unitPrice.ts`. Portionen: `lib/portions.ts`.
- `localStorage` nur für Komfort (Passwort, auf-/zugeklappt, gewählte Einkaufswochen), immer in `try/catch`.

### Design „Aubergine“

Farben in `tailwind.config.js`: `brand-*` (Pflaume, Hauptfarbe), `coral-*` (Akzent: „günstiger“, Fortschritt),
`gray-*` mit Pflaumenstich. Schrift Plus Jakarta Sans. **Keine** `green-*`-Klassen mehr verwenden – alles ist auf `brand-*` umgestellt.
Kontraste auf WCAG AA; Icon-Knöpfe brauchen `aria-label`.

## Datenbank

Schema-Referenz: `neon/schema.sql`. Der Worker zieht Änderungen selbst nach (`migrate()` in `api.ts`).

**Wichtig bei Schema-Änderungen:**
1. Befehl in `runMigrations()` ergänzen (immer idempotent: `IF NOT EXISTS`).
2. `SCHEMA_VERSION` hochzählen – sonst läuft die Migration nie. Der Stand steht als Kommentar an `profiles`.
3. Grund: `ALTER TABLE` sperrt die Tabelle auch, wenn die Spalte schon existiert. Liefen die Befehle bei jedem Kaltstart,
   hängt die App (so geschehen, siehe PR #5). Mit gleichem `SCHEMA_VERSION` führt ein Kaltstart gar keine DDL aus.
4. Auch in `neon/schema.sql` nachtragen.

Ein Familienprofil (`getProfile` nimmt das erste), kein Mehrbenutzer-Login. Fast alle Tabellen hängen an `profile_id`;
`recipes` (KI-/Import-Rezepte) und `meal_images` sind geteilt.

Daten-Konventionen:
- Datumsfelder als Text ausgeben (`meal_date::text`), Zeitzonen-Fallen beachten: im Frontend nie `toISOString()` für lokale Daten.
- Zutaten sind `text[]` im Format „Menge Einheit Zutat“, Rezepte immer für **4 Portionen**; Skalierung erst bei Anzeige/Einkaufsliste.
- Zubereitung: ein Schritt pro Zeile (`\n`).

## Secrets (Cloudflare Worker)

`DATABASE_URL`, `APP_PASSWORD` (Familien-Passwort, Header `X-App-Password`), `CREDENTIALS_KEY` (Shop-Zugangsdaten),
optional `PIXABAY_API_KEY`, `PEXELS_API_KEY`. Nie ins Repo, nie in `wrangler.jsonc` (`vars` würden bei Deploys überschrieben).

## Stolperfallen

- **Workers-AI-Kontingent:** 10.000 Neurons/Tag (Free). KI-Rezepte (~150–200 je Rezept) und Bilder teilen es. Bei Fehler 4006
  pausieren die Bild-KI-Anfragen bis Mitternacht UTC; Bilder kommen dann aus Fotodatenbanken.
- **Knuspr/Picnic** sind reverse-engineert und können jederzeit brechen. Picnic-Login kann SMS-Code verlangen (zweistufig:
  `connect` → `verify`); gespeichert wird nur der Sitzungs-Token. Antworten defensiv lesen.
- **Amazon** wurde bewusst entfernt (keine Suche/Warenkorb aus Apps möglich) – nicht wieder einbauen.
- **Gesundheitsfilter** (`violatesHealthConditions`) sind Heuristiken auf Zutatentext, keine Allergie-Garantie. KI-Rezepte
  werden immer nachgeprüft, die KI hält sich nicht zuverlässig an Vorgaben.
- **Abwechslung:** `isSimilarDish` verhindert Varianten desselben Gerichts im Plan; Gerichte der letzten 3 Wochen bekommen Abzug.
- `/api/images/*` ist absichtlich ohne Passwort (ein `<img>` kann keinen Header schicken).
- Service Worker (`public/sw.js`): `/api` wird nie gecacht. Bei Änderungen an gecachten Dateien `CACHE`-Version hochzählen.
