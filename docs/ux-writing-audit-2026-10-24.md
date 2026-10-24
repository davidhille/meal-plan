# UX-Writing-Audit miyummy – 24.10.2026

**Umfang:** alle Texte im Code (`src/` und die Fehlermeldungen in `worker/`), nur gelesen und per Suche gesichtet; nicht live durchgeklickt.
**Maßstab:** zweckmäßig, kurz, natürlich, eindeutig; Fehler nach „Was ging schief? Was tun?“; Leerzustände mit nächstem Schritt.

## Befunde

| # | Schwere | Befund | Stand |
|---|---|---|---|
| 1 | Hoch | Netz- und Serverfehler erreichten die Oberfläche roh: „Failed to fetch“ (englisch) bzw. „HTTP 502“. Betraf jede Meldung, die `e.message` anzeigt (rund 45 Stellen). | behoben: `lib/errorText.ts`, genutzt in `request` und `requestPublic` (`lib/api.ts`) |
| 2 | Mittel | Vage Meldungen ohne Gegenstand: „Konnte nicht gespeichert werden.“, „Aktualisieren hat nicht geklappt.“, „Speichern hat nicht geklappt.“, „Die Änderung hat nicht geklappt.“, „Die Suche hat nicht geklappt.“, „2 übertragen, 1 fehlgeschlagen.“ | behoben: nennen jetzt, was nicht ging |
| 3 | Mittel | Zwei Sheet-Titel „Bitte bestätigen“ (Verschieben/Tauschen/Brotzeit/Tag leeren und Nachtisch/Gericht ersetzen) sagten nicht, was bestätigt wird. | behoben: „Tauschen?“, „Verschieben?“, „Brotzeit machen?“, „Tag leeren?“, „Gericht ersetzen?“, „Nachtisch festlegen?“ |
| 4 | Niedrig | Leerzustände ohne Satz: „Keine Einträge“ (Einkaufsliste), „Keine Familienmitglieder hinzugefügt“ (klingt nach Fehler, der Hinweis darunter stimmt) | behoben: „Diese Liste ist leer.“, „Noch keine Familienmitglieder“ |
| 5 | Niedrig | Anrede wechselt zwischen „du“ und „ihr“, auch in einem Absatz (z. B. Vorrat: „Tippe …“ und „Was ihr immer im Haus habt“). Ist kein Fehler, solange die Regel gilt (siehe unten); sie stand nirgends. | Regel in `CLAUDE.md` festgehalten, Texte stimmen damit überein |
| 6 | Niedrig | Server-Meldungen für Entwickler („Name fehlt“, „Angaben fehlen“, `startDate und endDate fehlen`, `unauthorized`) – die Oberfläche prüft diese Felder vorher, sie sind im Alltag nicht sichtbar. | offen, bewusst nicht angefasst |
| 7 | Niedrig | Allgemeiner Rückfall „Das hat nicht geklappt.“ an rund 25 Stellen. Greift seit #1 nur noch, wenn gar keine Meldung ankommt. | offen, kein Handlungsbedarf |

## Bestanden

- **Bestätigungen** nennen die Folge („Zugang entfernen? … kann sich danach nicht mehr anmelden. Eure Pläne und Rezepte bleiben.“), der Knopf trägt das Verb („Entfernen“, „Endgültig löschen“, „Leeren“), gefährliche Aktionen sind rot.
- **Ausblenden-Dialog** erklärt Wirkung und Rückweg, bietet „Nur dieses Gericht“ oder die Hauptzutat für die Familie an.
- **Leerzustände** der Hauptbereiche (Speiseplan, Einkaufsliste, Favoriten, Routinen) erklären und bieten den nächsten Schritt.
- **Server-Fehler für Menschen** (Anmeldung, Kontingent, Einladung) sind verständlich und sagen, was zu tun ist („Zu viele Versuche. Bitte in 15 Minuten noch einmal.“).
- **Knöpfe** sind Verben („Plan erstellen“, „Nur leere Tage füllen“); kein „OK“, „Ja“, „Senden“.

## Anrede-Regel (gilt ab jetzt)

- **Eine Person, ihre Handlung:** du („Tippe auf …“, „Hast du dafür schon eingekauft …“, „Wie hat dir … gefallen?“).
- **Die Familie, Gemeinsames:** ihr/euer („Was hättet ihr gern?“, „Euer KI-Budget ist aufgebraucht“, „Eure Pläne und Rezepte bleiben“, Admin: „(ihr)“).
- **Fehler und Hinweise ohne Handelnde:** neutral („Bitte Netz prüfen …“, „Das Rezept konnte nicht gespeichert werden.“).
- Nie „Sie“.

## Nicht geprüft

- Texte der KI-Rezepte und der festen Rezeptsammlung.
- Push-Nachrichten im Browser, Texte in der Druck-/PDF-Ansicht der Einkaufsliste.
- Verständlichkeit mit echten Nutzerinnen (z. B. „Brotzeit“, „Vorrat“, „Pool“ – `FavoritesView` sagt noch „Rezept-Pool“).
