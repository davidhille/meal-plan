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
- **Doku immer selbst nachziehen, ohne Aufforderung, im selben PR:** Was eine spätere Session wissen muss, gehört hierher
  (CLAUDE.md), nicht nur in den Chat. Gemeint sind gefundene Fehlerursachen, Stolperfallen, Zugänge/Werkzeuge und Entscheidungen
  von David (z. B. „Dubletten nur über die URL“). Erledigte Einzelheiten und Verlauf gehören nicht hierher.
- **Merge:** Nach grüner CI (GitHub Actions + Workers Builds) direkt squash-mergen. David merged nicht selbst. Ist die CI rot,
  nicht mergen und Bescheid geben. Danach den lokalen Branch löschen und auf `main` wechseln (sonst meldet der Stop-Hook ungepushte
  Commits).
- PRs, Merges und Checks über die REST-API (`gh api repos/davidhille/meal-plan/...`); GraphQL (`gh pr create`) ist in
  Claude-Sessions gesperrt.
- Weiß diese Datei etwas nicht, das David voraussetzt: in früheren Chats des Claude-Projekts suchen (Chat-Suche), bevor man
  „geht nicht“ sagt.

## Live prüfen

- Die Claude-Cloud-Umgebung erreicht **weder Neon noch die Cloudflare-API noch miyummy.com** (der Proxy antwortet mit 403). Die
  Secrets liegen nur in Cloudflare und kommen nicht ins Repo.
- **Weg zu den Live-Daten:** der eingebaute Browser der Claude-Desktop-App auf Davids Rechner (Tools `Claude_Browser__*`; die App
  muss laufen und die Session mit dem Rechner verknüpft sein). Dort ist David in https://miyummy.com angemeldet (Eigentümer/Admin).
  Mit `javascript_tool` die API samt Sitzungs-Cookie aufrufen, z. B.:
  - `fetch('/api/admin/errors')`: Fehlerliste (`app_errors`, wie Administration → Fehler)
  - `fetch('/api/recipes/catalog')`: Rezept-Übersicht (u. a. `review`, `imageUrl`)
  - `fetch('/api/auth/status')`, `fetch('/api/profile')`: Anmeldung und Familien-Einstellungen
  - Schreibende Aufrufe nur, wenn sie zur Aufgabe gehören, z. B. `POST /api/profile/chefkoch-auto/run` zum Testen der Automatik.
- Nach Merge und Deploy (ca. 1 Minute, Migrationen laufen beim ersten Aufruf) Änderungen dort prüfen und das Ergebnis nennen,
  statt nur auf die CI zu verweisen.
- Lokal in der Cloud-Umgebung: `bun install` schlägt fehl (kein Paket-Registry-Zugriff). `bun test <datei>` geht für Module ohne
  Abhängigkeiten. Typen, Lint und Build prüft die CI im PR.

## Architektur

### Worker (`worker/`)

