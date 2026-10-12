// Amazon blockiert Live-Suchen von Apps/Servern (Erkenntnis aus der Juli-Version).
// Deshalb öffnet ein Klick einfach die normale Amazon-Suche in einem neuen Tab.
export function buildAmazonSearchUrl(query: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(query)}`;
}
