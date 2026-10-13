import type { NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Datenbank-Zugriff, wie ihn `neon(env.DATABASE_URL)` liefert: Zeilen als Objekte, kein Array-Modus.
 * (`ReturnType<typeof neon>` wäre zu allgemein – dann kennt TypeScript den Ergebnistyp der Abfragen nicht.)
 */
export type Sql = NeonQueryFunction<false, false>;

/** Eine Ergebniszeile (Spaltenname → Wert), wie sie Neon liefert */
export type Row = Awaited<ReturnType<Sql>>[number];
