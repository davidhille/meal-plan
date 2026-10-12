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
- Gerichte können **abgelehnt** werden — ein passender Ersatz wird automatisch ausgewählt, gespeichert und in der Ansicht ersetzt
- Bilder können pro Gericht generiert werden (auf Klick im Detail-Fenster)
- Wochenumschalter oben, um zwischen Wochen zu wechseln

### 1.2 Einkaufsliste (Tab: „einkaufsliste")

- Zutaten werden automatisch aus dem Wochenplan übernommen
- Vorgefertigte Labels (Einkaufsquellen):
  - „Knuspr" (grün)
  - „Metzger" (orange)
- Eigene Labels lassen sich mit frei wählbarer Farbe hinzufügen (z. B. Aldi, Rewe, DM)
- „Basics & Vorrat" — vordefinierte Grundzutaten (Salz, Pfeffer, Öl, Mehl, Gewürze …) können per Klick einer Einkaufsliste zugeordnet werden
- Zutaten können abgehakt werden („erledigt")
- Status wird pro Woche gespeichert
- Amazon-Integration:
  - Zutat anklicken → Amazon-Suchvorschläge (Autovervollständigung) werden angezeigt
  - ASIN auswählen und speichern
  - Mit einem Klick alle Artikel eines Labels in den Amazon-Warenkorb legen
- **Persistierung:** Aktuell über den Browser-Speicher (localStorage), nicht in der Datenbank. Daten gehen verloren beim Browser- oder Gerätewechsel.

### 1.3 Einstellungen (Tab: „einstellungen")

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
- Wiederkehrende automatische Plan-Erstellung
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

### 2.3 `generate-meal-image`
Erzeugt ein Lebensmittel-Foto für ein Gericht.

**Ablauf:**
1. Prüfen, ob bereits ein Bild im Cache (`meal_images`) existiert
2. Falls nicht: Bild-URL über Pollinations.ai generieren (kostenlos, kein API-Key)
   - Prompt: „Professional food photography of [Gericht], German home-cooked dish, warm lighting, plated on white ceramic, top-down angle"
   - Deterministischer Seed aus dem Gerichtsnamen
3. Bild-URL in `meal_images` cachen
4. Optional mit dem Gericht in `plan_meals` verknüpfen

---

## 3. Bildgenerierung

Zwei Wege sind angelegt, die aber **nicht automatisch** bei der Planerstellung laufen:

| Weg | Ort | Technologie | Auslöser |
|---|---|---|---|
| Edge Function | Server | Pollinations.ai (kostenlos) | Aufruf der Funktion |
| Browser-seitig | Client | Puter.js (`puter.ai.txt2img`, Flux-Schnell) | Klick im Gericht-Detailfenster |

Beide Wege cachen das Ergebnis in der Tabelle `meal_images`.

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
├── data/
│   └── mealData.ts              # Statische Wochen-Daten (Fallback)
├── lib/
│   ├── api.ts                   # API-Aufrufe an /api (Cloudflare → Neon)
│   └── amazon.ts                # Amazon-Suche & Warenkorb-URL-Builder
└── components/
    ├── Header.tsx               # Kopfzeile
    ├── WeekSelector.tsx         # Wochenumschalter
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
└── api.ts                       # Komplette API (Profil, Familie, Pläne, Bilder …)

neon/schema.sql                  # Datenbank-Schema
wrangler.jsonc                   # Cloudflare-Konfiguration
```

---

## 7. Bekannte Lücken & Hinweise

- **Einkaufsliste nutzt localStorage** statt Datenbank — Daten gehen verloren beim Browser- oder Gerätewechsel oder beim Leeren des Caches.
- **Bilder werden nicht automatisch** bei der Planerstellung generiert, sondern nur auf manuellen Klick im Gericht-Detailfenster.
- **Amazon-Suche** nutzt die öffentliche Amazon-Autovervollständigung ohne API-Key — instabil, kann von Amazon geblockt werden.
- **Gerichtedatenbank** ist fest in den Edge Functions hinterlegt (~23 Rezepte), nicht in der Datenbank — Änderungen erfordern Code-Anpassungen.
- **Routinen** können angelegt, aber nicht aktiv bearbeitet werden (kein Edit, nur Löschen). Die automatische Ausführung einer Routine (z. B. per Cron) ist nicht implementiert.

---

## 8. Potentielle Erweiterungen

- Einkaufsliste in Neon persistieren (statt localStorage)
- Bilder automatisch bei der Planerstellung generieren
- Gerichtedatenbank in eine eigene Tabelle auslagern
- Routinen per Cron/Scheduler automatisch ausführen lassen
- Eigene Gerichte hinzufügen können
- Nährwertberechnung pro Gericht und Tag
- Einkaufsliste teilen (z. B. als Link oder mit anderen Haushaltsmitgliedern)
