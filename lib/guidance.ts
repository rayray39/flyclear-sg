/**
 * Turns the two raw checks into the wording shown on the status card.
 *
 * House rule on wording: we never say a location is safe or legal. The strongest
 * positive statement allowed is "nothing was detected" — see context.md.
 */

import type { RestrictedZone } from './zones';

/** Drives the colour of the status card. */
export type Verdict = 'do-not-fly' | 'caution' | 'nothing-detected';

/** Distance thresholds from NEA guidance, in metres. */
const VERY_NEAR = 2_000;
const NEARBY = 5_000;

/**
 * Wind thresholds in knots, the unit NEA reports.
 *
 * Anchored on the Beaufort scale and on what consumer hardware is rated for.
 * Most popular consumer drones claim "Level 5" wind resistance, which tops out
 * around 10.7 m/s (~21 kt). Beaufort 6 begins at 22 kt — past that rating — and
 * Beaufort 5 (17 kt) is where a light airframe starts fighting to hold station.
 */
const MODERATE_WIND_KT = 11; // Beaufort 4: noticeable drift
const FRESH_WIND_KT = 17; // Beaufort 5: at the limit of many consumer drones
const STRONG_WIND_KT = 22; // Beaufort 6: above what most are rated for

export function lightningMessage(nearestStrikeM: number | null): string {
  if (nearestStrikeM === null) {
    return 'No recent lightning observation found within the selected radius.';
  }
  if (nearestStrikeM <= VERY_NEAR) {
    return 'Lightning observed very near this location. Do not fly.';
  }
  if (nearestStrikeM <= NEARBY) {
    return 'Lightning observed nearby. Flying is not recommended.';
  }
  return 'Lightning observed within 10 km. Monitor conditions closely.';
}

/**
 * `speedKnots` is the strongest wind found, not the average: a pre-flight call
 * should follow the worst reading in the area rather than the kindest one.
 */
export function windMessage(speedKnots: number | null): string {
  if (speedKnots === null) {
    return 'No wind reading available for this area. Treat wind as unknown.';
  }
  if (speedKnots >= STRONG_WIND_KT) {
    return 'Wind is above the limit most consumer drones are rated for. Do not fly.';
  }
  if (speedKnots >= FRESH_WIND_KT) {
    return 'Wind is at the limit of many consumer drones. Flying is not recommended.';
  }
  if (speedKnots >= MODERATE_WIND_KT) {
    return 'Moderate wind. Expect noticeable drift and shorter flight time.';
  }
  return 'Light wind at the reporting station. Gusts are not captured by this reading.';
}

export function zoneMessage(zones: RestrictedZone[]): string {
  if (zones.length === 0) {
    return 'No restricted area detected within the selected radius. Green does not mean permission is granted.';
  }
  if (zones.some((zone) => zone.containsCentre)) {
    return 'Your selected point is inside a restricted area. Check the red areas on the map.';
  }
  return 'Restricted areas fall within your selected radius. Check the red areas on the map.';
}

/**
 * `windKnots` is null when the wind check failed or no station reported, which
 * is "unknown", not "calm" — so it escalates nothing on its own.
 */
export function verdict(
  nearestStrikeM: number | null,
  zones: RestrictedZone[],
  windKnots: number | null,
): Verdict {
  const insideRestrictedArea = zones.some((zone) => zone.containsCentre);
  const lightningVeryNear = nearestStrikeM !== null && nearestStrikeM <= NEARBY;
  const windAboveRating = windKnots !== null && windKnots >= STRONG_WIND_KT;
  const windAtLimit = windKnots !== null && windKnots >= FRESH_WIND_KT;

  if (insideRestrictedArea || lightningVeryNear || windAboveRating) return 'do-not-fly';
  if (zones.length > 0 || nearestStrikeM !== null || windAtLimit) return 'caution';
  return 'nothing-detected';
}

export function guidanceMessage(result: Verdict): string {
  switch (result) {
    case 'do-not-fly':
      return 'Do not fly now. Recheck lightning and wind conditions and confirm all CAAS requirements before operating.';
    case 'caution':
      return 'Proceed with caution. Keep clear of the red areas, monitor wind and weather, and confirm CAAS requirements for your whole planned flight area.';
    case 'nothing-detected':
      return 'Nothing was detected for this area. Still confirm CAAS requirements and check your entire planned flight path, not only the take-off point.';
  }
}
