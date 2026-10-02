/**
 * NEA lightning observations via data.gov.sg.
 *
 * Endpoint: https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning
 * Updated every 2 minutes, with a few minutes of transmission delay. Calling it
 * with no `date` returns the most recent observation window.
 */

import { distanceM, type LatLng } from './geo';

const LIGHTNING_URL =
  'https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning';

/** Shape of the bits of the data.gov.sg response we actually use. */
type LightningResponse = {
  code: number;
  errorMsg: string;
  data?: {
    records?: {
      datetime: string;
      updatedTimestamp: string;
      item: {
        readings?: {
          location: { latitude: string; longitude: string };
          datetime: string;
          /** Human-readable, e.g. "Cloud to Cloud". */
          text: string;
          /** "C" = cloud-to-cloud, "G" = cloud-to-ground. */
          type: string;
        }[];
      };
    }[];
  };
};

export type Strike = {
  lat: number;
  lng: number;
  /** Metres from the user's selected point. */
  distanceM: number;
  datetime: string;
  text: string;
  type: string;
};

export type LightningResult = {
  strikes: Strike[];
  /** When NEA last refreshed the data, so the UI can show data age. */
  observedAt: string | null;
};

/**
 * Fetch the latest observations and keep only the strikes inside the circle.
 *
 * Throws on network/API failure so the caller can report "lightning check
 * unavailable" rather than silently implying a clear sky.
 */
export async function fetchLightningInRadius(
  centre: LatLng,
  radiusM: number,
): Promise<LightningResult> {
  // No API key here on purpose: this runs in the browser, so any key would be
  // public. The keyless quota is 6 calls / 10 seconds per IP, and lib/rateLimit
  // keeps us well inside it.
  //
  // `no-store` matters: the brief is explicit that results are never cached, and
  // stale weather is the one thing this app must not show.
  const response = await fetch(LIGHTNING_URL, { cache: 'no-store' });

  if (response.status === 429) {
    throw new Error('data.gov.sg rate limit hit. Wait a moment and check again.');
  }
  if (!response.ok) {
    throw new Error(`data.gov.sg returned HTTP ${response.status}.`);
  }

  const body = (await response.json()) as LightningResponse;
  if (body.code !== 0) {
    throw new Error(body.errorMsg || 'data.gov.sg returned an error.');
  }

  // There is normally one record (the latest 2-minute window), but the API can
  // return several, so flatten them all and let the radius filter do the work.
  const records = body.data?.records ?? [];
  const strikes = records
    .flatMap((record) => record.item.readings ?? [])
    .map((reading) => {
      const point = {
        lat: Number(reading.location.latitude),
        lng: Number(reading.location.longitude),
      };
      return {
        ...point,
        distanceM: distanceM(centre, point),
        datetime: reading.datetime,
        text: reading.text,
        type: reading.type,
      };
    })
    .filter((strike) => strike.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);

  return { strikes, observedAt: records[0]?.updatedTimestamp ?? null };
}
