# FlyClear SG — Drone Pre-Flight Zone & Lightning Checker

## Problem Statement

Drone users in Singapore need a fast way to answer two pre-flight questions:

1. **Can I fly at this selected location, or is it within a no-fly / restricted area?**
2. **Is there recent lightning activity nearby that makes flying unsafe?**

Today, users may need to check drone-zone restrictions and weather risks separately. **FlyClear SG** combines both checks into a single map-based pre-flight assistant.

The app is not a replacement for CAAS requirements. It helps users make a better preliminary decision before flying.

## Target Users

- Recreational drone users
- Drone hobbyists
- Educational drone users
- Small commercial drone operators doing preliminary site checks

## Core App Idea

The main interface is a **map of Singapore**.

The user can:

- Use their current GPS location or search for a location.
- Select a radius: **2 km, 5 km, or 10 km**.
- See a circular radius overlay centred on the user’s current or selected location.
- View recent lightning observations inside the selected radius.
- Check no-fly and allowed-fly status using **OneMap Drone Query**.
- Receive a simple pre-flight status card.

Next.js frontend + backend routes
Map library: Leaflet or Mapbox

## Main Map Interface

The map should show the selected location as the centre point.

Around that point, the app creates a **circle** based on the user-selected radius:

- **2 km**
- **5 km**
- **10 km**

Only information relevant to the selected circle should be visually emphasised.

### Map Layers

| Map Element | Display |
|---|---|
| User / selected location | Centre marker |
| Selected radius | Circle around centre point |
| Lightning observations | Yellow lightning bolt pins inside the circle |
| No-fly zones | Red areas inside the circle |
| Allowed-fly zones | Green areas inside the circle |
| Status card | Summary of drone-zone and lightning checks |

### Visual Behaviour

- Lightning observations inside the selected radius should appear as **yellow lightning bolt pins**.
- No-fly areas within the selected radius should be shown in **red**.
- Allowed-fly areas within the selected radius should be shown in **green**.
- Areas outside the selected radius can be muted or hidden to keep the interface focused.
- The selected radius circle should update when the user changes from 2 km to 5 km or 10 km.

## Data Sources

## 1. Lightning Observation Dataset — NEA via data.gov.sg

Used for detecting recent lightning observations near the user’s selected location.

The dataset is based on MSS’ Lightning Detection System and is updated on data.gov.sg at **2-minute intervals**, with a typical delay of a few minutes. NEA notes that most lightning strokes occur within **5–6 km** of a thunderstorm cloud, while lightning from storms more than **10 km** away can still affect a location.

Important limitations:

- Cloud-to-ground lightning location accuracy can vary.
- Cloud-to-cloud lightning location accuracy is less precise.
- Missed detections, false detections, technical gaps, and later corrections may occur.

App wording should therefore say:

> “No recent lightning observation found nearby.”

Not:

> “It is safe to fly.”

## 2. OneMap Drone Query — CAAS / OneMap

Used for checking whether the selected location or planned flying area is within a drone no-fly or restricted area.

The app should use **OneMap Drone Query** as the drone-zone checking source. OneMap API usage should be designed carefully to avoid excessive requests, including by caching tokens and avoiding unnecessary repeated calls. OneMap’s token management guidance recommends temporary token caching to avoid overloading the API and risking rate-limited bans.

## User Flow

1. User opens the app.
2. The main screen displays a map.
3. The app requests location access.
4. User either:
   - uses current GPS location, or
   - searches/selects another location.
5. App places a centre marker at the selected location.
6. User selects radius: **2 km / 5 km / 10 km**.
7. App draws a circle around the selected location.
8. App checks:
   - lightning observations inside the circle
   - no-fly / allowed-fly status using OneMap Drone Query
9. App displays:
   - yellow lightning pins inside the circle
   - red no-fly zones inside the circle
   - green allowed-fly zones inside the circle
   - a pre-flight status card

## Status Card Example

```text
Location: Yishun Field
Selected radius: 5 km

Drone Zone:
No-fly zones detected within selected radius.
Check red areas on the map.

Lightning:
Lightning observations detected within 5 km.

Pre-flight Guidance:
Do not fly now. Recheck lightning conditions and confirm all CAAS requirements before operating.
```

## Decision Logic

## Lightning Check

