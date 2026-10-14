// Alle Migrationen in fester Reihenfolge. Neue Datei anlegen (nächste Nummer) und hier unten anhängen.
// Bereits ausgelieferte Migrationen nie mehr ändern – stattdessen eine neue schreiben.
import basis from "./0001_basis";
import rezepteBearbeiten from "./0002_rezepte_bearbeiten";
import pushErinnerung from "./0003_push_erinnerung";
import schwerpunkte from "./0004_schwerpunkte";
import tagesRegeln from "./0005_tages_regeln";
import neuGenerierenVerlauf from "./0006_neu_generieren_verlauf";
import nachtischeAusblenden from "./0007_nachtische_ausblenden";

export interface Migration {
  /** Eindeutig und aufsteigend, z. B. "0002_kochmodus" */
  id: string;
  /** SQL-Befehle, laufen zusammen in einer Transaktion */
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  { id: "0001_basis", statements: basis },
  { id: "0002_rezepte_bearbeiten", statements: rezepteBearbeiten },
  { id: "0003_push_erinnerung", statements: pushErinnerung },
  { id: "0004_schwerpunkte", statements: schwerpunkte },
  { id: "0005_tages_regeln", statements: tagesRegeln },
  { id: "0006_neu_generieren_verlauf", statements: neuGenerierenVerlauf },
  { id: "0007_nachtische_ausblenden", statements: nachtischeAusblenden },
];
