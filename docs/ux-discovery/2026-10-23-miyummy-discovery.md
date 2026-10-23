# miyummy – UX Discovery: „Der Plan lernt zu wenig“ (23.10.2026)

Grundlage: Antworten von David (Jobs-to-be-Done, Problemdefinition, Journey), Daten der Familie Hille
(read-only aus der App: `/api/admin/stats`, `/api/recipes/catalog`, `/api/family`), Code (`worker/meals.ts`), zwei Audits vom selben Tag.

## 1. Problem Brief

- **Problem:** Der Plan lernt zu wenig, was der Familie schmeckt – er schlägt immer wieder Gerichte vor, die von vornherein nicht passen.
- **Betroffen:** der Wochenplaner (David).
- **Heute:** Ausblenden, Gericht für Gericht. Das sagt nur „dieses nie“, nicht „so etwas nie“.
- **Warum das scheitert:** 46 ausgeblendete Gerichte; trotzdem stehen 17 Fischgerichte in der Sammlung und diese Woche „Gebratene Reisbandnudeln mit Garnelen“ im Plan.
- **Umfang:** Verbesserung des Bestehenden, danach eine neue Funktion.

### Belege

| Befund | Wert | Quelle |
|---|---|---|
| Ausgeblendete Gerichte | 46 | `/api/recipes/catalog` → `hidden` |
| davon Fisch/Meeresfrüchte | 28 (61 %) | Namen der 46 |
| davon Lamm | 11 (24 %) | Namen der 46 |
| Rest | Chorizo 2, Rote Bete 2, sonstige 3 | Namen der 46 |
| Abneigungen schon hinterlegt (Erwachsener 1) | „Fisch“, „Lamm“, „Rosenkohl“ | `/api/family` |
| Wirkung einer Abneigung beim Planen | nur −30 Punkte, kein Ausschluss | `worker/meals.ts` (`scoreMeal`) |
| Bewertet | 6 von 24 Gerichten (30 Tage) | `/api/admin/stats` |
| Durchsehen nach dem Planen | 5–15 Min., 3–4 Gerichte angefasst | David |
| Warum ausgeblendet | „schmeckt uns einfach nicht“, meist **vorher** erkennbar | David |

**Kernbefund:** Die App *weiß* bereits, dass die Familie keinen Fisch und kein Lamm will – die Abneigung steht in den
Familienmitgliedern. Sie behandelt sie aber nur als leichten Abzug. Ein gut bewertetes oder saisonales Fischgericht
schlägt den Abzug, also blendet David von Hand aus. 85 % der Ausblendungen wären damit überflüssig gewesen.

## 2. Personas

| Persona | Priorität | Kern | Beleg |
|---|---|---|---|
| **Der Wochenplaner** | primär | Plant 1× pro Woche am Handy, will einen Plan, der auf Anhieb passt; blendet aus, bewertet kaum. „Ich will den Plan nicht jede Woche erziehen müssen.“ | Daten + Antworten |
| **Die Mitesserin** | sekundär | Eigener Zugang, kocht/isst mit, plant und bewertet selten; Wünsche laufen über den Planer. | Annahme (2 Zugänge) – prüfen |
| **Die neue Familie** | tertiär | Startet ohne Bewertungen/Abneigungen; erste Pläne beliebig. | Annahme (Heimbach: 0 Bewertungen) |

## 3. Jobs to Be Done

- **Hauptjob:** Wenn die neue Woche ansteht, will ich in einem Rutsch festlegen, was es gibt, und daraus direkt die
  Bestellung haben, damit das Thema Essen erledigt ist – und es allen schmeckt. (Wichtigkeit 10, Zufriedenheit ≈ 6, Score 14)
- Funktional: planen + einkaufen · Emotional: entlastet · Sozial: verlässlich · Erfolg: allen hat's geschmeckt.
- Nebenjobs: Abwechslung, die passt (Score 9) · günstig bestellen ohne Abschreiben (9) · abends sofort wissen, was es gibt (8).
- Ausführlich: Projekt-Dokument `claude/jtbd-miyummy.md`.

## 4. User Journey – Wochenplaner, Hauptjob

### Ist-Zustand

| Phase | Handlung | Denken / Fühlen | Reibung | Dauer |
|---|---|---|---|---|
| Auslösen | Woche steht an, App öffnen | neutral | keine Routine eingerichtet | – |
| Planen | „Neuen Zeitraum planen“ | erwartungsvoll | Plan kennt Abneigungen nur als Abzug | 30 Sek. |
| **Durchsehen** | Plan lesen, 3–4 Gerichte tauschen/ausblenden | **genervt**: „schon wieder Fisch“ | Ausblenden wirkt nur auf ein Gericht; Tauschen bringt Ähnliches | **5–15 Min.** |
| Einkaufen | Liste → Knuspr/Picnic/Metzger | im Griff | gering (heute verbessert) | 5–10 Min. |
| Kochen | Heute-Karte, Kochmodus | zufrieden | gering | – |
| Abschließen | (Bewerten) | – | wird vergessen, Erinnerung aus | – |

### Moments of Truth
- **Make-or-break:** Der erste Blick auf den neuen Plan. Steht dort Fisch oder Lamm, kippt „entlastet“ in „ich muss nacharbeiten“.
- **Größter Schmerz:** Dasselbe „Nein“ immer wieder geben (46×), obwohl es längst hinterlegt ist.
- **Funktioniert gut (erhalten):** Einkauf mit Shops/Metzger, Heute-Karte, Kochmodus.

### Soll-Zustand

