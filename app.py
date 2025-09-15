from flask import Flask, render_template, request, jsonify, send_from_directory

from backend.geolocation import parse_coordinates, get_timezone

from backend.data import load_all_data



from backend.astronomy.sun import print_today_sun_events
from backend.astronomy.moon import print_today_moon_events
from backend.astronomy.years import print_multi_year_calendar
from backend.astronomy.year import print_yearly_events

import os
import logging

# Load .env for local development (safe on Vercel; ignored if no .env)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Use absolute paths for templates/static (safer on serverless)
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "frontend", "templates"),
    static_folder=os.path.join(BASE_DIR, "frontend", "static"),
    static_url_path="/static",
)

# Register API blueprint for /api/calendar and /api/multiyear-calendar endpoints
from backend.routes import api
app.register_blueprint(api)


# MongoDB setup
mongo_client = None
mongo_db = None

def get_mongo_client():
    global mongo_client, mongo_db
    if mongo_client is None:
        try:
            from pymongo import MongoClient
            from config import MONGODB_URI, DATABASE_NAME

            logging.info("🔧 [MONGODB] Attempting to connect to MongoDB Atlas")
            logging.info(f"🔧 [MONGODB] MongoDB URI configured: {'Yes' if MONGODB_URI else 'No'}")
            logging.info(f"🔧 [MONGODB] Database name: {DATABASE_NAME}")

            if MONGODB_URI:
                logging.info("🔌 [MONGODB] Creating MongoDB client...")
                mongo_client = MongoClient(MONGODB_URI)
                mongo_db = mongo_client[DATABASE_NAME]

                # Test the connection
                logging.info("🔌 [MONGODB] Testing connection with ping...")
                mongo_client.admin.command('ping')
                logging.info("✅ [MONGODB] Successfully connected to MongoDB Atlas")

                # Log connection details (without sensitive info)
                logging.info(f"✅ [MONGODB] Database: {DATABASE_NAME}")
                logging.info(f"✅ [MONGODB] Server info: {mongo_client.server_info()['version']}")

            else:
                logging.warning("⚠️ [MONGODB] MONGODB_URI not configured")

        except ImportError as import_error:
            logging.error(f"❌ [MONGODB] PyMongo import failed: {import_error}")
        except Exception as conn_error:
            logging.error(f"❌ [MONGODB] MongoDB connection failed: {conn_error}")
            logging.error(f"❌ [MONGODB] Error type: {type(conn_error).__name__}")
            logging.error(f"❌ [MONGODB] Error details: {str(conn_error)}")

    return mongo_client, mongo_db


# Initialize MongoDB connection and store in app config
client, db = get_mongo_client()
app.config['mongo_client'] = client
app.config['mongo_db'] = db


# Load astronomical data at startup
# Move heavy data loads under __main__ to avoid cold-start costs on Vercel imports
# load_all_data()

def data_path(*parts: str) -> str:
    return os.path.join(BASE_DIR, *parts)

# Lazy-load CSV data on first request (Vercel won't run __main__ on cold start)
_DATA_LOADED = False

def ensure_data_loaded() -> None:
    global _DATA_LOADED
    if not _DATA_LOADED:
        try:
            load_all_data()
            _DATA_LOADED = True
            logging.info("Astronomical CSV data loaded")
        except Exception:
            logging.exception("Failed to load astronomical CSV data")


# Print today's sun, moon, and yearly events for a default location (Greenwich, UTC)
# Move demo prints under __main__ to avoid noisy logs in serverless
# print("\n--- Sun Events for Today (Demo: Greenwich, UTC, lat=51.48, lon=0.0) ---")
# print_today_sun_events(51.48, 0.0, 'UTC')
# print("--- End Sun Events ---\n")

# print_today_moon_events(51.48, 0.0, 'UTC', location_name="Greenwich, UK")

# Print yearly events for London, UK (Europe/London timezone)
# print_yearly_events(51.5074, -0.1278, 'Europe/London', location_name="London, ENG, United Kingdom")

@app.route("/api/health")
def api_health():
    return {
        "ok": True,
        "astro": os.environ.get("ASTRO_API_BASE", ""),
    }

# Bible SDK routes removed - focusing on XML parsing instead

# Serve favicon if present (avoid noisy 404s)
@app.route("/favicon.ico")
def favicon():
    for name in ("favicon.ico", "favicon.png"):
        path = os.path.join(BASE_DIR, "frontend", "static", name)
        if os.path.exists(path):
            return send_from_directory(os.path.join(BASE_DIR, "frontend", "static"), name)
    return ("", 204)


@app.route('/')
def home():
    ensure_data_loaded()
    print("Rendering index.html")
    return render_template('index.html')

