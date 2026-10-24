# Setup: Neon + Cloudflare Workers

## 1. Datenbank (Neon) – einmalig
Die Tabellen legt der Worker beim ersten Aufruf selbst an (Migrationen in `worker/migrations/`).
Optional danach in Neon Console → Projekt „Meal Plan" → **SQL Editor**:
`neon/import_backup.sql` einfügen → **Run** (Profil + „Papa" aus dem Supabase-Backup)

## 2. Cloudflare Worker anlegen
Workers & Pages → Create → Import a repository → `davidhille/meal-plan`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler versions upload`
- API token: neuen Token anlegen („meal-plan build token")

## 2b. Eigene Domain
Zone `miyummy.com` liegt im selben Cloudflare-Konto (Nameserver bei Domainfactory auf Cloudflare umgestellt; E-Mail-Einträge
bleiben „DNS only“). Die Custom Domains `miyummy.com` und `www.miyummy.com` stehen in `wrangler.jsonc` (`routes`) und
werden beim Deploy angelegt – vorher dürfen für diese Namen keine eigenen A/AAAA/CNAME-Einträge existieren.

## 3. Secrets (nach dem ersten Deploy)
Worker `meal-plan` → **Settings → Variables and Secrets** → *Add* → Typ **Secret**:
- `DATABASE_URL` = Neon Connection String (Connect → Branch `production`)
- `APP_PASSWORD` = Familien-Passwort (nur, um den ersten Zugang anzulegen; danach meldet sich jede Person mit E-Mail und Passwort an). **Pflicht für die Ersteinrichtung:** ohne dieses Secret ist die Einrichtung gesperrt (auch auf einer neuen, leeren Datenbank)
- `CREDENTIALS_KEY` = beliebige lange Zufallszeichenfolge (verschlüsselt Knuspr-/Picnic-Zugangsdaten; ohne diesen Schlüssel wird ersatzweise der Datenbank-Zugang verwendet)

- Ersatzfotos, wenn das Tageskontingent der Bild-KI aufgebraucht ist (alle optional – ohne Schlüssel wird Openverse genutzt):
  - `PIXABAY_API_KEY` = kostenloser Schlüssel von https://pixabay.com/api/docs/ (nach dem Login oben auf der Seite)
  - `PEXELS_API_KEY` = Schlüssel von https://www.pexels.com/api/ (Vergabe zeitweise pausiert)

Secrets wirken sofort, kein neuer Deploy nötig.

## 3b. Betrieb: Sicherung und Login-Schutz (Dashboard, einmalig)

**Wöchentliche Sicherung (R2):** Cloudflare → **R2 Object Storage** → *Create bucket* → Name `miyummy-backups` (Standort automatisch).
Der Block `r2_buckets` (Binding `BACKUPS`) steht aktiv in `wrangler.jsonc`; ohne den Bucket schlägt der Deploy fehl. Der Cron sichert
danach je Lauf eine Familie, wöchentlich, und behält die letzten 8 Dateien (`<Familien-ID>/<Datum>.json`). Ohne Bucket passiert nichts.
Zurückspielen: Datei aus dem Bucket laden → Administration → Familie → *Wiederherstellen*. Bilddaten sind nicht enthalten, Zugänge auch nicht.

**Login-Schutz:** Cloudflare → Domain `miyummy.com` → **Security → WAF → Rate limiting rules** → *Create rule*: Feld *URI Path* *equals*
`/api/auth/login`, Methode `POST`; 10 Anfragen je 1 Minute je IP; Aktion *Block* für 10 Minuten. (Der Free-Plan erlaubt eine Regel.)

**Uptime-Monitor:** kostenloser Dienst (z. B. UptimeRobot) auf `https://miyummy.com/api/health` (erwartet `200` und `{"ok":true}`).

**Tarif prüfen:** Cloudflare → *Workers & Pages* → `meal-plan` → *Metrics*: Anfragen/Tag (Free: 100.000) und Fehler „Too many subrequests“.
Neon → *Billing*: Tarif und Verlauf (Free: 6 Stunden, 1 GB Speicher).

## Lokal testen (optional)
`.dev.vars.example` → `.dev.vars` kopieren, Werte eintragen, dann `npm install && npm run dev:worker`.

## Architektur
Browser → Worker (`worker/index.ts`): `/api/*` → `worker/api.ts` → Neon, alles andere → statische App (`dist/`).
Der Connection String liegt nur im Worker, nie im Frontend.
