# Projektübersicht – Familien-Speiseplaner

Deutschsprachige App für die Essensplanung einer Familie: Speiseplan, Rezepte, Nachtische, Einkaufsliste mit
Preisvergleich und Warenkorb bei Knuspr und Picnic. Läuft unter https://meal-plan.davidshille.workers.dev/ und lässt
sich auf dem Handy als App installieren.

**Technik:** React + Vite + TypeScript + Tailwind · Cloudflare Worker (API, Zeitplan, KI) · Neon Postgres.
Entwickler-Infos stehen in `CLAUDE.md`, die Einrichtung in `SETUP_NEON_CLOUDFLARE.md`.

**Zugang:** ein gemeinsames Familien-Passwort (Secret `APP_PASSWORD`), kein Login mit Konten.

**Aufbau:** Kopfzeile mit Logo, darunter die Bereiche **Speiseplan · Einkaufsliste · Rezepte · Favoriten · Einstellungen**
als Segment-Leiste. Der gewählte Bereich bleibt beim Neuladen erhalten (URL-Hash, z. B. `#einkaufsliste`).
Design „Aubergine“: Pflaume als Hauptfarbe, Koralle als Akzent, Schrift Plus Jakarta Sans.

---

## 1. Speiseplan

- **Plan erstellen** für einen Zeitraum (nächster Tag, nächste Woche, nächster Monat oder frei gewählt). Bei Plänen über mehrere Wochen
  filtert eine **KW-Auswahl** die Ansicht.
- Tagesrhythmus: Sa/So aufwendigere **Wochenend**-Gerichte, unter der Woche abwechselnd **vegetarisch** und **Fleisch/Fisch**.
- Gerichtkarte: Bild, Typ, Zubereitungszeit, Bewertung, ggf. Nachtisch. Aktionen:
  - **♥ Merken** (Favorit) · **↻ Neu generieren** (nur austauschen) · **✕ Ablehnen** (kommt nie wieder) · **Kuchen** (Nachtisch dazu)
- **Komplett neuen Plan generieren** für denselben Zeitraum; **Plan löschen** mit Bestätigung.
- **Rezept-Ansicht:** Bild mit Quellenangabe, Zutaten mit **Portionen-Umrechnung** (Familie: Erwachsene 1, Kinder je nach Alter
  ½ bis 1 Portion; per +/− änderbar), Zubereitung Schritt für Schritt, Bewertung.

### Wie die Gerichte ausgewählt werden

- **Rezept-Pool:** feste Grundsammlung (383 Gerichte, davon 231 übersetzte TheMealDB-Rezepte mit Originalfoto)
  + KI-Rezepte + importierte Rezepte + Favoriten.
- **Bewertung je Gericht:** Sterne, Vorlieben und Abneigungen der Familie (mit Oberbegriffen: „Fisch“ trifft auch Lachs),
  Gesundheitsziel, Favoriten-Bonus, Abzug für Gerichte der letzten 3 Wochen.
- **Gesundheitsbedingungen** schließen hart aus: vegetarisch, vegan, glutenfrei, laktosefrei, Nussallergie, koscher, halal;
  Diabetes gibt einen Abzug bei Zucker. *Heuristik auf Zutatentext, keine Allergie-Garantie.*
- **Abwechslung:** ähnliche Gerichte (z. B. mehrere „Quinoa-Pfannen“) werden im Plan verteilt statt gehäuft.
- **Favoriten mit Turnus** werden fest eingeplant, sobald sie wieder dran sind.
- **KI-Rezepte** (Workers AI, Llama 3.3 70B): pro Plan einige neue Rezepte für Abwechslung bzw. wenn passende Kandidaten
  fehlen (z. B. bei vegan). Jedes wird von unseren Filtern nachgeprüft und landet im Pool.

### Bilder

Reihenfolge: Originalfoto (TheMealDB-Rezepte) → KI-Bild (FLUX.1, mit englischer Bildbeschreibung aus Name, Typ und Zutaten)
→ Ersatzfoto aus Pexels/Pixabay/Openverse, wenn das tägliche KI-Kontingent aufgebraucht ist. Fotos aus Datenbanken
werden nur übernommen, wenn sie wirklich zum Gericht passen, und mit Quellenangabe gezeigt. Gespeichert in Neon.

## 2. Einkaufsliste

- Entsteht automatisch aus dem Plan: Zutaten auf die Familienportionen umgerechnet und zusammengefasst
  („6 Zwiebeln“, „2 Dosen Kokosmilch“), Stückware aufgerundet.
- **„Einkauf für“:** eigene Wochenauswahl („Diese Woche“, „Nächste Woche“ …), mehrere Wochen kombinierbar; Häkchen je Woche.
- **Listen:** Lieferdienst (Knuspr/Picnic), Metzger (Fleisch automatisch, abschaltbar), eigene Listen (Aldi, DM …).
  Zuordnungen pro Zutat werden für künftige Pläne gemerkt. Listen sind auf- und zuklappbar.
- **Basics & Vorrat:** Salz, Gewürze, Öl usw. kommen nicht auf die Liste; gelb markiert, wenn der Plan sie braucht.
  Eigener Vorrat per Kisten-Symbol („haben wir immer da“). Eigene Artikel per Eingabefeld.