@app.route('/select-location', methods=['POST'])
def select_location():
    ensure_data_loaded()
    data = request.get_json()
    lat = float(data.get('lat'))
    lon = float(data.get('lon'))
    name = data.get('name')
    year = data.get('year')
    tz = get_timezone(lat, lon)
    tz_name = tz.zone or 'UTC'
    from datetime import datetime, timedelta
    import pytz
    now_local = datetime.now(pytz.timezone(tz_name))
    print(f"Selected location: {name} | {lat}, {lon} | Timezone: {tz_name} | Year: {year}")

    # Sun events summary (console)
    print(f"\n--- Sun Events for Today ({name}, lat={lat}, lon={lon}, tz={tz_name}) ---")
    print_today_sun_events(lat, lon, tz_name)
    print("--- End Sun Events ---\n")

    # Moon/month calculations
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    from backend.astronomy.moon import find_prev_next_full_moon, find_first_dawn_after, count_dawn_cycles
    from backend.astronomy.sun import get_event_with_fallback
    prev_full, next_full = find_prev_next_full_moon(now_utc)
    dawn_after_prev, _ = find_first_dawn_after(prev_full, lat, lon, tz_name)
    dawn_after_next, _ = find_first_dawn_after(next_full, lat, lon, tz_name)
    days_in_month = count_dawn_cycles(dawn_after_prev, dawn_after_next, lat, lon, tz_name) if (dawn_after_prev and dawn_after_next) else 29

    # Current day in month
    current_day = None
    if dawn_after_prev and dawn_after_next:
        dawns = [dawn_after_prev]
        current = dawn_after_prev
        while True:
            next_date = (current + timedelta(days=1)).date()
            nd, _ = get_event_with_fallback('dawn', lat, lon, tz_name, next_date)
            if not nd or nd > dawn_after_next:
                break
            dawns.append(nd)
            current = nd
        if dawns and dawns[-1] < dawn_after_next:
            dawns.append(dawn_after_next)
        for i in range(len(dawns) - 1):
            if dawns[i] <= now_local < dawns[i + 1]:
                current_day = i + 1
                break
    if current_day is None:
        current_day = 1 if (dawn_after_prev and now_local < dawn_after_prev) else days_in_month

    # Current month in year
    from backend.astronomy.year import find_prev_next_new_year, get_full_moons_in_range
    prev_anchor, next_anchor = find_prev_next_new_year(now_utc)
    moons = get_full_moons_in_range(prev_anchor, next_anchor)
    month_num = None
    for i, m in enumerate(moons):
        d1, _ = find_first_dawn_after(m, lat, lon, tz_name)
        d2, _ = find_first_dawn_after(moons[i + 1] if i + 1 < len(moons) else next_anchor, lat, lon, tz_name)
        if d1 and d2 and d1 <= now_local < d2:
            month_num = i + 1
            break
    if month_num is None:
        month_num = 1 if (dawn_after_prev and now_local < dawn_after_prev) else len(moons)

    print_today_moon_events(lat, lon, tz_name, location_name=name)
    if year:
        anchor_year = int(year)
        _ = pytz.UTC.localize(datetime(anchor_year, 1, 1))  # keep simple; yearly decides anchors
        print_yearly_events(lat, lon, tz_name, location_name=name)
    else:
        print_yearly_events(lat, lon, tz_name, location_name=name)

    # Multi-year calendar summary
    from backend.astronomy.years import print_multi_year_calendar
    now = datetime.now(pytz.UTC)
    print(f"\n--- Multi-Year Calendar ({name}, {now.year-1}-{str(now.year+1)[-2:]}) ---")
    print_multi_year_calendar(now.year - 1, now.year + 1, lat, lon, tz_name)
    print("--- End Multi-Year Calendar ---\n")

    # Build monthsInYear list
    months_in_year = []
    for i, m in enumerate(moons):
        d1, _ = find_first_dawn_after(m, lat, lon, tz_name)
        d2, _ = find_first_dawn_after(moons[i + 1] if i + 1 < len(moons) else next_anchor, lat, lon, tz_name)
        if d1 and d2:
            days = count_dawn_cycles(d1, d2, lat, lon, tz_name)
        else:
            days = '--'
        months_in_year.append({'days': days})

    # Year range string
    start_year = prev_anchor.year
    end_year = next_anchor.year if next_anchor.month > 6 else next_anchor.year - 1
    year_range = f"{start_year}-{str(end_year)[-2:]}"

    return jsonify({
        'status': 'ok',
        'timezone': tz_name,
        'year': year,
        'monthNum': month_num,
        'currentDay': current_day,
        'daysInMonth': days_in_month,
        'monthsInYear': months_in_year,
        'yearRange': year_range
    })

@app.route('/how_it_works')
def how_it_works():
    ensure_data_loaded()
    return render_template('how_it_works.html')

@app.route('/the_letters')
def the_letters():
    ensure_data_loaded()
    return render_template('the_letters.html')

@app.route('/primitive_roots')
def primitive_roots():
    ensure_data_loaded()
    return render_template('primitive_roots.html')

@app.route('/font-test')
def font_test():
    return render_template('font_test.html')

@app.route('/font-comparison')
def font_comparison():
    return render_template('complete_font_comparison_test.html')

@app.route('/api/generate-heatmaps', methods=['POST'])
def generate_heatmaps():
    """Generate lunar month heatmap for current month"""
    try:
        ensure_data_loaded()

        # Import the heatmap generation function
        import subprocess
        import sys
        import os

        # Path to the heatmap generation script
        script_path = os.path.join(BASE_DIR, 'backend', 'astronomy', 'map', 'generate_lunar_heatmaps.py')

        # Run the script in background
        process = subprocess.Popen([
            sys.executable, script_path
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=BASE_DIR)

        return jsonify({
            'status': 'generating',
            'message': 'Heatmap generation started'
        })

    except Exception as e:
        logging.error(f"Error starting heatmap generation: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

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
