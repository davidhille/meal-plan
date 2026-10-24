# Projektübersicht – miyummy (Familien-Speiseplaner)

Deutschsprachige App für die Essensplanung einer Familie: Speiseplan, Rezepte, Nachtische, Einkaufsliste mit
Preisvergleich und Warenkorb bei Knuspr und Picnic. Läuft unter https://miyummy.com/ (zusätzlich https://meal-plan.davidshille.workers.dev/) und lässt
sich auf dem Handy als App installieren. Name und Logo: „miyummy“ (Schriftzug in Poppins, i-Punkt als Teller-Ring);
das App-Icon (Teller mit Besteck) bleibt.

**Technik:** React + Vite + TypeScript + Tailwind · Cloudflare Worker (API, Zeitplan, KI) · Neon Postgres.
Entwickler-Infos stehen in `CLAUDE.md`, die Einrichtung in `SETUP_NEON_CLOUDFLARE.md`.

**Zugang:** Jede Person meldet sich mit eigener E-Mail und eigenem Passwort an (Sitzung 180 Tage, verlängert sich bei
Nutzung; nach 8 Fehlversuchen 15 Minuten gesperrt). Den ersten Zugang legt man einmalig mit dem bisherigen
Familien-Passwort (Secret `APP_PASSWORD`) an – danach gilt nur noch die Anmeldung. **Einstellungen → Zugänge:** eigenes
Passwort ändern, abmelden; Admins legen Zugänge für die Familie an, setzen Passwörter zurück (meldet die Person überall ab)
und entfernen Zugänge.

**Mehrere Familien:** Der Betreiber (erster Zugang überhaupt) sieht in den Einstellungen die Karte **„Administration“**:
Familie anlegen → **Einladungslink** (7 Tage gültig, einmal nutzbar; kopieren oder teilen). Wer ihn öffnet, legt den
ersten Zugang an und ist Admin seiner Familie. Außerdem: neuer Link, umbenennen, sperren (Anmeldung geht nicht mehr,
Routinen ruhen), endgültig löschen. Pro Familie getrennt: Pläne, Einkaufslisten, Favoriten, Bewertungen, Einstellungen,
Shop-Zugänge **und eigene Rezepte** (Import, Chefkoch, Bearbeitungen, eigene Nachtische) sowie Filter-Anpassungen
(Kategorien) und eigene Filter. Gemeinsam: Grundsammlung (383 Gerichte, 161 Nachtische), Bilder und **KI-Rezepte** – was
eine Familie per KI erzeugt, landet bei allen im Pool. Bearbeitet eine Familie ein fremdes KI-Rezept, gilt ihre Fassung nur
für sie; Ausblenden/Löschen ebenso. Neue Familien starten mit den Listen „Einkauf“ (Standard) und „Metzger“
(Automatik in den Einstellungen abschaltbar); Knuspr/Picnic erscheinen erst nach dem Verbinden.

**Statistik (nur Betreiber):** Karte **„Statistik“** unter der Administration. KI-Verbrauch heute gegen das
Gratis-Kontingent (10.000 Neurons, neu ab 00:00 UTC), Verlauf der letzten 30 Tage mit Gratis-Grenze, und pro Familie:
Zugänge, zuletzt aktiv, Pläne, geplante Gerichte (30 Tage), Bewertungen, Favoriten, KI-Rezepte, Importe sowie KI-Verbrauch
(heute/7/30 Tage, aufgeteilt in Rezepte und Bilder). „Automatisch“ = Bilder, die der Cron nachzieht. Cloudflare meldet
Neurons nur fürs ganze Konto – die App schreibt deshalb jeden KI-Aufruf selbst mit (Tabelle `ai_usage`) und schätzt die
Neurons nach der Preisliste (Tokens bzw. Bildgröße und Schritte). Gezählt wird ab Version mit Migration 0018.

**Weitere Werkzeuge für den Betreiber:**
- **KI-Budget pro Familie** (Statistik, je Familie „KI-Budget/Tag“: unbegrenzt oder 500–5.000 Neurons). Ist es erreicht,
  bekommt die Familie bis 2 Uhr (Winterzeit 1 Uhr) nur Gerichte aus der Sammlung bzw. Ersatzfotos; die KI der anderen
  Familien läuft weiter. „Rezept mit KI“ zeigt dann „Euer KI-Budget für heute ist aufgebraucht“ mit Chefkoch-Ersatz.
- **Warnung bei 80 %** des Gratis-Kontingents: einmal am Tag eine Push-Nachricht an den Betreiber (wenn die Erinnerung auf
  seinem Gerät an ist), dazu ein Hinweis in der Statistik.
- **Meldungen** (Karte unter der Statistik): Feedback der Familien (erledigt/wieder offen, löschen) und Fehler der App
  (Server-Fehler, Shop-Fehler, KI-Fehler, Routinen, Bilder nachziehen; Tabelle `app_errors`, 60 Tage).
