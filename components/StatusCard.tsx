import type { CheckResult } from '@/lib/types';

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
            radius, nearest {Math.round(result.strikes[0].distanceM / 100) / 10} km away.
          </p>
        )}
        {result.lightningObservedAt && (
          <p className="hint">
            NEA data updated {new Date(result.lightningObservedAt).toLocaleString('en-SG')}
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
