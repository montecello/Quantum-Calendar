from flask import Flask, render_template, request, jsonify, send_from_directory

from backend.geolocation import parse_coordinates, get_timezone

from backend.data import load_all_data



from backend.astronomy.sun import print_today_sun_events
from backend.astronomy.moon import print_today_moon_events
from backend.astronomy.years import print_multi_year_calendar
from backend.astronomy.year import print_yearly_events

import os
import logging
from colorama import Fore, Style
import json

# Load .env for local development (safe on Vercel; ignored if no .env)
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
print(f"Debug: MONGODB_URI = {os.getenv('MONGODB_URI')}")

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
            if MONGODB_URI:
                mongo_client = MongoClient(MONGODB_URI)
                mongo_db = mongo_client[DATABASE_NAME]
                logging.info("Connected to MongoDB Atlas")
            else:
                logging.warning("MONGODB_URI not configured")
        except ImportError:
            logging.warning("PyMongo not installed")
        except Exception as e:
            logging.error(f"Failed to connect to MongoDB: {e}")
    return mongo_client, mongo_db


# Initialize MongoDB connection and store in app config
client, db = get_mongo_client()
app.config['mongo_client'] = client
app.config['mongo_db'] = db


def check_mongo_connection():
    """Check MongoDB connection and database access with colored logs."""
    try:
        from config import STRONG_COLLECTION, KJV_COLLECTION
        client, db = get_mongo_client()
        if client is None or db is None:
            print(Fore.RED + "✗ MongoDB connection failed: Client or database not initialized" + Style.RESET_ALL)
            return False
        
        # Try to ping the database
        client.admin.command('ping')
        
        # Try to access collections
        strong_count = db[STRONG_COLLECTION].count_documents({})
        kjv_count = db[KJV_COLLECTION].count_documents({})
        
        print(Fore.GREEN + f"✓ MongoDB connected successfully" + Style.RESET_ALL)
        print(Fore.GREEN + f"✓ Database '{db.name}' accessible" + Style.RESET_ALL)
        print(Fore.GREEN + f"✓ Collection '{STRONG_COLLECTION}' has {strong_count} documents" + Style.RESET_ALL)
        print(Fore.GREEN + f"✓ Collection '{KJV_COLLECTION}' has {kjv_count} documents" + Style.RESET_ALL)
        return True
    except ImportError as e:
        print(Fore.RED + f"✗ MongoDB check failed: Missing dependency - {e}" + Style.RESET_ALL)
        return False
    except Exception as e:
        print(Fore.RED + f"✗ MongoDB connection or access failed: {e}" + Style.RESET_ALL)
        return False


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
    # print(f"\n--- Sun Events for Today ({name}, lat={lat}, lon={lon}, tz={tz_name}) ---")
    # print_today_sun_events(lat, lon, tz_name)
    # print("--- End Sun Events ---\n")

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

    # print_today_moon_events(lat, lon, tz_name, location_name=name)
    if year:
        anchor_year = int(year)
        _ = pytz.UTC.localize(datetime(anchor_year, 1, 1))  # keep simple; yearly decides anchors
        # print_yearly_events(lat, lon, tz_name, location_name=name)

    # Multi-year calendar summary
    # print(f"\n--- Multi-Year Calendar ({name}, {now.year-1}-{str(now.year+1)[-2:]}) ---")
    # print_multi_year_calendar(now.year - 1, now.year + 1, lat, lon, tz_name)
    # print("--- End Multi-Year Calendar ---\n")

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

@app.route('/api/strongs-data')
def get_strongs_data():
    limit = int(request.args.get('limit', 100))
    query = request.args.get('query', '').strip()
    print(f"INFO: API /api/strongs-data called with query='{query}', limit={limit}")
    
    try:
        if mongo_db:
            print("INFO: Using MongoDB for Strong's data")
            collection = mongo_db["strongs"]
            
            if query:
                # Search with regex - case insensitive
                regex = {"$regex": query, "$options": "i"}
                data = list(collection.find({
                    "$or": [
                        {"hebrew": regex},
                        {"english": regex},
                        {"strongsNumber": {"$regex": query}}
                    ]
                }).limit(limit))
                print(f"INFO: MongoDB search for '{query}' found {len(data)} documents")
                
                # Log first few results for debugging
                for i, result in enumerate(data[:3]):
                    strongs_num = result.get('strongsNumber', 'N/A')
                    english = result.get('english', 'N/A')
                    hebrew = result.get('hebrew', 'N/A')
                    print(f"INFO: MongoDB result {i+1}: H{strongs_num} - {english} - {hebrew}")
            else:
                data = list(collection.find({}, {'_id': 0}).limit(limit))
                print(f"INFO: Retrieved {len(data)} documents from MongoDB (no query)")
            
            if data:
                return jsonify(data)
            else:
                print(f"INFO: No MongoDB results for '{query}', falling back to JSON")
        
        # Fallback to JSON
        print("INFO: MongoDB not available, falling back to JSON")
        try:
            with open(os.path.join(BASE_DIR, 'backend', 'data', 'strongs.json'), 'r') as f:
                all_data = json.load(f)
            
            print(f"INFO: JSON loaded with {len(all_data)} entries")
            
            if query:
                # Filter JSON data with better matching
                filtered = []
                for entry in all_data:
                    hebrew = entry.get('hebrew', '').lower()
                    english = entry.get('english', '').lower()
                    strongs_num = str(entry.get('strongsNumber', '')).lower()
                    
                    if (query.lower() in hebrew or 
                        query.lower() in english or 
                        query.lower() in strongs_num):
                        filtered.append(entry)
                        if len(filtered) >= limit:
                            break
                data = filtered
                print(f"INFO: JSON search for '{query}' found {len(data)} entries")
                
                # Log first few results for debugging
                for i, result in enumerate(data[:3]):
                    strongs_num = result.get('strongsNumber', 'N/A')
                    english = result.get('english', 'N/A')
                    hebrew = result.get('hebrew', 'N/A')
                    print(f"INFO: JSON result {i+1}: H{strongs_num} - {english} - {hebrew}")
            else:
                data = all_data[:limit]
                print(f"INFO: Loaded {len(data)} entries from JSON (no query)")
            
            return jsonify(data)
        except Exception as e:
            print(f"ERROR: Failed to load strongs.json: {e}")
            return jsonify([])
    except Exception as e:
        print(f"ERROR: Error in get_strongs_data: {e}")
        return jsonify([])

