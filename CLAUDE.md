# CLAUDE.md – miyummy (Familien-Speiseplaner)

Deutschsprachige Web-App für die Essensplanung einer Familie: Wochenplan, Rezepte, Einkaufsliste mit
Anbindung an Knuspr und Picnic. Live unter https://miyummy.com/ (zusätzlich https://meal-plan.davidshille.workers.dev/; installierbar als PWA).
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
| `index.ts` | Einstieg (läuft vor den Assets, `run_worker_first`): `www.` → 301 ohne www, `/api/*` → `handleApi`, sonst Assets; `scheduled` (Cron alle 15 Min) → `runRoutines` |
| `api.ts` | Einstieg der API: Datenbank, Migration, Anmeldung (Sitzungs-Cookie → `ctx.user`), Origin-Prüfung bei ändernden Anfragen, verteilt an die Routen; Fehler → JSON |
| `auth.ts`, `routes/auth.ts` | Login pro Person: PBKDF2-Hash (100.000 Iterationen, Workers-Maximum), Sitzungen in `sessions` (nur SHA-256 des Tokens, Cookie `mp_session` HttpOnly/Secure/Lax, 180 Tage), Sperre nach 8 Fehlversuchen. `/auth/status`, `/auth/login`, `/auth/logout`, `/auth/setup` (erster Zugang, nur mit `APP_PASSWORD` und solange `users` leer ist) sind öffentlich; `/auth/password` und `/users` (nur Admin) brauchen eine Sitzung. Solange es keine Zugänge gibt, gilt noch `X-App-Password` |
| `routes/admin.ts` | Administration (nur `users.is_owner`): Familien anlegen (Start-Listen + Einladung), Einladungslink, umbenennen, sperren (`profiles.disabled`), löschen. Einladungen in `invites` (nur Token-Hash, 7 Tage, einmal); angenommen über öffentliches `/auth/invite/:token`. `GET /admin/stats` = Statistik pro Familie inkl. KI-Verbrauch |
| `aiUsage.ts` | KI-Verbrauch: `meteredEnv(env, sql, profileId)` zählt jeden erfolgreichen `AI.run` in `ai_usage` (geschätzte Neurons nach Preisliste; `null` = App/Cron). `api.ts` gibt Routen die gezählte Umgebung (`ctx.env`), `routines.ts` pro Familie bzw. `null`. Neue KI-Aufrufe immer über `ctx.env`/`meteredEnv`, nie über das rohe `env` |
| `http.ts` | `Env`, Anfrage-Kontext `Ctx` (inkl. `user`), `json()` |
| `routes/*.ts` | Routen nach Bereich (`profile`, `plans`, `recipes`, `shopping`, `shops`). Jede Datei prüft `route`/`parts` und gibt eine `Response` oder `null` (nicht zuständig) zurück |
| `repo.ts` | Gemeinsame DB-Zugriffe: `getProfile(sql, user)` (Familie der angemeldeten Person; ohne Anmeldung nur im Übergang die erste), `loadContext`, `loadPool`, Favoriten, Spaltenlisten (`PLAN_COLS` …) |
| `planning.ts` | Plan erstellen, Gericht austauschen/ersetzen, Rezept-Übersicht (`unsuitable` = passt nicht zu den Gesundheitseinstellungen). `createPlan(…, extendPlanId)` = Plan verlängern (`POST /plans/:id/extend`): nur `datesToFill` – belegte Tage und `meal_plans.cleared_dates` (Tag geleert / Gericht weg verschoben) bleiben |
| `recipeEdits.ts` | Gericht bearbeiten/zurücksetzen. Grundsammlung: Zeile in `recipes` mit `replaces` = Originalname; Umbenennen zieht Bewertung, Ausblenden, Favorit, Filter, Bild und kommende Plan-Tage mit |
| `shoppingList.ts` | Einkaufsliste eines Plans aus DB-Daten (Labels, Zustand, Produkt-Verknüpfungen, Shop-Regeln) |
| `shopAccounts.ts` | Shop-Verbindungen speichern/laden (verschlüsselt), Shop-Zustand für die Einstellungen |
| `routines.ts` | Cron: fällige Routinen → neuer Plan, Bewertungs-Erinnerung, fehlende Bilder nachziehen |
| `push.ts`, `webpush.ts` | Erinnerung zum Bewerten per Web Push. `webpush.ts` = Verschlüsselung (RFC 8291) + VAPID ohne Bibliothek; die VAPID-Schlüssel erzeugt der Worker selbst und speichert sie verschlüsselt in `app_settings` (kein Secret nötig). Nur bekannte Push-Dienste als Ziel |
| `migrate.ts`, `migrations/` | Datenbank-Migrationen (siehe unten) |
| `meals.ts` | Rezept-Typ, Grundsammlung `MEAL_DATABASE`, Scoring (`scoreMeal`), Auswahl (`pickMeal`, `pickReplacement`), Gesundheitsfilter, Ähnlichkeit (`isSimilarDish`) |
| `dayRules.ts` | Regeln pro Wochentag (`profiles.day_rules`, Schlüssel 0–6 = getUTCDay): `off` → Tag wird nicht geplant, `brotzeit` → Brotzeit, `maxMinutes` → nur passende Gerichte (`withinTime`). `pickBrotzeitDates` = feste Brotzeit-Tage plus automatisch bis `profiles.brotzeit_per_week`. Brotzeit im Plan = `plan_meals.brotzeit` (Name „Brotzeit“, keine Zutaten; ohne Bild/Bewertung/Push), `POST /plan-meals/:id/brotzeit`, zurück über `regenerate` |
| `nutrition.ts` | Ernährungs-Schwerpunkte (`focusScore`, Pluspunkte, mehrere gleichzeitig), Saison-Liste, Fleisch-Erkennung ohne Fisch (`isMeatDish`) für die Wochen-Grenze `meat_max_per_week` |
| `recipes/*.ts` | Feste Rezeptsammlung (vegetarisch, fleisch, wochenende, `mealdb` = 231 übersetzte TheMealDB-Rezepte mit Foto-URL) |
| `aiRecipes.ts` | KI-Rezepte erzeugen, mit eigenen Filtern nachprüfen, in Tabelle `recipes` speichern; Bewertungs-Kommentare (`ctx.feedback` aus `loadContext`) fließen in den Prompt; `generateWishRecipe` = Rezept nach Wunsch (nur Vorschau, Speichern über `POST /recipes/ai-save`) |
| `recipeImport.ts` | Rezept per Link (schema.org JSON-LD, z. B. Chefkoch) → auf 4 Portionen umrechnen |
| `chefkoch.ts` | Chefkoch-Suche: Such-Adresse mit Filter-Kennungen, Treffer aus der `ItemList` (JSON-LD) der Ergebnisseite, Details per `parseRecipeDetails`; Seiten über den Cloudflare-Cache (6 Std.; wirkt nur mit eigener Domain, nicht auf workers.dev). Nur `chefkoch.de/rezepte/…` wird abgerufen |
| `images.ts` | Bilder: TheMealDB-Originalfoto → KI-Bild → Ersatzfoto (Pexels/Pixabay/Openverse, geprüft mit `photoFit`: Gericht zu sehen, keine fremden Hauptzutaten `CONFLICTS`); gespeichert als `bytea` in `meal_images` – ohne `profile_id` gemeinsam, mit `profile_id` eigene Fassung einer Familie (Vorrang, URL `?f=<Familie>`; „Neues Bild“, Entfernen, Umbenennen-Kopie, Chefkoch-Fotos). Sichtbares Bild: `effectiveImageUrl` bzw. `ORDER BY profile_id IS NULL`. `removeImage(…, profileId)`: `source = 'removed'`, Foto-Link bzw. `mealdb` in `rejected_photos`. Cron und Nachprüfung arbeiten nur auf gemeinsamen Bildern |
| `shopping.ts` | Einkaufsliste aus Plan-Zutaten: parsen, auf Portionen skalieren, zusammenfassen, Vorrat aussortieren. Vorrat = `DEFAULT_PANTRY` (Wörter aus `PANTRY_WORDS`) + eigene `pantry_items`; herausgenommene Standard-Einträge = `pantry_items.excluded`; Anzeige über `pantryOverview` |
| `shops.ts` | Knuspr/Picnic (inoffizielle APIs): Login, Suche, Warenkorb; AES-GCM-Verschlüsselung der Zugangsdaten |