- **Feedback & Wünsche** (Einstellungen, für alle): Nachricht an den Betreiber (höchstens 20 pro Tag und Familie).
- **Datensicherung** (Statistik, je Familie): „Sichern“ lädt alle Daten der Familie als JSON herunter (ohne Zugänge und
  Push-Geräte); „Wiederherstellen“ spielt eine Sicherung **derselben** Familie zurück und ersetzt deren Daten (Name, Sperre
  und Zugänge bleiben; alles in einer Transaktion).

**Aufbau:** Kopfzeile mit Logo (scrollt mit). Die Bereiche **Speiseplan · Einkaufsliste · Rezepte · Favoriten · Einstellungen**
stehen immer mit Symbol und Text da: am Handy als feste Tab-Leiste unten (Plan · Einkauf · Rezepte · Favoriten ·
Einstellungen), ab Tablet-Breite als Leiste unter dem Logo. Oben fest bleibt nur die Wochenauswahl. Der gewählte Bereich
bleibt beim Neuladen erhalten (URL-Hash, z. B. `#einkaufsliste`). Beim Laden zeigt der Speiseplan Platzhalter-Karten,
bis die Gerichte da sind.
Design „Aubergine“: Pflaume als Hauptfarbe, Koralle als Akzent, Schrift Plus Jakarta Sans.

---

## 1. Speiseplan

- **Heute-Karte** oben: heutiges Gericht groß mit Bild, „Rezept“ und „Kochmodus“, darunter das Gericht von morgen. Ist heute
  nichts geplant, steht dort direkt „Gericht planen“.
  Gestern (bzw. heute ab der Erinnerungszeit, spätestens ab 18 Uhr) noch nicht bewertet? Direkt dort mit Sternen bewerten. Der heutige Tag ist im Plan markiert.
- **Plan erstellen** für einen Zeitraum (nächster Tag, nächste Woche, nächster Monat oder frei gewählt). Bei Plänen über mehrere Wochen
  filtert eine **KW-Auswahl** die Ansicht; vergangene Wochen sind ausgeblendet und lassen sich mit „Frühere“ wieder einblenden.
- **Plan teilen** („Teilen“ oben neben „Herunterladen“): Nur-Lese-Link ohne Zugang (`/?plan=<token>`, in der Datenbank nur
  der Hash in `meal_plans.share_hash`). Zeigt Familienname, Gerichte mit Bild, Zeit, Nachtisch, Brotzeit und aufklappbarem
  Rezept (4 Portionen) – keine Einkaufsliste, keine Bewertungen. Neuer Link macht den alten ungültig; „Link zurückziehen“
  sperrt ihn; „Alle tauschen“ behält den Link.
- **Wochen-Rückblick** (Sonntag: laufende Woche, Montag/Dienstag: Vorwoche; ab zwei gekochten Gerichten): Anzahl gekocht
  und Brotzeiten, Lieblingsgericht (höchste Sterne ab 4), noch nicht bewertete Gerichte zum Antippen. Mit × pro Woche
  ausblendbar (auf dem Gerät gemerkt). Logik `src/lib/weekReview.ts`.
- **Saison-Hinweis:** Gerichtkarten im Plan zeigen Zutaten, die am Plan-Tag Saison haben (z. B. „Kürbis“, Koralle mit
  Spross-Symbol). Saison-Liste in `src/lib/season.ts`, dieselbe wie für den Schwerpunkt „saisonal“.
- Tagesrhythmus: Sa/So aufwendigere **Wochenend**-Gerichte, unter der Woche abwechselnd **vegetarisch** und **Fleisch/Fisch**.
- Gerichtkarte: Bild, Typ, Zubereitungszeit, Bewertung, ggf. Nachtisch. Gerichte mit Fisch oder Meeresfrüchten (ohne Fleisch)
  heißen „Fisch“ statt „Fleisch“ – im Plan, auf den Rezeptkarten, in der Rezeptansicht und in der KI-Vorschau
  (`lib/dishType.ts`, `DishTypeLabel`; auch im Plan-Download). Beim Auswählen (Filter „Art“, Bearbeiten, KI-Wunsch) bleibt „Fleisch & Fisch“. Farbbalken nur aus der Palette: Vegetarisch Pflaume,
  Fleisch Koralle, Fisch helle Koralle, Wochenende dunkle Aubergine, Brotzeit neutral grau. Aktionen als beschriftete
  Leiste unten in der Karte (`CardActionBar`):
  - **Merken** (Favorit) · **Nachtisch** (dazu/ändern) · **Tauschen** (nur austauschen) · **Ausblenden** (mit Rückfrage wie in den Rezepten; kommt nicht mehr in den Plan, gleiche Liste wie „Ausgeblendete Gerichte“ unter Rezepte; 8 Sek. lang „Rückgängig“, `POST /plan-meals/:id/unreject`)
  - **Verlegen** (oder Tag leeren): Gericht auf einen anderen Tag legen – steht dort schon eins, tauschen beide;
    auch bis 2 Wochen nach Planende (der Plan wird verlängert). Oder „Tag leeren – nicht kochen“: Gericht kommt aus dem
    Plan (nicht ausgeblendet), die Zutaten verschwinden von der Einkaufsliste.
