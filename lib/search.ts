/**
 * Location search via OneMap.
 *
 * OneMap's search endpoint answers without an API token (it just adds a nag
 * field to the JSON) and sends CORS headers, which is why FlyClear needs no
 * OneMap credentials and no backend.
 */

const ONEMAP_SEARCH = 'https://www.onemap.gov.sg/api/common/elastic/search';

/** One OneMap hit, trimmed to what the UI needs. */
export type Place = { name: string; address: string; lat: number; lng: number };

type OneMapResult = {
  SEARCHVAL: string;
  ADDRESS: string;
  LATITUDE: string;
  LONGITUDE: string;
};

/** `signal` lets the caller cancel an in-flight search when the query changes. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  // Single characters match half of Singapore and are never what the user meant.
  if (query.trim().length < 2) return [];

  const url = `${ONEMAP_SEARCH}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Location search is unavailable right now.');

  const body = (await response.json()) as { results?: OneMapResult[] };
  return (body.results ?? []).slice(0, 8).map((hit) => ({
    name: hit.SEARCHVAL,
    address: hit.ADDRESS,
    lat: Number(hit.LATITUDE),
    lng: Number(hit.LONGITUDE),
  }));
}