### Frontend (`src/`)

- `App.tsx` hält den globalen Zustand (Profil, Familie, Plan, Favoriten …) und schaltet die Bereiche:
  `speiseplan | einkaufsliste | rezepte | favoriten | einstellungen` (`ViewTab`, im URL-Hash gemerkt).
- `lib/api.ts`: **alle** Serveraufrufe. Komponenten rufen nie selbst `fetch` auf.
- Jede Ansicht/jedes Fenster ist eine eigene Komponente (`…View`, `…Modal`, `…Sheet`).
- Fenster nutzen `useDialog` (Escape schließt das oberste, Fokus, Scroll-Sperre); Bestätigungen über `ConfirmDialog`, nie `alert()`/`confirm()`.
- Nachtische: feste Sammlung als Frontend-Daten (`data/desserts.ts` = TheMealDB mit Foto + `data/dessertsFamily.ts` = eigene ohne Foto, eigener Chunk) plus **eigene Nachtische** aus der Tabelle `custom_desserts` (`GET/POST /desserts/custom`, `POST /recipes/to-dessert` macht aus einem Hauptgericht einen Nachtisch); `DessertsView` mischt beide. Am Gericht gespeichert in `plan_meals.dessert` (jsonb). Eigene Nachtische haben ihr Bild unter `/api/images/<Name>` (`lib/desserts.ts` → `dessertImage`); der Cron erzeugt fehlende nach und nach.
- Preisvergleich/Grundpreis: `lib/unitPrice.ts`. Portionen: `lib/portions.ts`.
- Eigene Rezept-Filter: `lib/recipeFilters.ts` – Regeln (Suchbegriffe/Zeit) plus Hand-Zuordnung (`includeNames`/`excludeNames`).
- Filter der Rezept-Übersicht: `RecipeFilterSheet` (ein Fenster), Gruppen-Logik `lib/recipeFacets.ts` (in der Gruppe oder, zwischen Gruppen und). Speiseart/Hauptzutat: `lib/recipeCategories.ts` (Heuristik) plus Korrekturen pro Gericht (`recipe_category_overrides`, `GET/POST /category-overrides`).
- Administration: `AdminSettings` (Familien) und `AdminStats` (Statistik), nur für `isOwner`.
- Anmeldung: `LoginScreen` (Anmelden bzw. ersten Zugang anlegen), `AccountSettings` (Einstellungen → Zugänge). Ohne Sitzung zeigt `App` die Anmeldung.
- `localStorage` nur für Komfort (auf-/zugeklappt, gewählte Einkaufswochen; altes Familien-Passwort nur bis zum ersten Zugang), immer in `try/catch`.

