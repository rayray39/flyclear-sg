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

export function zoneMessage(zones: RestrictedZone[]): string {
  if (zones.length === 0) {
    return 'No restricted area detected within the selected radius. Green does not mean permission is granted.';
  }
  if (zones.some((zone) => zone.containsCentre)) {
    return 'Your selected point is inside a restricted area. Check the red areas on the map.';
  }
  return 'Restricted areas fall within your selected radius. Check the red areas on the map.';
}

export function verdict(
  nearestStrikeM: number | null,
  zones: RestrictedZone[],
): Verdict {
  const insideRestrictedArea = zones.some((zone) => zone.containsCentre);
  const lightningVeryNear = nearestStrikeM !== null && nearestStrikeM <= NEARBY;

  if (insideRestrictedArea || lightningVeryNear) return 'do-not-fly';
  if (zones.length > 0 || nearestStrikeM !== null) return 'caution';
  return 'nothing-detected';
}

export function guidanceMessage(result: Verdict): string {
  switch (result) {
    case 'do-not-fly':
      return 'Do not fly now. Recheck lightning conditions and confirm all CAAS requirements before operating.';
    case 'caution':
      return 'Proceed with caution. Keep clear of the red areas, monitor the weather, and confirm CAAS requirements for your whole planned flight area.';
    case 'nothing-detected':
      return 'Nothing was detected for this area. Still confirm CAAS requirements and check your entire planned flight path, not only the take-off point.';
  }
}
