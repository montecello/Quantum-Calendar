from flask import Flask, render_template, request, jsonify

from backend.geolocation import parse_coordinates, get_timezone

from backend.data import load_all_data



from backend.astronomy.sun import print_today_sun_events
from backend.astronomy.moon import print_today_moon_events
from backend.astronomy.years import print_multi_year_calendar
from backend.astronomy.year import print_yearly_events

import os

# Load .env for local development (safe on Vercel; ignored if no .env)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")

app = Flask(
    __name__,
    template_folder="frontend/templates",
    static_folder="frontend/static"
)

# Register API blueprint for /api/calendar and /api/multiyear-calendar endpoints
from backend.routes import api
app.register_blueprint(api)


# Load astronomical data at startup
# Move heavy data loads under __main__ to avoid cold-start costs on Vercel imports
# load_all_data()




# Print today's sun, moon, and yearly events for a default location (Greenwich, UTC)
# Move demo prints under __main__ to avoid noisy logs in serverless
# print("\n--- Sun Events for Today (Demo: Greenwich, UTC, lat=51.48, lon=0.0) ---")
# print_today_sun_events(51.48, 0.0, 'UTC')
# print("--- End Sun Events ---\n")

# print_today_moon_events(51.48, 0.0, 'UTC', location_name="Greenwich, UK")

# Print yearly events for London, UK (Europe/London timezone)
# print_yearly_events(51.5074, -0.1278, 'Europe/London', location_name="London, ENG, United Kingdom")


@app.route('/')
def home():
    print("Rendering index.html")
    return render_template('index.html')

@app.route('/select-location', methods=['POST'])
def select_location():
    data = request.get_json()
    lat = float(data.get('lat'))
    lon = float(data.get('lon'))
    name = data.get('name')
    year = data.get('year')
    tz = get_timezone(lat, lon)
    print(f"Selected location: {name} | {lat}, {lon} | Timezone: {tz.zone} | Year: {year}")
    from backend.astronomy.sun import print_today_sun_events
    from backend.astronomy.moon import print_today_moon_events
    from backend.astronomy.year import print_yearly_events, find_prev_next_new_year
    print(f"\n--- Sun Events for Today ({name}, lat={lat}, lon={lon}, tz={tz.zone}) ---")
    print_today_sun_events(lat, lon, tz.zone)
    print("--- End Sun Events ---\n")
    # Get moon events for calendar rendering
    from datetime import datetime
    import pytz
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    from backend.astronomy.moon import find_prev_next_full_moon, find_first_dawn_after, count_dawn_cycles
    from backend.astronomy.sun import get_event_with_fallback
    from datetime import timedelta
    prev_full, next_full = find_prev_next_full_moon(now_utc)
    dawn_after_prev, _ = find_first_dawn_after(prev_full, lat, lon, tz.zone)
    dawn_after_next, _ = find_first_dawn_after(next_full, lat, lon, tz.zone)
    days_in_month = count_dawn_cycles(dawn_after_prev, dawn_after_next, lat, lon, tz.zone) if (dawn_after_prev and dawn_after_next) else 29
    # Find current day in month
    dawns = [dawn_after_prev]
    current = dawn_after_prev
    now_local = datetime.now(pytz.timezone(tz.zone))
    while True:
        next_date = (current + timedelta(days=1)).date()
        next_dawn, _ = get_event_with_fallback('dawn', lat, lon, tz.zone, next_date)
        if not next_dawn or next_dawn > dawn_after_next:
            break
        dawns.append(next_dawn)
        current = next_dawn
    if dawns[-1] < dawn_after_next:
        dawns.append(dawn_after_next)
    current_day = None
    for i in range(len(dawns)-1):
        if dawns[i] <= now_local < dawns[i+1]:
            current_day = i+1
            break
    if current_day is None:
        if now_local < dawns[0]:
            current_day = 1
        else:
            current_day = days_in_month
    # Find current month in year
    from backend.astronomy.year import find_prev_next_new_year, get_full_moons_in_range
    prev_anchor, next_anchor = find_prev_next_new_year(now_utc)
    moons = get_full_moons_in_range(prev_anchor, next_anchor)
    month_num = None
    for i, moon in enumerate(moons):
        dawn, _ = find_first_dawn_after(moon, lat, lon, tz.zone)
        next_dawn, _ = find_first_dawn_after(moons[i+1] if i+1 < len(moons) else next_anchor, lat, lon, tz.zone)
        if dawn and next_dawn and dawn <= now_local < next_dawn:
            month_num = i+1
            break
    if month_num is None:
        if now_local < dawn_after_prev:
            month_num = 1
        else:
            month_num = len(moons)
    print_today_moon_events(lat, lon, tz.zone, location_name=name)
    # If year is provided, anchor yearly events to that year
    if year:
        anchor_year = int(year)
        jan1 = pytz.UTC.localize(datetime(anchor_year, 1, 1))
        prev_anchor, next_anchor = find_prev_next_new_year(jan1)
        print_yearly_events(lat, lon, tz.zone, location_name=name, anchor_override=prev_anchor)
    else:
        print_yearly_events(lat, lon, tz.zone, location_name=name)

    # Print multi-year calendar for selected location (previous, current, next year)
    from backend.astronomy.years import print_multi_year_calendar
    now = datetime.now(pytz.UTC)
    print(f"\n--- Multi-Year Calendar ({name}, {now.year-1}-{str(now.year+1)[-2:]}) ---")
    print_multi_year_calendar(now.year-1, now.year+1, lat, lon, tz.zone)
    print("--- End Multi-Year Calendar ---\n")
    # Build monthsInYear list
    months_in_year = []
    for i, moon in enumerate(moons):
        dawn, _ = find_first_dawn_after(moon, lat, lon, tz.zone)
        next_dawn, _ = find_first_dawn_after(moons[i+1] if i+1 < len(moons) else next_anchor, lat, lon, tz.zone)
        if dawn and next_dawn:
            days = count_dawn_cycles(dawn, next_dawn, lat, lon, tz.zone)
        else:
            days = '--'
        months_in_year.append({'days': days})
    # Calculate year range string
    start_year = prev_anchor.year
    end_year = next_anchor.year if next_anchor.month > 6 else next_anchor.year - 1
    year_range = f"{start_year}-{str(end_year)[-2:]}"
    return jsonify({
        'status': 'ok',
        'timezone': tz.zone,
        'year': year,
        'monthNum': month_num,
        'currentDay': current_day,
        'daysInMonth': days_in_month,
        'monthsInYear': months_in_year,
        'yearRange': year_range
    })

if __name__ == "__main__":
    # Load data only for local dev to keep Vercel cold starts fast
    load_all_data()

    # Demo prints for local run
    print("\n--- Sun Events for Today (Demo: Greenwich, UTC, lat=51.48, lon=0.0) ---")
    print_today_sun_events(51.48, 0.0, 'UTC')
    print("--- End Sun Events ---\n")

    print_today_moon_events(51.48, 0.0, 'UTC', location_name="Greenwich, UK")

    print_yearly_events(51.5074, -0.1278, 'Europe/London', location_name="London, ENG, United Kingdom")

    # Print multi-year calendar data for demo (Greenwich, 2024-2026) at the end
    print("\n--- Multi-Year Calendar (Greenwich, 2024-2026) ---")
    print_multi_year_calendar(2024, 2026, 51.48, 0.0, 'Europe/London')
    print("--- End Multi-Year Calendar ---\n")
    port = int(os.environ.get("PORT", "5001"))
    app.run(debug=True, port=port, host="0.0.0.0")
