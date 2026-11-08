/**
 * Guard against hammering data.gov.sg.
 *
 * data.gov.sg resets its quota every 10 seconds and allows 6 calls in that
 * window without an API key. One check now reads three separate datasets —
 * lightning, wind speed, wind direction — so the budget is counted in *API
 * calls* rather than checks, and the whole batch is reserved up front before
 * any request goes out. Reserving first is what stops a check from starting,
 * firing two of its three calls, and tipping us over the quota mid-flight.
 *
 * The window here is 12 s against upstream's 10 s. Holding the same call count
 * over a longer window is strictly more conservative, and the extra 2 s absorbs
 * clock skew and the latency between reserving a slot and the call landing.
 *
 * The counter lives in the browser tab, which is the right place now that there
 * is no server: data.gov.sg meters per IP, so each visitor has their own quota
 * to protect and no reason to share a budget with strangers.
 *
 * Known gap: the counter resets on page reload, so holding F5 can get past it.
 * The upstream 429 is handled and shown to the user, so the worst case is a
 * clear error message. Move it to sessionStorage if that ever matters.
 */

const MAX_CALLS = 6;
const WINDOW_MS = 12_000;

/** One timestamp per reserved call, oldest first. */
let recentCallTimes: number[] = [];

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Reserves `count` API calls if the budget allows, otherwise reports the wait.
 *
 * All-or-nothing on purpose: a half-reserved check would either skip a dataset
 * or exceed the quota, and neither is worth the complexity of a partial run.
 */
export function takeApiCallSlots(count: number): RateLimitDecision {
  if (count > MAX_CALLS) {
    // A caller bug, not a user problem: no wait would ever free this many slots.
    throw new Error(`A single check cannot reserve ${count} calls; the cap is ${MAX_CALLS}.`);
  }

  const now = Date.now();
  recentCallTimes = recentCallTimes.filter((t) => now - t < WINDOW_MS);

  if (recentCallTimes.length + count > MAX_CALLS) {
    // Wait for enough of the oldest calls to age out to make room for `count`.
    const slotsToFree = recentCallTimes.length + count - MAX_CALLS;
    const lastCallToExpire = recentCallTimes[slotsToFree - 1];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - lastCallToExpire)) / 1000)),
    };
  }

  for (let i = 0; i < count; i++) recentCallTimes.push(now);
  return { allowed: true };
}

/** Test seam: forget every reserved call. Not used by the app. */
export function resetRateLimit(): void {
  recentCallTimes = [];
}
