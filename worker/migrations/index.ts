// Alle Migrationen in fester Reihenfolge. Neue Datei anlegen (nächste Nummer) und hier unten anhängen.
// Bereits ausgelieferte Migrationen nie mehr ändern – stattdessen eine neue schreiben.
import basis from "./0001_basis";
import rezepteBearbeiten from "./0002_rezepte_bearbeiten";

export interface Migration {
  /** Eindeutig und aufsteigend, z. B. "0002_kochmodus" */
  id: string;
  /** SQL-Befehle, laufen zusammen in einer Transaktion */
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  { id: "0001_basis", statements: basis },
  { id: "0002_rezepte_bearbeiten", statements: rezepteBearbeiten },
];