- Unter dem Plan: **Neuen Zeitraum planen** (Hauptknopf), daneben zurückhaltend **Alle tauschen** (gleicher Zeitraum) und **Plan löschen**, beide mit Bestätigung.
- **Plan herunterladen:** „Herunterladen“ neben dem Zeitraum öffnet den ganzen Plan als Druckseite (Übersicht, alle Rezepte
  mit auf die Familie umgerechneten Zutaten und Zubereitung, Nachtische) → „Als PDF speichern“. Ohne Pop-up als HTML-Datei.
- **Rückfrage vor dem Ersetzen:** Läuft der Plan noch, fragen „Alle tauschen“ und „Neuen Zeitraum planen“ nach –
  mit „Vorher herunterladen“, damit die Rezepte zum schon erledigten Einkauf nicht verloren gehen.
- **Plan verlängern statt ersetzen** (in der Rückfrage bei „Neuen Zeitraum planen“): Der laufende Plan wird auf den neuen
  Zeitraum erweitert. Geplante Tage bleiben – auch Gerichte, die man in die Zukunft verschoben hat –, ebenso bewusst
  leere Tage („Tag leeren“ oder Gericht weg verschoben). Nur freie Tage bekommen ein Gericht; Abwechslung, Fleisch-Grenze
  und Turnus-Favoriten berücksichtigen die schon geplanten Gerichte. „Neuen Plan erstellen“ ersetzt wie bisher alles.
- **Leere Tage bleiben sichtbar:** Tage ohne Gericht (geleert, verschoben oder nicht geplant) stehen im Plan als schmale Zeile
  „leer, nichts geplant“ mit „Gericht planen“ (füllt nur diesen Tag, ohne automatische Brotzeit); freie Wochentage als
  „frei (Wochentag)“.
- **Nur leere Tage füllen** (in der Rückfrage bei „Alle tauschen“): gleicher Zeitraum, aber nur Tage
  ohne Gericht werden geplant – z. B. die Lücke, die ein in die Zukunft verschobenes Gericht hinterlässt. Mit „Tag leeren“
  freigemachte Tage bleiben frei.
- **Gäste pro Tag:** In der Rezept-Ansicht eines Plan-Gerichts „Gäste an diesem Tag“ (+/−). Die Portionen dieses Gerichts,
  die Einkaufsliste und der Export rechnen die Gäste mit ein; die Karte im Plan zeigt „+2“. Bleibt beim Austauschen am Tag.
- **Rezept-Ansicht:** Bild mit Quellenangabe, Zutaten mit **Portionen-Umrechnung** (Familie: Erwachsene 1, Kinder je nach Alter
  ½ bis 1 Portion; per +/− änderbar), Zubereitung Schritt für Schritt, Bewertung.
- **Eure Bewertung mit Kommentar:** In jeder Rezept-Ansicht (Plan, Rezepte, Favoriten) stehen unter „Eure Bewertung“
  Sterne, Datum und Kommentar („zu scharf für die Kinder“). „Ändern“ öffnet das Bewerten-Fenster mit Sternen und
  Kommentar vorausgefüllt. In der Rezept-Übersicht zeigen Kacheln Sterne und ein Sprechblasen-Symbol, bei den Favoriten
  steht der Kommentar direkt unter dem Gericht.
- **Kochmodus** (Knopf in jeder Rezept-Ansicht): Vollbild mit großer Schrift, erst Zutaten zum Abhaken, dann ein Schritt
  pro Seite. Zeitangaben im Text („15–20 Min.“) werden zu Timer-Knöpfen; laufende Timer bleiben sichtbar und klingeln/
  vibrieren. Der Bildschirm bleibt an (wo der Browser das kann). Am Ende: „Gericht bewerten“.

### Wie die Gerichte ausgewählt werden

- **Rezept-Pool:** feste Grundsammlung (383 Gerichte, davon 231 übersetzte TheMealDB-Rezepte mit Originalfoto)
  + KI-Rezepte + importierte Rezepte + Favoriten.
- **Bewertung je Gericht:** Sterne, Vorlieben und Abneigungen der Familie (mit Oberbegriffen: „Fisch“ trifft auch Lachs),
  Ernährungs-Schwerpunkte, Favoriten-Bonus, Abzug für Gerichte der letzten 3 Wochen.
- **Gesundheitsbedingungen** schließen hart aus: vegetarisch, vegan, glutenfrei, laktosefrei, Nussallergie, ohne Alkohol;
  Diabetes gibt einen Abzug bei Zucker. *Heuristik auf Zutatentext, keine Allergie-Garantie.*