| Datei | Inhalt |
|---|---|
| `index.ts` | Einstieg (läuft vor den Assets, `run_worker_first`): `www.` → 301 ohne www, `/api/*` → `handleApi`, sonst Assets; `scheduled` (Cron alle 15 Min) → `runRoutines` |
| `api.ts` | Einstieg der API: Datenbank, Migration, Anmeldung (Sitzungs-Cookie → `ctx.user`), Origin-Prüfung bei ändernden Anfragen, verteilt an die Routen; Fehler → JSON |
| `auth.ts`, `routes/auth.ts` | Login pro Person: PBKDF2-Hash (100.000 Iterationen, Workers-Maximum), Sitzungen in `sessions` (nur SHA-256 des Tokens, Cookie `mp_session` HttpOnly/Secure/Lax, 180 Tage), Sperre nach 8 Fehlversuchen. `/auth/status`, `/auth/login`, `/auth/logout`, `/auth/setup` (erster Zugang, nur mit gesetztem `APP_PASSWORD` und solange `users` leer ist; ohne Secret 503, nie offen: `checkSetupPassword`) sind öffentlich; `/auth/password` und `/users` (nur Admin) brauchen eine Sitzung. Alles andere ohne Sitzung = 401, auch auf einer leeren Datenbank (der alte `X-App-Password`-Übergang ist entfernt). Einladung: wird bei einem Fehler beim Anlegen des Zugangs wieder freigegeben |
| `routes/admin.ts` | Administration (nur `users.is_owner`): Familien anlegen (Start-Listen + Einladung), Einladungslink, umbenennen, sperren (`profiles.disabled`), löschen. Einladungen in `invites` (nur Token-Hash, 7 Tage, einmal); angenommen über öffentliches `/auth/invite/:token`. `GET /admin/stats` = Statistik pro Familie inkl. KI-Verbrauch |
| `aiUsage.ts` | KI-Verbrauch: `meteredEnv(env, sql, profileId)` zählt jeden erfolgreichen `AI.run` in `ai_usage` (geschätzte Neurons nach Preisliste; `null` = App/Cron). `api.ts` gibt Routen die gezählte Umgebung (`ctx.env`), `routines.ts` pro Familie bzw. `null`. Neue KI-Aufrufe immer über `ctx.env`/`meteredEnv`, nie über das rohe `env` |
| `backup.ts` | Wöchentliche Sicherung je Familie als JSON in den R2-Bucket (Binding `BACKUPS`, optional; ohne Binding passiert nichts). Im Cron am Ende, **eine Familie je Lauf** (Free-Limit 50 Unteranfragen), `app_settings.backup_ok_<id>`/`backup_try_<id>`, die letzten 8 Dateien bleiben; ohne Bilddaten (`exportFamily(…, { withImages: false })`, `exportFamily` läuft als ein Batch). Fehler → `app_errors` + Push |
| `storage.ts` | Datenbankgröße (`pg_database_size`) gegen die Neon-Free-Grenze 1 GB (`DB_LIMIT_BYTES`): Anzeige in Admin → Statistik, im Cron stündlich geprüft, Push ab 80 % (einmal am Tag). `adminTools.cleanupOldRows` räumt um 4 Uhr Sitzungen, Einladungen und KI-Zähler auf |
| `routes/share.ts` | Plan teilen: `POST/DELETE /plans/:id/share` (Token, nur Hash in `meal_plans.share_hash`), öffentlich `GET /share/:token` (ohne Anmeldung). Frontend: `?plan=<token>` → `SharedPlanView` (eigener Chunk, in `main.tsx` vor `App`) |
| `adminTools.ts` | `logError` (Tabelle `app_errors`, nie werfend; aus `api.ts`, `routines.ts`, `meteredEnv`; `oncePerDay` für sich wiederholende Fehler wie Chefkoch-Fotos), `alertOwnerOncePerDay` (Push an den Betreiber, einmal am Tag je Anlass über `app_settings.alert_<key>_day`; genutzt bei Server-Fehlern (500) und gescheiterten Routinen), `checkAiWarning` (Push an Betreiber ab 80 %, einmal am Tag über `app_settings.ai_warn_day`), `exportFamily`/`importFamily` (alle Tabellen mit `profile_id` außer Zugängen/Protokollen plus Plan-Kind-Tabellen; Import nur in dieselbe Familie, eine Transaktion). KI-Budget: `profiles.ai_daily_limit`, geprüft in `meteredEnv` → `FamilyBudgetError` (zählt als Kontingent, sperrt die KI aber nicht global) |
| `http.ts` | `Env`, Anfrage-Kontext `Ctx` (inkl. `user`), `json()`, `UserError` (+ `publicError`, `sameHost`). **Fehler mit Meldung für Menschen immer als `UserError` (oder Unterklasse: `ImportError`, `RecipeEditError`, `FamilyBudgetError`) werfen**; jeder andere Fehler gibt dem Browser nur „Der Server hat gerade ein Problem …“ (500), Detail nur in `app_errors` |
| `routes/*.ts` | Routen nach Bereich (`profile`, `plans`, `recipes`, `shopping`, `shops`). Jede Datei prüft `route`/`parts` und gibt eine `Response` oder `null` (nicht zuständig) zurück |
| `repo.ts` | Gemeinsame DB-Zugriffe: `getProfile(sql, user)` (Familie der angemeldeten Person; ohne Anmeldung nur im Übergang die erste), `loadContext`, `loadPool`, Favoriten, Spaltenlisten (`PLAN_COLS` …) |
| `planning.ts` | Plan erstellen, Gericht austauschen/ersetzen, Rezept-Übersicht (`unsuitable` = passt nicht zu den Gesundheitseinstellungen). `createPlan(…, extendPlanId)` = Plan verlängern (`POST /plans/:id/extend`): nur `datesToFill` – belegte Tage und `meal_plans.cleared_dates` (Tag geleert / Gericht weg verschoben) bleiben |
| `recipeEdits.ts` | Gericht bearbeiten/zurücksetzen. Grundsammlung: Zeile in `recipes` mit `replaces` = Originalname; Umbenennen zieht Bewertung, Ausblenden, Favorit, Filter, Bild und kommende Plan-Tage mit |
| `shoppingList.ts` | Einkaufsliste eines Plans aus DB-Daten (Labels, Zustand, Produkt-Verknüpfungen, Shop-Regeln) |
| `shopAccounts.ts` | Shop-Verbindungen speichern/laden (verschlüsselt), Shop-Zustand für die Einstellungen |
| `routines.ts`, `routineRules.ts` | Cron: fällige Routinen → neuer Plan, Bewertungs-Erinnerung, fehlende Bilder nachziehen. Scheitert eine Routine, nimmt der Cron die Markierung `last_run_at` zurück und versucht es im nächsten Lauf erneut (`routines.run_attempts`, höchstens 3 am Tag, danach Push an den Betreiber); Regeln (`routineDue`, `shouldRetryRoutine`) in `routineRules.ts` |
| `push.ts`, `webpush.ts` | Erinnerung zum Bewerten per Web Push. `webpush.ts` = Verschlüsselung (RFC 8291) + VAPID ohne Bibliothek; die VAPID-Schlüssel erzeugt der Worker selbst und speichert sie verschlüsselt in `app_settings` (kein Secret nötig). Nur bekannte Push-Dienste als Ziel |
| `migrate.ts`, `migrations/` | Datenbank-Migrationen (siehe unten) |
| `meals.ts` | Rezept-Typ, Grundsammlung `MEAL_DATABASE`, Scoring (`scoreMeal`), Auswahl (`pickMeal`, `pickReplacement`), Gesundheitsfilter, Ähnlichkeit (`isSimilarDish`) |
| `chefkochAuto.ts` | Chefkoch-Automatik (`profiles.chefkoch_auto`): im Cron ab `profiles.chefkoch_auto_time` (Standard 06:00, Berliner Zeit) bis 10 neue Hauptspeisen/Tag (≥ 4,5 ★, ≥ 2 Bewertungen, passt zu Gesundheit/Abneigungen), je Lauf **nur eine Familie, reihum** (`pickAutoFamily`; eine Familie braucht ca. 20 Unteranfragen, mehrere in einem Lauf rissen das Limit von 50 – 24.10.2026) und ≤ 3 Rezeptseiten (Fotos brauchen eigene Anfragen); Dubletten-Prüfung nur über die Quelle (`sourceKey` = Chefkoch-Rezeptnummer; `deleteMainDish` trägt gelöschte Chefkoch-Links in `chefkoch_auto_skipped` ein); gleicher Name wird nur aus technischen Gründen übersprungen (Namen sind eindeutig); Zähler `chefkoch_auto_day/_count`, Abgelehntes in `chefkoch_auto_skipped`. Übernommene Rezepte bekommen `recipes.auto_review = true` („Neu“ in der Übersicht, `POST /recipes/review` = behalten). Schalter `PUT /profile/chefkoch-auto` (holt beim Einschalten gleich eine Portion), Uhrzeit `PUT /profile/chefkoch-auto-time`, Handstart `POST /profile/chefkoch-auto/run`. **Fotos holt der Worker nie** (siehe `chefkochPhotos.ts`) |
| `chefkochPhotos.ts` | Chefkoch-Fotos aus dem **Browser**: `chefkochPhotoTodo` (`POST /recipes/photo-todo`: Rezepte ohne Foto, Bild-Adresse von der Rezeptseite, zählt `recipes.photo_attempts` ≤ 5) und `saveChefkochPhoto` (`POST /recipes/photo`: nur Rezept der Familie ohne Foto, Format per Kopfbytes `sniffImageType`, ≤ 4 MB). Frontend: `fillChefkochPhotos` in `lib/api.ts` (beim App-Start in `App.tsx` und nach `runChefkochAuto`), lädt nur von `img.chefkoch-cdn.de` |
| `dislikes.ts` | Abneigungen beim Planen: Familien-Nein (`profiles.family_dislikes`: fisch, meeresfruechte, lamm, schwein, rind, gefluegel) schließt immer aus; „Mag nicht“ einzelner Mitglieder nur bei Mehrheit (sonst −30 in `scoreMeal`). `excludedByDislikes` gilt für Planen, Tauschen, Rezept-Übersicht (`unsuitable`); KI-Rezepte prüfen zusätzlich jede einzelne Abneigung. `PUT /profile/family-dislikes` |
| `dislikePattern.ts` | Muster-Vorschlag: `dislikeHint` (rein, getestet) zählt ausgeblendete Gerichte (`rejected_meals` ohne `geloescht`) je Hauptzutat aus `dislikes.ts`; beim 3. und 6. (`HINT_AT_COUNTS`) kommt `dislikeHint` in der Antwort von `POST /plan-meals/:id/reject` und `POST /recipes/hide` (nie blockierend, Fehler → `null`; die App zeigt ihn in `App.tsx` als Karte, `RecipesView` reicht `onDislikeHint` durch). Annehmen = `PUT /profile/family-dislikes`; kein Zähler in der DB |
| `planQuality.ts` | Kennzahlen „Passt der Plan auf Anhieb?“ pro Familie (Admin → Statistik, Ziele aus dem Discovery-Doc): reine Rechnung `computePlanQuality`; die Abfrage steht in `routes/admin.ts` (`planQualityByFamily`). „Eingriff“ = Länge von `plan_meals.skipped_names` des sichtbaren Gerichts (Tauschen und Ausblenden hängen den alten Namen an; Brotzeit zählt nicht); Ausblenden = `rejected_meals` ohne `reason = 'geloescht'`; Zeitraum 30 Tage ab `meal_date`, auch kommende Tage des laufenden Plans |
| `dayRules.ts` | Regeln pro Wochentag (`profiles.day_rules`, Schlüssel 0–6 = getUTCDay): `off` → Tag wird nicht geplant, `brotzeit` → Brotzeit, `maxMinutes` → nur passende Gerichte (`withinTime`). `pickBrotzeitDates` = feste Brotzeit-Tage plus automatisch bis `profiles.brotzeit_per_week`. Brotzeit im Plan = `plan_meals.brotzeit` (Name „Brotzeit“, keine Zutaten; ohne Bild/Bewertung/Push), `POST /plan-meals/:id/brotzeit`, zurück über `regenerate` |
| `nutrition.ts` | Ernährungs-Schwerpunkte (`focusScore`, Pluspunkte, mehrere gleichzeitig), Saison-Liste, Fleisch-Erkennung ohne Fisch (`isMeatDish`) für die Wochen-Grenze `meat_max_per_week` |
| `recipes/*.ts` | Feste Rezeptsammlung (vegetarisch, fleisch, wochenende, `mealdb` = 231 übersetzte TheMealDB-Rezepte mit Foto-URL) |
| `aiRecipes.ts` | KI-Rezepte erzeugen, mit eigenen Filtern nachprüfen, in Tabelle `recipes` speichern; Bewertungs-Kommentare (`ctx.feedback` aus `loadContext`) fließen in den Prompt; `generateWishRecipe` = Rezept nach Wunsch (nur Vorschau, Speichern über `POST /recipes/ai-save`) |
| `recipeImport.ts` | Rezept per Link (schema.org JSON-LD, z. B. Chefkoch) → auf 4 Portionen umrechnen. `stripAuthorSuffix`: „… von X“ (Chefkoch-Autor) weg; maßgeblich ist die Chefkoch-Adresse – steht „von X“ nicht im Link, ist X der Autor (Partner-Konten wie „Routinier“, „Kaufland“ sehen sonst wie normale Wörter aus) |
| `chefkoch.ts` | Chefkoch-Suche: Such-Adresse mit Filter-Kennungen, Treffer aus der `ItemList` (JSON-LD) der Ergebnisseite, Details per `parseRecipeDetails`; Seiten über den Cloudflare-Cache (6 Std.; wirkt nur mit eigener Domain, nicht auf workers.dev). Nur `chefkoch.de/rezepte/…` wird abgerufen |
| `images.ts` | Bilder: TheMealDB-Originalfoto → KI-Bild → Ersatzfoto (Pexels/Pixabay/Openverse, geprüft mit `photoFit`: Gericht zu sehen, keine fremden Hauptzutaten `CONFLICTS`); gespeichert als `bytea` in `meal_images` – ohne `profile_id` gemeinsam, mit `profile_id` eigene Fassung einer Familie (Vorrang, URL `?f=<Familie>`; „Neues Bild“, Entfernen, Umbenennen-Kopie, Chefkoch-Fotos). Sichtbares Bild: `effectiveImageUrl` bzw. `ORDER BY profile_id IS NULL`. `removeImage(…, profileId)`: `source = 'removed'`, Foto-Link bzw. `mealdb` in `rejected_photos`. Der Cron arbeitet nur auf gemeinsamen Bildern |
| `shopping.ts` | Einkaufsliste aus Plan-Zutaten: parsen, auf Portionen skalieren, zusammenfassen, Vorrat aussortieren. Vorrat = `DEFAULT_PANTRY` (Wörter aus `PANTRY_WORDS`) + eigene `pantry_items`; herausgenommene Standard-Einträge = `pantry_items.excluded`; Anzeige über `pantryOverview` |
| `shops.ts` | Knuspr/Picnic (inoffizielle APIs): Login, Suche, Warenkorb; AES-GCM-Verschlüsselung der Zugangsdaten |

