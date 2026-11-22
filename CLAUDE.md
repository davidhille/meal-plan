# CLAUDE.md – miyummy (Familien-Speiseplaner)

Deutschsprachige Web-App für die Essensplanung einer Familie: Wochenplan, Rezepte, Einkaufsliste mit
Anbindung an Knuspr und Picnic. Live unter https://miyummy.com/ (zusätzlich https://meal-plan.davidshille.workers.dev/; installierbar als PWA).
Nutzerdoku/Funktionsübersicht: `PROJEKTUEBERSICHT.md`. Einrichtung: `SETUP_NEON_CLOUDFLARE.md`.
Aktueller Stand (zuletzt erledigt, offene Punkte, Grenzen): `status.md`.

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
- **`status.md` am Ende jeder Aufgabe mitpflegen** (Stand-Datum, „Zuletzt erledigt“ kurz halten und Älteres streichen, „Offen“ und
  „Entscheidungen“ nachziehen). Sie ist der Kurzüberblick, keine zweite Fassung von `CLAUDE.md`.
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

## Confluence (Space MP, davidhille.atlassian.net)

- Zwei Seiten erzeugt `scripts/confluence/sync.ts` automatisch (GitHub Action `confluence.yml` bei jedem Push auf `main`, auch von Hand
  startbar): „Funktionen (Benutzerhandbuch)“ ← `PROJEKTUEBERSICHT.md` (Seite wird überschrieben, nie dort von Hand ändern) und
  „Änderungshistorie“ ← gemergte PRs. Der Markdown-Umsetzer steht in `scripts/confluence/markdown.ts` (getestet, nur das, was die Datei nutzt).
  Ohne die Secrets `CONFLUENCE_EMAIL`/`CONFLUENCE_API_TOKEN` (GitHub → Settings → Secrets → Actions) tut der Lauf nichts. Lokal: `bun scripts/confluence/sync.ts --dry-run`.
