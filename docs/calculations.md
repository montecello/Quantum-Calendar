# Calculations Documentation

This app builds a location-aware lunar calendar. Below are the core rules and data sources.

## Day begins (First Light)
- A day starts at local first light (astronomical dawn).
- Fallbacks at high latitudes or edge seasons:
  1. Nautical dawn
  2. Civil dawn
  3. Sunrise (last resort)
- The side panel shows fallback tags as “(secondary: …)”.
- Library: Astral (solar angles); time zones via pytz.

## Month begins (First Dawn after Full Moon)
- Compute the exact full moon (100% illumination) using Skyfield ephemerides (de421.bsp).
- For the selected location and time zone, the new month starts at the first local dawn strictly after the full-moon instant.
- Month length = number of dawns between consecutive month starts (29 or 30 in practice; location dependent).

## Week rhythm
- The month is segmented into natural 7‑day periods aligned to lunar markers. Your UI highlights days 1, 8, 15, 22, 29 for weekly cadence.

## Year begins (New Year’s Day)
- Derived in `data/new_years_day_calculator.py` from precomputed CSVs:
  - `data/full_moon_times.csv` — full moon instants (UTC)
  - `data/spica_moon_crossings.csv` — moments when the moon crosses Spica
  - `data/sun_hamal_crossings.csv` — Sun crossing Hamal
- For each year:
  1. For each full moon, find the latest Spica crossing before it and measure the time gap.
  2. Select the full moon with the smallest gap to its preceding Spica crossing.
  3. Ensure this full moon occurs before the Sun–Hamal crossing; if not, step back to the prior full moon.
  4. The calendar’s New Year’s Day is the first local dawn after that selected full moon.

## Special days and styling (legend parity)
- Month start: highlighted (gold/bronze) — day 1.
- Weekly rest markers: days 8, 15, 22, 29 (royal blue).
- First-month sequence: day 14 (ruby red), 15 (emerald), 16 (orange), 17–21 (indigo), per UI.
- Seventh-month highlights: composite classes (emerald/ruby/orange/indigo) on specific days.
- Silver counter: starts at 3rd month, 9th day; increments to 50 days. The day after 50 is marked dark pink.
- Gregorian grid maps the same special classes by converting ISO dates to the custom month/day via `yearsData`.

## Time zones and calendars
- All internal astronomy uses UTC instants; local times are rendered via IANA time zones.
- The optional Gregorian view shows standard months, Sunday‑first weekday order, and clamps navigation to Mar 2000–Apr 2049.

## Dependencies
- Skyfield + jplephem (de421.bsp kernel)
- Astral (solar dawn/dusk)
- timezonefinder, pytz
- pandas (for CSVs)

## Limitations
- Ephemeris precision is bound to the bundled kernel and CSV ranges.
- Dawn detection uses standard solar depression angles; refraction/terrain can shift observed times.
- Edge cases near full‑moon instants vs. local dawn boundaries can differ by location.
- High-latitude fallbacks change day starts in some seasons.

## Files of interest
- `backend/astronomy/sun.py` — dawn/sunrise/sunset/dusk + moon illumination at dawn
- `backend/astronomy/year.py`, `years.py` — month/year boundaries and multi‑year data
- `frontend/static/js/calendar.js` — grid, special day classes, legend parity
- `frontend/static/js/gregorian.js` — standard calendar view