- **Abwechslung:** ähnliche Gerichte (z. B. mehrere „Quinoa-Pfannen“) werden im Plan verteilt statt gehäuft.
- **Favoriten mit Turnus** werden fest eingeplant, sobald sie wieder dran sind.
- **KI-Rezepte** (Workers AI, Llama 3.3 70B): pro Plan einige neue Rezepte für Abwechslung bzw. wenn passende Kandidaten
  fehlen (z. B. bei vegan). Jedes wird von unseren Filtern nachgeprüft und landet im Pool. Die neuesten Kommentare
  aus euren Bewertungen (bis zu 12) gehen als Rückmeldung mit in die Anfrage – die KI lernt daraus (Schärfe, Zutaten,
  Aufwand …), auch beim Rezept nach Wunsch.

### Bilder

Reihenfolge: Originalfoto (TheMealDB-Rezepte) → KI-Bild (FLUX.1, mit englischer Bildbeschreibung aus Name, Typ und Zutaten)
→ Ersatzfoto aus Pexels/Pixabay/Openverse, wenn das tägliche KI-Kontingent aufgebraucht ist. Fotos aus Datenbanken
werden mit Quellenangabe gezeigt und nur übernommen, wenn sie zum Rezept passen: das Gericht selbst ist zu sehen (bei
„Suppe“, „Pfanne“, „Teller“ … auch das Besondere, z. B. „Falafel“), und das Foto zeigt nichts Auffälliges, das nicht im
Rezept ist (Pommes beim Kartoffelsalat, Brokkoli/Tofu, Kürbis, Frühstück …). Von mehreren Treffern gewinnt der mit den
meisten passenden Zutaten; „Neues Bild“ liefert nie wieder dasselbe Foto. Gespeichert in Neon.

- **Bilder pro Familie:** Grundsätzlich teilen sich alle Familien ein Bild pro Gericht. **„Neues Bild“** und **„Bild
  entfernen“** gelten aber nur für die eigene Familie (eigene Fassung), die anderen behalten ihr Bild. Beim Umbenennen
  eines Gerichts wird das Bild für den neuen Namen kopiert. Chefkoch-Fotos importierter Rezepte gehören der Familie.
- **Bild entfernen** (Symbol neben „Neues Bild“, mit Rückfrage): Das Gericht hat dann kein Bild, das Foto kommt nicht
  wieder. „Bild generieren“ sucht ein anderes; bei Gerichten im Speiseplan erstellt der Cron ein KI-Bild, sobald wieder
  Kontingent da ist (kein Ersatzfoto mehr).
- Beim ersten Cron-Lauf nach dem Update werden vorhandene Ersatzfotos einmal mit den neuen Regeln nachgeprüft.

## 2. Einkaufsliste

- **Gemeinsam einkaufen:** Häkchen werden gespeichert; ist die Liste offen, holt sie alle 10 Sekunden (und beim Zurückkehren
  in die App) die Häkchen und Einträge der anderen. Kurzer Hinweis „Liste aktualisiert – … von anderen“.
- Entsteht automatisch aus dem Plan: Zutaten auf die Familienportionen umgerechnet und zusammengefasst
  („6 Zwiebeln“, „2 Dosen Kokosmilch“), Stückware aufgerundet. Unterschiedliche Schreibweisen landen auf einer Zeile
  („Knoblauch (2 Zehen)“ + „2 Knoblauchzehen“, „Paprika (1 rote)“ + „3 Paprikaschoten“; Menge in Klammern zählt).
- **„Einkauf für“:** eigene Wochenauswahl („Diese Woche“, „Nächste Woche“ …), mehrere Wochen kombinierbar; Häkchen je Woche.
  Gerichte vergangener Tage zählen standardmäßig nicht mit (Hinweis unter der Zusammenfassung mit „einrechnen“;
  `?since=` an `GET /plans/:id/shopping`, die Häkchen bleiben dabei erhalten).
- **„⋯“ an jedem Eintrag:** Produkt auswählen, „Haben wir immer da“ (Vorrat), in andere Liste, Entfernen (eigene Artikel).
- **Abgehakt:** steht zusammengeklappt unten in jeder Liste („7 erledigt“), sind alle abgehakt: „Alles erledigt“.
- **Listen:** Lieferdienst (Knuspr/Picnic), Metzger (Fleisch automatisch, abschaltbar), eigene Listen (Aldi, DM …).
  Zuordnungen pro Zutat werden für künftige Pläne gemerkt. Listen sind auf- und zuklappbar.
- **PDF:** Listen ohne Shop (Metzger, Aldi, DM …) über das PDF-Symbol im Kopf der jeweiligen Liste herunterladen –
  nur offene Einträge, mit Kästchen zum Abhaken, Umlaute und € passen.