- Startseite, „Architektur & Technik“, „Datenbank & Migrationen“ und „Betrieb“ pflegt man von Hand (Atlassian-Werkzeuge in der Claude-Session;
  vor dem Überschreiben mit `getConfluenceContent` als HTML lesen und gezielt per `edits` ändern, sonst gehen Panels verloren). Beim Abschluss
  einer Aufgabe, die Module, Migrationen oder Betrieb ändert, diese Seiten mitziehen.

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
| `index.ts` | Einstieg (läuft vor den Assets, `run_worker_first`): `www.` → 301 ohne www, `/api/*` → `handleApi`, sonst Assets; `scheduled` (Cron stündlich) → `runRoutines` |
| `api.ts` | Einstieg der API: Datenbank, Migration, Anmeldung (Sitzungs-Cookie → `ctx.user`), Origin-Prüfung bei ändernden Anfragen, verteilt an die Routen; Fehler → JSON |
| `auth.ts`, `routes/auth.ts` | Login pro Person: PBKDF2-Hash (100.000 Iterationen, Workers-Maximum), Sitzungen in `sessions` (nur SHA-256 des Tokens, Cookie `mp_session` HttpOnly/Secure/Lax, 180 Tage), Sperre nach 8 Fehlversuchen. `/auth/status`, `/auth/login`, `/auth/logout`, `/auth/setup` (erster Zugang, nur mit gesetztem `APP_PASSWORD` und solange `users` leer ist; ohne Secret 503, nie offen: `checkSetupPassword`) sind öffentlich; `/auth/password` und `/users` (nur Admin) brauchen eine Sitzung. Alles andere ohne Sitzung = 401, auch auf einer leeren Datenbank (der alte `X-App-Password`-Übergang ist entfernt). Einladung: wird bei einem Fehler beim Anlegen des Zugangs wieder freigegeben |
| `routes/admin.ts` | Administration (nur `users.is_owner`): Familien anlegen (Start-Listen + Einladung), Einladungslink, umbenennen, sperren (`profiles.disabled`), löschen. Einladungen in `invites` (nur Token-Hash, 7 Tage, einmal); angenommen über öffentliches `/auth/invite/:token`. `GET /admin/stats` = Statistik pro Familie inkl. KI-Verbrauch und Einrichtung (Mitglieder, Familien-Nein) |
| `aiUsage.ts` | KI-Verbrauch: `meteredEnv(env, sql, profileId)` zählt jeden erfolgreichen `AI.run` in `ai_usage` (geschätzte Neurons nach Preisliste; `null` = App/Cron). `api.ts` gibt Routen die gezählte Umgebung (`ctx.env`), `routines.ts` pro Familie bzw. `null`. Neue KI-Aufrufe immer über `ctx.env`/`meteredEnv`, nie über das rohe `env` |
| `backup.ts` | Wöchentliche Sicherung je Familie als JSON in den R2-Bucket (Binding `BACKUPS`, optional; ohne Binding passiert nichts). Im Cron am Ende, **eine Familie je Lauf** (Free-Limit 50 Unteranfragen), `app_settings.backup_ok_<id>`/`backup_try_<id>`, die letzten 8 Dateien bleiben; ohne Bilddaten (`exportFamily(…, { withImages: false })`, `exportFamily` läuft als ein Batch). Fehler → `app_errors` + Push |
| `storage.ts` | Datenbankgröße (`pg_database_size`) gegen die Neon-Free-Grenze 1 GB (`DB_LIMIT_BYTES`): Anzeige in Admin → Statistik, im Cron stündlich geprüft, Push ab 80 % (einmal am Tag). `adminTools.cleanupOldRows` räumt um 4 Uhr Sitzungen, Einladungen und KI-Zähler auf |
| `routes/share.ts` | Plan teilen: `POST/DELETE /plans/:id/share` (Token, nur Hash in `meal_plans.share_hash`), öffentlich `GET /share/:token` (ohne Anmeldung). Frontend: `?plan=<token>` → `SharedPlanView` (eigener Chunk, in `main.tsx` vor `App`) |
| `adminTools.ts` | `logError` (Tabelle `app_errors`, nie werfend; aus `api.ts`, `routines.ts`, `meteredEnv`; `oncePerDay` für sich wiederholende Fehler wie Chefkoch-Fotos), `alertOwnerOncePerDay` (Push an den Betreiber, einmal am Tag je Anlass über `app_settings.alert_<key>_day`; genutzt bei Server-Fehlern (500) und gescheiterten Routinen), `checkAiWarning` (Push an Betreiber ab 80 %, einmal am Tag über `app_settings.ai_warn_day`), `exportFamily`/`importFamily` (alle Tabellen mit `profile_id` außer Zugängen/Protokollen plus Plan-Kind-Tabellen; Import nur in dieselbe Familie, eine Transaktion). KI-Budget: `profiles.ai_daily_limit`, geprüft in `meteredEnv` → `FamilyBudgetError` (zählt als Kontingent, sperrt die KI aber nicht global) |
| `http.ts` | `Env`, Anfrage-Kontext `Ctx` (inkl. `user`), `json()`, `UserError` (+ `publicError`, `sameHost`). **Fehler mit Meldung für Menschen immer als `UserError` (oder Unterklasse: `ImportError`, `RecipeEditError`, `FamilyBudgetError`) werfen**; jeder andere Fehler gibt dem Browser nur „Der Server hat gerade ein Problem …“ (500), Detail nur in `app_errors` |
| `routes/*.ts` | Routen nach Bereich (`profile`, `plans`, `recipes`, `shopping`, `shops`). Jede Datei prüft `route`/`parts` und gibt eine `Response` oder `null` (nicht zuständig) zurück |
| `repo.ts` | Gemeinsame DB-Zugriffe: `getProfile(sql, user)` (Familie der angemeldeten Person; ohne Anmeldung nur im Übergang die erste), `loadContext`, `loadPool`, Favoriten, Spaltenlisten (`PLAN_COLS` …) |
| `planning.ts` | Plan erstellen, Gericht austauschen/ersetzen, Rezept-Übersicht (`unsuitable` = passt nicht zu den Gesundheitseinstellungen **oder** den Abneigungen; `unsuitableBy` = Grund `health`/`dislike`, damit der Hinweis ihn nennt – `lib/health.ts` `unsuitableSubject`/`unsuitableDetail`; ein Hinweis „(Diabetes)“ bei Fischgerichten war falsch, 26.10.2026). `createPlan(…, extendPlanId)` = Plan verlängern (`POST /plans/:id/extend`): nur `datesToFill` – belegte Tage und `meal_plans.cleared_dates` bleiben. Zwei Wege, ein Gericht rauszunehmen (Entscheidung von David 25.10.2026): „Gericht rausnehmen" = Tag frei (wird bei „Hinzufügen" gefüllt, auch nach Verlegen), „Nicht kochen" (`DELETE …?keepEmpty=1`) = `cleared_dates`, bleibt leer; Häkchen `includeCleared` im Plan-Fenster füllt sie ausnahmsweise; die Route übergibt `opts.today` (Berliner Datum), Tage davor bekommen nie ein Gericht |
| `recipeEdits.ts` | Gericht bearbeiten/zurücksetzen. Grundsammlung: Zeile in `recipes` mit `replaces` = Originalname; Umbenennen zieht Bewertung, Ausblenden, Favorit, Filter, Bild und kommende Plan-Tage mit |
| `shoppingList.ts` | Einkaufsliste eines Plans aus DB-Daten (Labels, Zustand, Produkt-Verknüpfungen, Shop-Regeln). Die Gerichte werden nach `meal_date, created_at` gelesen, damit `usedIn` mit dem nächsten Gericht beginnt |
| `shopAccounts.ts` | Shop-Verbindungen speichern/laden (verschlüsselt), Shop-Zustand für die Einstellungen |
| `routines.ts`, `routineRules.ts` | Cron: fällige Routinen → neuer Plan, Bewertungs-Erinnerung, fehlende Bilder nachziehen. Scheitert eine Routine, nimmt der Cron die Markierung `last_run_at` zurück und versucht es im nächsten Lauf erneut (`routines.run_attempts`, höchstens 3 am Tag, danach Push an den Betreiber); Regeln (`routineDue`, `shouldRetryRoutine`) in `routineRules.ts` |
| `push.ts`, `webpush.ts` | Erinnerung zum Bewerten per Web Push. `webpush.ts` = Verschlüsselung (RFC 8291) + VAPID ohne Bibliothek; die VAPID-Schlüssel erzeugt der Worker selbst und speichert sie verschlüsselt in `app_settings` (kein Secret nötig). Nur bekannte Push-Dienste als Ziel |
| `migrate.ts`, `migrations/` | Datenbank-Migrationen (siehe unten) |
| `meals.ts` | Rezept-Typ, Grundsammlung `MEAL_DATABASE`, Scoring (`scoreMeal`: Sterne um 3 zentriert, Favorit +10, Zufall `RANDOM_SPREAD` 25), Auswahl (`pickMeal`, `pickReplacement`), Gesundheitsfilter, Ähnlichkeit (`isSimilarDish`) |
| `chefkochAuto.ts` | Chefkoch-Automatik (`profiles.chefkoch_auto`): im Cron ab `profiles.chefkoch_auto_time` (Standard 06:00, Berliner Zeit) bis 10 neue Hauptspeisen/Tag (≥ 4,5 ★, ≥ 2 Bewertungen, passt zu Gesundheit/Abneigungen), je Lauf **nur eine Familie, reihum** (`pickAutoFamily`; eine Familie braucht ca. 20 Unteranfragen, mehrere in einem Lauf rissen das Limit von 50 – 24.10.2026) und ≤ 3 geladene Rezeptseiten, dazu bis 6 Ergebnisseiten, die so lange durchsucht werden, bis das Ladebudget voll ist (Fotos brauchen eigene Anfragen). **Fehlerursache 26.10.2026 („Heute übernommen: 0“, obwohl Chefkoch passende zeigte):** früher nur 2 Ergebnisseiten je Lauf; was dort stand, war bekannt oder dauerhaft übersprungen (v. a. Rezepte mit nur 1 Bewertung, die erst später mehr bekommen) – die Automatik fand dann nie wieder etwas. Jetzt: zu wenige Bewertungen = `chefkoch_auto_skipped.retry_after` (3 Tage, danach erneut prüfen, 0032), alles andere dauerhaft; `POST /profile/chefkoch-auto/run` liefert `report` (Ablehnungsgrund je geprüftem Rezept) zur Diagnose; Dubletten-Prüfung nur über die Quelle (`sourceKey` = Chefkoch-Rezeptnummer; `deleteMainDish` trägt gelöschte Chefkoch-Links in `chefkoch_auto_skipped` ein); gleicher Name wird nur aus technischen Gründen übersprungen (Namen sind eindeutig); Zähler `chefkoch_auto_day/_count`, Abgelehntes in `chefkoch_auto_skipped`. Übernommene Rezepte bekommen `recipes.auto_review = true` („Neu“ in der Übersicht, `POST /recipes/review` = behalten). Schalter `PUT /profile/chefkoch-auto` (holt beim Einschalten gleich eine Portion), Uhrzeit `PUT /profile/chefkoch-auto-time` (nur volle Stunden, weil der Cron stündlich läuft: Auswahlfeld in der App, der Server rundet ab; `<input type="time" step=3600>` zeigt im Browser trotzdem Minuten), Handstart `POST /profile/chefkoch-auto/run`. **Fotos holt der Worker nie** (siehe `chefkochPhotos.ts`) |
| `chefkochPhotos.ts` | Chefkoch-Fotos aus dem **Browser**: `chefkochPhotoTodo` (`POST /recipes/photo-todo`: Rezepte ohne Foto, Bild-Adresse von der Rezeptseite, zählt `recipes.photo_attempts` ≤ 5) und `saveChefkochPhoto` (`POST /recipes/photo`: nur Rezept der Familie ohne Foto, Format per Kopfbytes `sniffImageType`, ≤ 4 MB). Frontend: `fillChefkochPhotos` in `lib/api.ts` (beim App-Start in `App.tsx`, nach `runChefkochAuto` und nach `saveImportedRecipe` mit Chefkoch-Link – sonst blieb das Foto beim Import per Link weg, 26.10.2026; der Link-Import schickt keine Bild-Adresse mit, der Server-Weg `storeSourcePhoto` scheitert am 403), lädt nur von `img.chefkoch-cdn.de` |
| `dislikes.ts` | Abneigungen beim Planen: Familien-Nein (`profiles.family_dislikes`: fisch, meeresfruechte, lamm, schwein, rind, gefluegel) schließt immer aus; „Mag nicht“ einzelner Mitglieder nur bei Mehrheit (sonst −30 in `scoreMeal`). `excludedByDislikes` gilt für Planen, Tauschen, Rezept-Übersicht (`unsuitable`); KI-Rezepte prüfen zusätzlich jede einzelne Abneigung. `PUT /profile/family-dislikes` |
| `dislikePattern.ts` | Muster-Vorschlag: `dislikeHint` (rein, getestet) zählt ausgeblendete Gerichte (`rejected_meals` ohne `geloescht`) je Hauptzutat aus `dislikes.ts`; beim 3. und 6. (`HINT_AT_COUNTS`) kommt `dislikeHint` in der Antwort von `POST /plan-meals/:id/reject` und `POST /recipes/hide` (nie blockierend, Fehler → `null`; die App zeigt ihn in `App.tsx` als Karte, `RecipesView` reicht `onDislikeHint` durch). Annehmen = `PUT /profile/family-dislikes`; kein Zähler in der DB |
| `planQuality.ts` | Kennzahlen „Passt der Plan auf Anhieb?“ pro Familie (Admin → Statistik, Ziele aus dem Discovery-Doc): reine Rechnung `computePlanQuality`; die Abfrage steht in `routes/admin.ts` (`planQualityByFamily`). „Eingriff“ = Länge von `plan_meals.skipped_names` des sichtbaren Gerichts (Tauschen und Ausblenden hängen den alten Namen an; Brotzeit zählt nicht); Ausblenden = `rejected_meals` ohne `reason = 'geloescht'`; Zeitraum 30 Tage ab `meal_date`, auch kommende Tage des laufenden Plans |
| `dayRules.ts` | Regeln pro Wochentag (`profiles.day_rules`, Schlüssel 0–6 = getUTCDay): `off` → Tag wird nicht geplant, `brotzeit` → Brotzeit, `maxMinutes` → nur passende Gerichte (`withinTime`). `pickBrotzeitDates` = feste Brotzeit-Tage plus automatisch bis `profiles.brotzeit_per_week`. Brotzeit im Plan = `plan_meals.brotzeit` (Name „Brotzeit“, keine Zutaten; ohne Bild/Bewertung/Push), `POST /plan-meals/:id/brotzeit`, zurück über `regenerate` |
| `weekVariety.ts` | Mengen-Regeln („höchstens 2× Nudeln pro Woche“, „mindestens 1× Fisch pro Woche“, „höchstens 2× Garnelen pro Monat“): `parseVarietyRules`, Zähler (`countsOf`/`addToCounts`, je Woche und Monat), `exceedsCap` (Höchstgrenze), `minimumSlots` (Mindest-Gerichte auf freie Tage verteilen). Kategorien und Standard-Regeln stehen in `src/lib/varietyCategories.ts` (geteilt mit den Einstellungen). **Regel-Arten `fleisch`/`vegetarisch` zählen nach den Zutaten** (`Dish` mit `ingredients`/`type`; `isMeatDish`/`isVegetarianDish`), darum trägt `ctx.planHistory` seit 0043 auch Zutaten und Art; ein Gericht ohne `ingredients` zählt für keine Art; `capReached` für „Fleisch-Grenze erreicht“ (KI-Rezept-Art). Details unter „Stolperfallen → Abwechslung“ |
| `repeatPause.ts` | Pause nach Bewertung: `repeatPauseDays` (unbewertet 70 Tage, 5 ★ 77, 4 ★ 84, 3 ★ 91, 1–2 ★ 365), `skipPauseDays` (weggetauscht: 90 Tage, +45 je weiteres Mal) und `pausedNames` (Gerichte mit Restpause aus Verlauf und `meal_skips`) |
| `slotRules.ts` | Tageslogik der Planung (rein): `effortOf` (Aufwand aus der Zubereitungszeit: bis 45 Min. schnell, darüber aufwendig; ohne Zeit zählt Art „Wochenende“ als aufwendig), `preferredEffortFor` (Mo–Fr schnell, Sa/So aufwendig bevorzugt), `vegMissing` (Vegetarisch-Mindestzahl pro Woche, Standard 3, bei Teilwochen anteilig) |
| `nutrition.ts` | Ernährungs-Schwerpunkte (`focusScore`, Pluspunkte, mehrere gleichzeitig), Fleisch-Erkennung ohne Fisch (`isMeatDish`) für die Regel-Art „fleisch“ |
| `recipes/*.ts` | Feste Rezeptsammlung (vegetarisch, fleisch, wochenende, `mealdb` = 231 übersetzte TheMealDB-Rezepte mit Foto-URL) |
| `aiRecipes.ts` | KI-Rezepte erzeugen, mit eigenen Filtern nachprüfen, in Tabelle `recipes` speichern; Bewertungs-Kommentare (`ctx.feedback` aus `loadContext`) fließen in den Prompt; `generateWishRecipe` = Rezept nach Wunsch (nur Vorschau, Speichern über `POST /recipes/ai-save`) |
| `recipeImport.ts` | Rezept per Link (schema.org JSON-LD, z. B. Chefkoch) → auf 4 Portionen umrechnen. `stripAuthorSuffix`: „… von X“ (Chefkoch-Autor) weg; maßgeblich ist die Chefkoch-Adresse – steht „von X“ nicht im Link, ist X der Autor (Partner-Konten wie „Routinier“, „Kaufland“ sehen sonst wie normale Wörter aus) |
| `chefkoch.ts` | Chefkoch-Suche: Such-Adresse mit Filter-Kennungen, Treffer aus der `ItemList` (JSON-LD) der Ergebnisseite, Details per `parseRecipeDetails`; Seiten über den Cloudflare-Cache (6 Std.; wirkt nur mit eigener Domain, nicht auf workers.dev). Nur `chefkoch.de/rezepte/…` wird abgerufen |
| `images.ts` | Bilder: TheMealDB-Originalfoto → KI-Bild → Ersatzfoto (Pexels/Pixabay/Openverse, geprüft mit `photoFit`: Gericht zu sehen, keine fremden Hauptzutaten `CONFLICTS`); gespeichert als `bytea` in `meal_images` – ohne `profile_id` gemeinsam, mit `profile_id` eigene Fassung einer Familie (Vorrang, URL `?f=<Familie>`; „Neues Bild“, Entfernen, Umbenennen-Kopie, Chefkoch-Fotos). Sichtbares Bild: `effectiveImageUrl` bzw. `ORDER BY profile_id IS NULL`. `removeImage(…, profileId)`: `source = 'removed'`, Foto-Link bzw. `mealdb` in `rejected_photos`. Der Cron arbeitet nur auf gemeinsamen Bildern |
| `shopping.ts` | Einkaufsliste aus Plan-Zutaten: parsen, auf Portionen skalieren, zusammenfassen, Vorrat aussortieren. Vorrat = `DEFAULT_PANTRY` (Wörter aus `PANTRY_WORDS`) + eigene `pantry_items`; herausgenommene Standard-Einträge = `pantry_items.excluded`; Anzeige über `pantryOverview`. **Gerichtszeile (Entscheidung von David 26.10.2026):** `PlanItem.usedIn` = Namen der Gerichte und Nachtische, für die eine zusammengefasste Zutat gebraucht wird (Planreihenfolge, ohne Dubletten; `buildPlanItems` bekommt dafür `mealNames`/`dessertNames` parallel zu `mealIngredients`/`unscaledIngredients`). **Vorrat-Prüfung ohne Füllwörter:** `cleanIngredientName` (`src/lib/ingredientName.ts`, auch im Frontend) macht aus „Etwas Butter zum Braten“ „Butter“; `buildPlanItems` prüft damit `isPantry`/eigenen Vorrat (Anzeige der Zutat bleibt unverändert). „Haben wir immer da“ öffnet ein Fenster mit diesem vorbelegten, änderbaren Namen (`ShoppingListView`, 20.11.2026). Zweck der Gerichtszeile: beim Einkaufen sehen, wofür eine Zutat ist, und ggf. Vorhandenes zu Hause nehmen (z. B. Tomaten statt Cherrytomaten). Im Frontend steht sie **immer sichtbar** als „für Gericht +n“ unter dem Artikel (`ShoppingSection`), alle Gerichte im ⋯-Menü („Gebraucht für“); nur Plan-Zutaten, nicht Vorrat und eigene Artikel. Nicht hinter einen Schalter legen; die Zeile bleibt reiner Text, weil der Artikelname in Shop-Listen die Produktsuche öffnet |
| `shops.ts` | Knuspr/Picnic (inoffizielle APIs): Login, Suche, Warenkorb; AES-GCM-Verschlüsselung der Zugangsdaten |

