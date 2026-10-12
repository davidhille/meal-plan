# Projektübersicht — Meal-Planning-App

Eine deutschsprachige App zur automatisierten Essensplanung für Familien mit Wochenplan, Einkaufsliste und persönlichen Einstellungen.

**Technologie-Stack:** React + Vite + TypeScript, Tailwind CSS, Lucide React (Icons), Neon (Postgres) + Cloudflare Worker (`/api`), geschützt per Familien-Passwort

---

## 1. Hauptfunktionen

Die App hat drei Hauptbereiche, die über einen Tab-Switcher erreichbar sind.

### 1.1 Speiseplan (Tab: „speiseplan")

- Wochenansicht mit Gerichten für jeden Tag (Mo–So)
- Drei Gericht-Typen:
  - `vegetarisch` — vegetarische Gerichte
  - `fleisch` — Fleischgerichte
  - `wochenende` — aufwendigere Gerichte fürs Wochenende
- Klick auf ein Gericht öffnet ein Detail-Fenster (MealModal) mit:
  - Zutatenliste
  - Zubereitungsanleitung
  - Sterne-Bewertung (1–5)
- Pro Gericht: **Merken** (Favorit), **Ablehnen** (kommt nie wieder, Ersatz wird eingesetzt) und **Neu generieren** (nur austauschen)
- **Komplett neuen Plan generieren** ersetzt den Plan für denselben Zeitraum
- Bilder werden automatisch erzeugt (siehe Abschnitt 3) und lassen sich im Detail-Fenster neu generieren
- Der zuletzt erstellte Plan wird beim Öffnen geladen; über „Plan löschen“ (mit Bestätigung) lässt er sich entfernen
- **Portionen:** Alle Rezepte sind für 4 Portionen geschrieben. Im Detail-Fenster werden die Mengen auf die Familie umgerechnet (Erwachsene 1, Kinder bis 6 Jahre ½, 7–12 Jahre ¾, ab 13 Jahre 1 Portion) und lassen sich per +/− anpassen

### 1.2 Einkaufsliste (Tab: „einkaufsliste")

