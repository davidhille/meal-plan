export interface AmazonSuggestion {
  value: string;
  asin?: string;
}

export async function searchAmazon(query: string): Promise<AmazonSuggestion[]> {
  const url = `https://completion.amazon.de/search/complete?q=${encodeURIComponent(query)}&search-alias=aps&mkt=4`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();

    // Amazon autocomplete returns [query, [suggestions], ...extra arrays]
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
      return [];
    }

    const suggestions: string[] = data[1];
    // data[2] may contain ASINs corresponding to suggestions
    const asins: string[] = Array.isArray(data[2]) ? data[2] : [];

    return suggestions.slice(0, 5).map((value: string, idx: number) => ({
      value,
      asin: asins[idx] || undefined,
    }));
  } catch {
    return [];
  }
}

export function buildAmazonCartUrl(asins: string[]): string {
  if (asins.length === 0) return '';
  const params = asins.map((asin, idx) => `ASIN.${idx + 1}=${asin}&Quantity.${idx + 1}=1`).join('&');
  return `https://www.amazon.de/gp/cart/aws-callback.html?${params}`;
}
