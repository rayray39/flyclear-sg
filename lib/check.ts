/**
 * The whole pre-flight check, run in the browser.
 *
 * This used to be a Next route handler. FlyClear is deployed to GitHub Pages,
 * which serves static files and has no server to run one — and both upstreams
 * send `access-control-allow-origin: *`, so the browser can call them directly.
 */

import { fetchLightningInRadius } from './lightning';
import { fetchWindNear } from './wind';
import { findZonesInRadius, ZONE_SOURCE } from './zones';
import { guidanceMessage, lightningMessage, verdict, windMessage, zoneMessage } from './guidance';
import { takeApiCallSlots } from './rateLimit';
import type { LatLng } from './geo';
import type { CheckResult } from './types';

/** The only radii the UI offers. */
export const RADII_M = [2_000, 5_000, 10_000];

/**
 * One check reads three data.gov.sg datasets: lightning, wind speed and wind
 * direction. They are separate endpoints, so this is three API calls, all
 * reserved from the rate-limit budget before any of them goes out.
 */
export const API_CALLS_PER_CHECK = 3;

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

  const slot = takeApiCallSlots(API_CALLS_PER_CHECK);
  if (!slot.allowed) {
    throw new CheckError(
      `Too many checks. Please wait ${slot.retryAfterSeconds}s before checking again.`,
    );
  }

  const zones = findZonesInRadius(centre, radiusM);

  // The zone check is local and always succeeds. The two network checks run
  // together and settle independently, so an outage in one degrades its own
  // section of the card instead of failing the whole check.
  const [lightningOutcome, windOutcome] = await Promise.allSettled([
    fetchLightningInRadius(centre, radiusM),
    fetchWindNear(centre, radiusM),
  ]);

  const lightning = lightningOutcome.status === 'fulfilled' ? lightningOutcome.value : null;
  const lightningError =
    lightningOutcome.status === 'rejected' ? messageFor(lightningOutcome.reason, 'Lightning check unavailable.') : null;

  const wind = windOutcome.status === 'fulfilled' ? windOutcome.value : null;
  const windError =
    windOutcome.status === 'rejected' ? messageFor(windOutcome.reason, 'Wind check unavailable.') : null;

  const strikes = lightning?.strikes ?? [];
  // `strikes` is sorted nearest-first by fetchLightningInRadius.
  const nearestStrikeM = strikes.length > 0 ? strikes[0].distanceM : null;
  // A failed wind check is "unknown", not "calm", so it stays null here.
  const windKnots = wind?.headline?.speedKnots ?? null;
  const result = verdict(nearestStrikeM, zones, windKnots);

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
    lightningObservedAt: lightning?.observedAt ?? null,
    lightningError,
    wind: {
      stations: wind?.stations ?? [],
      headline: wind?.headline ?? null,
      headlineOutsideRadius: wind?.headlineOutsideRadius ?? false,
      message: windError
        ? 'Wind check unavailable — treat wind as unknown.'
        : windMessage(windKnots),
      observedAt: wind?.observedAt ?? null,
      error: windError,
    },
    guidance: guidanceMessage(result),
    zoneSource: ZONE_SOURCE,
  };
}

/** Rejections from fetch are usually Errors, but never guaranteed to be. */
function messageFor(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
