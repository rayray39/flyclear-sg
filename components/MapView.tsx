'use client';

// Leaflet touches `window` at import time, so this component is only ever
// loaded via next/dynamic with ssr: false (see app/page.tsx).
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { useEffect } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import type { LatLng } from '@/lib/geo';
import type { Strike } from '@/lib/lightning';
import type { RestrictedZone } from '@/lib/zones';

type Props = {
  centre: LatLng;
  radiusM: number;
  /** Only present after a check; empty before then. */
  zones: RestrictedZone[];
  strikes: Strike[];
  /** True once a check has run, so we know whether to paint the circle green. */
  checked: boolean;
  onPick: (point: LatLng) => void;
};

/**
 * Leaflet's default marker uses image files that bundlers rewrite and break.
 * A divIcon is plain HTML, so there is nothing to 404 — hence no images here.
 */
const centreIcon = divIcon({
  className: 'pin pin-centre',
  html: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const lightningIcon = divIcon({
  className: 'pin pin-lightning',
  html: '⚡',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/** Zoom level that roughly frames each radius on a typical screen. */
const ZOOM_FOR_RADIUS: Record<number, number> = { 2000: 14, 5000: 13, 10000: 12 };

/**
 * Absolute floor only. The real limit is computed at runtime by
 * ClampZoomToSingapore below, because it depends on the size of the map pane.
 */
const MIN_ZOOM = 11;
const MAX_ZOOM = 19;

/**
 * Panning is clamped to this box so the island can't be dragged off-screen.
 * Leaflet wants [[southLat, westLng], [northLat, eastLng]].
 */
const SINGAPORE_BOUNDS: [[number, number], [number, number]] = [
  [1.13, 103.55],
  [1.51, 104.14],
];

/** Keeps the Leaflet view in sync with React state (map is not a controlled component). */
function FollowSelection({ centre, radiusM }: { centre: LatLng; radiusM: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([centre.lat, centre.lng], ZOOM_FOR_RADIUS[radiusM] ?? 13);
    // Depend on the primitives, not the `centre` object, which is a new
    // reference on every render and would re-pan the map constantly.
  }, [map, centre.lat, centre.lng, radiusM]);
  return null;
}

/**
 * Stops the user zooming out past the point where Singapore fills the pane.
 *
 * OneMap's tile server only covers Singapore — ask it for a tile over Johor or
 * the Riau Islands and it answers 200 with an empty body, which Leaflet renders
 * as bare container background. So anything further out than "the island fills
 * the view" is just empty space.
 *
 * This has to be computed rather than hard-coded: the zoom at which Singapore
 * fits depends on how wide the map pane is, which differs between a phone and a
 * desktop and changes when the window is resized.
 */
function ClampZoomToSingapore() {
  const map = useMap();
  useEffect(() => {
    // getBoundsZoom returns the furthest-out zoom that still fits the bounds.
    // setMinZoom also pulls the current view in if it was already further out.
    const clamp = () => map.setMinZoom(map.getBoundsZoom(SINGAPORE_BOUNDS));
    clamp();
    map.on('resize', clamp);
    return () => {
      map.off('resize', clamp);
    };
  }, [map]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

export default function MapView({ centre, radiusM, zones, strikes, checked, onPick }: Props) {
  // Green only once a check has actually run and come back clean — an unchecked
  // circle must not look like an all-clear.
  const isClear = checked && zones.length === 0;

  return (
    <MapContainer
      className="map"
      center={[centre.lat, centre.lng]}
      zoom={ZOOM_FOR_RADIUS[radiusM] ?? 13}
      scrollWheelZoom
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={SINGAPORE_BOUNDS}
      // 1.0 = a hard wall at the bounds; lower values let the map drift past
      // them and spring back, which reads as sloppy on a map this small.
      maxBoundsViscosity={1}
      // Smooth zooming: `zoomSnap` is the granularity Leaflet settles on and
      // `zoomDelta` is one +/- button press. Quarter-steps feel gradual instead
      // of the default whole-level jump. `wheelPxPerZoomLevel` is how much
      // scrolling buys one full level — higher means a gentler wheel.
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={140}
    >
      <TileLayer
        url="https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png"
        attribution='<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/> New OneMap | Map data &copy; contributors, <a href="https://www.sla.gov.sg">Singapore Land Authority</a>'
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        // Don't even request tiles outside OneMap's coverage, and don't repeat
        // the world sideways when the pane is wider than the data.
        bounds={SINGAPORE_BOUNDS}
        noWrap
      />

      <ClampZoomToSingapore />
      <FollowSelection centre={centre} radiusM={radiusM} />
      <ClickToPick onPick={onPick} />

      {/* The selected radius. Green = nothing detected, not "safe to fly". */}
      <Circle
        center={[centre.lat, centre.lng]}
        radius={radiusM}
        pathOptions={{
          color: isClear ? '#22c55e' : '#38bdf8',
          fillColor: isClear ? '#22c55e' : '#38bdf8',
          fillOpacity: 0.08,
          weight: 2,
        }}
      />

      {/* Restricted areas overlapping the circle, in red. */}
      {zones.map((zone) =>
        zone.circle ? (
          <Circle
            key={zone.id}
            center={[zone.circle.lat, zone.circle.lng]}
            radius={zone.circle.radiusM}
            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 1 }}
          >
            <Popup>
              <strong>{zone.name}</strong>
              <br />
              {zone.reason}
            </Popup>
          </Circle>
        ) : (
          <Polygon
            key={zone.id}
            // GeoJSON stores [lng, lat]; Leaflet wants [lat, lng].
            positions={zone.polygon!.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 1 }}
          >
            <Popup>
              <strong>{zone.name}</strong>
              <br />
              {zone.reason}
            </Popup>
          </Polygon>
        ),
      )}

      {strikes.map((strike, index) => (
        <Marker
          key={`${strike.datetime}-${index}`}
          position={[strike.lat, strike.lng]}
          icon={lightningIcon}
        >
          <Popup>
            <strong>{strike.text}</strong>
            <br />
            {Math.round(strike.distanceM / 100) / 10} km away
            <br />
            {new Date(strike.datetime).toLocaleTimeString('en-SG')}
          </Popup>
        </Marker>
      ))}

      <Marker position={[centre.lat, centre.lng]} icon={centreIcon} />
    </MapContainer>
  );
}
