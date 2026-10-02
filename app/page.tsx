'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import StatusCard from '@/components/StatusCard';
import { CheckError, RADII_M, runCheck } from '@/lib/check';
import { searchPlaces, type Place } from '@/lib/search';
import type { LatLng } from '@/lib/geo';
import type { CheckResult } from '@/lib/types';

// Leaflet needs `window`, so the map must not be server-rendered.
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="map" />,
});

const SINGAPORE_CENTRE: LatLng = { lat: 1.3521, lng: 103.8198 };

export default function Page() {
  const [centre, setCentre] = useState<LatLng>(SINGAPORE_CENTRE);
  const [locationName, setLocationName] = useState('Singapore (city centre)');
  const [radiusM, setRadiusM] = useState(5_000);

  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);

  const [result, setResult] = useState<CheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Move the centre point. Any existing result described the *old* point or
   * radius, so it is dropped — a stale green card is the dangerous failure here.
   */
  function selectLocation(point: LatLng, name: string) {
    setCentre(point);
    setLocationName(name);
    setResult(null);
    setError(null);
  }

  // Debounced search: wait for a pause in typing so we don't fire a OneMap
  // request per keystroke.
  useEffect(() => {
    if (query.trim().length < 2) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setPlaces(await searchPlaces(query, controller.signal));
      } catch {
        // Aborted or offline — leaving the old suggestions up is harmless.
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('This browser does not support location access.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        selectLocation(
          { lat: position.coords.latitude, lng: position.coords.longitude },
          'My current location',
        ),
      () => setError('Could not get your location. Search or tap the map instead.'),
    );
  }

  async function check() {
    setIsChecking(true);
    setError(null);
    try {
      setResult(await runCheck(centre, radiusM));
    } catch (problem) {
      // CheckError messages (rate limit, outside Singapore) are written for the
      // user; anything else is a surprise and gets a generic line.
      setError(
        problem instanceof CheckError
          ? problem.message
          : 'The check failed. Check your connection and try again.',
      );
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <main className="layout">
      <MapView
        centre={centre}
        radiusM={radiusM}
        zones={result?.zones ?? []}
        strikes={result?.strikes ?? []}
        checked={result !== null}
        onPick={(point) => selectLocation(point, 'Point selected on map')}
      />

      <aside className="sidebar">
        <header>
          <h1>FlyClear SG</h1>
          <p>Drone pre-flight zone &amp; lightning checker</p>
        </header>

        <div>
          <h2>Location</h2>
          <input
            type="search"
            value={query}
            placeholder="Search a place, e.g. Yishun Park"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search for a location"
          />
          {places.length > 0 && (
            <ul className="suggestions">
              {places.map((place) => (
                <li key={`${place.lat},${place.lng},${place.name}`}>
                  <button
                    onClick={() => {
                      selectLocation({ lat: place.lat, lng: place.lng }, place.name);
                      setQuery('');
                      setPlaces([]);
                    }}
                  >
                    {place.name}
                    <small>{place.address}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint" style={{ marginTop: 8 }}>
            Selected: {locationName} ({centre.lat.toFixed(4)}, {centre.lng.toFixed(4)}). You
            can also tap anywhere on the map.
          </p>
          <button style={{ marginTop: 8, width: '100%' }} onClick={useMyLocation}>
            Use my current location
          </button>
        </div>

        <div>
          <h2>Radius</h2>
          <div className="row">
            {RADII_M.map((metres) => (
              <button
                key={metres}
                aria-pressed={metres === radiusM}
                onClick={() => {
                  setRadiusM(metres);
                  setResult(null);
                }}
              >
                {metres / 1000} km
              </button>
            ))}
          </div>
        </div>

        <button className="check-button" onClick={check} disabled={isChecking}>
          {isChecking ? 'Checking…' : 'Check this location'}
        </button>

        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}

        {result ? (
          <StatusCard result={result} locationName={locationName} />
        ) : (
          <p className="hint">
            Pick a location and radius, then press Check. Results are not cached, so each
            check is a fresh look at NEA lightning data.
          </p>
        )}

        {result?.lightningError && (
          <p className="notice error">Lightning check failed: {result.lightningError}</p>
        )}

        <footer className="disclaimer">
          <p>
            FlyClear SG is a pre-flight assistant, not a permission to fly. &ldquo;Nothing
            detected&rdquo; means no restriction was found in our data — it does not
            guarantee that flying is legal or safe.
          </p>
          <p>
            Check your <strong>entire planned flight area</strong>, not just the take-off
            point, and confirm every{' '}
            <a href="https://www.caas.gov.sg/public-passengers/unmanned-aircraft/" target="_blank" rel="noreferrer">
              CAAS requirement
            </a>{' '}
            before operating.
          </p>
          <p>
            Zone data is <strong>approximate</strong>, traced from the CAAS no-fly map
            {result ? ` on ${result.zoneSource.tracedOn}` : ''}. Verify against{' '}
            <a href="https://www.onemap.gov.sg/droneQuery" target="_blank" rel="noreferrer">
              OneMap Drone Query
            </a>
            . Lightning data: NEA via data.gov.sg.
          </p>
        </footer>
      </aside>
    </main>
  );
}
