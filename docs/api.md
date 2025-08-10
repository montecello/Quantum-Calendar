# API Documentation

All endpoints return JSON. Base URL: your deployed domain (e.g., https://your-app.vercel.app).

## GET /api/sunevents
Returns sun events and moon illumination for a given date and location.

Query parameters:
- `lat` (float, required) — Latitude
- `lon` (float, required) — Longitude
- `tz` (string, required) — IANA time zone name (e.g., `Europe/London`)
- `date` (YYYY-MM-DD, required) — Local date
- `name` (string, optional) — Display name for location

Example:
- /api/sunevents?lat=51.48&lon=0.0&tz=Europe%2FLondon&date=2025-08-09&name=Greenwich

Response:
```json
{
  "text": "Location: Greenwich, England\nDawn: 03:41 (secondary: civil)\nSunrise: 04:56\nSunset: 21:03\nDusk: 22:16 (secondary: civil)\nMoon %: 82.14% -> 77.09%",
  "data": {
    "date": "2025-08-09",
    "location": "Greenwich, England",
    "lat": 51.48,
    "lon": 0.0,
    "tz": "Europe/London",
    "dawn": { "time": "03:41", "type": "civil" },
    "sunrise": "04:56",
    "sunset": "21:03",
    "dusk": { "time": "22:16", "type": "civil" },
    "moon_percent": { "today_dawn": 82.14, "tomorrow_dawn": 77.09 }
  }
}
```

Errors:
- 400 when params are missing or invalid
- 500 on internal errors

---

## GET /api/timezone
Resolves time zone from lat/lon.

Query parameters:
- `lat` (float, required)
- `lon` (float, required)

Example:
- /api/timezone?lat=51.48&lon=0.0

Response:
```json
{ "tz": "Europe/London" }
```

---

## GET /api/calendar
Generates a single-year custom calendar for a location (used by older views).

Query parameters:
- `lat` (float, required)
- `lon` (float, required)
- `tz` (string, required)

Response:
- JSON object with months and day boundaries; schema may evolve. Prefer the multi-year endpoint below in new clients.

---

## GET /api/multiyear-calendar
Returns multiple custom years with month start dates and lengths.

Query parameters:
- `lat` (float, required)
- `lon` (float, required)
- `tz` (string, required)
- `start_year` (int, required)
- `end_year` (int, required)

Example:
- /api/multiyear-calendar?lat=51.48&lon=0.0&tz=Europe%2FLondon&start_year=2000&end_year=2048

Response (truncated):
```json
[
  {
    "year": 2025,
    "months": [
      { "days": 30, "start": "2025-03-14T05:38:00+00:00" },
      { "days": 29, "start": "2025-04-13T04:50:00+00:00" }
      // ...
    ]
  }
]
```

Notes:
- `months[i].start` is the ISO timestamp for the first local dawn of that month (server time zone aware).
- Day counts vary by location due to dawn timing.

---

## Rate limiting and auth
- No authentication is required in this build.
- Add a proxy with API-keyed upstreams as needed; keep third-party secrets on the server.

## Error schema
```json
{ "error": "message" }
```
