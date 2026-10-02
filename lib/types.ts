/** Shared between the /api/check route and the UI that renders its answer. */

import type { Strike } from './lightning';
import type { RestrictedZone } from './zones';
import type { Verdict } from './guidance';

export type CheckResult = {
  centre: { lat: number; lng: number };
  radiusM: number;
  verdict: Verdict;
  zones: RestrictedZone[];
  zoneMessage: string;
  strikes: Strike[];
  lightningMessage: string;
  /** NEA's own "last updated" stamp, so the user can judge data age. */
  lightningObservedAt: string | null;
  /** Set when the lightning fetch failed; the zone check still ran. */
  lightningError: string | null;
  guidance: string;
  zoneSource: { url: string; tracedOn: string };
};
