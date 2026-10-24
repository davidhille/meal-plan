# Interaktions-Audit: Erststart einer neuen Familie (24.10.2026)

Weg: Einladungslink → Zugang anlegen → erster Blick in die App → Familie einrichten → erster Plan.
Methode: Code gelesen (`LoginScreen`, `routes/admin.ts`, `MealPlanView`, `SettingsView`, `PlanCreationModal`), live nur lesend
(Admin → Familien und Statistik; keine Daten der Familien selbst, keine Einladung angelegt). Maßstab: Skill `interaction-design`
(Usage-/Origin-Story mit Peak-End, Excise, Zustände, Fehlervermeidung). Stand: **Block 1 (#1, #2, #4) umgesetzt** (24.10.2026, `EmptyPlanStart`); #3, #5–#9 offen.

Posture: **transient** (einmaliger, kurzer Einstieg). Die Hürde ist hier nicht Technik, sondern dass die App erst *nach* dem ersten Plan
erfährt, was die Familie nicht isst.

## Die Geschichte heute (Origin Story)

| Plot-Punkt | Was passiert | Bewertung |
|---|---|---|
| Einstieg | David schickt den Einladungslink (7 Tage, einmal gültig). Seite „Willkommen bei <Familie>! Lege deinen Zugang an.“ | gut: Familienname, klare Aufgabe, sichtbare Beschriftungen, „Mindestens 8 Zeichen“ |
| Auslöser | Name, E-Mail, Passwort → „Zugang anlegen“ → App lädt neu | brüchig: keine Bestätigung, kein Hinweis, was als Nächstes kommt |
| Aufbau | Leerer Speiseplan: „Noch kein Speiseplan. Erstelle einen Plan – er berücksichtigt eure Familie, Vorlieben und Bewertungen.“ + **Plan erstellen** | **Versprechen stimmt nicht**: Es gibt weder Familie noch Vorlieben noch Bewertungen |
| Krise | Erster Plan enthält Gerichte, die die Familie nie isst (Fisch, Lamm …); Abhilfe nur über Ausblenden, Gericht für Gericht | **hier geht der Plan schief**, genau das Problem aus der Discovery |
| Höhepunkt | Ein Plan, der auf Anhieb passt | wird dem Zufall überlassen |
| Ausklang | Kein Abschluss: nichts sagt „Dein erster Plan steht – so passt du ihn an“ | fehlt |

## Befunde

Schwere: **H** = bricht den Erstnutzen, **M** = Reibung, **N** = Politur.

| # | Schwere | Stelle | Befund | Empfehlung |
|---|---|---|---|---|
| 1 | H | Leerer Speiseplan (`MealPlanView`) | Der erste Plan wird ohne jede Angabe erstellt. Das „Familien-Nein“ (`family_dislikes`) liegt zwei Ebenen tief: Einstellungen → „Gesundheit & Ernährung“ → Fenster. Eine neue Familie weiß davon nicht. | Vor dem ersten Plan eine kurze, überspringbare Frage „Was esst ihr nicht?“ (Chips: Fisch, Meeresfrüchte, Lamm, Schwein, Rind, Geflügel) direkt im Leerzustand; speichert über den bestehenden `PUT /profile/family-dislikes`. |
| 2 | H | Text im Leerzustand | „…berücksichtigt eure Familie, Vorlieben und Bewertungen“ ist bei einer neuen Familie falsch (nichts hinterlegt). | Ehrlich formulieren: „Mit ein paar Angaben passt der Plan besser – oder starte gleich und passe danach an.“ |
| 3 | M | Einstellungen, Zusammenfassung | Ohne Einträge steht „Ausgewogen, keine Einschränkungen“. Das liest sich wie „alles erledigt“ und verrät nicht, dass man Fisch oder Lamm ausschließen kann. | „Nichts ausgeschlossen – tippe, um z. B. Fisch oder Lamm auszuschließen.“ |
| 4 | M | Nach „Zugang anlegen“ | Seite lädt neu und landet im leeren Plan. Keine Bestätigung, kein erster Schritt. | Einmalige Begrüßungszeile oben im Plan: „Willkommen, <Name>! 1 Was esst ihr nicht? 2 Plan erstellen.“ (verschwindet nach dem ersten Plan) |
| 5 | M | Erster Plan fertig | Kein Ende der Geschichte. Ausblenden, Tauschen und „Keinen X mehr“ werden nirgends vorgestellt. | Nach dem ersten Plan einmalig: „Dein erster Plan steht. Passt etwas nicht? Tippe auf das Gericht → Ausblenden.“ |
| 6 | M | Familienmitglieder | „Noch niemand eingetragen“ ist im Leerzustand ok, aber Portionen und Lieblingsessen hängen daran; die Info-Karte erklärt das erst, wenn man sie aufklappt. | Im Einstieg (Befund 4) als zweiter, freiwilliger Schritt nennen. |
| 7 | N | `LoginScreen` | Fehlermeldung ohne Gegenstand: „Das hat nicht geklappt.“ (Regel: Gegenstand + nächster Schritt). Kein Passwort-Anzeigen-Knopf. Der Name-Feld hat kein `autoFocus`. | Text: „Der Zugang konnte nicht angelegt werden. Bitte Netz prüfen und noch einmal versuchen.“; Anzeigen-Knopf; `autoFocus` auf den Namen. |
| 8 | N | Einladung, Betreiberseite | Der Link muss von Hand verschickt werden; abgelaufene Links zeigen „Bitte frag nach einem neuen Link“ ohne Kontakt. | Admin: „Link kopieren“ plus Hinweis auf 7 Tage ist vorhanden; Familienname im Fehlertext der Einladung nennen, falls bekannt. |
| 9 | N | Messung | Es gibt keine Kennzahl, ob eine neue Familie vor dem ersten Plan etwas eingerichtet hat. | In Admin → Statistik je Familie „Einrichtung“ (Mitglieder, Familien-Nein) anzeigen. |

## Beobachtung aus den Live-Daten (nur Kennzahlen)

- **Familie Heimbach** (seit 21.10.): 1 Zugang, 1 Plan, 5 Gerichte, Eingriffe pro Plan **1**, 0 ausgeblendet, 0 Bewertungen, 0 Favoriten, letzter Login 21.10. (abends).
  Das ist ein ruhiger Start, aber auch kein Beleg für Zufriedenheit: Seit drei Tagen keine Aktivität, und ohne Bewertungen lernt der Plan nichts.
- **Familie Test** (interne Testfamilie): 7 ausgeblendete Gerichte im ersten Plan. Das ist das Muster aus der Discovery.
- Nicht prüfbar: ob Heimbach Familienmitglieder oder Abneigungen eingetragen hat (Inhalte anderer Familien werden nicht gelesen).

## Empfohlene Reihenfolge

1. **Einstieg mit Abneigungen (#1, #2, #4):** ein Block im leeren Speiseplan, überspringbar, schreibt auf das bestehende Familien-Nein.
2. **Abschluss des ersten Plans (#5) und ehrliche Summary (#3).**
3. **Login-Politur (#7), Familienmitglieder im Einstieg (#6), Kennzahl (#9).**

Wichtig: Der Einstieg darf **nicht blockieren** (Prinzip „Lernen nebenbei, nie als Pflicht“ aus der Discovery). Jede Frage lässt sich überspringen,
der Plan geht auch ohne Angaben.

## Umgesetzt: Einstieg mit Abneigungen (#1, #2, #4)

- Leerer Speiseplan (`EmptyPlanStart`): Frage „Was esst ihr nicht?“ mit den sechs Chips aus `FAMILY_DISLIKES` (44 px, `aria-pressed`), speichert sofort über `PUT /profile/family-dislikes`; bei Fehler Meldung mit Gegenstand, Auswahl bleibt wie vorher.
- Nichts blockiert: „Plan erstellen“ geht immer, die Angabe ist überspringbar.
- Text ehrlich: statt „berücksichtigt eure Familie, Vorlieben und Bewertungen“ (gab es noch nicht) steht bei einer frischen Familie „Willkommen bei miyummy“ und der Hinweis, dass die Angabe später änderbar ist. Frisch = kein Plan, keine Mitglieder, kein Familien-Nein.
