# Status – miyummy

Stand: 20.11.2026 (letzter Merge: #192, 16.11.2026). Diese Datei ist der Kurzüberblick „Wo stehen wir?“.
Funktionen: `PROJEKTUEBERSICHT.md`. Arbeitsregeln und Technik: `CLAUDE.md`. Einrichtung: `SETUP_NEON_CLOUDFLARE.md`.

## Betrieb

- Live: https://miyummy.com/ (PWA), Deploy automatisch bei jedem Push auf `main` (Cloudflare Workers Builds).
- Stack: React/Vite + Cloudflare Worker + Neon Postgres (Free), KI über Workers AI, wöchentliche Sicherung in R2.
- Bewusst nur kostenlose Tarife (Cloudflare, Neon, R2 im Gratis-Rahmen).

## Zuletzt erledigt

- **Planung (Nov.):** Bewertung zentriert, Pause nach Sternen, einstellbare Mengen-Regeln, Saison höchstens +3, Gerichte der letzten 5 Wochen kommen nicht wieder (#188–#190).
- **Betrieb (16.11.):** Neon-Rechenzeit gespart (Health ohne DB-Abfrage, Cron stündlich), Chefkoch-Uhrzeit nur volle Stunden (#191, #192).
- **Chefkoch-Automatik (26.10.):** tiefer suchen, wenig bewertete Rezepte nach 3 Tagen erneut prüfen, Handstart nennt Ablehnungsgründe (#184, #185).
- **Einkaufsliste/Nachtische (26.10.):** Gerichtszeile unter jedem Artikel, Link-Import auch als Nachtisch (#180, #187).
- **UX-Discovery:** Familien-Nein, Ausblenden mit Muster-Vorschlag, Kennzahlen in Admin → Statistik umgesetzt; „Warum dieses Gericht?“ bewusst wieder entfernt.

## Offen

| Thema | Stand |
|---|---|
| Wirkung des Familien-Nein auf einen neuen Plan | live noch nicht belegt (letzter geprüfter Plan vor #123) |
| Free-Limits des Workers | im Cloudflare-Dashboard zu bestätigen (`SETUP_NEON_CLOUDFLARE.md` 3b) |
| Chefkoch-Foto bei Nachtischen | Server scheitert (403), Browser-Weg kennt nur Rezepte; Cron erzeugt KI-Bild |
| Routinen | nur anlegen/löschen, nicht bearbeiten |
| Tests | nur Kernlogik, keine Oberfläche/Datenbank/Shop-Anbindung |

## Bekannte Grenzen

- Knuspr/Picnic: inoffizielle Schnittstellen, können ausfallen.
- Workers-AI-Kontingent (Free) teilen sich KI-Rezepte und Bilder.
- Gesundheitsfilter = Heuristik, keine Allergie-Absicherung.
- Kein Screenreader-Test (Entscheidung von David, nicht wieder vorschlagen).

## Entscheidungen (Auszug)

- Familien-Nein schließt immer aus, „Mag nicht“ einzelner Mitglieder nur bei Mehrheit.
- Meeresfrüchte bleiben im Plan (nein sind nur Fisch und Lamm).
- Keine Vorrats-basierte Planung.