- Wird automatisch aus dem aktuellen Plan berechnet (`worker/shopping.ts`):
  - Zutaten aller nicht abgelehnten Gerichte, auf die Familienportionen umgerechnet
  - Gleiche Zutaten werden zusammengefasst (z. B. 2× Zwiebel → „6 Zwiebeln"), Stückware wird aufgerundet
  - Fleisch landet standardmäßig beim „Metzger", alles andere bei „Knuspr"
  - Vorrat (Salz, Pfeffer, Öl, Gewürze, Brühe …) kommt nicht auf die Liste, sondern unter „Basics & Vorrat" – gelb markiert, wenn der Plan ihn braucht
- Ersatzgerichte (nach Ablehnung) fließen automatisch ein
- Abhaken, Liste wechseln, eigene Listen (Aldi, Rewe, DM …) mit Farbe, eigene Artikel („Klopapier"), Basics bei Bedarf auf eine Liste setzen
- **Gemerkte Zuordnungen:** Wird eine Zutat einmal auf eine andere Liste gesetzt oder mit einem Amazon-Produkt verknüpft, gilt das auch für künftige Pläne
- „Kopieren" kopiert alle offenen Einträge einer Liste als Text
- Amazon-Integration: Zutat anklicken → Amazon-Suchvorschläge → Produkt verknüpfen → „Warenkorb" öffnet alle offenen verknüpften Artikel
- **Persistierung:** komplett in Neon (Tabellen `shopping_labels`, `shopping_item_state`, `shopping_extras`, `ingredient_prefs`) – auf allen Geräten gleich

### 1.3 Favoriten (Tab: „favoriten")

- Gemerkte Gerichte mit eigenem Rezept (auch wenn es nicht in der festen Liste steht)
- **Turnus:** kein Turnus / jede Woche / alle 2, 3 oder 4 Wochen
  - Mit Turnus: wird bei jeder Planung fest eingeplant, sobald es wieder „dran“ ist (bevorzugt an einem passenden Tag)
  - Ohne Turnus: bekommt bei der Planung einen Bonus
- `favorites.last_planned` merkt sich, wann das Gericht zuletzt im Plan stand

### 1.4 Einstellungen / Profil (Tab: „einstellungen")

#### Gesundheitsprofil
- Gesundheitsziel (`health_goal`):
  - `balanced` — Ausgewogene Ernährung
  - `weight_loss` — Gewichtsabnahme
  - `muscle_gain` — Muskelaufbau
  - `healthy_lifestyle` — Gesunder Lebensstil
- Gesundheitsbedingungen (`health_conditions`, mehrere wählbar):
  - Diabetes, glutenfrei, laktoseintolerant, Nussallergie, vegetarisch, vegan, koscher, halal

#### Familienmitglieder
- Name, Typ (Erwachsener/Kind), Alter
- Gemochte Speisen (`favorite_foods`) — beeinflusst die automatische Auswahl positiv
- Unbeliebte Speisen (`disliked_foods`) — führt zu Abzug bei der Bewertung
- Hinzufügen und Löschen möglich

#### Routinen
- Wiederkehrende automatische Plan-Erstellung – läuft per Cloudflare-Cron (alle 15 Min geprüft)
- Wöchentlich am gewählten Wochentag bzw. monatlich am 1., sobald die Uhrzeit (deutsche Zeit) erreicht ist
- Erzeugt einen Plan ab dem Folgetag über die eingestellte Dauer; pro Tag höchstens einmal (`last_run_at`)
- Einstellbar:
  - Name (z. B. „Wochenplan")
  - Häufigkeit: wöchentlich oder monatlich
  - Wochentag (0–6) und Uhrzeit
  - Planungsdauer in Tagen
- Routinen können gelöscht werden

#### Plan erstellen
- Start- und Enddatum wählen
- Edge Function generiert einen personalisierten Plan
- Nach Erstellung wird automatisch zum Speiseplan-Tab gewechselt

---

## 2. Automatische Essensplanung (Server)

Die Logik liegt in `worker/meals.ts` und wird von `worker/api.ts` genutzt (Routen `POST /api/plans`, `POST /api/plan-meals/:id/reject`). Abschnitte 2.1–2.3 beschreiben die fachliche Logik (ursprünglich Supabase Edge Functions).

### 2.1 `generate-plan`
Erstellt für einen Zeitraum einen individuellen Speiseplan.

**Ablauf:**
1. Profil, Familienmitglieder, Bewertungen und abgelehnte Gerichte laden
2. Für jeden Tag im Zeitraum ein Gericht auswählen
3. Bewertungsscoring (`scoreMeal`) pro Gericht:
   - Basiswert: 50 Punkte
   - Abgelehnte Gerichte: sofort ausgeschlossen (−1)
   - Hohe Bewertung: +10 pro Stern
   - Familien-Favoriten: +15 pro Treffer
   - Unbeliebte Speisen: −30 pro Treffer
   - Kinderfreundlichkeit: Bonus für einfache Fleischgerichte bei kleinen Kindern
   - Vegetarisch/Vegan-Bedingungen: Gerichte mit Fleisch oder Fisch werden ausgeschlossen
   - Glutenfrei: Gerichte mit glutenhaltigen Zutaten (Nudeln, Brot, Mehl, Teig, Sojasoße …) werden ausgeschlossen
   - Abneigungen verstehen Oberbegriffe (z. B. „Fisch“ trifft Lachs, „Pilze“ trifft Champignons)
   - Gewichtsabnahme: Bonus für vegetarische Gerichte, Abzug für Sahne/Butter/Käse
   - Muskelaufbau: Bonus für Fleischgerichte und proteinreiche Zutaten
4. Tagesabhängige Typ-Auswahl:
   - Samstag/Sonntag → `wochenende`
   - Gerade Wochentage → `fleisch`
   - Ungerade Wochentage → `vegetarisch`
5. Vermeidung von Wiederholungen innerhalb eines Plans
6. Plan und Gerichte in der Datenbank speichern

**Gerichtedatenbank:** 31 fest hinterlegte Rezepte (inkl. 9 KI-Rezepte aus dem Backup) mit Zutaten und Zubereitungsanleitung.

### 2.2 `replace-meal`
Lehnt ein Gericht ab und ersetzt es automatisch.

**Ablauf:**
1. Kontext laden (Profil, Familie, Bewertungen, Ablehnungen, Plan-Gerichte)
2. Das abgelehnte Gericht als `rejected = true` markieren
3. Gericht in `rejected_meals` eintragen (zukünftiger Ausschluss)
4. Neue Bewertung mit angepasstem Scoring durchführen (vermeidet Dubletten im selben Plan)
5. Ersatzgericht in die Datenbank einfügen und zurückgeben

### 2.3 Bilder
Siehe Abschnitt 3.

---

## 3. Bildgenerierung

- **Modell:** FLUX.1 schnell über **Cloudflare Workers AI** (Binding `AI` in `wrangler.jsonc`, `worker/images.ts`)
- **Kosten:** Im Cloudflare-Free-Plan sind 10.000 Neurons/Tag enthalten; ein Bild braucht grob 60 → ca. 150 Bilder/Tag. Ist das Kontingent aufgebraucht, wird es beim nächsten Lauf erneut versucht.
- **Automatisch:** Nach „Plan erstellen“ und nach dem Ersetzen eines Gerichts im Hintergrund; zusätzlich füllt der 15-Minuten-Cron fehlende Bilder auf (max. 5 pro Lauf)
- **Ein Bild pro Gericht:** gespeichert in Neon (`meal_images.image_data`, JPEG), ausgeliefert über `/api/images/<Gericht>` (ohne Passwort, mit langem Browser-Cache)
- **Manuell:** Im Rezept „Bild generieren“ bzw. „Neues Bild“
- Die App lädt die Plan-Ansicht nach dem Erstellen einige Male nach, bis alle Bilder da sind

---

## 4. Datenbank (Neon)

Schema: `neon/schema.sql`. Ein gemeinsames Familienprofil, kein RLS – Zugriff nur über die API mit Familien-Passwort.

### Tabellenübersicht

| Tabelle | Zweck | Schlüsselfelder |
|---|---|---|
| `profiles` | Gesundheitsprofil pro Nutzer | `user_id`, `health_goal`, `health_conditions` |
| `family_members` | Familienmitglieder mit Vorlieben | `profile_id`, `name`, `type`, `age`, `favorite_foods`, `disliked_foods` |
| `meal_ratings` | Bewertungen pro Gericht (1–5) | `profile_id`, `meal_name`, `rating`, `notes` |
| `meal_plans` | Generierte Speisepläne | `profile_id`, `start_date`, `end_date`, `status` |
| `plan_meals` | Einzelne Gerichte in einem Plan | `plan_id`, `meal_date`, `meal_name`, `meal_type`, `ingredients`, `instructions`, `rejected`, `image_url` |
| `routines` | Automatische Plan-Erstellungen | `profile_id`, `name`, `frequency`, `day_of_week`, `time`, `duration_days` |
| `rejected_meals` | Abgelehnte Gerichte (Ausschlussliste) | `profile_id`, `meal_name`, `reason` |
| `meal_images` | Bild-Cache pro Gericht | `meal_name`, `image_url` |

Setup-Anleitung: `SETUP_NEON_CLOUDFLARE.md`.

---

## 5. Zugang

- Kein Nutzer-Login, ein gemeinsames Familienprofil
- Familien-Passwort (`APP_PASSWORD` im Worker) wird beim ersten Öffnen abgefragt und im Browser gespeichert
- Jede API-Anfrage schickt es im Header `X-App-Password` mit

---

## 6. Projektstruktur

```
src/
├── App.tsx                      # Hauptkomponente, State-Management, Tab-Steuerung
├── main.tsx                     # Einstiegspunkt
├── index.css                    # Globale Styles
├── types/
│   └── index.ts                 # Alle TypeScript-Typen & Konstanten
├── lib/
│   ├── api.ts                   # API-Aufrufe an /api (Cloudflare → Neon)
│   └── amazon.ts                # Amazon-Suche & Warenkorb-URL-Builder
└── components/
    ├── Header.tsx               # Kopfzeile
    ├── TabSwitcher.tsx          # Tab-Navigation
    ├── MealPlanView.tsx         # Speiseplan-Ansicht
    ├── DayCard.tsx              # Tageskarte im Speiseplan
    ├── MealModal.tsx            # Gericht-Detailfenster
    ├── MealRatingModal.tsx      # Bewertungs-Fenster
    ├── ShoppingListView.tsx     # Einkaufslisten-Ansicht
    ├── ShoppingSection.tsx      # Einkaufslisten-Bereich pro Label
    ├── AmazonPreviewModal.tsx   # Amazon-Suchvorschau
    ├── SettingsView.tsx         # Einstellungs-Ansicht
    ├── PreferencesModal.tsx     # Gesundheitsprofil-Bearbeitung
    ├── FamilyMemberModal.tsx    # Familienmitglied hinzufügen
    ├── RoutineModal.tsx         # Routine anlegen
    └── PlanCreationModal.tsx    # Plan erstellen

worker/
├── index.ts                     # Einstieg: /api → API, sonst statische App
├── meals.ts                     # Rezeptdatenbank + Scoring
├── shopping.ts                  # Einkaufsliste aus Plan berechnen
├── images.ts                    # Rezeptbilder (Workers AI → Neon)
└── api.ts                       # Komplette API (Profil, Familie, Pläne, Bilder …)

neon/schema.sql                  # Datenbank-Schema
wrangler.jsonc                   # Cloudflare-Konfiguration
```

---

## 7. Bekannte Lücken & Hinweise

- **Amazon-Suche** nutzt die öffentliche Amazon-Autovervollständigung ohne API-Key — instabil, kann von Amazon geblockt werden.
- **Gerichtedatenbank** ist fest in den Edge Functions hinterlegt (~23 Rezepte), nicht in der Datenbank — Änderungen erfordern Code-Anpassungen.
- **Routinen** können angelegt, aber nicht bearbeitet werden (kein Edit, nur Löschen).

---

## 8. Potentielle Erweiterungen

- Gerichtedatenbank in eine eigene Tabelle auslagern
- Eigene Gerichte hinzufügen können
- Nährwertberechnung pro Gericht und Tag
- Einkaufsliste teilen (z. B. als Link oder mit anderen Haushaltsmitgliedern)
