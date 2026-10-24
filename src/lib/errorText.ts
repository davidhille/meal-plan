// Verständliche Fehlertexte für Serveraufrufe (reine Rechnung, damit testbar). Muster: Was ging schief? Was tun?

/** Browser meldet „Failed to fetch“ & Co.: Netz weg, Server nicht erreichbar */
export const NETWORK_ERROR = 'Keine Verbindung zum Server. Bitte Netz prüfen und noch einmal versuchen.';

/** Lesende Anfrage hat das Zeitlimit überschritten */
export const TIMEOUT_ERROR = 'Der Server antwortet gerade nicht. Bitte gleich noch einmal versuchen.';

/** Text zu einem Fehler von `fetch` selbst (nicht zu einer Antwort mit Fehlerstatus) */
export function fetchErrorText(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError' ? TIMEOUT_ERROR : NETWORK_ERROR;
}

/**
 * Text zu einer Antwort mit Fehlerstatus. Eine Meldung vom Server (schon auf Deutsch, z. B. „E-Mail oder Passwort stimmt nicht.“)
 * hat Vorrang; ohne sie (HTML-Fehlerseite, leere Antwort) gibt es einen Text nach Status statt „HTTP 502“.
 */
export function httpErrorText(status: number, serverText?: unknown): string {
  if (typeof serverText === 'string' && serverText.trim()) return serverText.trim();
  if (status === 429) return 'Zu viele Anfragen. Bitte kurz warten und noch einmal versuchen.';
  if (status >= 500) return 'Der Server hat gerade ein Problem. Bitte gleich noch einmal versuchen.';
  if (status === 403) return 'Das ist hier nicht erlaubt.';
  if (status === 404) return 'Das wurde nicht gefunden – vielleicht gibt es es nicht mehr.';
  return 'Das hat nicht geklappt. Bitte noch einmal versuchen.';
}
