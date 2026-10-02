/**
 * The whole pre-flight check, run in the browser.
 *
 * This used to be a Next route handler. FlyClear is deployed to GitHub Pages,
 * which serves static files and has no server to run one — and both upstreams
 * send `access-control-allow-origin: *`, so the browser can call them directly.
 */

import { fetchLightningInRadius } from './lightning';
import { findZonesInRadius, ZONE_SOURCE } from './zones';
import { guidanceMessage, lightningMessage, verdict, zoneMessage } from './guidance';
import { takeCheckSlot } from './rateLimit';
import type { LatLng } from './geo';
import type { CheckResult } from './types';

/** The only radii the UI offers. */
export const RADII_M = [2_000, 5_000, 10_000];

// Singapore's bounding box, with a little slack for the surrounding waters.
const SG_BOUNDS = { minLat: 1.13, maxLat: 1.51, minLng: 103.55, maxLng: 104.14 };

/** Thrown for problems worth showing the user verbatim (rate limit, bad input). */
export class CheckError extends Error {}

export async function runCheck(centre: LatLng, radiusM: number): Promise<CheckResult> {
  // Validate before spending any rate-limit budget on a bad request.
  if (!RADII_M.includes(radiusM)) {
    throw new CheckError('Pick a radius of 2 km, 5 km or 10 km.');
  }
  const { lat, lng } = centre;
  if (lat < SG_BOUNDS.minLat || lat > SG_BOUNDS.maxLat || lng < SG_BOUNDS.minLng || lng > SG_BOUNDS.maxLng) {
    throw new CheckError('That point is outside Singapore. FlyClear SG only covers Singapore.');
  }

  const slot = takeCheckSlot();
  if (!slot.allowed) {
    throw new CheckError(
      `Too many checks. Please wait ${slot.retryAfterSeconds}s before checking again.`,
    );
  }

  const zones = findZonesInRadius(centre, radiusM);

  // The zone check is local and always succeeds, so a lightning outage should
  // degrade the card rather than fail the whole check.
  let strikes: CheckResult['strikes'] = [];
  let lightningObservedAt: string | null = null;
  let lightningError: string | null = null;
  try {
    const lightning = await fetchLightningInRadius(centre, radiusM);
    strikes = lightning.strikes;
    lightningObservedAt = lightning.observedAt;
  } catch (error) {
    lightningError = error instanceof Error ? error.message : 'Lightning check unavailable.';
  }

  // `strikes` is sorted nearest-first by fetchLightningInRadius.
  const nearestStrikeM = strikes.length > 0 ? strikes[0].distanceM : null;
  const result = verdict(nearestStrikeM, zones);

  return {
    centre,
    radiusM,
    verdict: result,
    zones,
    zoneMessage: zoneMessage(zones),
    strikes,
    lightningMessage: lightningError
      ? 'Lightning check unavailable — treat conditions as unknown.'
      : lightningMessage(nearestStrikeM),
    lightningObservedAt,
    lightningError,
    guidance: guidanceMessage(result),
    zoneSource: ZONE_SOURCE,
  };
}