### Frontend (`src/`)

- `App.tsx` hält den globalen Zustand (Profil, Familie, Plan, Favoriten …) und schaltet die Bereiche:
  `speiseplan | einkaufsliste | rezepte | favoriten | einstellungen` (`ViewTab`, im URL-Hash gemerkt).
- Navigation: `TabSwitcher` mit `variant="bottom"` (Handy, `sm:hidden`, fest unten inkl. `env(safe-area-inset-bottom)`) bzw. `"top"` (ab `sm`). Feste Elemente unten (CartBar, Hinweise) am Handy über der Tab-Leiste platzieren (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`).
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
Kontraste auf WCAG AA; Icon-Knöpfe brauchen `aria-label`. Kleinste Schrift `text-xs` (12 px), keine `text-[10px]`/`text-[11px]`.
Kleine Symbol-Knöpfe (unter 44 px) bekommen die Klasse `tap` (unsichtbare Tippfläche, `index.css`).
Jedes Eingabefeld braucht einen Namen (sichtbares `<label>` oder `aria-label`); Hinweise zu einem Feld (z. B. „mind. 8 Zeichen“) dauerhaft
sichtbar und per `aria-describedby` verbunden, nicht nur als Platzhalter. Fenster nur über `useDialog`: Escape, Fokus hinein und zurück und
**Tab bleibt im Fenster** (`lib/focusTrap.ts`); ohne das wanderte der Fokus hinter das Fenster. Bewegung: `prefers-reduced-motion` in
`index.css` (Übergänge und Pulsieren aus, Ladekreise laufen weiter). Stand der Prüfung: `docs/accessibility-audit-2026-10-24.md`
(Entscheidung von David: kein Test mit echtem Screenreader/VoiceOver, nicht wieder vorschlagen. Felder immer mit sichtbarem Label, auf der Anmeldeseite `Field`).

### Texte (UX-Writing)

**Anrede:** eine Person und ihre Handlung = **du** („Tippe auf …“), die Familie und Gemeinsames = **ihr/euer** („Was hättet ihr gern?“,
„Eure Pläne bleiben“), Hinweise und Fehler ohne Handelnde neutral („Bitte Netz prüfen …“). Nie „Sie“.
**Fehlermeldungen:** sagen, was nicht ging (mit Gegenstand: „Das Rezept konnte nicht gespeichert werden.“, nicht „Speichern hat nicht
geklappt.“), und wenn möglich, was zu tun ist. Netz- und Serverfehler wandelt `lib/errorText.ts` in `request`/`requestPublic` um
(nie „Failed to fetch“ oder „HTTP 502“ anzeigen); eine deutsche Meldung vom Server hat Vorrang. Neue Fehlertexte im Worker auf Deutsch schreiben.
**Titel von Fenstern** nennen die Handlung („Tag leeren?“), nie „Bitte bestätigen“. Knöpfe sind Verben, kein „OK“/„Ja“. Leerzustände
erklären kurz und bieten den nächsten Schritt. Stand der Prüfung: `docs/ux-writing-audit-2026-10-24.md`.
Interaktions-Audit der Einkaufsliste (abgeschlossen 24.10.2026, alle Befunde bearbeitet): `docs/interaction-audit-einkaufsliste-2026-10-24.md`.
Interaktions-Audit Erststart neue Familie (Block 1 und 2 umgesetzt: Abneigungen im leeren Plan, ehrliche Zusammenfassung, Hinweis nach dem ersten Plan, Login-Politur #7; #6, #8, #9 offen): `docs/interaction-audit-erststart-2026-10-24.md`.

## UX-Discovery

Anker für Produktentscheidungen: `docs/ux-discovery/2026-10-23-miyummy-discovery.md` (Problem: „Der Plan lernt zu wenig“). Stand der
Folgeschritte laut `docs/ux-discovery/2026-10-24-validation.md`: Abneigung = Ausschluss und Ausblenden mit „Keinen X mehr“ sind
umgesetzt (#123), die Kennzahlen stehen in Admin → Statistik (`planQuality.ts`); der Muster-Vorschlag steht (`dislikePattern.ts`: beim 3. und 6. ausgeblendeten Gericht derselben Hauptzutat fragt die App „Lamm ganz weglassen?“,
im Plan und in der Rezept-Übersicht); „Warum dieses Gericht?“ wurde am 24.10.2026 gebaut und wieder entfernt (David: stand bei jedem Gericht fast dasselbe, seit dem Familien-Nein gibt es keine überraschenden Vorschläge mehr; nicht wieder einbauen, außer es gibt einen individuellen Grund pro Gericht). Entscheidung von David: Familien-Nein schließt immer aus, „Mag nicht“ einzelner Mitglieder nur bei Mehrheit.
**Entscheidung von David:** Die Familie Hille mag Meeresfrüchte (Garnelen & Co.), sie sollen im Plan bleiben; nein sind nur Fisch und
Lamm. „Fisch“ schließt Meeresfrüchte bewusst nicht aus (eigene Gruppe `meeresfruechte`), das ist keine Lücke. Das Beispiel
„Reisbandnudeln mit Garnelen“ im Discovery-Doc war kein Fehlvorschlag.
Vor dem Ausliefern größerer UX-Änderungen den Skill `ux-validate` gegen dieses Doc laufen lassen.

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
- **Chefkoch-Fotos nie im Worker laden:** `img.chefkoch-cdn.de` antwortet Cloudflare-Workers mit 403 (Cron wie Nutzeranfragen, am 24.10.2026
  belegt; Rezeptseiten von `www.chefkoch.de` lädt der Worker dagegen problemlos). Aus dem **Browser** klappt es: `fetch` mit CORS ist erlaubt
  (am 24.10.2026 von miyummy.com aus geprüft, HTTP 200) – **aber nur für bestimmte Zuschnitte**: `crop-160x120`, `240x300`, `600x400`, `720x480`, `960x640` haben CORS, der Zuschnitt der Rezeptseite (`960x540`) nicht (Browser: „Failed to fetch“), andere Größen liefern 400. Darum holt die App die Fotos (`chefkochPhotos.ts`, `fillChefkochPhotos`) und wählt den Zuschnitt über `lib/chefkochPhoto.ts` (`photoCandidates`).
  `storeSourcePhoto` (Rezept-Import per Link, „In meine Rezepte übernehmen“) versucht es serverseitig weiter und scheitert still; das
  Foto holt dann der Browser nach.
- **Betrieb/Wiederherstellung:** Neon Free hält nur 6 Std. Verlauf, darum die wöchentliche R2-Sicherung (`backup.ts`; Bucket `miyummy-backups` und Binding `BACKUPS` in `wrangler.jsonc` sind eingerichtet, siehe `SETUP_NEON_CLOUDFLARE.md` 3b; fehlt der Bucket, schlägt der Deploy fehl). Free-Limits des Workers: 50 Unteranfragen je Cron-Lauf (jede Datenbankabfrage zählt, im Cron deshalb Abfragen bündeln und je Lauf nur eine Familie sichern bzw. Chefkoch-Rezepte holen; ist das Budget leer, scheitert jede weitere Abfrage, auch `logError` – im Cloudflare-Log dann „Fehler nicht protokolliert“), 100.000 Anfragen/Tag. Stand und offene Punkte stehen in `docs/prod-readiness-audit-2026-10-24.md`. Migrationen nur additiv halten, damit ein Rollback der Worker-Version ohne Datenverlust geht.
- **Amazon** wurde bewusst entfernt (keine Suche/Warenkorb aus Apps möglich) – nicht wieder einbauen.
- **Gesundheitsfilter** (`violatesHealthConditions`) sind Heuristiken auf Zutatentext, keine Allergie-Garantie. KI-Rezepte
  werden immer nachgeprüft, die KI hält sich nicht zuverlässig an Vorgaben.
- **Abwechslung:** `isSimilarDish` verhindert Varianten desselben Gerichts im Plan; Gerichte der letzten 3 Wochen bekommen Abzug.
- `/api/images/*` ist absichtlich ohne Anmeldung (Bilder sind nicht privat); `?f=<profile_id>` liefert die Fassung einer Familie.
- Service Worker (`public/sw.js`): `/api` wird nie gecacht. Bei Änderungen an gecachten Dateien `CACHE`-Version hochzählen.
  Er empfängt auch die Push-Nachrichten (`push`, `notificationclick`).
- Push auf dem iPhone geht nur in der installierten PWA (Home-Bildschirm), ab iOS 16.4.
- Fenster (Modals) immer über `useDialog`: Escape und Scroll-Sperre zählen offene Fenster (`lib/dialogStack.ts`).
