# FlyClear SG

Singapore drone pre-flight zone & lightning checker. Pick a point, pick a radius,
press **Check** — the app reports restricted areas, recent NEA lightning
observations and current NEA wind inside that circle.  

Visit the site here: https://rayray39.github.io/flyclear-sg/

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # geometry + decision-ladder checks
npm run build    # static site into out/
```

No credentials, no backend, no build-time secrets.

## Where to look

| File | What it does |
|---|---|
| `app/page.tsx` | All UI state: location, radius, check, results |
| `components/MapView.tsx` | Leaflet map, OneMap tiles, circles and pins |
| `lib/check.ts` | Everything the Check button does, start to finish |
| `lib/geo.ts` | Distance and point/circle-vs-polygon maths |
| `lib/zones.ts` | Drone-zone lookup against the bundled zone file |
| `lib/lightning.ts` | NEA lightning fetch + radius filter |
| `lib/wind.ts` | NEA wind speed + direction fetch, joined per station |
| `lib/search.ts` | OneMap location search |
| `lib/guidance.ts` | Raw checks → the wording on the status card |
| `lib/rateLimit.ts` | API-call budget that stops Check-mashing reaching data.gov.sg |
| `data/drone-zones.json` | The zone shapes (editable, no code change needed) |

## Deployment

Pushing to `main` builds a static export and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. There is no server: both upstream APIs send
`access-control-allow-origin: *`, so the browser calls them directly.

A Pages project site lives under `/<repo>/`, so the workflow sets
`NEXT_PUBLIC_BASE_PATH` to prefix every asset URL. Local dev leaves it unset and
serves from the root.

One consequence of having no server: no `x-api-key` for data.gov.sg, since any
key shipped to the browser would be public. The keyless quota is 6 calls per 10
seconds *per IP*, and `lib/rateLimit.ts` keeps each visitor inside it.

That limiter counts **API calls, not checks**, because one check now reads three
separate datasets — lightning, wind speed and wind direction. All three slots are
reserved before any request goes out, so a check can never fire half its calls
and tip the quota over mid-flight. The budget is 6 calls per 12 s (a longer
window than upstream's 10 s holding the same count is strictly more
conservative), which works out at two back-to-back checks before a short wait.
That is not a tight constraint in practice: NEA refreshes these feeds every one
to two minutes, so a third immediate check would read the same numbers.

## Data sources, and one important caveat

**Lightning** — `api-open.data.gov.sg/v2/real-time/api/weather?api=lightning`
(NEA via data.gov.sg, refreshed every 2 minutes). Live and authoritative.

**Wind** — `api-open.data.gov.sg/v2/real-time/api/wind-speed` (knots) and
`.../wind-direction` (degrees). Two datasets, one 17-station network, so they are
joined by `stationId`; a station missing either half is dropped. Direction is
meteorological — the bearing the wind blows *from*.

Singapore has only 17 wind stations, so a 2 km circle often contains none. When
that happens the app falls back to the nearest station island-wide and says so on
the card, rather than reporting nothing. Where several stations sit inside the
circle it headlines the **strongest** reading, because a pre-flight call should
follow the worst case in the area. The reading is a 10-minute average, so it does
not capture gusts or turbulence around buildings — the card says that too.

**Drone zones** — *not* live. OneMap's Drone Query is a browser-only tool; their
public API exposes only auth, search, routing, geocoding, population and themes,
with no drone endpoint. So the zones are a static, deliberately coarse file
traced from the CAAS no-fly map: 5 km rings around the five aerodromes, plus a
few protected areas. Good for a pre-flight hint, **not** good enough to fly on.
The UI says so in the footer and on the card.

To swap in a real feed later, `findZonesInRadius()` in `lib/zones.ts` is the only
function that needs to change.

**Location search** — OneMap's `elastic/search`. It answers without a token,
which is why no OneMap account is needed.

## Deliberate behaviours

- **Nothing is cached.** Every check is a fresh read of NEA data, per the brief.
  The rate limiter, not a cache, is what protects the upstream quota.
- **The circle only turns green after a successful clean check.** An unchecked
  circle must never look like an all-clear.
- **Changing the location or radius clears the result.** A stale green card is
  the dangerous failure mode here.
- **The app never says "safe".** The strongest statement it makes is "nothing
  was detected".
- **A failed check is "unknown", not "clear".** If the wind or lightning fetch
  fails, that section says so and escalates nothing — `verdict()` treats a null
  wind speed as no information, never as calm air.
- **Wind thresholds follow Beaufort and consumer drone ratings.** 22 kt
  (Beaufort 6) is above the ~10.7 m/s "Level 5" resistance most consumer drones
  claim, so it forces *do not fly*; 17 kt (Beaufort 5) drops the card to
  *caution*. Both live in `lib/guidance.ts`.