### Design „Aubergine“

Farben in `tailwind.config.js`: `brand-*` (Pflaume, Hauptfarbe), `coral-*` (Akzent: „günstiger“, Fortschritt),
`gray-*` mit Pflaumenstich. Schrift Plus Jakarta Sans; Logo-Schriftzug `Logo.tsx` in Poppins (in `index.html` nur die Zeichen m/ı/y/u geladen), „mi“ fett, „yummy“ leicht, i-Punkt = Koralle-Ring. **Keine** `green-*`-Klassen mehr verwenden – alles ist auf `brand-*` umgestellt.
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

Mehrere Familien (`profiles`, eine pro Familie); Zugänge (`users`) gehören über `profile_id` zur Familie. Alle Tabellen
mit Familiendaten hängen an `profile_id` – **jede Abfrage auf die Familie aus `getProfile(sql, user)` beschränken**, IDs aus
der Anfrage immer gegen die Familie prüfen (z. B. `planOwned`). `recipes` (KI/Import/Bearbeitungen) gehört seit 0016 einer
Familie (eindeutig je `(profile_id, name)`); **KI-Rezepte (`source = 'ai'`, unbearbeitet) sieht jede Familie** (`loadPool`,
`recipeCatalog`: eigene Zeilen zuletzt, damit sie gleichnamige ersetzen; Bearbeiten eines fremden KI-Rezepts = eigene Zeile mit `replaces`); `meal_images` ist gemeinsam mit optionaler Fassung pro Familie (seit 0017); `app_settings` ist global.

Daten-Konventionen:
- Datumsfelder als Text ausgeben (`meal_date::text`), Zeitzonen-Fallen beachten: im Frontend nie `toISOString()` für lokale Daten.
- Zutaten sind `text[]` im Format „Menge Einheit Zutat“, Rezepte immer für **4 Portionen**; Skalierung erst bei Anzeige/Einkaufsliste.
- Zubereitung: ein Schritt pro Zeile (`\n`).

## Secrets (Cloudflare Worker)

`DATABASE_URL`, `APP_PASSWORD` (bisheriges Familien-Passwort; nur noch zum Anlegen des ersten Zugangs), `CREDENTIALS_KEY` (verschlüsselt Shop-Zugangsdaten und den privaten Push-Schlüssel; Ändern = Shops neu verbinden, Erinnerung neu einschalten),
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
- `/api/images/*` ist absichtlich ohne Anmeldung (Bilder sind nicht privat); `?f=<profile_id>` liefert die Fassung einer Familie.
- Service Worker (`public/sw.js`): `/api` wird nie gecacht. Bei Änderungen an gecachten Dateien `CACHE`-Version hochzählen.
  Er empfängt auch die Push-Nachrichten (`push`, `notificationclick`).
- Push auf dem iPhone geht nur in der installierten PWA (Home-Bildschirm), ab iOS 16.4.
- Fenster (Modals) immer über `useDialog`: Escape und Scroll-Sperre zählen offene Fenster (`lib/dialogStack.ts`).
