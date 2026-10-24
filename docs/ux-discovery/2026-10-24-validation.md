# UX Validation Report – miyummy (24.10.2026)

**Gegenstand:** Stand von `main` (bis PR #137) gegen das Discovery-Doc `docs/ux-discovery/2026-10-23-miyummy-discovery.md`
**Geprüft:** Code (`worker/dislikes.ts`, `worker/meals.ts`, `worker/planning.ts`, `HideMealDialog.tsx`, `worker/routes/admin.ts`, `AdminStats.tsx`) und lesend die Live-Daten der Familie Hille (`/api/profile`, `/api/family`, `/api/recipes/catalog`, `/api/plans/latest`)

## Alignment Score: Partial

Der größte Schmerz (Abneigung wirkt nur als Abzug, das „Nein“ muss 46× einzeln gegeben werden) ist behoben. Die Folgeschritte aus dem Doc (Muster-Vorschlag, Kennzahlen, Erklärung) fehlen noch.

**Korrektur (David, 24.10.):** Meeresfrüchte (Garnelen & Co.) mag die Familie und sollen weiter im Plan erscheinen. Fisch und Lamm sind die Nein-Gruppen. Der Garnelen-Plan vom 14.–27.10. und das Beispiel „Reisbandnudeln mit Garnelen“ im Discovery-Doc sind deshalb kein Fehlvorschlag. Dass „Fisch“ keine Meeresfrüchte ausschließt, ist gewollt.

## Befunde

| Bereich | Status | Notizen |
|---|---|---|
| Persona (Wochenplaner) | ✅ | Familien-Nein schließt beim Planen, Tauschen, in der Rezept-Übersicht und bei KI-Rezepten aus. Ausblenden bleibt ein Dialog mit zwei Wegen, kein Mehraufwand. |
| JTBD „Plan passt auf Anhieb“ | ✅ | Live gesetzt: Familien-Nein „Fisch“ und „Lamm“, Meeresfrüchte bleiben erlaubt (gewollt, die Gruppen sind getrennt, `FAMILY_DISLIKE_GROUPS`). Wirkung auf einen neuen Plan noch nicht belegt (s. Beobachtungen). |
| Journey: Planen / Durchsehen | ✅ | Ausschluss und Ausblenden mit „Keinen X mehr vorschlagen“ sind da (PR #123). |
| Journey: Lernen (Muster-Vorschlag nach 3. Ausblenden) | ✅ | Umgesetzt am 24.10. (`dislikePattern.ts`): beim 3. (und 6.) ausgeblendeten Gericht derselben Hauptzutat fragt die App „Lamm ganz weglassen?“. Beim Ausblenden im Plan und in der Rezept-Übersicht. |
| Journey: Abschließen (Bewertungsquote) | ⚠️ | Erinnerung und Bewerten in der Heute-Karte bestehen schon; nichts Neues seit dem Doc, Quote nicht messbar (s. Telemetrie). |
| Design-Prinzipien | ⚠️ | „Ein Nein reicht“ und „Abneigung heißt nie“ erfüllt (Familie: Familien-Nein; Einzelne: Mehrheit, Entscheidung von David). „Erklären statt rätseln“ fehlt: keine Anzeige, warum ein Gericht kommt oder fehlt. |
| Telemetrie | ✅ (Nachtrag 24.10.) | **Nachgezogen:** Die fünf Kennzahlen stehen jetzt pro Familie in Admin → Statistik („Passt der Plan auf Anhieb?“, `worker/planQuality.ts`). Stand bei der Prüfung: ❌, in Admin → Statistik gab es nur Pläne, Gerichte (30 T.), Bewertungen (Anzahl), Favoriten, KI-Rezepte, Importe. Keine der fünf Kennzahlen aus Abschnitt 5 des Docs (Abneigungs-Treffer im Plan, Ausblendungen/Woche, Eingriffe nach dem Planen, Bewertungsquote, „Plan passt auf Anhieb“). |
| Annahmen | ⚠️ | Offene Wer-zählt-Frage ist entschieden (Familien-Nein: immer; einzelne Mitglieder: Mehrheit). Folge: Die Abneigungen der beiden Erwachsenen mit Eintrag (2 von 4) schließen allein nichts aus; der Schutz hängt am Familien-Nein. Die Annahme „Fisch trifft Garnelen“ aus dem Doc gilt für das Familien-Nein nicht, und das ist richtig so. |

## Beobachtungen aus den Live-Daten

- Ausgeblendete Gerichte: 49 (Doc vom 23.10.: 46). Ursache der 3 zusätzlichen nicht geprüft.
- Letzter Plan (14.–27.10.) wurde am 13.10. erstellt, also vor PR #123. Er enthält keine Fisch- oder Lammgerichte; Garnelengerichte (20.10., 27.10.) sind erwünscht. Ein Plan **nach** #123 liegt noch nicht vor, die Wirkung des Ausschlusses ist deshalb live noch nicht belegt.

## Empfehlungen

1. ~~**Kennzahlen (Schritt 4 des Docs)** in Admin → Statistik~~ – erledigt am 24.10. (alle fünf Kennzahlen aus Abschnitt 5 des Docs).
2. ~~**Muster-Vorschlag (Schritt 3)**~~ – erledigt am 24.10. (Plan und Rezept-Übersicht).
3. **Neuen Plan erstellen und prüfen** (Fisch und Lamm = 0), bevor Schritt 5 („Warum dieser Vorschlag?“) angegangen wird.

## Risiken, wenn so belassen

- Ohne Kennzahlen bleibt unklar, ob das Ziel (höchstens 1 Eingriff pro Plan) erreicht ist.
- Neue Familien starten ohne Familien-Nein; der Schutz greift erst nach der ersten Ausblendung mit „Keinen X mehr“ oder nach Einstellung.