```text
For each lightning observation:
  calculate distance from selected location

If observation is within selected radius:
  show yellow lightning bolt pin on map
  include it in the status card
```

Suggested message logic:

```text
If lightning observation is within 2 km:
  Show: "Lightning observed very near this location. Do not fly."

Else if lightning observation is within 5 km:
  Show: "Lightning observed nearby. Flying is not recommended."

Else if lightning observation is within 10 km:
  Show: "Lightning observed within 10 km. Monitor conditions closely."

Else:
  Show: "No recent lightning observation found within selected radius."
```

## Drone Zone Check

```text
Use OneMap Drone Query for the selected location or planned flight area.

If OneMap indicates no-fly or restricted area:
  show affected area in red
  show warning in status card

If OneMap indicates no restriction detected:
  show allowed-fly area in green
  show status in status card
```

Important wording:

```text
"Allowed-fly zone" means no OneMap Drone Query restriction was detected for the selected area.
It does not guarantee that flying is legal or safe.
```

The app should remind users to check the **entire planned flight area**, not only the take-off point.

## Rate Limit Usage

The app must avoid excessive calls to both **data.gov.sg** and **OneMap**.

### data.gov.sg Lightning Observation

data.gov.sg rate limits reset every **10 seconds**. For v2 real-time APIs, the stated limits are:

- **6 calls / 10 seconds** without API key
- **12 calls / 10 seconds** with Dev API key
- **30 calls / 10 seconds** with Prod API key

Usage design:

- Fetch lightning observations server-side.
- Do not call the lightning API for every user pan or zoom.
- Use a data.gov.sg API key for development and production.
- If the API returns rate-limit errors, back off.

### OneMap Drone Query

Usage design:

- Query only when the user confirms a selected location or changes the selected flight area.
- Do not query continuously while the user drags the map.
- Debounce map clicks, search changes, and location updates.
- Store and reuse OneMap access tokens instead of requesting a new token for every API call.
- Refresh tokens only when needed.
- If OneMap rate-limits the app, back off and ask the user to retry instead of repeatedly calling the API.

OneMap guidance recommends caching access tokens temporarily to avoid unnecessary calls and reduce the risk of rate-limited bans.

## MVP Features

No database and do not cache the results. 

**ALWAYS Respect the rate limits.** 

Indicate a "check" button that the user will press. If the user clicks on the "check" button too many times, do not continue to send the queries to the APIs, stop and then display a simple warning message for the user.

1. **Map-first interface**
   - The main screen is a Singapore map.
   - User location or searched location is shown as the centre point.

2. **Location selection**
   - Use current GPS location.
   - Search for another location.
   - Tap on map to select a planned flying point.

3. **Radius selector**
   - User can choose **2 km, 5 km, or 10 km**.
   - App draws a circle around the selected location.
   - Circle updates immediately when radius changes.

4. **Lightning observation layer**
   - Fetch NEA Lightning Observation data from data.gov.sg.
   - Show lightning observations inside the selected circle.
   - Display them as **yellow lightning bolt pins**.
   - Show latest lightning data timestamp.

5. **Drone-zone layer**
   - Use OneMap Drone Query to check the selected area.
   - Show no-fly zones as **red** inside the selected circle.
   - Show allowed-fly areas as **green** inside the selected circle.
   - Make clear that green means “no OneMap restriction detected,” not guaranteed permission.

6. **Pre-flight status card**
   - Summarise selected location.
   - Show selected radius.
   - Indicate whether lightning was observed nearby.
   - Indicate whether no-fly zones were detected.
   - Provide clear next-step guidance.

7. **Rate-limit-safe API usage**
   - Server-side caching for lightning observations.
   - Debounced OneMap Drone Query calls.
   - Token caching for OneMap.
   - Graceful handling of rate-limit errors.

8. **Safety and legality disclaimer**
   - Explain that the app is a pre-flight assistant.
   - Remind users to comply with CAAS rules and check the full planned flight area.
   - Avoid saying that a location is definitely safe or legal to fly.

## Product Positioning

**FlyClear SG** helps drone users in Singapore make better pre-flight decisions by combining:

- recent lightning observations from **NEA / data.gov.sg**
- drone-zone checking through **OneMap Drone Query**

It should be positioned as:

> “A Singapore drone pre-flight zone and lightning checker.”

Not as:

> “A guarantee that flying is legal or safe.”