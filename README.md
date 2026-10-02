# FlyClear SG

Singapore drone pre-flight zone & lightning checker. Pick a point, pick a radius,
press **Check** — the app reports restricted areas and recent NEA lightning
observations inside that circle.

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
| `lib/search.ts` | OneMap location search |
| `lib/guidance.ts` | Raw checks → the wording on the status card |
| `lib/rateLimit.ts` | Stops Check-button mashing reaching data.gov.sg |
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
seconds *per IP*, and `lib/rateLimit.ts` keeps each visitor well inside it.

## Data sources, and one important caveat

**Lightning** — `api-open.data.gov.sg/v2/real-time/api/weather?api=lightning`
(NEA via data.gov.sg, refreshed every 2 minutes). Live and authoritative.

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
