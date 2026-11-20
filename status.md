# Status – miyummy

Stand: 20.11.2026 (letzter Merge: #197, 20.11.2026). Diese Datei ist der Kurzüberblick „Wo stehen wir?“.
Funktionen: `PROJEKTUEBERSICHT.md`. Arbeitsregeln und Technik: `CLAUDE.md`. Einrichtung: `SETUP_NEON_CLOUDFLARE.md`.

## Betrieb

- Live: https://miyummy.com/ (PWA), Deploy automatisch bei jedem Push auf `main` (Cloudflare Workers Builds).
- Stack: React/Vite + Cloudflare Worker + Neon Postgres (Free), KI über Workers AI, wöchentliche Sicherung in R2.
- Bewusst nur kostenlose Tarife (Cloudflare, Neon, R2 im Gratis-Rahmen).

## Zuletzt erledigt

- **Fehler „Prisenn/Scheibenn“ (20.11.):** Import machte aus „Prise(n)“ ein doppeltes „n“, die Zutat blieb deshalb auf der Einkaufsliste statt im Vorrat; Ursache behoben, 27 gespeicherte Rezepte per Migration 0034 repariert; „Salz und Pfeffer“ zählt jetzt als Vorrat, Prisen stehen in der Mehrzahl.
- **Einkaufsliste „Einkauf für“ (20.11.):** frühere Wochen sind ausgeblendet, Link „Frühere Wochen anzeigen“ holt sie zurück.
- **Einkaufsliste → Vorrat (20.11.):** „Haben wir immer da“ öffnet ein Fenster mit änderbarem Namen (vorbelegt ohne Füllwörter).
- **Einschränkung „Cholesterin“ (20.11.):** wählbar unter Krankheiten & Einschränkungen; schließt nichts aus, gibt −15 bei viel Butter, Sahne, Speck, Wurst, Innereien, Eigelb (wie Diabetes bei Zucker); KI-Rezepte bekommen die Vorgabe „wenig gesättigte Fette“.
- **Planung (Nov.):** Bewertung zentriert, Pause nach Sternen, einstellbare Mengen-Regeln, Saison höchstens +3 (#188–#190).
- **Chefkoch-Automatik (26.10.):** tiefer suchen, wenig bewertete Rezepte nach 3 Tagen erneut prüfen, Handstart nennt Ablehnungsgründe (#184, #185).
- **Einkaufsliste/Nachtische (26.10.):** Gerichtszeile unter jedem Artikel, Link-Import auch als Nachtisch (#180, #187).

## Offen

| Thema | Stand |
|---|---|
| Wirkung des Familien-Nein auf einen neuen Plan | live noch nicht belegt (letzter geprüfter Plan vor #123) |
| Free-Limits des Workers | im Cloudflare-Dashboard zu bestätigen (`SETUP_NEON_CLOUDFLARE.md` 3b) |
| Chefkoch-Foto bei Nachtischen | Server scheitert (403), Browser-Weg kennt nur Rezepte; Cron erzeugt KI-Bild |
| Routinen | nur anlegen/löschen, nicht bearbeiten |
| Beilagen & Salate | Idee besprochen (Mechanik wie Nachtisch, feste Sammlung + Chefkoch + KI auf Knopfdruck); Entscheidung steht aus |
| Tests | nur Kernlogik, keine Oberfläche/Datenbank/Shop-Anbindung |

## Bekannte Grenzen

- Knuspr/Picnic: inoffizielle Schnittstellen, können ausfallen.
- Workers-AI-Kontingent (Free) teilen sich KI-Rezepte und Bilder.
- Gesundheitsfilter = Heuristik, keine Allergie-Absicherung.
- Kein Screenreader-Test (Entscheidung von David, nicht wieder vorschlagen).

## Entscheidungen (Auszug)

- Cholesterin ist wie Diabetes nur ein Abzug, kein harter Ausschluss (Heuristik auf Zutatentext; Käse und Eier zählen bewusst nicht mit).
- Familien-Nein schließt immer aus, „Mag nicht“ einzelner Mitglieder nur bei Mehrheit.
- Meeresfrüchte bleiben im Plan (nein sind nur Fisch und Lamm).
- Keine Vorrats-basierte Planung.
