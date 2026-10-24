# Production-Readiness-Audit miyummy – 24.10.2026

**Perspektive:** Betrieb (wer wird nachts angerufen, wenn es hakt).
**Anlass:** Weitere Familien einladen. Stand heute: 3 Familien, 4 Zugänge, 5 Pläne (live gelesen über `/api/admin/stats`).
**Stand:** `main` bei `44135c5` (PR #142). Code gelesen, Live-Daten nur lesend (Fehlerliste, Statistik). Nichts geändert.
**Nicht prüfbar von hier:** Cloudflare-Konto (Tarif, Metriken, Regeln) und Neon-Konsole (Größe, Tarif). Aussagen dazu sind als „zu bestätigen“ markiert.

## Was ausgeliefert wird und was brechen kann

Ein Worker (`/api/*` + statische App), Neon Postgres über HTTP, Workers AI, Cron alle 15 Minuten. Jeder Push auf `main` deployt; die Migrationen laufen beim ersten Aufruf. Es gibt keine Testumgebung: Produktion ist die einzige Umgebung.

## Verdict: MIT ÄNDERUNGEN FREIGEGEBEN

Für ein paar weitere Familien tragfähig. Vor einer größeren Einladungsrunde sollten die zwei „Vorher beheben“-Punkte und die Sicherung geklärt sein.

## Vorher beheben

| # | Befund | Stelle | Ausfall-/Missbrauchsfall | Behebung |
|---|---|---|---|---|
| 1 | **Fail-open, wenn die Datenbank keine Zugänge hat.** Solange `users` leer ist, gilt das alte Familien-Passwort, und ist `APP_PASSWORD` nicht gesetzt, ist die API ohne Anmeldung offen (`getProfile` legt dann sogar eine Familie an). `POST /auth/setup` macht ohne `APP_PASSWORD` jede Person zum Betreiber. Die Übergangszeit ist vorbei, alle Familien haben Zugänge. | `worker/api.ts:70`, `worker/routes/auth.ts:35–44`, `worker/repo.ts:84–94` | Neue/leere Neon-Datenbank (Wiederherstellung, falsche `DATABASE_URL`, gelöschtes Projekt): erste Person, die die Adresse aufruft, wird Betreiber bzw. liest/schreibt offen. | Altpfad `X-App-Password` entfernen (ohne Sitzung immer 401). `/auth/setup` nur mit gesetztem `APP_PASSWORD` (sonst 503). Test dazu. |
| 2 | **Wiederherstellung von Datenverlust ist dünn.** Die Sicherung ist nur manuell, pro Familie, ohne Zugänge. Neon Free hält nur **6 Stunden** Verlauf ([Neon-Tarife](https://neon.com/docs/introduction/plans)). Bemerkt man einen Fehler (z. B. falsch gelöschte Rezepte) später, ist nichts mehr da. | `worker/adminTools.ts` (`exportFamily`), Neon-Konsole | Versehentliches `deleteMainDish`, Fehler in einer Migration oder Löschen einer Familie in der Administration: Daten dauerhaft weg. | Entscheidung David: (a) wöchentlicher Cron legt je Familie eine Sicherung in einem Cloudflare-R2-Bucket ab (Binding nötig), oder (b) Neon-Tarif mit längerem Verlauf, oder (c) bewusst nur manuell, dann monatlich exportieren und Erinnerung setzen. |

## Empfehlungen

| # | Befund | Warum | Behebung |
|---|---|---|---|
| 3 | **Routine ohne Wiederholung.** Der Lauf wird vor dem Planen als erledigt markiert (richtig gegen Doppelpläne); scheitert `createPlan`, gibt es erst zur nächsten Woche/zum nächsten Monat wieder einen Versuch. Der Fehler steht nur in `app_errors`. | Eine Familie wartet auf den Wochenplan, und niemand merkt es. | Bei Fehler `last_run_at` zurücksetzen, höchstens 3 Versuche pro Tag (neue Spalte, Migration), danach Push an den Betreiber. |
| 4 | **Workers-Limits des Free-Tarifs (zu bestätigen):** 50 Unteranfragen und 10 ms CPU je Cron-Aufruf, 100.000 Anfragen/Tag je Konto ([Cloudflare](https://developers.cloudflare.com/workers/platform/limits)). `runRoutines` bearbeitet alle Familien in einem Aufruf; jede Datenbankabfrage zählt als Unteranfrage. Mit `run_worker_first: true` zählt auch jede Datei der App als Anfrage. | Mit mehr Familien bricht der Cron mitten drin ab („Too many subrequests“): später Schritte (Erinnerung, Bilder) fallen aus. Über 100.000 Anfragen/Tag antwortet die ganze Seite mit Fehler 1027. | Tarif und Metriken im Cloudflare-Dashboard prüfen. Bei Free: Familien je Lauf begrenzen/reihum bearbeiten und `run_worker_first` auf `["/api/*"]` einschränken (www-Umleitung dann als Cloudflare-Regel). Bei Paid: nichts nötig. |
| 5 | **Anmeldung ohne Drosselung je Adresse.** Die Sperre gilt je Konto (8 Fehlversuche, 15 min): wer eine E-Mail kennt, kann dieses Konto sperren; jeder Versuch rechnet PBKDF2. | Störung mit Absicht möglich, CPU-Last. | Cloudflare-Regel „Rate limiting“ für `POST /api/auth/login` (Dashboard, kein Code). |
| 6 | **Interne Fehlertexte nach außen.** Der Sammel-Handler schickt `err.message` bei 500 an den Browser (Datenbank-/Bibliothekstexte, Tabellen- und Spaltennamen). | Informationsabfluss, und für Familien unverständlich. | Eigene `UserError` für gewollte deutsche Meldungen (z. B. „Das ist keine gültige Sicherung.“); alles andere: „Der Server hat gerade ein Problem. Bitte gleich noch einmal versuchen.“ und Detail nur in `app_errors`. |
| 7 | **Fehlerliste zugerauscht, kein Alarm.** 12 von 15 Einträgen sind Chefkoch-Foto-403 (bekanntes Problem), echte Fehler gehen darin unter. Es gibt keinen Push bei neuen Server-Fehlern oder fehlgeschlagenen Routinen (nur beim KI-Kontingent). | Ein Ausfall fällt erst auf, wenn eine Familie schreibt. | Foto-Fehler erst nach dem letzten Versuch und höchstens einmal je Tag/Rezept eintragen; Push an den Betreiber bei Routinen-/5xx-Fehlern (Muster `checkAiWarning`, einmal pro Tag). |
| 8 | **Kein Speicher-Monitoring.** Bilder liegen als `bytea` in Neon (Free: 1 GB je Projekt, [Neon](https://neon.com/docs/introduction/plans)). Nirgends wird die Datenbankgröße gelesen. | Läuft das Projekt voll, scheitern alle Schreibzugriffe gleichzeitig. | `pg_database_size` in Administration → Statistik und Warnung ab 80 % (wie beim KI-Kontingent). |
| 9 | **Einladung geht bei Fehler verloren.** Der Link wird verbraucht, bevor der Zugang angelegt ist; scheitert das `INSERT`, ist der Link tot. | Neue Familie kommt nicht rein, Betreiber muss neu einladen. | `used_at` bei Fehler zurücksetzen (oder beides in einer Transaktion). |
| 10 | **`Origin: null` wirft.** `new URL(origin)` in `api.ts:51` liegt außerhalb des `try`: ein Browser mit Herkunft „null“ löst eine unbehandelte Ausnahme aus. | Cloudflare-Fehlerseite statt JSON. | In `try/catch` fassen → 403. |

## Kleinigkeiten

| # | Vorschlag | Begründung |
|---|---|---|
| 11 | `/api/health` (nur `SELECT 1`) und einen kostenlosen Uptime-Monitor darauf. | Heute meldet nichts, wenn die Seite oder Neon nicht antwortet. |
| 12 | Abgelaufene Sitzungen, benutzte Einladungen und alte `ai_usage`-Zeilen gelegentlich löschen (Muster wie bei `app_errors`). | Tabellen wachsen unbegrenzt, langsam. |
| 13 | In `CLAUDE.md` festhalten: Migrationen nur additiv (keine `DROP`/`RENAME` in einem Schritt mit dem Code). Rollback ist dann ein Zurücksetzen der Worker-Version in Cloudflare. | Der heutige Aufbau trägt das schon (alte Worker ignorieren neue Spalten); es steht nur nirgends. |
| 14 | `serveImage` ohne Base64-Umweg (Bytes direkt lesen). | Weniger CPU je Bild bei 10-ms-Grenze; durch Browser-Cache (1 Jahr) heute unkritisch. |

## Ausfall-Szenarien

| Szenario | Was passiert | Wirkung für Familien | Erholung | Abgedeckt? |
|---|---|---|---|---|
| Neon antwortet nicht / schläft (Free: Pause nach 5 min) | erster Aufruf wartet kurz; GET bricht nach 25 s ab | langsamer Start, dann Meldung „Der Server antwortet gerade nicht …“ (seit #142) | von selbst | Ja |
| Netz weg beim Nutzer | `fetch` schlägt fehl | „Keine Verbindung zum Server …“ (seit #142); App-Hülle aus dem Cache | nach Rückkehr des Netzes | Ja |
| Deploy mit neuer Migration, zwei Worker gleichzeitig | Migration kann doppelt laufen | keine (idempotent, je eine Transaktion) | – | Ja |
| Deploy mit Fehler | Worker liefert Fehler | App unbenutzbar bis Rollback | Version in Cloudflare zurücksetzen, Migrationen sind additiv | Teilweise (kein Test-/Vorschau-Ablauf, siehe #13) |
| Zwei Cron-Läufe überlappen | `UPDATE … RETURNING` als Schloss | kein Doppelplan | – | Ja |
| Routine schlägt fehl (KI, Datenbank, Limit) | Lauf gilt als erledigt, nur Protokolleintrag | kein Wochenplan | nächste Woche / von Hand | **Nein** (#3) |
| Workers-AI-Kontingent leer | Bilder aus Fotodatenbanken, Rezepte aus Sammlung, Warnung ab 80 % | kaum sichtbar | Mitternacht UTC | Ja |
| Chefkoch/Foto-CDN weist ab (403/520) | Rezept ohne Foto, Eintrag in `app_errors` | Rezepte ohne Bild | später erneut (bis 5×) | Ja, aber laut (#7) |
| Datenbank ohne Zugänge (neue/geleerte DB) | Altpfad bzw. offenes Setup | offener Zugriff, fremder Betreiber | – | **Nein** (#1) |
| Daten versehentlich gelöscht | Neon-Verlauf nur 6 h | Verlust | nur manuelle Sicherung | **Nein** (#2) |
| Neon-Speicher voll | Schreibzugriffe schlagen fehl | alles „Server hat ein Problem“ | aufräumen / Tarif | **Nein** (#8) |
| Cron-Aufruf überschreitet 50 Unteranfragen (Free, viele Familien) | spätere Schritte fehlen | Erinnerungen, Bilder bleiben aus | – | **Nein** (#4) |

## Umgebung: Entwicklung und Produktion

| Thema | Entwicklung | Produktion | Lücke? |
|---|---|---|---|
| Datenbank | `.dev.vars` mit eigener `DATABASE_URL` | Secret in Cloudflare | Nein; aber nur eine Produktions-DB, kein Staging |
| Adressen | localhost | miyummy.com + workers.dev | Nein; Cookie `Secure`, Origin-Prüfung gleicher Host |
| Secrets | `.dev.vars` | Cloudflare Secrets, nicht in `wrangler.jsonc` | Nein (dokumentiert) |
| Build | `vite build` prüft keine Typen | CI (Typen, Lint, Tests, Build) vor Merge | Nein |
| Cron | nicht lokal | alle 15 min | Nur in Produktion prüfbar; Fehler landen in `app_errors` |
| Limits | keine | Free-Tarif (zu bestätigen) | Ja, siehe #4 |

## Urteil nach Bereich

- **Durchgängiger Ablauf:** in Ordnung
- **Fehlerbehandlung:** Bedenken (#3, #6, #9, #10)
- **Datenintegrität:** Bedenken (#2, #9); Import in einer Transaktion, Migrationen idempotent: gut
- **Umgebungs-Parität:** in Ordnung, Limits zu bestätigen (#4)
- **Beobachtbarkeit:** Bedenken (#7, #8, #11)
- **Sicherheit (Nebenbefund):** Bedenken (#1, #5, #6); Sitzungen als Hash, PBKDF2, Cookie-Flags, Familien-Trennung: gut
