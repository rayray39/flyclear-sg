/**
 * Drone-zone check against the bundled CAAS zone file.
 *
 * Why a bundled file and not an API: OneMap's Drone Query is a browser-only tool
 * with no public REST endpoint (their API docs expose only auth, search, routing,
 * geocoding, population and themes). So the shapes live in data/drone-zones.json
 * and are deliberately labelled approximate everywhere they surface in the UI.
 */

import zoneData from '@/data/drone-zones.json';
import { distanceM, doesCircleTouchRing, isPointInRing, type LatLng, type Ring } from './geo';

/** A zone as stored in the JSON file: either a circle or a polygon, never both. */
type ZoneShape =
  | { circle: { lat: number; lng: number; radiusM: number }; polygon?: never }
  | { polygon: [number, number][]; circle?: never };

type Zone = { id: string; name: string; reason: string } & ZoneShape;

/** A zone that overlaps the user's search circle, ready to draw on the map. */
export type RestrictedZone = Zone & {
  /** True when the exact take-off point sits inside the zone, not just nearby. */
  containsCentre: boolean;
};

const zones = zoneData.zones as Zone[];

export const ZONE_SOURCE = {
  url: zoneData.sourceUrl,
  tracedOn: zoneData.tracedOn,
};

/** Every restricted zone that overlaps the circle at `centre` with `radiusM`. */
export function findZonesInRadius(centre: LatLng, radiusM: number): RestrictedZone[] {
  return zones
    .map((zone) => {
      if (zone.circle) {
        const gap = distanceM(centre, zone.circle);
        return {
          ...zone,
          overlaps: gap <= radiusM + zone.circle.radiusM,
          containsCentre: gap <= zone.circle.radiusM,
        };
      }
      const ring = zone.polygon as Ring;
      return {
        ...zone,
        overlaps: doesCircleTouchRing(centre, radiusM, ring),
        containsCentre: isPointInRing(centre, ring),
      };
    })
    .filter((zone) => zone.overlaps)
    .map(({ overlaps, ...zone }) => zone);
}
