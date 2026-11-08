import type { CheckResult } from '@/lib/types';

/** Metres -> "1.2 km", the same rounding the lightning line uses. */
function km(metres: number): string {
  return `${Math.round(metres / 100) / 10} km`;
}

/**
 * An arrow pointing the way the wind travels.
 *
 * NEA reports the bearing the wind blows *from*, so the arrow is rotated by
 * `degrees + 180` to point downwind. The label beside it always spells out the
 * "from" direction, because an arrow alone is ambiguous.
 */
function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg className="wind-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g transform={`rotate(${(degrees + 180) % 360} 12 12)`}>
        <path d="M12 3 L12 21 M12 3 L7.5 9 M12 3 L16.5 9" />
      </g>
    </svg>
  );
}

const VERDICT_HEADING: Record<CheckResult['verdict'], string> = {
  'do-not-fly': 'Do not fly',
  caution: 'Caution',
  'nothing-detected': 'Nothing detected',
};

export default function StatusCard({
  result,
  locationName,
}: {
  result: CheckResult;
  locationName: string;
}) {
  return (
    <div className={`card ${result.verdict}`}>
      <h2>Pre-flight status — {VERDICT_HEADING[result.verdict]}</h2>

      <dl>
        <dt>Location</dt>
        <dd>{locationName}</dd>
        <dt>Radius</dt>
        <dd>{result.radiusM / 1000} km</dd>
      </dl>

      <section>
        <strong>Drone zone</strong>
        <p>{result.zoneMessage}</p>
        {result.zones.length > 0 && (
          <ul className="zone-list">
            {result.zones.map((zone) => (
              <li key={zone.id}>
                {zone.name} — {zone.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <strong>Lightning</strong>
        <p>{result.lightningMessage}</p>
        {result.strikes.length > 0 && (
          <p className="hint">
            {result.strikes.length} observation{result.strikes.length === 1 ? '' : 's'} in
            radius, nearest {km(result.strikes[0].distanceM)} away.
          </p>
        )}
        {result.lightningObservedAt && (
          <p className="hint">
            NEA data updated {new Date(result.lightningObservedAt).toLocaleString('en-SG')}
          </p>
        )}
      </section>

      <section>
        <strong>Wind</strong>
        <p>{result.wind.message}</p>
        {result.wind.headline && (
          <div className="wind-readout">
            <WindArrow degrees={result.wind.headline.directionDeg} />
            <div>
              <p className="wind-figure">
                {result.wind.headline.speedKnots.toFixed(1)} kt (
                {result.wind.headline.speedMs.toFixed(1)} m/s)
              </p>
              <p className="hint">
                from {result.wind.headline.fromCompass} (
                {String(Math.round(result.wind.headline.directionDeg)).padStart(3, '0')}°) ·{' '}
                {result.wind.headline.stationName}
              </p>
            </div>
          </div>
        )}
        {result.wind.headlineOutsideRadius && result.wind.headline && (
          <p className="hint">
            No wind station inside the radius — nearest is{' '}
            {km(result.wind.headline.distanceM)} away.
          </p>
        )}
        {result.wind.stations.length > 1 && (
          <p className="hint">
            Strongest of {result.wind.stations.length} stations in radius.
          </p>
        )}
        {result.wind.observedAt && (
          <p className="hint">
            NEA data updated {new Date(result.wind.observedAt).toLocaleString('en-SG')}
          </p>
        )}
      </section>

      <section>
        <strong>Pre-flight guidance</strong>
        <p>{result.guidance}</p>
      </section>
    </div>
  );
}