- **Vorrat** (ein Bereich unter den Listen): alles, was ihr immer im Haus habt – kommt nicht automatisch auf die Liste.
  Vorbelegt mit Salz, Pfeffer, Öl, Mehl, Brühe, Tomatenmark und gängigen Gewürzen; eigene Einträge per Eingabefeld
  „Zum Vorrat“ oder „⋯“ an einer Zutat → „Haben wir immer da“. Gelb = braucht der Plan, kurz nachschauen. **Antippen = ist alle** →
  auf eine Liste setzen (abgehakt wandert es zurück in den Vorrat). **Bearbeiten** → Eintrag antippen nimmt ihn aus dem
  Vorrat (auch Standard-Einträge); er kommt dann wieder auf die Liste, wenn ein Rezept ihn braucht. Wieder eintippen holt
  ihn zurück. Eigene Artikel per Eingabefeld in den Listen.
- **Lieferdienst-Liste:** pro Artikel ein Preis-Knopf je Shop, der günstigere ist markiert; Antippen ordnet den Artikel zu.
  Ist nur ein Shop verbunden, heißt die Liste wie der Shop (z. B. „Knuspr“).
- **Produkt-Dialog:** sucht gleichzeitig bei Knuspr und Picnic, zeigt Packung, Preis und **Grundpreis** (€/kg, €/l, €/Stk.)
  und wie viele Packungen nötig sind.
- **Preisvergleich der ganzen Liste** mit Empfehlung unter Berücksichtigung von **Mindestbestellwert** und **Liefergebühr**;
  Artikel lassen sich gesammelt zum günstigeren Shop verschieben.
- **Warenkorb-Leiste** unten: aktueller Warenkorbwert je Shop und Fortschritt zum Mindestbestellwert.
- **Warenkorb bei Knuspr und Picnic:** Artikel mit Menge übertragen, im Warenkorb Mengen ändern, entfernen, leeren;
  Artikel, die schon im Warenkorb liegen, sind markiert.

## 3. Rezepte

- **Hauptgerichte:** Kachel-Übersicht aller planbaren Gerichte mit Suche und Filter. Gericht einem Tag im Plan zuordnen;
  Gerichte ausblenden. Gerichte, die nicht zu den Gesundheitseinstellungen passen (z. B. Nudeln bei glutenfrei), sind
  standardmäßig versteckt und lassen sich einblenden – sie werden nie automatisch geplant.
- **Filter-Fenster** (Knopf „Filter“ neben der Suche, Zahl = aktive Filter): alle Filter an einer Stelle, in Gruppen –
  **Art** (Vegetarisch, Fleisch & Fisch, Wochenende), **Speiseart** (Auflauf, Eintopf, Suppe, Pasta, Pizza, Salat, Curry,
  Pfanne & Wok, Burger & Wraps, Braten & Schnitzel, Eierspeise, Mehlspeisen), **Hauptzutat** (Nudeln, Reis, Kartoffeln,
  Geflügel, Rind, Schwein, Lamm, Fisch, Krustentiere & Muscheln, Gemüse, Hülsenfrüchte, Käse) und **Meine Filter**.
  In einer Gruppe darf man mehreres wählen (Rind *oder* Schwein), die Gruppen gelten zusammen (Pasta *und* Rind). Die Zahl
  am Knopf sagt, wie viele Gerichte es damit gäbe; Knöpfe ohne Treffer sind ausgegraut. Gewählte Filter stehen als
  Chips unter der Suche (einzeln entfernen oder „Alle löschen“).
- **Kategorien:** Speiseart und Hauptzutat erkennt die App an Name und Zutaten (`lib/recipeCategories.ts`; Würzzutaten wie
  Hühnerbrühe oder Fischsauce zählen nicht, Hackfleisch ohne Angabe zählt zu Rind und Schwein). Liegt sie daneben, im
  Rezept unter „Kategorien“ → „Filter anpassen“ an- oder abwählen (gilt nur für die eigene Familie) (gespeichert in `recipe_category_overrides`, zieht beim
  Umbenennen mit).
- **Sortierung** (Auswahl rechts über der Liste, auf dem Gerät gemerkt): Empfohlen (Favoriten, gut bewertete und
  saisonale Gerichte zuerst, schlecht bewertete hinten; `lib/recipeSort.ts`), Beste Bewertung, Schnellste zuerst, A–Z.
- **Rezept hinzufügen** (Knopf oben in der Übersicht) bündelt drei Wege: Bei Chefkoch suchen, Mit KI erstellen,
  Von einem Link importieren (`AddRecipeSheet`).
- **Rezept mit KI erstellen** (über „Rezept hinzufügen“): Wunsch eingeben („etwas mit Kürbis, schnell“), Art wählen
  oder „Egal“ → Vorschau. „Anderer Vorschlag“, über den Stift anpassen, dann „In die Sammlung“ (optional als Favorit).
  Gesundheitseinstellungen und Abneigungen werden beachtet und geprüft; das Bild entsteht im Hintergrund.
