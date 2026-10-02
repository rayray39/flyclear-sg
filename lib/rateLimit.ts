/**
 * Guard against hammering data.gov.sg.
 *
 * data.gov.sg resets its quota every 10 seconds and allows 6 calls in that
 * window without an API key. We budget far below that so an impatient user
 * mashing "Check" can never get themselves rate-limited.
 *
 * The counter lives in the browser tab, which is the right place now that there
 * is no server: data.gov.sg meters per IP, so each visitor has their own quota
 * to protect and no reason to share a budget with strangers.
 *
 * ponytail: counter resets on page reload, so holding F5 can get past it. The
 * upstream 429 is handled and shown to the user, so the worst case is a clear
 * error message. Move it to sessionStorage if that ever matters.
 */

const MAX_CHECKS = 5;
const WINDOW_MS = 30_000;

let recentCheckTimes: number[] = [];

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Records one check if there is budget left; otherwise reports the wait. */
export function takeCheckSlot(): RateLimitDecision {
  const now = Date.now();
  recentCheckTimes = recentCheckTimes.filter((t) => now - t < WINDOW_MS);

  if (recentCheckTimes.length >= MAX_CHECKS) {
    const oldest = recentCheckTimes[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
    };
  }

  recentCheckTimes.push(now);
  return { allowed: true };
}