@app.route('/api/kjv-data')
def get_kjv_data():
    limit = int(request.args.get('limit', 100))
    query = request.args.get('query', '').strip()
    print(f"INFO: API /api/kjv-data called with query='{query}', limit={limit}")
    
    try:
        # Try MongoDB first
        if mongo_db is not None:
            print("INFO: Using MongoDB for KJV data")
            collection = mongo_db["verses"]
            
            if query:
                # Search verses by text content
                regex = {"$regex": query, "$options": "i"}
                print(f"DEBUG: Searching with regex: {regex}")
                matched_verses = list(collection.find({
                    "text": regex
                }).limit(limit))
                print(f"INFO: MongoDB search for '{query}' found {len(matched_verses)} verses")
                
                # Debug: Print first match if any
                if matched_verses:
                    print(f"DEBUG: First match text: {matched_verses[0].get('text', '')[:100]}")
                
                if len(matched_verses) == 0:
                    # Try a direct test search
                    test_egypt = list(collection.find({"text": {"$regex": "Egypt", "$options": "i"}}).limit(2))
                    print(f"DEBUG: Direct Egypt search found {len(test_egypt)} verses")
                    if test_egypt:
                        print(f"DEBUG: Direct search result: {test_egypt[0].get('text', '')[:100]}")
                
                # Count Strong's number frequencies across matched verses
                strongs_freq = {}
                for verse in matched_verses:
                    strongs_list = verse.get('strongsNumbers', [])
                    for strongs_num in strongs_list:
                        strongs_freq[strongs_num] = strongs_freq.get(strongs_num, 0) + 1
                
                # Sort Strong's numbers by frequency (descending)
                sorted_strongs = sorted(strongs_freq.items(), key=lambda x: x[1], reverse=True)
                print(f"INFO: Found {len(sorted_strongs)} unique Strong's numbers")
                if sorted_strongs:
                    print(f"INFO: Top 5 Strong's by frequency: {sorted_strongs[:5]}")
                
                # Return verses with frequency-sorted Strong's numbers
                return jsonify({
                    'verses': matched_verses,
                    'strongsFrequency': sorted_strongs,
                    'totalVerses': len(matched_verses)
                })
            else:
                data = list(collection.find({}, {'_id': 0}).limit(limit))
                print(f"INFO: Retrieved {len(data)} verses from MongoDB (no query)")
                return jsonify({'verses': data, 'strongsFrequency': [], 'totalVerses': len(data)})
        
        # Fallback to JSON
        print("INFO: Using JSON fallback for KJV data")
        try:
            with open(os.path.join(BASE_DIR, 'backend', 'data', 'verses.json'), 'r') as f:
                all_data = json.load(f)
            
            print(f"INFO: JSON loaded with {len(all_data)} verses")
            
            if query:
                # Filter JSON data by text content
                filtered = []
                for entry in all_data:
                    text = entry.get('text', '').lower()
                    if query.lower() in text:
                        filtered.append(entry)
                        if len(filtered) >= limit:
                            break
                
                # Count Strong's number frequencies
                strongs_freq = {}
                for verse in filtered:
                    strongs_list = verse.get('strongsNumbers', [])
                    for strongs_num in strongs_list:
                        strongs_freq[strongs_num] = strongs_freq.get(strongs_num, 0) + 1
                
                # Sort Strong's numbers by frequency (descending)
                sorted_strongs = sorted(strongs_freq.items(), key=lambda x: x[1], reverse=True)
                print(f"INFO: JSON search for '{query}' found {len(filtered)} verses")
                print(f"INFO: Found {len(sorted_strongs)} unique Strong's numbers")
                if sorted_strongs:
                    print(f"INFO: Top 5 Strong's by frequency: {sorted_strongs[:5]}")
                
                return jsonify({
                    'verses': filtered,
                    'strongsFrequency': sorted_strongs,
                    'totalVerses': len(filtered)
                })
            else:
                return jsonify({'verses': all_data[:limit], 'strongsFrequency': [], 'totalVerses': len(all_data[:limit])})
            
        except Exception as e:
            print(f"ERROR: Failed to load verses.json: {e}")
            return jsonify({'verses': [], 'strongsFrequency': [], 'totalVerses': 0})
    except Exception as e:
        print(f"ERROR: Error in get_kjv_data: {e}")
        return jsonify({'verses': [], 'strongsFrequency': [], 'totalVerses': 0})

if __name__ == "__main__":
    # Load data only for local dev to keep Vercel cold starts fast
    load_all_data()

    # Only print startup checks in the main process (not reloader)
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        # Check MongoDB connection
        print("\n--- MongoDB Connection Check ---")
        check_mongo_connection()
        print("--- End MongoDB Check ---\n")

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