### Frontend (`src/`)

- `App.tsx` hält den globalen Zustand (Profil, Familie, Plan, Favoriten …) und schaltet die Bereiche:
  `speiseplan | einkaufsliste | rezepte | favoriten | einstellungen` (`ViewTab`, im URL-Hash gemerkt).
- Navigation: `TabSwitcher` mit `variant="bottom"` (Handy, `sm:hidden`, fest unten inkl. `env(safe-area-inset-bottom)`) bzw. `"top"` (ab `sm`). Feste Elemente unten (CartBar, Hinweise) am Handy über der Tab-Leiste platzieren (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`).
- `lib/api.ts`: **alle** Serveraufrufe. Komponenten rufen nie selbst `fetch` auf.
- Jede Ansicht/jedes Fenster ist eine eigene Komponente (`…View`, `…Modal`, `…Sheet`).
- Fenster nutzen `useDialog` (Escape schließt das oberste, Fokus, Scroll-Sperre); Bestätigungen über `ConfirmDialog`, nie `alert()`/`confirm()`.
- Nachtische: feste Sammlung als Frontend-Daten (`data/desserts.ts` = TheMealDB mit Foto + `data/dessertsFamily.ts` = eigene ohne Foto, eigener Chunk) plus **eigene Nachtische** aus der Tabelle `custom_desserts` (`GET/POST /desserts/custom`, `POST /recipes/to-dessert` macht aus einem Hauptgericht einen Nachtisch); `DessertsView` mischt beide. Neue Nachtische kommen über „Nachtisch hinzufügen“ (`AddRecipeSheet` mit `ways`: Chefkoch-Suche oder Link) bzw. im Link-Import-Dialog `RecipeImportModal` über die Art „Nachtisch“ (`onDessertSaved`; bei Chefkoch-Links Originalmengen und „Ergibt“ aus `previewChefkoch`, sonst auf 4 Portionen umgerechnet). **Offen:** Das Chefkoch-Foto eines Nachtischs holt der Server nicht (403, `storeSourcePhoto` scheitert still), der Browser-Weg `fillChefkochPhotos` kennt nur Rezepte – der Cron erzeugt dann ein KI-Bild. Am Gericht gespeichert in `plan_meals.dessert` (jsonb). Eigene Nachtische haben ihr Bild unter `/api/images/<Name>` (`lib/desserts.ts` → `dessertImage`); der Cron erzeugt fehlende nach und nach.
- Beilagen/Salate: feste Sammlung `src/data/sides.ts` (4 Portionen, `carb` = Sättigungsbeilage), am Gericht in `plan_meals.sides` (jsonb-Liste, je `kind` höchstens eine; `PUT /plan-meals/:id/sides`, `parseSides` in `routes/plans.ts`), Auswahl in `SidePickerModal`. Anders als Nachtische werden Beilagen **mit dem Gericht skaliert** (Portionen + `guests`) und in `shoppingList.ts` als eigene Gerichtszeile „Name (zu Gericht)“ an `buildPlanItems` angehängt. Tauschen/Ersetzen (`replaceMeal`, `replaceWithRecipe`) nimmt `sides` wie den Nachtisch mit (Entscheidung von David 21.11.2026), nur Brotzeit setzt sie zurück. **Einstellung** `profiles.sides_mode` (0036, `PUT /profile/sides-mode`, `SidesSettings`; NULL = aus): `suggestSides` in `src/lib/sidesSuggest.ts` (rein, auch im Worker genutzt) schlägt vor, wenn Nudeln/Reis/Kartoffeln/Brot o. Ä. fehlen (`COMPLETE_RE`), Salat nur ohne Gemüse (`VEG_RE`); Nudeln nie (Mengen-Regel). `suggest`: Karte zeigt „Dazu?“ (`DayCard.sideSuggestion`); `auto`: `createPlan` schreibt `sides` beim Einfügen (nicht bei Tauschen). **Rezeptseite:** `SidesView` (dritter Bereich in `RecipesView`), Ausblenden fester Einträge `profiles.hidden_sides` (0038, `PUT /profile/hidden-sides`, `ctx.hiddenSides` für `suggestSides`), Chefkoch-Suche = `ChefkochSearchModal` mit `mode` `beilage`/`salat` (keine Chefkoch-Kategorie-Kennung bekannt, darum Suchwort „Beilagen“/„Salat“ angehängt). **Hinzufügen überall gleich (21.11.2026, David: „Menüs sehr unterschiedlich“):** gestrichelter Knopf „… hinzufügen“ → `AddRecipeSheet` (Chefkoch, KI, Link; Nachtische ohne KI); bei Beilagen/Salaten öffnen KI und Link `SideAddSheet` (`initialWay`). Suchfelder heißen „X oder Zutat suchen“ und finden auch über Zutaten. Neue Bereiche gleich bauen. Eigene Beilagen lassen sich (noch) nicht bearbeiten, nur löschen und neu anlegen. Ein falsch einsortiertes Hauptgericht verschiebt man über „Gericht bearbeiten“ → Art „Beilage“/„Salat“ (`RecipeEditModal.onMoveToSide`, `POST /recipes/to-side` wie `to-dessert`; auch im Rezept-Fenster des Plans). **Eigene Beilagen:** Tabelle `custom_sides` (0037), `routes/sides.ts` (`GET/POST/DELETE /sides/custom`, `POST /sides/ai-preview`), KI in `aiSides.ts` (`generateSide`, nur Vorschau, über `env` = gezählte Umgebung, prüft Gesundheit/Abneigungen), Frontend `SideAddSheet` (Link über `previewRecipeImport`, auf 4 Portionen) im `SidePickerModal`. Eigene Beilagen kommen nicht in `suggestSides` (nur die feste Sammlung).
- Preisvergleich/Grundpreis: `lib/unitPrice.ts`. Portionen: `lib/portions.ts`.
- Eigene Rezept-Filter: `lib/recipeFilters.ts` – Regeln (Suchbegriffe/Zeit) plus Hand-Zuordnung (`includeNames`/`excludeNames`).
- Filter der Rezept-Übersicht: `RecipeFilterSheet` (ein Fenster), Gruppen-Logik `lib/recipeFacets.ts` (in der Gruppe oder, zwischen Gruppen und). Speiseart/Hauptzutat: `lib/recipeCategories.ts` (Heuristik) plus Korrekturen pro Gericht (`recipe_category_overrides`, `GET/POST /category-overrides`).
- Mengen-Regeln: `VarietyRulesSettings` (Einstellungen → Planung → „Wie oft darf es vorkommen?“, Muster wie `DayRulesSettings`, speichert jede Änderung sofort über `saveVarietyRules`); Kategorien/Standard in `lib/varietyCategories.ts`. **Regelarten (David 21.11.2026):** In der Auswahl der Karte stehen zwei Gruppen: „Art des Gerichts“ (`fleisch`, `vegetarisch`, `group: 'art'` in `VARIETY_CATEGORIES`) und „Kategorie“ (wie bisher, am Namen erkannt). So geht auch „höchstens 1× vegetarisch“. Nachtisch/Salat/Beilage sind keine Regelarten (Zusätze zum Gericht, `plan_meals.dessert`/`sides`, keine eigenen Gerichte). Die frühere Fleisch-Grenze (`profiles.meat_max_per_week`) und Vegetarisch-Mindestzahl (`veg_min_per_week`, Standard 3) sind seit Migration 0043 Regeln in `variety_rules` (Spalten bleiben, werden nicht mehr gelesen; Standard enthält „Vegetarisch mindestens 3× pro Woche“). Die Daten sind flach (eine Regel je Kategorie und Zeitraum), die Oberfläche zeigt aber **eine Karte pro Kategorie** mit je einer Zeile „pro Woche“/„pro Monat“ (`groupVarietyRules`; zwei getrennte Karten für dieselbe Kategorie wirkten wie doppelte Regeln, 21.11.2026).
- Plan-Fenster: `PlanCreationModal` bietet bei laufendem Plan die Wahl „Zum bestehenden Plan hinzufügen“ (`extendMealPlan`, Standard) oder „Ab heute weiterplanen“ (`extendMealPlan(…, trimPast)`: wie Hinzufügen, nimmt aber Tage vor heute aus dem Plan; sie wandern in einen Plan mit `status = 'archived'` – nie löschen, sonst fehlt der Verlauf für Pause/Mengen-Regeln; `archivePastDays` in `planning.ts`; `latestPlan`, Bild-Nachzug und Push lesen nur `active`) oder „Alles neu planen“ (`createMealPlan`); die frühere Rückfrage danach gibt es nur noch bei „Alle tauschen“ (`ReplacePlanDialog`).
- Administration: `AdminSettings` (Familien) und `AdminStats` (Statistik), nur für `isOwner`.
- Anmeldung: `LoginScreen` (Anmelden bzw. ersten Zugang anlegen), `AccountSettings` (Einstellungen → Zugänge). Ohne Sitzung zeigt `App` die Anmeldung.
- `localStorage` nur für Komfort (auf-/zugeklappt, gewählte Einkaufswochen; altes Familien-Passwort nur bis zum ersten Zugang), immer in `try/catch`. **Entscheidungen der Familie gehören in die Datenbank, nicht in den `localStorage`:** Der Merker „Fertig“ im Hinweis zu unpassenden Gerichten lag dort und kam auf einem anderen Gerät/Browser immer wieder (26.10.2026, David; war pro Browser gespeichert). Jetzt `profiles.seen_unsuitable` (0031), kommt als `seenUnsuitable` mit `recipeCatalog`, Speichern über `POST /recipes/unsuitable-seen` (`saveSeenUnsuitable`). Welche unpassenden Gerichte in der Liste sichtbar sind (`mp_revealed_unsuitable`), bleibt bewusst pro Browser. **Entscheidung von David (26.10.2026):** Nach „Fertig“ soll unter der Suche nichts mehr stehen – der Link „N unpassende eingeblendet – verwalten“ erscheint nur, solange unpassende Gerichte eingeblendet sind (`revealedCount > 0`), nicht dauerhaft.

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
Interaktions-Audit Erststart neue Familie (abgeschlossen 24.10.2026, alle Befunde bearbeitet): `docs/interaction-audit-erststart-2026-10-24.md`.

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
- **Neon-Rechenzeit (Free: 100 CU-Stunden/Monat, Suspend nach 5 Min. Ruhe, fest):** Jede Datenbankabfrage weckt den Compute. Ein Uptime-Ping mit `SELECT 1` alle 5 Min. hielt ihn rund um die Uhr wach (Nov. 2026: 93,8 CU-h nach 16 Tagen). Darum prüft `/api/health` nur den Worker, und der Cron läuft stündlich (`0 * * * *`). Keine neuen Pings, Polling-Schleifen oder häufigeren Crons einbauen, die die Datenbank berühren. Bei Verdacht: Neon Console → Billing → Usage (CU-hrs); bei Dauerbetrieb steigt der Wert um etwa 6 pro Tag.
- **Betrieb/Wiederherstellung:** Neon Free hält nur 6 Std. Verlauf, darum die wöchentliche R2-Sicherung (`backup.ts`; Bucket `miyummy-backups` und Binding `BACKUPS` in `wrangler.jsonc` sind eingerichtet, siehe `SETUP_NEON_CLOUDFLARE.md` 3b; fehlt der Bucket, schlägt der Deploy fehl). Free-Limits des Workers: 50 Unteranfragen je Cron-Lauf (jede Datenbankabfrage zählt, im Cron deshalb Abfragen bündeln und je Lauf nur eine Familie sichern bzw. Chefkoch-Rezepte holen; ist das Budget leer, scheitert jede weitere Abfrage, auch `logError` – im Cloudflare-Log dann „Fehler nicht protokolliert“), 100.000 Anfragen/Tag. Stand und offene Punkte stehen in `docs/prod-readiness-audit-2026-10-24.md`. Migrationen nur additiv halten, damit ein Rollback der Worker-Version ohne Datenverlust geht.
- **„Prisenn“/„Scheibenn“ (Fehlerursache 20.11.2026):** Der Import rechnete Chefkoch-Zutaten um (`scaleIngredient`, `fixUnitNumber`) und machte aus „Prise(n)“ erst „Prisen(n)“; `fixPlural` hängte dann ein zweites „n“ an. Die Zutat hing wegen „Prisenn Paprikapulver“ als Artikel auf der Einkaufsliste, statt im Vorrat zu verschwinden. Jetzt lässt `fixUnitNumber` „Prise(n)“/„Dose/n“ stehen (nur `fixPlural` löst sie auf); Migration 0034 hat die gespeicherten Zutaten repariert (`recipes`, `plan_meals`, `favorites`, `custom_desserts`). Neue Mehrzahl-Schreibweisen beim Import immer mit „(n)“-Beispiel testen (`recipeImport.test.ts`).
- **Fleisch-Erkennung (Fehlerursache 21.11.2026: „Knusperente“ stand als vegetarisch):** `MEAT_RE` in `meals.ts` entscheidet beim Import/bei der Chefkoch-Automatik über „vegetarisch“ vs. „fleisch“ (`guessType`) und beim Gesundheitsfilter „vegetarisch“; `MEAT_ONLY_RE` in `nutrition.ts` für die Fleisch-Grenze pro Woche. „Enten“ (Mehrzahl) fehlte. Neue Fleischsorten in **beiden** Mustern ergänzen und mit Beispiel in `meals.test.ts` testen; Migration 0041 hat gespeicherte Rezepte korrigiert. Vorsicht vor Fehltreffern (Hirschhornsalz, Wildreis, Wildkräuter).
- **Amazon** wurde bewusst entfernt (keine Suche/Warenkorb aus Apps möglich) – nicht wieder einbauen.
- **Gesundheitsfilter** (`violatesHealthConditions`) sind Heuristiken auf Zutatentext, keine Allergie-Garantie. KI-Rezepte
  werden immer nachgeprüft, die KI hält sich nicht zuverlässig an Vorgaben.
- **Abwechslung:** `isSimilarDish` verhindert Varianten desselben Gerichts im Plan.
  **Planung 21.11.2026 überarbeitet (David: „immer die gleichen Rezepte, ich generiere immer neue, weil ich sie nicht will“):** (1) **Ursache:** Beim Tauschen wurde das Gericht aus `plan_meals` gelöscht, bei „Alle tauschen“/„Alles neu planen“ der ganze Plan; der Verlauf (`loadPlanHistory`) kannte sie danach nicht mehr, dieselben Spitzenreiter kamen im nächsten Plan wieder. Jetzt merkt `meal_skips` (0042, je Familie und Gericht: `times`, `last_skipped`) weggetauschte und mit einem Plan verworfene (noch nicht gekochte) Gerichte (`recordSkips`/`recordDiscardedMeals` in `planning.ts`; aus `replaceMeal`, `POST /plans`, `/plans/:id/regenerate`, `DELETE /plans/:id`), Pause `skipPauseDays`. Ausgeblendetes bleibt in `rejected_meals`. (2) **Sorten:** `ctx.recentKinds` (Plan der letzten 3 Wochen + weggetauschte) gibt in `pickMeal`/`pickReplacement` einen Abzug für gleiche Kennwörter (Kohlrouladen, Rotkohl …). (3) **Kein Wochenrhythmus nach Art mehr** (Mo/Mi/Fr vegetarisch usw. war starr und mischte Inhalt und Aufwand): Mo–Fr schnell, Sa/So aufwendig nach Zubereitungszeit (`slotRules.ts`, nur eine Vorliebe, kein Zwang); vegetarisch/Fleisch über Wochenmengen: Fleisch-Grenze und Vegetarisch-Mindestzahl als Mengen-Regeln der Arten `fleisch`/`vegetarisch` (seit 0043, vorher `meat_max_per_week`/`veg_min_per_week` mit eigenen Karten) in `pickDays`/`replaceMeal` (`isVegetarianDish`: Art vegetarisch, bei Wochenende/sonstigen nach Zutaten; `minimumSlots` verteilt die Mindest-Tage gleichmäßig, bei „Neu“ sorgt `vegMissing` für den Wochen-Mindestwert). `preferredTypeFor` dient nur noch als Typ-Hinweis für KI-Rezepte. Die Art „Wochenende“ muss man nicht mehr setzen (nur ohne Zeitangabe); der Filter „Aufwendig (ab 46 Min.)“ in der Rezept-Übersicht richtet sich nach der Zeit. Nicht wieder auf Art pro Wochentag umstellen.
  **Pause nach Bewertung (Entscheidung von David 1.11.2026, löst die feste 5-Wochen-Sperre vom 26.10. ab; Längen am 21.11.2026 angehoben):** `repeatPause.ts`: unbewertet 70 Tage
  (`RECENT_DAYS`), 5 ★ 11 Wochen, 4 ★ 12, 3 ★ 13, 1–2 ★ ein Jahr (= nie, nur wenn sonst nichts übrig ist). Grundlage ist `loadPlanHistory`
  (`planning.ts`: geplante Gerichte des letzten Jahres vor dem Planstart, ohne Ausgeblendete und Brotzeit); `ctx.recentNames` = Gerichte mit
  Restpause. `pickMeal`/`pickReplacement` nehmen sie nur, wenn nichts anderes übrig ist (`withoutRecent`, lieber eine Wiederholung als ein
  leerer Tag); `aiTypesNeeded` zählt sie als nicht frisch, so liefert die KI bei knapper Sammlung neue Rezepte.
  **Fehlerursache 1.11.2026 („bewertete Rezepte kommen fast wöchentlich, ich muss viel neu laden“):** `scoreMeal` rechnete `Sterne × 10` –
  selbst 1 ★ bekam +10 (über unbewertet), 5 ★ +50, Favorit +20, bei nur ±15 Zufall; die Spitzengruppe war immer vorn und kehrte nach der Pause
  sofort zurück. Jetzt `(Sterne − 3) × 12` (1 ★ −24 … 5 ★ +24), Favorit +10, Zufall `RANDOM_SPREAD` = 25. Nicht wieder auf `Sterne × Faktor` umstellen.
  **Saison gibt es nicht mehr (Entscheidung von David 21.11.2026, „so viel Lauch seit Wochen“):** kein Bonus beim Planen, keine Zeile „Saison: …“ an den Karten, keine
  Sortierung danach, kein Schwerpunkt „Saisonal“ (Migration 0039 entfernt ihn aus den Familien). Nicht wieder einbauen.
  **Mengen-Regeln (Entscheidung von David 1.11.2026: einstellbar, mit Minimum und Monat):** `profiles.variety_rules` (jsonb, Migration 0033;
  NULL = Standard `DEFAULT_VARIETY_RULES`: Meeresfrüchte höchstens 1×, Nudeln und Asiatisch (Thai, Chinesisch, Wok, Stir-Fry … am Namen erkannt, `ASIATISCH`; Indisches nicht, Entscheidung von David 21.11.2026: zu oft Asia) je höchstens 2× pro Woche, Asiatisch zusätzlich höchstens 5× pro Monat; Pizza, Burger/Wraps und Curry je höchstens 1× pro Woche; Kategorien `mexikanisch` und `bowlpfanne` ohne Standardregel), `PUT /profile/variety-rules`
  (`null` = Standard, `[]` = bewusst keine Regeln). Eine Regel = Kategorie (`VARIETY_CATEGORIES`, Treffer über den **Gerichtnamen**, nicht die
  Zutaten – Namen wie „Gambas“/„Garnelen“ oder „Penne“/„Lasagne“ teilen keine Wörter) + `max` und/oder `min` + Zeitraum Kalenderwoche oder
  Kalendermonat. Neue Kategorie = Eintrag in `src/lib/varietyCategories.ts`. Zähler = Verlauf (`ctx.planHistory`) + feste Tage des Plans
  (beim Verlängern nicht doppelt). `exceedsCap` gilt in `pickDays` und `replaceMeal` (Knopf „Neu“); ist sonst nichts übrig, gilt die Grenze
  nicht. `minimumSlots` verteilt fehlende Mindest-Gerichte gleichmäßig auf freie Tage (bei Teilplänen nur den Anteil des Zeitraums); `pickDays`
  nimmt dort ein frisches Gericht der Kategorie (nicht pausiert, nicht schon im Plan), gibt es keins, bleibt es bei der normalen Auswahl.
  **Zuordnung von Hand (Entscheidung von David 21.11.2026):** `recipe_variety_overrides` (0040, je Familie und Gerichtname, `included` true = zählt dazu, false = zählt nicht; geht vor der Namenserkennung), `GET/POST /variety-overrides` (`include`/`exclude`/`auto`), `ctx.varietyOverrides` aus `loadContext` bis in `categoriesOf`/`exceedsCap`/`matchesCategory`; Frontend `RecipeVarietyAssign` in der Rezept-Ansicht („Zählt für Mengen-Regeln“, getrennt von den Filter-Kategorien in `recipe_category_overrides`). Umbenennen zieht sie mit (`renameReferences`), Löschen entfernt sie. Neue Funktionen, die Kategorien zählen, immer `overrides` durchreichen.
  „Mindestens“ gilt nur beim Planen, nicht bei „Neu“. Favoriten mit Turnus (`turnus_weeks`) laufen davon getrennt. `replaceMeal` setzt das neue
  Gericht an den *aktuellen* Tag der Zeile (Auswahl dauert, Verlegen dazwischen führte sonst zu zwei Gerichten an einem Tag).
- `/api/images/*` ist absichtlich ohne Anmeldung (Bilder sind nicht privat); `?f=<profile_id>` liefert die Fassung einer Familie.
- Service Worker (`public/sw.js`): `/api` wird nie gecacht. Bei Änderungen an gecachten Dateien `CACHE`-Version hochzählen.
  Er empfängt auch die Push-Nachrichten (`push`, `notificationclick`).
- Push auf dem iPhone geht nur in der installierten PWA (Home-Bildschirm), ab iOS 16.4.
- Fenster (Modals) immer über `useDialog`: Escape und Scroll-Sperre zählen offene Fenster (`lib/dialogStack.ts`).
