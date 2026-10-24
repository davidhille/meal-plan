# Accessibility-Audit miyummy (WCAG 2.2) – 24.10.2026

**Stand:** `main` bis PR #140, Live-Prüfung auf miyummy.com im Handy-Format (375 × 812 und 320 × 640), nur lesend.
**Vorarbeit:** UX/UI-Audit vom 23.10. (fünf Tabs: Kontrast, Fokus, Struktur, Tap-Flächen; die Befunde sind umgesetzt).
**Schwerpunkt hier:** was dort nicht abgedeckt war: Dialoge, Formularfelder, Anmeldung, Bewegung, Reflow.
**Nicht geprüft:** echter Screenreader (VoiceOver/NVDA), Desktop-Layout, Kontraste in allen Dialogen außer der Rezept-Ansicht, Anmeldeseite im Browser (nur Code).

## Befunde

| # | Schwere | WCAG | Befund | Stand |
|---|---|---|---|---|
| 1 | Mittel | 2.4.3 (A) | Tab verließ jeden Dialog und landete auf der Tab-Leiste dahinter (live bestätigt: nach 14× Tab Fokus auf „Rezepte“ in der Navigation). Betrifft alle 21 Fenster über `useDialog`. | behoben: Tab bleibt im Fenster (`lib/focusTrap.ts`, `useDialog.ts`) |
| 2 | Mittel | 1.3.1, 3.3.2, 4.1.2 (A) | Routine: Eingabefeld für eigene Tage-Anzahl ohne Namen. | behoben: `aria-label="Anzahl Tage"` |
| 3 | Mittel | 3.3.2 (A) | Anmeldung: Beschriftung nur als Platzhalter; „mind. 8 Zeichen“ verschwand beim Tippen. | behoben: Hinweis „Mindestens 8 Zeichen.“ steht dauerhaft und ist mit dem Feld verbunden; alle Felder haben jetzt eine sichtbare Beschriftung über dem Feld (`Field` in `LoginScreen.tsx`, kein Platzhalter mehr). Im Browser noch nicht angesehen. |
| 4 | Niedrig | 2.3.3 (AAA), Best Practice | Kein `prefers-reduced-motion`. | behoben in `index.css`: keine Übergänge, kein Pulsieren; Ladekreise laufen weiter |
| 5 | Niedrig | 2.4.1 (A) | Kein „Zum Inhalt springen“-Link. Gelöst über Landmarken (`header`, 3× `nav`, `main`), daher kein Verstoß; nur Komfort. | offen, optional |

## Bestanden (belegt)

- **Namen:** alle Knöpfe, Bilder (`alt`), Links und Felder haben einen Namen (AST-Prüfung über 68 Komponenten, nach den Fixes 0 Treffer).
- **Dialoge:** `role="dialog"`, `aria-modal`, Name, Escape, Fokus hinein und zurück; Kontrast in der Rezept-Ansicht 31 Texte geprüft, niedrigster Wert 6,32:1, kleinste Schrift 12 px.
- **Reflow (1.4.10):** bei 320 px auf allen fünf Tabs kein waagrechtes Scrollen.
- **Textabstand (1.4.12):** mit Zeilenhöhe 1,5, Zeichenabstand 0,12 em und Wortabstand 0,16 em nichts abgeschnitten.
- **Zielgröße (2.5.8):** Symbolknöpfe mit der Klasse `tap` haben eine Tippfläche von 44 px.
- **Fokus nicht verdeckt (2.4.11):** Elemente weit unten werden beim Fokussieren nicht von der festen Tab-Leiste überdeckt (3 Stichproben plus letztes Element, Überlappung 0 px).
- **Ziehen (2.5.7):** keine Zieh-Bedienung vorhanden. **Anmeldung (3.3.8):** E-Mail und Passwort mit `autocomplete`, kein CAPTCHA.
- **Sprache, Überschriften, Landmarken, Statusmeldungen:** `lang="de"`, eine h1, Fehler mit `role="alert"`, Hinweise mit `role="status"`.

## Empfehlung als Nächstes

1. Einmal mit VoiceOver (iPhone) durch Plan, Einkaufsliste und ein Rezept-Fenster gehen; das lässt sich nicht automatisch prüfen.
2. ~~Sichtbare Beschriftungen auf der Anmeldeseite (Befund 3)~~ – erledigt.
3. Desktop-Layout und die übrigen Dialoge auf Kontrast prüfen.