- **KI-Kontingent leer:** „Rezept mit KI erstellen“ zeigt dann einen Hinweis (wann es neu anläuft) und bietet „Stattdessen bei
  Chefkoch suchen“ an – die Chefkoch-Suche öffnet sich mit dem Wunsch als Suchbegriff.
- **Was hab ich da?** (Knopf in der Übersicht): Zutaten mit Komma eingeben („Zucchini, Feta, Reis“) → Gerichte aus der
  Sammlung, die möglichst viele davon verwenden (Plural egal, ohne KI, nur passende zu den Gesundheitseinstellungen).
  Antippen öffnet das Rezept; die letzte Eingabe bleibt auf dem Gerät gemerkt.
- **Bei Chefkoch suchen** (über „Rezept hinzufügen“): Suchbegriff plus Filter (Hauptspeise, Vegetarisch, Vegan,
  bis 30 Min, ab 4 ★, beste zuerst) → je 12 Treffer mit Foto, Bewertung und Zeit, „Mehr laden“ holt die nächsten 12. Antippen zeigt die Vorschau
  (Name änderbar, Zutaten auf 4 Portionen umgerechnet, Zubereitung, Hinweis bei unpassenden Gesundheitseinstellungen, „schon da“);
  „In meine Rezepte übernehmen“ speichert es mit Chefkoch-Foto und Link zum Original (optional als Favorit) und führt
  zurück zur Trefferliste (weitere Rezepte übernehmen). Pfeil, Escape oder Tipp daneben = zurück zur Liste.
  Abgerufen wird nur bei einer Suche (je Suche die Ergebnisseite plus bis zu 12 Rezepte, in Vierergruppen).
- **Rezept-Ansicht in der Übersicht:** Bild erzeugen bzw. neues Bild, **Gericht bearbeiten** (Stift: Name, Art, Zeit,
  Zutaten, Zubereitung; gilt auch für kommende Plan-Tage und den Favoriten; Gerichte der Sammlung lassen sich auf das
  Original zurücksetzen) und **eigene Filter zuordnen** (Filter-Knöpfe unter dem Bild).
- **Blättern** in der Rezept-Ansicht (Hauptgerichte und Nachtische): Pfeile oben, Pfeiltasten ← → oder übers Bild
  wischen; es geht durch die aktuell gefilterte Liste („12 / 383“), die Übersicht dahinter läuft mit.
- **Nachtische:** 161 Rezepte – 124 übersetzte Desserts aus TheMealDB mit Fotos und 37 Alltags-Nachtische (Cremes &
  Pudding, Obst, warme Süßspeisen, neue Kategorie „Eis & Kaltes“). Deren Bilder entstehen im Hintergrund (2 pro Cron-Lauf)
  oder per „Bild generieren“ im Rezept. Mit fester Menge;
  im Speiseplan per Kuchen-Knopf an ein Gericht hängen (erst Rezept ansehen, dann hinzufügen).
- **Eigene Nachtische:**
  - „Nachtisch bei Chefkoch suchen“ (oben in den Nachtischen): wie die Chefkoch-Suche, mit Filter „Dessert“. Zutaten
    bleiben in Originalmenge, „Menge“ laut Rezept (z. B. „1 Kuchen“). Kategorie wird geschätzt und lässt sich ändern;
    mit Foto und Link zum Original.
  - Falsch einsortiertes Hauptgericht: „Gericht bearbeiten“ → Art **„Nachtisch“** → Kategorie und Menge →
    „Zu den Nachtischen verschieben“. Es verschwindet aus den Hauptgerichten, Bild und Rezept kommen mit.
  - Eigene Nachtische stehen zwischen den übrigen, lassen sich an Gerichte hängen, ausblenden und endgültig löschen.
- **Ausblenden und endgültig löschen** (Hauptgerichte und Nachtische gleich): Auge-Symbol an der Kachel blendet aus
  (mit Rückfrage). Unten unter „Ausgeblendete Gerichte/Nachtische“: „Einblenden“ oder Papierkorb = **endgültig löschen**
  (nicht wiederherstellbar; eigene/KI-/importierte Rezepte verschwinden aus der Datenbank, Gerichte und Nachtische der
  festen Sammlung werden dauerhaft ausgeschlossen). Im Speiseplan nimmt das ✕ in der Nachtisch-Zeile den Nachtisch vom Tag.

## 4. Favoriten

- Gemerkte Gerichte mit eigenem Rezept, **Turnus** (kein / 1–4 Wochen) und „zuletzt geplant“.
- **Rezept aus dem Web importieren** (auch unter Rezepte → „Rezept hinzufügen“): Link einfügen (Chefkoch & Co., schema.org-Rezeptdaten) → Vorschau prüfen → speichern.
  Mengen werden auf 4 Portionen umgerechnet, der Typ geschätzt.

## 5. Einstellungen