| Phase | Handlung | Fühlen | Design-Chance | Messgröße |
|---|---|---|---|---|
| Planen | Plan erstellen | vertrauend | Abneigungen schließen aus („nie“), nicht nur Abzug | 0 Gerichte mit Abneigung im Plan |
| Durchsehen | höchstens 1 Gericht anfassen | entlastet | Ausblenden fragt: „Nur dieses“ oder „Keinen Fisch mehr“ (erkannte Hauptzutat) | ≤ 1 Eingriff pro Plan |
| Lernen | – (nebenbei) | „die App kennt uns“ | Nach dem 3. Ausblenden derselben Hauptzutat: Vorschlag, sie als Abneigung zu speichern | Ausblendungen pro Woche ↓ |
| Abschließen | am Folgetag 1 Tipp | – | Bewerten in der Heute-Karte (vorhanden) + Erinnerung beim ersten Plan anbieten | Bewertungsquote ≥ 50 % |

### Gap-Analyse

| Phase | Ist | Soll | Lücke | Priorität |
|---|---|---|---|---|
| Planen | Abneigung = −30 Punkte | Abneigung = Ausschluss | Regel in `scoreMeal`/Pool | **Hoch** |
| Durchsehen | Ausblenden pro Gericht | Ausblenden mit „so etwas nie“ | Dialog + Abneigung speichern | **Hoch** |
| Lernen | kein Muster | Vorschlag nach 3 gleichen Ausblendungen | Muster-Erkennung über `recipeCategories` | Mittel |
| Abschließen | 25 % bewertet | ≥ 50 % | Erinnerung/1-Tipp-Bewertung sichtbarer | Mittel |
| Familie | Abneigung gilt für die ganze Familie? | klar pro Person vs. Familie | Regel festlegen (s. Risiken) | Mittel |

## 5. Erfolgsmessung

Alles aus vorhandenen Tabellen berechenbar, keine neue Erfassung nötig (Anzeige in Admin → Statistik):

| Kennzahl | Heute | Ziel | Quelle |
|---|---|---|---|
| Gerichte mit hinterlegter Abneigung im neuen Plan | ≥ 1 pro Woche | 0 | `plan_meals` × `family_members.disliked_foods` |
| Ausblendungen pro Woche | hoch (46 gesamt) | ≤ 1 | `rejected_meals.created_at` |
| Eingriffe nach dem Planen (Tauschen + Ausblenden) | 3–4 | ≤ 1 | `plan_meals.skipped_names`, `rejected` |
| Bewertungsquote (30 Tage) | 25 % | ≥ 50 % | `ratings` / gekochte Gerichte |
| Leitmetrik „Plan passt auf Anhieb“ | – | ≥ 80 % der Gerichte unverändert gekocht | `plan_meals` ohne Tausch/Ausblenden |

## 6. Erkenntnisse und Design-Prinzipien

1. **Ein Nein reicht.** Was die Familie einmal klar abgelehnt hat (Abneigung, wiederholtes Ausblenden), kommt nicht wieder – auch nicht als Variante.
2. **Abneigung heißt nie, Vorliebe heißt öfter.** Harte Regeln für „mögen wir nicht“, weiche Pluspunkte für „mögen wir“.
3. **Lernen nebenbei, nie als Pflicht.** Jede Aktion, die der Planer ohnehin macht (Ausblenden, Tauschen), wird zum Signal.
4. **Erklären statt rätseln.** Wenn der Plan etwas weglässt oder vorschlägt, sagt er kurz warum („ohne Fisch und Lamm“).

## 7. Annahmen und Risiken

| Annahme / Risiko | Status | Umgang |
|---|---|---|
| Abneigungen eines Erwachsenen gelten für die ganze Familie | **offen** – nur ein Erwachsener hat „Fisch“ hinterlegt | Entscheiden: Ausschluss, wenn *ein* Mitglied es nicht mag, oder nur bei Erwachsenen / Mehrheit |
| „Fisch“ trifft Garnelen, Lachs, Forelle … | erfüllt über `FOOD_GROUPS` (Oberbegriffe) | Test mit den 28 ausgeblendeten Fischgerichten |
| Weniger Auswahl durch harten Ausschluss | Risiko gering (406 Gerichte, davon 17 Fisch) | Wenn der Pool zu klein wird, Hinweis statt stiller Lockerung |
| Mitesserin bewertet nicht, weil sie den Weg nicht kennt | Annahme | Nach Umsetzung mit ihr prüfen |
| Andere Familien profitieren genauso | Annahme | Kennzahlen pro Familie in der Statistik beobachten |

## 8. Empfohlene nächste Schritte

1. **Abneigung = Ausschluss** beim Planen, Tauschen und bei KI-Rezepten (KI prüft bereits hart). Danach erzeugt ein neuer Plan keine Fisch-/Lammgerichte mehr. *Klein, größte Wirkung.*
2. **Ausblenden mit Muster:** Der Dialog erkennt die Hauptzutat (Fisch, Lamm …) und bietet „Nur dieses Gericht“ oder „Keinen Fisch mehr vorschlagen“ (→ Abneigung der Familie).
3. **Muster-Vorschlag:** Nach dem 3. Ausblenden derselben Hauptzutat ein Hinweis „Sollen wir Lamm ganz weglassen?“.
4. **Kennzahlen** aus Abschnitt 5 in Admin → Statistik.
5. Danach (neue Funktion): Bewerten sichtbarer machen (Erinnerung beim ersten Plan anbieten, Heute-Karte) und „Warum dieser Vorschlag?“ in der Rezeptansicht.

Offene Entscheidung vor Schritt 1: **Wessen Abneigung schließt aus?** (siehe Risiken)
