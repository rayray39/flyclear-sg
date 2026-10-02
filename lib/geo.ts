/**
 * Tiny geometry helpers, all in metres.
 *
 * The trick that keeps this file short: Singapore is only ~50 km across, so we
 * flatten latitude/longitude into plain x/y metres around a reference point and
 * then do ordinary school-level 2D geometry. At this scale the flattening error
 * is well under a metre — far smaller than NEA's own lightning location accuracy
 * (200 m – 2 km), so it costs us nothing and saves us spherical trigonometry.
 */

export type LatLng = { lat: number; lng: number };

/** A GeoJSON-style ring: [longitude, latitude] pairs, first point repeated last. */
export type Ring = [number, number][];

const METRES_PER_DEGREE_LAT = 111_320;

type XY = { x: number; y: number };

/** Project a lat/lng into metres east (x) / north (y) of `origin`. */
function toLocalXY(origin: LatLng, p: LatLng): XY {
  // Lines of longitude squeeze together as you move away from the equator,
  // so the east-west scale depends on latitude. North-south does not.
  const metresPerDegreeLng =
    METRES_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (p.lng - origin.lng) * metresPerDegreeLng,
    y: (p.lat - origin.lat) * METRES_PER_DEGREE_LAT,
  };
}

/** Straight-line distance between two coordinates, in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const { x, y } = toLocalXY(a, b);
  return Math.hypot(x, y);
}

/** Shortest distance from `p` to the line segment `a`–`b`, in metres. */
function distanceToSegment(p: XY, a: XY, b: XY): number {
  const segX = b.x - a.x;
  const segY = b.y - a.y;
  const segLengthSq = segX * segX + segY * segY;

  // Degenerate segment (a === b): fall back to point-to-point.
  if (segLengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // How far along the segment the closest point sits, clamped to [0, 1] so we
  // stay on the segment rather than running off along the infinite line.
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * segX + (p.y - a.y) * segY) / segLengthSq),
  );
  return Math.hypot(p.x - (a.x + t * segX), p.y - (a.y + t * segY));
}

/**
 * Is `point` inside `ring`? Classic ray casting: shoot a ray east from the point
 * and count how many edges it crosses. Odd number of crossings = inside.
 */
export function isPointInRing(point: LatLng, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lngI, latI] = ring[i];
    const [lngJ, latJ] = ring[j];

    // Does this edge straddle the point's latitude? If not, the eastward ray
    // can't cross it.
    const straddles = latI > point.lat !== latJ > point.lat;
    if (!straddles) continue;

    // Longitude where the edge crosses the point's latitude.
    const crossingLng =
      lngI + ((point.lat - latI) / (latJ - latI)) * (lngJ - lngI);
    if (point.lng < crossingLng) inside = !inside;
  }
  return inside;
}

/**
 * Does a circle (centre + radius) touch the area enclosed by `ring`?
 * True if the centre is inside the ring, or if any edge comes within `radiusM`.
 */
export function doesCircleTouchRing(
  centre: LatLng,
  radiusM: number,
  ring: Ring,
): boolean {
  if (isPointInRing(centre, ring)) return true;

  const origin = { x: 0, y: 0 };
  const points = ring.map(([lng, lat]) => toLocalXY(centre, { lat, lng }));
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(origin, points[i], points[i + 1]) <= radiusM) {
      return true;
    }
  }
  return false;
}
