/**
 * The smallest check that fails if the geometry or the decision ladder breaks.
 * Run with: npm test   (Node 22+ strips the TypeScript types on import)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { distanceM, isPointInRing, doesCircleTouchRing } from '../lib/geo.ts';
import { lightningMessage, verdict } from '../lib/guidance.ts';

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

test('verdict escalates on a containing zone or close lightning', () => {
  const overlapping = [{ containsCentre: false }];
  const containing = [{ containsCentre: true }];

  assert.equal(verdict(null, []), 'nothing-detected');
  assert.equal(verdict(null, overlapping), 'caution');
  assert.equal(verdict(8000, []), 'caution');
  assert.equal(verdict(3000, []), 'do-not-fly');
  assert.equal(verdict(null, containing), 'do-not-fly');
});
