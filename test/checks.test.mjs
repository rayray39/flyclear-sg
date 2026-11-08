/**
 * The smallest check that fails if the geometry or the decision ladder breaks.
 * Run with: npm test   (Node 22+ strips the TypeScript types on import)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { distanceM, isPointInRing, doesCircleTouchRing } from '../lib/geo.ts';
import { lightningMessage, verdict, windMessage } from '../lib/guidance.ts';
import { compassPoint } from '../lib/wind.ts';
import { takeApiCallSlots, resetRateLimit } from '../lib/rateLimit.ts';

// A 0.01° × 0.01° square near Singapore's centre. 0.01° of latitude is ~1113 m.
const SQUARE = [
  [103.80, 1.30],
  [103.81, 1.30],
  [103.81, 1.31],
  [103.80, 1.31],
  [103.80, 1.30],
];

test('distanceM matches the known metres-per-degree of latitude', () => {
  const metres = distanceM({ lat: 1.30, lng: 103.8 }, { lat: 1.31, lng: 103.8 });
  assert.ok(Math.abs(metres - 1113) < 5, `expected ~1113 m, got ${metres}`);
});

test('isPointInRing separates inside from outside', () => {
  assert.equal(isPointInRing({ lat: 1.305, lng: 103.805 }, SQUARE), true);
  assert.equal(isPointInRing({ lat: 1.305, lng: 103.790 }, SQUARE), false);
  assert.equal(isPointInRing({ lat: 1.350, lng: 103.805 }, SQUARE), false);
});

test('doesCircleTouchRing reaches across a gap only when the radius is big enough', () => {
  // ~1113 m west of the square's left edge.
  const nearby = { lat: 1.305, lng: 103.79 };
  assert.equal(doesCircleTouchRing(nearby, 500, SQUARE), false);
  assert.equal(doesCircleTouchRing(nearby, 2000, SQUARE), true);
  // A centre inside the ring always counts, however small the radius.
  assert.equal(doesCircleTouchRing({ lat: 1.305, lng: 103.805 }, 1, SQUARE), true);
});

test('lightning wording follows the 2 / 5 / 10 km ladder', () => {
  assert.match(lightningMessage(1500), /very near/);
  assert.match(lightningMessage(4000), /not recommended/);
  assert.match(lightningMessage(9000), /Monitor conditions/);
  assert.match(lightningMessage(null), /No recent lightning/);
  // Never claim safety, only absence of a detection.
  assert.doesNotMatch(lightningMessage(null), /safe/i);
});

test('verdict escalates on a containing zone, close lightning or strong wind', () => {
  const overlapping = [{ containsCentre: false }];
  const containing = [{ containsCentre: true }];

  assert.equal(verdict(null, [], null), 'nothing-detected');
  assert.equal(verdict(null, [], 6), 'nothing-detected');
  assert.equal(verdict(null, overlapping, null), 'caution');
  assert.equal(verdict(8000, [], null), 'caution');
  assert.equal(verdict(3000, [], null), 'do-not-fly');
  assert.equal(verdict(null, containing, null), 'do-not-fly');

  // Wind alone: Beaufort 5 cautions, Beaufort 6 stops the flight.
  assert.equal(verdict(null, [], 12), 'nothing-detected');
  assert.equal(verdict(null, [], 17), 'caution');
  assert.equal(verdict(null, [], 22), 'do-not-fly');
  // A failed wind check is unknown, not calm, so it escalates nothing.
  assert.equal(verdict(null, [], null), 'nothing-detected');
});

test('wind wording follows the Beaufort ladder and never claims safety', () => {
  assert.match(windMessage(25), /above the limit/);
  assert.match(windMessage(18), /at the limit/);
  assert.match(windMessage(13), /Moderate wind/);
  assert.match(windMessage(4), /Light wind/);
  assert.match(windMessage(null), /unknown/);
  assert.doesNotMatch(windMessage(4), /safe/i);
});

test('compassPoint maps bearings to 16-point labels and wraps at north', () => {
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(45), 'NE');
  assert.equal(compassPoint(90), 'E');
  assert.equal(compassPoint(180), 'S');
  assert.equal(compassPoint(270), 'W');
  // 349 and above rounds past NNW, back round to N.
  assert.equal(compassPoint(350), 'N');
  assert.equal(compassPoint(360), 'N');
});

test('rate limiter budgets API calls, not checks', () => {
  resetRateLimit();
  // 6 calls per window, 3 calls per check: two checks fit, the third does not.
  assert.equal(takeApiCallSlots(3).allowed, true);
  assert.equal(takeApiCallSlots(3).allowed, true);

  const blocked = takeApiCallSlots(3);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0, 'a blocked check must say how long to wait');

  // A partial reservation must not sneak past a full one.
  assert.equal(takeApiCallSlots(1).allowed, false);

  resetRateLimit();
  assert.equal(takeApiCallSlots(3).allowed, true);
});
