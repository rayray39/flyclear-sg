/** Shared between runCheck() and the UI that renders its answer. */

import type { Strike } from './lightning';
import type { WindReading } from './wind';
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
  /** Grouped because wind is six related fields, not six independent ones. */
  wind: {
    /** Stations inside the circle, nearest first; empty if none reported. */
    stations: WindReading[];
    /** Strongest wind available: what the card headlines and the verdict uses. */
    headline: WindReading | null;
    /** True when `headline` comes from the nearest station *outside* the circle. */
    headlineOutsideRadius: boolean;
    message: string;
    /** NEA's own reading timestamp, so the user can judge data age. */
    observedAt: string | null;
    /** Set when the wind fetch failed; the other checks still ran. */
    error: string | null;
  };
  guidance: string;
  zoneSource: { url: string; tracedOn: string };
};
