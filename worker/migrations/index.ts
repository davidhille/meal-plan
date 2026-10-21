// Alle Migrationen in fester Reihenfolge. Neue Datei anlegen (nächste Nummer) und hier unten anhängen.
// Bereits ausgelieferte Migrationen nie mehr ändern – stattdessen eine neue schreiben.
import basis from "./0001_basis";
import rezepteBearbeiten from "./0002_rezepte_bearbeiten";
import pushErinnerung from "./0003_push_erinnerung";
import schwerpunkte from "./0004_schwerpunkte";
import tagesRegeln from "./0005_tages_regeln";
import neuGenerierenVerlauf from "./0006_neu_generieren_verlauf";
import nachtischeAusblenden from "./0007_nachtische_ausblenden";
import nachtischeLoeschen from "./0008_nachtische_loeschen";
import bewertungDatum from "./0009_bewertung_datum";
import bildEntfernen from "./0010_bild_entfernen";
import eigeneNachtische from "./0011_eigene_nachtische";
import kategorienKorrekturen from "./0012_kategorien_korrekturen";
import geleerteTage from "./0013_geleerte_tage";
import vorratHerausnehmen from "./0014_vorrat_herausnehmen";
import zugaenge from "./0015_zugaenge";

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
  { id: "0008_nachtische_loeschen", statements: nachtischeLoeschen },
  { id: "0009_bewertung_datum", statements: bewertungDatum },
  { id: "0010_bild_entfernen", statements: bildEntfernen },
  { id: "0011_eigene_nachtische", statements: eigeneNachtische },
  { id: "0012_kategorien_korrekturen", statements: kategorienKorrekturen },
  { id: "0013_geleerte_tage", statements: geleerteTage },
  { id: "0014_vorrat_herausnehmen", statements: vorratHerausnehmen },
  { id: "0015_zugaenge", statements: zugaenge },
];
