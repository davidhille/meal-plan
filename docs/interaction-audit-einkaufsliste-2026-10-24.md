# Interaction-Design-Audit: Einkaufsliste (24.10.2026)

Weg: Plan → Einkaufsliste → Shop-Warenkorb (Knuspr/Picnic).
Methode: Code gelesen (`ShoppingListView`, `ShoppingSection`, `CartBar`, `CartPreviewSheet`) und lesend live geprüft
(miyummy.com, Handy-Format 375×812, Daten der Familie Hille, nichts geändert). Maßstab: Skill `interaction-design`
(Mikrointeraktionen, Excise, Zustände, Fehlervermeidung, Reaktionszeiten, Tippflächen ≥ 44 px).
Stand: **alle Befunde bearbeitet** (#1–#8, #10, #11, #13 umgesetzt; #9 und #12 geprüft, bewusst unverändert) (24.10.2026; „Vertrauen“: Fehlerzeile mit Rollback, Eingaben erst nach Erfolg leeren, Rückgängig beim Abhaken von Basis-Zutaten; „Ruhe“: stilles Nachladen nach Aktionen ohne Spinner-Ersatz, Vorrat-Karte ohne `overflow-hidden`, Menüs schließen mit Escape/Außenklick, ⋯-Knopf öffnet das Menü nicht mehr sofort wieder). 

Posture: **transient** (kurze Nutzung im Laden/Zuhause, Handy). Folge: wenige Entscheidungen, Rückgängig statt Rückfrage,
Fehler sichtbar, Eingaben nie verlieren.

## Befund-Tabelle

Schwere: **H** = verliert Daten/Vertrauen, **M** = Reibung oder Fehlbedienung, **N** = Politur.

| # | Schwere | Stelle | Befund | Empfehlung |
|---|---|---|---|---|
| 1 | H | Alle Schreibaktionen (`removeItem`, `moveToPantry`, `takeFromPantry`, `addItem`, `addToPantry`) | Fehler werden ignoriert. Bei Netzproblem (Laden, Funkloch) sieht der Nutzer keinen Fehler; die Liste kann vom Server abweichen. | Gemeinsame Fehlerzeile (`role="alert"`) mit „Erneut versuchen“; Zustand bei Fehler zurückrollen. |
| 2 | H | Formulare „Eigenen Artikel hinzufügen“, Vorrat-Eingabe | Eingabefeld wird **vor** dem Ergebnis geleert. Scheitert der Aufruf, ist der Text weg. | Feld erst nach Erfolg leeren, bei Fehler Text behalten und Meldung zeigen. |
| 3 | H | `toggleItem` bei Basics | Abgehakte Basis-Zutat wird **still** entfernt/verschoben, ohne Hinweis und ohne Rückgängig. | Kurzer Hinweis „X in den Vorrat gelegt · Rückgängig“ (5 s, modeless), kein Dialog. |
| 4 | M | `load()` | Setzt jedes Mal `loading=true`; `if (loading)` ersetzt die **ganze Liste** durch einen Spinner (auch beim 10‑s‑Abgleich und nach jeder Aktion). Liste springt, Scrollposition und Fokus gehen verloren. | Spinner nur beim ersten Laden; danach stilles Nachladen (Stale-while-revalidate), Liste bleibt stehen. |
| 5 | M | Vorrat-Karte | Das Menü (`role="menu"`) sitzt in einem Container mit `overflow-hidden` (live bestätigt: ein Container mit Vorrat + `overflow:hidden`). Das Menü kann abgeschnitten werden. Kein Escape, keine Pfeiltasten, kein Schließen beim Tippen daneben. | Menü per Portal oder ohne `overflow-hidden`; Escape/Außenklick schließen; Fokus zurück auf den Auslöser. |
| 6 | M | Vorrat-Bearbeitung | Vorrat ändern ohne Rückgängig; auf dem Handy kein Hinweis, dass etwas langes Drücken/Menü braucht. | Rückgängig-Hinweis wie in #3; sichtbarer Menüknopf statt versteckter Geste. |
| 7 | M | Tippflächen (live, Handy) | Unter 44 px: „Eigenen Artikel hinzufügen“ 38, „Hinzufügen“ 38×40, Gruppen-Köpfe „zuklappen“ 32, Symbolknöpfe „offene Einträge kopieren/als …“ **32×32**, „x erledigt“ 36, Zusammenfassung „3 Gerichte … einrechnen“ 32, Aktualisieren-Knopf der CartBar 40 breit. Im Warenkorb-Fenster: Stepper −/+ 28 px (mit `tap`-Fläche), Leeren 28 px hoch. | Mindestens 44 px Höhe/Fläche; die Symbolknöpfe zusammenrücken oder in ein Menü „Mehr“ auslagern. |
| 8 | N | CartBar | **Korrektur:** „noch 7“ war nur ein abgeschnittener Messtext; angezeigt wird „noch 7,00 € bis Mindestwert“ (klar). Echt war nur: Meldung verschwindet nach 4 s per `setTimeout` ohne Aufräumen. | Timer in `useEffect` aufräumen (umgesetzt). |
| 9 | M | `CartPreviewSheet` – „Leeren“ | Bestätigungsdialog verlangt Entscheidung vor jedem Leeren; entfernt auch Artikel, die der Nutzer direkt im Shop gelegt hat. Dafür besteht keine Rückgängig-Möglichkeit. | Hier ist der Dialog berechtigt (Shop-API ohne Rückgängig); Text beibehalten, Knopf „Warenkorb leeren“ mit Anzahl. |
| 10 | M | `CartPreviewSheet` – Übertragen | Erfolg/Fehler erscheint als kleine graue Zeile `text-xs` über dem Knopf, ohne Unterscheidung von Erfolg und Fehler; nach Erfolg wird die Auswahl geleert, der Knopf sagt „Nichts zum Übertragen ausgewählt“ (Sackgasse, kein nächster Schritt). | Erfolg und Fehler farblich/ikonisch trennen; nach Erfolg „Zum Shop öffnen“ oder „Schließen“ anbieten (Ende des Weges gestalten). |
| 11 | N | Texte | Leerzustand „Gerade ist nichts mit Knuspr-Produkt bei Knuspr eingeplant.“ doppelt; „Das hat nicht geklappt.“ ohne Gegenstand (CLAUDE.md verlangt Gegenstand + Handlung). | Texte nach Regeln im UX‑Writing‑Abschnitt der CLAUDE.md überarbeiten. |
| 12 | N | Kontrast | Viele `text-xs text-gray-500`‑Zeilen (Hinweise, Preise) auf Weiß/Grau‑50: knapp an AA. | Kontrast der betroffenen Texte messen, ggf. `gray-600`. |
| 13 | N | Lade-Hinweis | „Warenkorb wird geladen …“ nur im Fenster, CartBar zeigt „lädt …“ pro Shop: ok. Kein Zeitlimit; bleibt der Shop stumm, steht „lädt …“ dauerhaft. | Nach ca. 10 s „Antwort dauert länger. Erneut versuchen“. |

Hinweis zu #7: Die Messwerte sind die sichtbare Größe; Knöpfe mit Klasse `tap` haben zusätzlich eine unsichtbare Tippfläche von 44 px. Umgesetzt: echte 44 px bei Eingabefeldern, Hinzufügen-Knöpfen, Listenkopf (Aufklappen, PDF, Kopieren), „x erledigt“, Vorrat-Kopf und -Menüpunkten, „einrechnen“, Aktualisieren; `tap` bei Shop-Chips, „Bearbeiten“, „Leeren“; Vorrat-Chips 36 px hoch bei 8 px Abstand (44 px Raster).

Live bestätigt: Tippflächen (#7), Menü im `overflow-hidden`‑Container (#5), Wechsel in den Tab zeigt sofort Inhalt
(Spinner-Flash bei #4 liegt unter der Messgrenze, per Code belegt). Nicht live prüfbar ohne Schreibaktionen: #1–#3, #10
(Folge aus dem Code).

## Zustandsübersicht (Liste)

```
[Laden erstes Mal] → [Liste]            Fehler → [Fehler + Erneut versuchen]   (heute: nur Spinner/leer)
[Liste] --Haken--> [speichern] --ok--> [Liste]
                              --Fehler--> [Liste mit Fehlerzeile, Rollback]      (heute: fehlt)
[Liste] --Basis abhaken--> [Vorrat + „Rückgängig“ 5 s]                           (heute: still)
[Liste] --10 s--> [stilles Nachladen]                                            (heute: Spinner ersetzt Liste)
```

## Empfohlene Reihenfolge

1. **Vertrauen** (#1–#3): Fehler sichtbar, Eingabe behalten, Rückgängig bei stillen Änderungen.
2. **Ruhe** (#4, #5): kein Spinner-Ersatz der Liste, Menü korrekt (Escape, nicht abgeschnitten).
3. **Handy-Bedienung** (#7, #8): Tippflächen 44 px, CartBar‑Klartext.
4. **Ende des Weges** (#10) und Texte/Kontrast (#11–#13).

Offen: Test mit schlechtem Netz (Flugmodus im Laden). Screenreader-Test: von David gestrichen.

## Abschluss (24.10.2026)

- **#6** Vorrat: „liegt jetzt im Vorrat“ bzw. „ist nicht mehr im Vorrat“ mit **Rückgängig** (gleiche Hinweiszeile wie bei #3).
- **#9** bewusst unverändert: Der Dialog „Warenkorb leeren?“ bleibt, weil die Shop-Schnittstelle kein Rückgängig kennt; der Text nennt schon die Anzahl und dass auch Artikel aus dem Shop betroffen sind.
- **#10** Warenkorb-Fenster: Erfolg (Haken, Pflaume) und Fehler (Warnsymbol, rot, `role="alert"`) getrennt; nach dem Übertragen heißt der Knopf **Fertig** und schließt das Fenster; ohne Auswahl: „Wähle oben Produkte zum Übertragen aus“.
- **#11** Texte: Leerzustand „Noch kein Artikel hat ein Knuspr-Produkt. Tippe in der Liste auf einen Artikel und wähle eines aus.“; Fehlertexte mit Gegenstand und nächstem Schritt.
- **#12** gemessen, keine Änderung nötig: `gray-500` auf Weiß 6,5 : 1, auf `gray-50` 6,1 : 1, `coral-700` und `amber-700` über 4,8 : 1. `gray-300`/`gray-400` stehen nur bei Symbolen und deaktivierten Knöpfen.
- **#13** CartBar: nach 10 s ohne Antwort „dauert länger – mit ↻ neu laden“ statt dauerhaft „lädt …“.