- **Lieferdienst-Liste:** pro Artikel ein Preis-Knopf je Shop, der günstigere ist markiert; Antippen ordnet den Artikel zu.
- **Produkt-Dialog:** sucht gleichzeitig bei Knuspr und Picnic, zeigt Packung, Preis und **Grundpreis** (€/kg, €/l, €/Stk.)
  und wie viele Packungen nötig sind.
- **Preisvergleich der ganzen Liste** mit Empfehlung unter Berücksichtigung von **Mindestbestellwert** und **Liefergebühr**;
  Artikel lassen sich gesammelt zum günstigeren Shop verschieben.
- **Warenkorb-Leiste** unten: aktueller Warenkorbwert je Shop und Fortschritt zum Mindestbestellwert.
- **Warenkorb bei Knuspr und Picnic:** Artikel mit Menge übertragen, im Warenkorb Mengen ändern, entfernen, leeren;
  Artikel, die schon im Warenkorb liegen, sind markiert.

## 3. Rezepte

- **Hauptgerichte:** Kachel-Übersicht aller planbaren Gerichte, Suche und Filter (Typ, eigene Filter). Gericht einem Tag
  im Plan zuordnen; Gerichte ausblenden. Gerichte, die nicht zu den Gesundheitseinstellungen passen (z. B. Nudeln bei
  glutenfrei), sind standardmäßig versteckt und lassen sich einblenden – sie werden nie automatisch geplant.
- **Rezept-Ansicht in der Übersicht:** Bild erzeugen bzw. neues Bild, **Gericht bearbeiten** (Stift: Name, Art, Zeit,
  Zutaten, Zubereitung; gilt auch für kommende Plan-Tage und den Favoriten; Gerichte der Sammlung lassen sich auf das
  Original zurücksetzen) und **eigene Filter zuordnen** (Filter-Knöpfe unter dem Bild).
- **Nachtische:** 124 übersetzte Desserts mit Fotos (Kuchen & Torten, Gebäck, Cremes & Pudding …), mit fester Menge;
  im Speiseplan per Kuchen-Knopf an ein Gericht hängen (erst Rezept ansehen, dann hinzufügen).

## 4. Favoriten

- Gemerkte Gerichte mit eigenem Rezept, **Turnus** (kein / 1–4 Wochen) und „zuletzt geplant“.
- **Rezept aus dem Web importieren:** Link einfügen (Chefkoch & Co., schema.org-Rezeptdaten) → Vorschau prüfen → speichern.
  Mengen werden auf 4 Portionen umgerechnet, der Typ geschätzt.

## 5. Einstellungen

Auf- und zuklappbare Karten:
- **Gesundheit & Ernährung:** Ziel und Einschränkungen.
- **Familienmitglieder:** Name, Erwachsener/Kind mit Alter, mag/mag nicht – anlegen, bearbeiten, löschen (mit Bestätigung).
- **Routinen:** wöchentlich oder monatlich automatisch einen neuen Plan erstellen (Cron alle 15 Minuten, deutsche Zeit).
- **Einkaufslisten verwalten:** eigene Listen anlegen, umbenennen, umfärben, löschen.
- **Eigene Rezept-Filter:** Name, Suchbegriffe und/oder maximale Zubereitungszeit, für Gerichte, Nachtische oder beide;
  bearbeiten und löschen. Einzelne Gerichte werden im Rezept zugeordnet oder ausgenommen (auch ganz ohne Suchbegriffe).
  Vorschläge u. a. „Fisch“ und „Fleisch“ – die festen Arten „Vegetarisch / Fleisch & Fisch / Wochenende“ steuern den
  Wochenrhythmus und bleiben unverändert.
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
| Nachtische | `src/data/desserts.ts` |
| Datenbank-Schema | `worker/migrations/` (der Worker migriert selbst, siehe `CLAUDE.md`) |
| App installierbar | `public/manifest.webmanifest`, `public/sw.js` |

## 7. Bekannte Grenzen

- **Knuspr und Picnic** nutzen inoffizielle Schnittstellen und können jederzeit ausfallen. Läuft die Picnic-Sitzung ab,
  muss neu verbunden werden (ggf. mit SMS-Code).
- **Workers-AI-Kontingent** (Free: 10.000 Neurons/Tag) teilen sich KI-Rezepte und Bilder. Ist es aufgebraucht, kommen Bilder
  aus Fotodatenbanken und es entstehen bis zum nächsten Tag keine neuen KI-Rezepte.
- **Amazon** ist bewusst nicht angebunden (keine Suche/Warenkorb aus Apps möglich).
- **Gesundheitsfilter** sind eine Heuristik, keine zertifizierte Allergie-Absicherung.
- Routinen lassen sich nur anlegen und löschen, nicht bearbeiten.
- Automatische Tests decken die Kernlogik ab (Einkaufsliste, Portionen, Gesundheitsfilter, Auswahl, Grundpreis,
  Rezept-Import), nicht aber Oberfläche, Datenbank und Shop-Anbindung.
