# Status – miyummy

Stand: 21.11.2026 (letzter Merge: #201, 21.11.2026). Diese Datei ist der Kurzüberblick „Wo stehen wir?“.
Funktionen: `PROJEKTUEBERSICHT.md`. Arbeitsregeln und Technik: `CLAUDE.md`. Einrichtung: `SETUP_NEON_CLOUDFLARE.md`.

## Betrieb

- Live: https://miyummy.com/ (PWA), Deploy automatisch bei jedem Push auf `main` (Cloudflare Workers Builds).
- Stack: React/Vite + Cloudflare Worker + Neon Postgres (Free), KI über Workers AI, wöchentliche Sicherung in R2.
- Bewusst nur kostenlose Tarife (Cloudflare, Neon, R2 im Gratis-Rahmen).

## Zuletzt erledigt

- **Asiatisch begrenzt (21.11.):** neue Mengen-Regel-Kategorie „Asiatische Gerichte“ (am Gerichtnamen erkannt), Standard höchstens 2× pro Woche und 5× pro Monat; änderbar in Einstellungen → Planung → „Wie oft darf es vorkommen?“. Noch nicht live getestet.
- **Saison entfernt (21.11.):** kein Saison-Bonus beim Planen, keine „Saison: …“-Zeile an den Karten, keine Saison in der Sortierung „Empfohlen“, Schwerpunkt „Saisonal“ weg (Migration 0039). Grund: zu oft Lauch. Noch nicht live getestet.
- **„Ab heute weiterplanen“ (21.11.):** Plan-Fenster bei laufendem Plan: dritte Wahl neben „Hinzufügen“ und „Alles neu planen“. Heute und kommende Tage bleiben, Vergangenes wird aus dem Plan genommen (wandert in einen archivierten Plan, damit Pause nach Bewertung und Mengen-Regeln den Verlauf behalten), freie Tage bekommen ein Gericht. Noch nicht live getestet.
- **Beilagen auf der Rezeptseite (21.11.):** dritter Bereich „Beilagen“ (Beilagen/Salate): ansehen, feste ausblenden (`profiles.hidden_sides`, Migration 0038; ausgeblendete kommen nicht als Vorschlag/Auswahl), eigene löschen, bei Chefkoch suchen (getrennt für Beilage und Salat) oder per Link/KI hinzufügen. Live getestet 21.11. (API: setzen, Einkaufsliste, eigene, Ausblenden, Chefkoch-Suche, KI-Vorschau; Oberfläche und Modus „automatisch“ noch nicht).
- **Beilagen & Salate, Teil 3 (21.11.):** im Beilagen-Fenster „Eigene Beilage hinzufügen“: per Rezept-Link (Chefkoch & Co., auf 4 Portionen) oder KI-Vorschlag auf Knopfdruck (zählt zum KI-Kontingent); eigene Beilagen je Familie (Tabelle `custom_sides`, Migration 0037), löschbar. Live getestet 21.11. (API: setzen, Einkaufsliste, eigene, Ausblenden, Chefkoch-Suche, KI-Vorschau; Oberfläche und Modus „automatisch“ noch nicht).
- **Beilagen & Salate, Teil 2 (21.11.):** Einstellungen → Planung → „Beilagen und Salate“: aus (Standard) / nur vorschlagen (Karte zeigt „Dazu? …“ zum Übernehmen) / automatisch (beim Planen ergänzt). Vorschlag nur, wenn Nudeln/Reis/Kartoffeln/Brot fehlen, Salat nur ohne Gemüse. Migration 0036 (`profiles.sides_mode`). Live getestet 21.11. (API: setzen, Einkaufsliste, eigene, Ausblenden, Chefkoch-Suche, KI-Vorschau; Oberfläche und Modus „automatisch“ noch nicht).
- **Beilagen beim Tauschen (21.11.):** „Neu“ und Ersetzen behalten Beilage und Salat am Tag (wie den Nachtisch); nur Brotzeit entfernt sie.
- **Beilagen & Salate, Teil 1 (20.11.):** am Gericht „Beilage“ antippen → Beilage und/oder Salat aus fester Sammlung (35 Einträge, `src/data/sides.ts`); Zutaten kommen mit den Portionen (inkl. Gäste) auf die Einkaufsliste, „Gebraucht für“ nennt „Beilage (zu Gericht)“; auch in Heute, Teilen und Download. Migration 0035 (`plan_meals.sides`).
- **Fehler „Prisenn/Scheibenn“ (20.11.):** Import machte aus „Prise(n)“ ein doppeltes „n“, die Zutat blieb deshalb auf der Einkaufsliste statt im Vorrat; Ursache behoben, 27 gespeicherte Rezepte per Migration 0034 repariert; „Salz und Pfeffer“ zählt jetzt als Vorrat, Prisen stehen in der Mehrzahl.
- **Einkaufsliste „Einkauf für“ (20.11.):** frühere Wochen sind ausgeblendet, Link „Frühere Wochen anzeigen“ holt sie zurück.
- **Einkaufsliste → Vorrat (20.11.):** „Haben wir immer da“ öffnet ein Fenster mit änderbarem Namen (vorbelegt ohne Füllwörter).
- **Einschränkung „Cholesterin“ (20.11.):** wählbar unter Krankheiten & Einschränkungen; schließt nichts aus, gibt −15 bei viel Butter, Sahne, Speck, Wurst, Innereien, Eigelb (wie Diabetes bei Zucker); KI-Rezepte bekommen die Vorgabe „wenig gesättigte Fette“.
- **Planung (Nov.):** Bewertung zentriert, Pause nach Sternen, einstellbare Mengen-Regeln, Saison-Bonus (#188–#190, am 21.11. wieder entfernt).
- **Chefkoch-Automatik (26.10.):** tiefer suchen, wenig bewertete Rezepte nach 3 Tagen erneut prüfen, Handstart nennt Ablehnungsgründe (#184, #185).
- **Einkaufsliste/Nachtische (26.10.):** Gerichtszeile unter jedem Artikel, Link-Import auch als Nachtisch (#180, #187).

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

- Cholesterin ist wie Diabetes nur ein Abzug, kein harter Ausschluss (Heuristik auf Zutatentext; Käse und Eier zählen bewusst nicht mit).
- Familien-Nein schließt immer aus, „Mag nicht“ einzelner Mitglieder nur bei Mehrheit.
- Meeresfrüchte bleiben im Plan (nein sind nur Fisch und Lamm).
- Keine Vorrats-basierte Planung.
