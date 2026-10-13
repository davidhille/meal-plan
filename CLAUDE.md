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
| `api.ts` | Einstieg der API: Passwort, Datenbank, Migration, verteilt an die Routen; Fehler → JSON |
| `http.ts` | `Env`, Anfrage-Kontext `Ctx`, `json()` |
| `routes/*.ts` | Routen nach Bereich (`profile`, `plans`, `recipes`, `shopping`, `shops`). Jede Datei prüft `route`/`parts` und gibt eine `Response` oder `null` (nicht zuständig) zurück |
| `repo.ts` | Gemeinsame DB-Zugriffe: `getProfile`, `loadContext`, `loadPool`, Favoriten, Spaltenlisten (`PLAN_COLS` …) |
| `planning.ts` | Plan erstellen, Gericht austauschen/ersetzen, Rezept-Übersicht (`unsuitable` = passt nicht zu den Gesundheitseinstellungen) |
| `recipeEdits.ts` | Gericht bearbeiten/zurücksetzen. Grundsammlung: Zeile in `recipes` mit `replaces` = Originalname; Umbenennen zieht Bewertung, Ausblenden, Favorit, Filter, Bild und kommende Plan-Tage mit |
| `shoppingList.ts` | Einkaufsliste eines Plans aus DB-Daten (Labels, Zustand, Produkt-Verknüpfungen, Shop-Regeln) |
| `shopAccounts.ts` | Shop-Verbindungen speichern/laden (verschlüsselt), Shop-Zustand für die Einstellungen |
| `routines.ts` | Cron: fällige Routinen → neuer Plan, Bewertungs-Erinnerung, fehlende Bilder nachziehen |
| `push.ts`, `webpush.ts` | Erinnerung zum Bewerten per Web Push. `webpush.ts` = Verschlüsselung (RFC 8291) + VAPID ohne Bibliothek; die VAPID-Schlüssel erzeugt der Worker selbst und speichert sie verschlüsselt in `app_settings` (kein Secret nötig). Nur bekannte Push-Dienste als Ziel |
| `migrate.ts`, `migrations/` | Datenbank-Migrationen (siehe unten) |
| `meals.ts` | Rezept-Typ, Grundsammlung `MEAL_DATABASE`, Scoring (`scoreMeal`), Auswahl (`pickMeal`, `pickReplacement`), Gesundheitsfilter, Ähnlichkeit (`isSimilarDish`) |
| `nutrition.ts` | Ernährungs-Schwerpunkte (`focusScore`, Pluspunkte, mehrere gleichzeitig), Saison-Liste, Fleisch-Erkennung ohne Fisch (`isMeatDish`) für die Wochen-Grenze `meat_max_per_week` |
| `recipes/*.ts` | Feste Rezeptsammlung (vegetarisch, fleisch, wochenende, `mealdb` = 231 übersetzte TheMealDB-Rezepte mit Foto-URL) |
| `aiRecipes.ts` | KI-Rezepte erzeugen, mit eigenen Filtern nachprüfen, in Tabelle `recipes` speichern; `generateWishRecipe` = Rezept nach Wunsch (nur Vorschau, Speichern über `POST /recipes/ai-save`) |
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
- Eigene Rezept-Filter: `lib/recipeFilters.ts` – Regeln (Suchbegriffe/Zeit) plus Hand-Zuordnung (`includeNames`/`excludeNames`).
- `localStorage` nur für Komfort (Passwort, auf-/zugeklappt, gewählte Einkaufswochen), immer in `try/catch`.

### Design „Aubergine“

Farben in `tailwind.config.js`: `brand-*` (Pflaume, Hauptfarbe), `coral-*` (Akzent: „günstiger“, Fortschritt),
`gray-*` mit Pflaumenstich. Schrift Plus Jakarta Sans. **Keine** `green-*`-Klassen mehr verwenden – alles ist auf `brand-*` umgestellt.
Kontraste auf WCAG AA; Icon-Knöpfe brauchen `aria-label`.

## Datenbank

Das Schema steht vollständig in `worker/migrations/` (`0001_basis.ts` = alles bis Oktober 2026). Der Worker führt
fehlende Migrationen beim ersten Aufruf nach einem Deploy aus (`migrate.ts`), eine leere Datenbank bekommt so alle Tabellen.

**Schema ändern:**
1. Neue Datei `worker/migrations/000N_kurzname.ts` (`export default ["ALTER TABLE … ADD COLUMN IF NOT EXISTS …"]`)
   und in `migrations/index.ts` unten anhängen. Ausgelieferte Migrationen nie mehr ändern.
2. Befehle idempotent schreiben (`IF NOT EXISTS`); laufen zwei Worker gleichzeitig an, kann eine Migration doppelt laufen.
   Kein `CONCURRENTLY` (eine Migration läuft in einer Transaktion). `bun test` prüft beides grob.
3. Hintergrund: `ALTER TABLE` sperrt die Tabelle auch, wenn die Spalte schon existiert (App hing deshalb schon mal, PR #5).
   Darum steht der Name der neuesten Migration als Kommentar an `profiles` (bei nur `0001_basis` der alte Wert
   `schema:2026101207`); stimmt er, führt ein Kaltstart keine DDL aus.
   Ausgeführte Migrationen stehen in `schema_migrations`.

Ein Familienprofil (`getProfile` nimmt das erste), kein Mehrbenutzer-Login. Fast alle Tabellen hängen an `profile_id`;
`recipes` (KI-/Import-Rezepte) und `meal_images` sind geteilt.

Daten-Konventionen:
- Datumsfelder als Text ausgeben (`meal_date::text`), Zeitzonen-Fallen beachten: im Frontend nie `toISOString()` für lokale Daten.
- Zutaten sind `text[]` im Format „Menge Einheit Zutat“, Rezepte immer für **4 Portionen**; Skalierung erst bei Anzeige/Einkaufsliste.
- Zubereitung: ein Schritt pro Zeile (`\n`).

## Secrets (Cloudflare Worker)

`DATABASE_URL`, `APP_PASSWORD` (Familien-Passwort, Header `X-App-Password`), `CREDENTIALS_KEY` (verschlüsselt Shop-Zugangsdaten und den privaten Push-Schlüssel; Ändern = Shops neu verbinden, Erinnerung neu einschalten),
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
  Er empfängt auch die Push-Nachrichten (`push`, `notificationclick`).
- Push auf dem iPhone geht nur in der installierten PWA (Home-Bildschirm), ab iOS 16.4.
- Fenster (Modals) immer über `useDialog`: Escape und Scroll-Sperre zählen offene Fenster (`lib/dialogStack.ts`).