Die Karten sind in Gruppen mit kleiner Überschrift geordnet (`SettingsGroup`): **Familie & Ernährung**
(Familienmitglieder, Gesundheit & Ernährung, Hinweise), **Planung** (Wochentage, Routinen, Rezept-Filter, Erinnerung),
**Einkaufen** (Shops, Einkaufslisten), **Konto** (Zugänge, Feedback) und – nur für den Betreiber – **Administration**
(Familien, Statistik, Meldungen).

Auf- und zuklappbare Karten:
- **Neue Rezepte von Chefkoch** (Einstellungen → Planung, Schalter pro Familie): täglich bis zu 10 neue Hauptspeisen aus
  „Neueste ab 4,5 ★“ (`chefkoch.de/rs/s0t21r4.5o6/…`), nur mit mind. 4,5 Sternen und 2 Bewertungen, passend zu Gesundheit und
  „Kommt nie in den Plan“, nicht schon vorhanden/ausgeblendet (Dubletten-Prüfung über den Link bzw. die Chefkoch-Rezeptnummer, `sourceKey`; gelöschte Chefkoch-Rezepte merkt sich `chefkoch_auto_skipped`, damit sie nicht wiederkommen). Übernahme wie „In meine Rezepte übernehmen“ (Foto + Link). Läuft im
  Cron ab der eingestellten Uhrzeit (`profiles.chefkoch_auto_time`, Standard 6:00, Berliner Zeit, nur 15-Minuten-Schritte) in Portionen (je Lauf höchstens 6 Rezeptseiten); Geprüftes, aber Unpassendes merkt sich `chefkoch_auto_skipped`.
  Übernommene Rezepte sind unter Rezepte → Gerichte mit „Neu“ markiert (`recipes.auto_review`): Banner mit „Nur neue zeigen“ und
  „Alle behalten“; im geöffneten Rezept „Behalten“ oder „Ausblenden“ (Blättern in der „Nur neue“-Liste). Bis zur Prüfung werden sie
  wie eigene Rezepte mit eingeplant. „Jetzt Rezepte holen“ startet eine Portion von Hand (`POST /profile/chefkoch-auto/run`, auch bei
  ausgeschalteter Automatik, Tageslimit gilt). Fehlt einem übernommenen Rezept das Foto, holt `healChefkochPhotos` es im Cron nach
  (höchstens 5 Versuche je Rezept, `recipes.photo_attempts`; ein entferntes Foto bleibt weg).
- **Kommt nie in den Plan** (in „Gesundheit & Ernährung“ und beim Ausblenden): Hauptzutaten, die die ganze Familie nicht will
  (Fisch, Meeresfrüchte, Lamm, Schwein, Rind, Geflügel; `profiles.family_dislikes`, `worker/dislikes.ts`). Solche Gerichte werden
  nie geplant, nie getauscht, nicht von der KI erzeugt und stehen in den Rezepten unter „passen nicht“. Beim Ausblenden erkennt die
  App die Hauptzutat und bietet „Nur dieses Gericht“ oder „Keinen Fisch mehr vorschlagen“ (`HideMealDialog`).
- **Abneigungen einzelner Familienmitglieder** („Mag nicht“): Abzug beim Planen; ausgeschlossen erst, wenn die Mehrheit der
  Familienmitglieder sie teilt.
- **Gesundheit & Ernährung:**
  - **Schwerpunkte** (mehrere): Kalorienbewusst, Proteinreich, Low Carb, Viel Gemüse, Vollkorn & Ballaststoffe,
    Kinderfreundlich, Saisonal, Günstig – passende Gerichte bekommen Pluspunkte, nichts wird ausgeschlossen.
  - **Einschränkungen** (mehrere): Diabetes (nur Abzug bei Zucker), glutenfrei, laktosefrei, Nussallergie, vegetarisch,
    vegan, ohne Alkohol – schließen hart aus.
  - **Fleisch pro Woche:** keine Grenze, kein Fleisch oder höchstens 1–5× pro Kalenderwoche (Fisch zählt nicht mit);
    gilt beim Planen und beim „Alle tauschen“.
- **Familienmitglieder:** Name, Erwachsener/Kind mit Alter, mag/mag nicht – anlegen, bearbeiten, löschen (mit Bestätigung).
- **Routinen:** wöchentlich oder monatlich automatisch einen neuen Plan erstellen (Cron alle 15 Minuten, deutsche Zeit).
- **Einkaufslisten verwalten:** eigene Listen anlegen, umbenennen, umfärben, löschen.
- **Eigene Rezept-Filter:** Name, Suchbegriffe und/oder maximale Zubereitungszeit, für Gerichte, Nachtische oder beide;
  bearbeiten und löschen. Einzelne Gerichte werden im Rezept zugeordnet oder ausgenommen (auch ganz ohne Suchbegriffe).
  Gedacht für alles, was Art/Speiseart/Hauptzutat nicht abdecken (Vorschläge „Schnell“, „Lieblingsessen der Kinder“,
  „Für Gäste“, „Schokolade“). Die früheren eigenen Filter Nudeln, Reis, Huhn, Rind und Schwein wurden mit Migration 0012
  durch die festen Hauptzutaten ersetzt; ihre Hand-Zuordnungen wurden dabei als Korrekturen übernommen.
