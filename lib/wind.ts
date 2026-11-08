/**
 * NEA wind observations via data.gov.sg.
 *
 * Two endpoints, one station network (17 stations island-wide), identical
 * response shape:
 *   .../v2/real-time/api/wind-speed      -> knots
 *   .../v2/real-time/api/wind-direction  -> degrees
 *
 * Direction follows the meteorological convention: the compass bearing the wind
 * blows *from*, not the way it travels. 90 means an easterly.
 *
 * They are two separate datasets, so one wind reading costs two API calls. That
 * is the reason lib/rateLimit.ts budgets calls rather than checks.
 */

// Explicit .ts extension so `node --test` can load this module directly: Node's
// type stripping does no TypeScript-style extension guessing.
import { distanceM, type LatLng } from './geo.ts';

const SPEED_URL = 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed';
const DIRECTION_URL = 'https://api-open.data.gov.sg/v2/real-time/api/wind-direction';

/** Knots are what NEA reports; drone wind ratings are quoted in m/s. */
export const KNOTS_TO_MS = 0.514444;

/** Shape of the bits of the data.gov.sg response we actually use. */
type ReadingBlock = {
  timestamp: string;
  data: { stationId: string; value: number }[];
};

type WindData = {
  stations?: {
    id: string;
    name: string;
    location: { latitude: number; longitude: number };
  }[];
  readings?: ReadingBlock[];
};

type WindResponse = { code: number; errorMsg: string; data?: WindData };

/** One station reporting both a speed and a direction. */
export type WindReading = {
  stationId: string;
  stationName: string;
  lat: number;
  lng: number;
  /** Metres from the user's selected point. */
  distanceM: number;
  speedKnots: number;
  speedMs: number;
  /** Degrees the wind blows *from*. */
  directionDeg: number;
  /** 16-point compass label for `directionDeg`, e.g. "NE". */
  fromCompass: string;
};

export type WindResult = {
  /** Stations inside the circle that reported both values, nearest first. */
  stations: WindReading[];
  /**
   * The reading the status card headlines and the verdict uses: the strongest
   * wind in the circle, because a pre-flight call should follow the worst case
   * rather than the most convenient one.
   */
  headline: WindReading | null;
  /** True when no station sat inside the circle, so `headline` is the nearest one outside it. */
  headlineOutsideRadius: boolean;
  /** NEA's own reading timestamp, so the UI can show data age. */
  observedAt: string | null;
};

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** Bearing in degrees -> 16-point compass label. Each point spans 22.5 degrees. */
export function compassPoint(degrees: number): string {
  const normalised = ((degrees % 360) + 360) % 360;
  return COMPASS_16[Math.round(normalised / 22.5) % 16];
}

/**
 * Fetch one of the two datasets.
 *
 * Throws on failure so the caller can report "wind check unavailable" rather
 * than silently implying calm air.
 */
async function fetchWindDataset(url: string, label: string): Promise<WindData> {
  // No API key here on purpose: this runs in the browser, so any key would be
  // public. `no-store` because the brief forbids caching results.
  const response = await fetch(url, { cache: 'no-store' });

  if (response.status === 429) {
    throw new Error(`data.gov.sg rate limit hit on ${label}. Wait a moment and check again.`);
  }
  if (!response.ok) {
    throw new Error(`data.gov.sg returned HTTP ${response.status} for ${label}.`);
  }

  const body = (await response.json()) as WindResponse;
  if (body.code !== 0) {
    throw new Error(body.errorMsg || `data.gov.sg returned an error for ${label}.`);
  }
  return body.data ?? {};
}

/** Latest reading block, flattened to stationId -> value. */
function toValueByStation(readings: ReadingBlock[] | undefined): Map<string, number> {
  const byStation = new Map<string, number>();
  // The API returns the newest block first; without a `date` there is only one.
  for (const entry of readings?.[0]?.data ?? []) {
    const value = Number(entry.value);
    if (Number.isFinite(value)) byStation.set(entry.stationId, value);
  }
  return byStation;
}

/**
 * Read wind around `centre`, preferring stations inside the circle.
 *
 * Singapore has only 17 wind stations, so a 2 km circle often contains none. In
 * that case we fall back to the nearest station island-wide and flag it, rather
 * than reporting no wind data at all — a distant reading clearly labelled as
 * distant is more useful than a blank.
 */
export async function fetchWindNear(centre: LatLng, radiusM: number): Promise<WindResult> {
  // Two calls, fired together. Both are reserved from the rate-limit budget
  // before either goes out — see runCheck in lib/check.ts.
  const [speed, direction] = await Promise.all([
    fetchWindDataset(SPEED_URL, 'wind speed'),
    fetchWindDataset(DIRECTION_URL, 'wind direction'),
  ]);

  const speedByStation = toValueByStation(speed.readings);
  const directionByStation = toValueByStation(direction.readings);

  const readings = (speed.stations ?? [])
    .map((station) => {
      const speedKnots = speedByStation.get(station.id);
      const directionDeg = directionByStation.get(station.id);
      // A station missing either half can't describe the wind, so drop it.
      if (speedKnots === undefined || directionDeg === undefined) return null;

      const point = {
        lat: Number(station.location.latitude),
        lng: Number(station.location.longitude),
      };
      return {
        stationId: station.id,
        stationName: station.name,
        ...point,
        distanceM: distanceM(centre, point),
        speedKnots,
        speedMs: speedKnots * KNOTS_TO_MS,
        directionDeg,
        fromCompass: compassPoint(directionDeg),
      };
    })
    .filter((reading): reading is WindReading => reading !== null)
    .sort((a, b) => a.distanceM - b.distanceM);

  const inRadius = readings.filter((reading) => reading.distanceM <= radiusM);
  // `readings` is sorted nearest-first, so slice(0, 1) is the nearest station.
  const pool = inRadius.length > 0 ? inRadius : readings.slice(0, 1);

  return {
    stations: inRadius,
    headline: pool.reduce<WindReading | null>(
      (strongest, reading) =>
        strongest === null || reading.speedKnots > strongest.speedKnots ? reading : strongest,
      null,
    ),
    headlineOutsideRadius: inRadius.length === 0 && pool.length > 0,
    observedAt: speed.readings?.[0]?.timestamp ?? null,
  };
}