- **Wochentage:** pro Wochentag „Normal“, „Frei – nicht planen“ (auswärts essen, Reste) oder „höchstens 15/20/30/45/60 Min“.
  Freie Tage bleiben im Plan leer (schmale Zeile „frei“, Heute-Karte „Heute ist frei“); an Tagen mit Zeitlimit kommen
  nur Gerichte, die reinpassen (bekannte Zeit zuerst). Gilt für neue Pläne, Routinen und „Alle tauschen“.
- **Brotzeit:** Tage ohne Kochen – reiner Platzhalter „Brotzeit“, nichts auf der Einkaufsliste, kein Bild, keine Bewertung.
  Drei Wege: Wochentag auf „Brotzeit“ stellen (immer), **„Brotzeit pro Woche“** (0–4×; feste Tage zählen mit, die Planung
  verteilt den Rest – bevorzugt Tage mit Zeitlimit, dann Mo–Fr, möglichst auseinander; bei angebrochenen Wochen anteilig)
  oder im Plan beim Kalender-Knopf „Brotzeit statt Kochen“. Auf der Brotzeit-Karte holt „Doch kochen“ (Kochmütze) ein Gericht
  aus der Sammlung zurück (KI nur, wenn nichts passt).
- **Erinnerung zum Bewerten:** pro Gerät einschalten, Uhrzeit wählen (Standard 20:00), Test senden. Abends kommt eine
  Benachrichtigung, wenn das heutige Gericht noch keine Sterne hat (höchstens einmal am Tag). Ein Tipp darauf öffnet
  direkt das Bewerten-Fenster für dieses Gericht. iPhone: nur mit der
  installierten App vom Home-Bildschirm.
- **Einkaufen & Shops:** Standard-Liste, Metzger-Automatik, Knuspr und Picnic verbinden (Picnic ggf. mit SMS-Code),
  Mindestbestellwert und Liefergebühr je Shop. Zugangsdaten werden verschlüsselt gespeichert.

## 6. Technik im Überblick

| Bereich | Wo |
|---|---|
| API-Routen (nach Bereich) | `worker/api.ts` → `worker/routes/` |
| Planung, Einkaufsliste, Shop-Konten, Cron | `worker/planning.ts`, `worker/shoppingList.ts`, `worker/shopAccounts.ts`, `worker/routines.ts` |
| Rezepte, Auswahl, Filter | `worker/meals.ts`, `worker/recipes/` |
| KI-Rezepte / Import / Bilder | `worker/aiRecipes.ts`, `worker/recipeImport.ts`, `worker/images.ts` |
| Einkaufsliste berechnen | `worker/shopping.ts` |
| Knuspr/Picnic | `worker/shops.ts` |
| Frontend-Zustand / Serveraufrufe | `src/App.tsx`, `src/lib/api.ts` |
| Push-Erinnerung | `worker/push.ts`, `worker/webpush.ts`, `public/sw.js`, `src/components/ReminderSettings.tsx` |
| Kochmodus / Heute-Karte | `src/components/CookingMode.tsx`, `src/components/TodayCard.tsx`, `src/lib/cooking.ts` |
| Nachtische | `src/data/desserts.ts` |
| Datenbank-Schema | `worker/migrations/` (der Worker migriert selbst, siehe `CLAUDE.md`) |
| App installierbar | `public/manifest.webmanifest`, `public/sw.js` |

## 7. Bekannte Grenzen

- **Knuspr und Picnic** nutzen inoffizielle Schnittstellen und können jederzeit ausfallen. Läuft die Picnic-Sitzung ab,
  muss neu verbunden werden (ggf. mit SMS-Code).
- **Workers-AI-Kontingent** (Free: 10.000 Neurons/Tag) teilen sich KI-Rezepte und Bilder. Ist es aufgebraucht, kommen Bilder
  aus Fotodatenbanken und es entstehen bis zum nächsten Tag keine neuen KI-Rezepte. Den Verbrauch zeigt die Karte
  „Statistik“ (geschätzt, siehe oben).
- **Amazon** ist bewusst nicht angebunden (keine Suche/Warenkorb aus Apps möglich).
- **Gesundheitsfilter** sind eine Heuristik, keine zertifizierte Allergie-Absicherung.
- Routinen lassen sich nur anlegen und löschen, nicht bearbeiten.
- Automatische Tests decken die Kernlogik ab (Einkaufsliste, Portionen, Gesundheitsfilter, Auswahl, Grundpreis,
  Rezept-Import), nicht aber Oberfläche, Datenbank und Shop-Anbindung.
