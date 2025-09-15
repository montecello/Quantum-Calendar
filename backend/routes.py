from flask import Blueprint, request, jsonify, send_from_directory
import logging
import os
import requests
from config import GEOAPIFY_API_KEY
from cachetools import TTLCache
from backend.calendar import get_calendar_for_year
from backend.astronomy.years import get_multi_year_calendar_data
from config import ASTRO_API_BASE

# MongoDB imports
try:
    from pymongo import MongoClient
    from config import MONGODB_URI, DATABASE_NAME, STRONG_COLLECTION, KJV_COLLECTION
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False
    logging.warning("MongoDB not available - using static file fallback")

# Add datetime import
from datetime import datetime

api = Blueprint('api', __name__)

# MongoDB client (lazy initialization)
_mongo_client = None
_db = None

def get_mongo_client():
    global _mongo_client, _db
    if _mongo_client is None and MONGODB_AVAILABLE and MONGODB_URI:
        try:
            _mongo_client = MongoClient(MONGODB_URI)
            _db = _mongo_client[DATABASE_NAME]
            logging.info("Connected to MongoDB Atlas")
        except Exception as e:
            logging.error(f"Failed to connect to MongoDB: {e}")
            _mongo_client = None
    return _db

# Cache geocoding responses for 1 hour to reduce API usage and latency
_geocode_cache = TTLCache(maxsize=256, ttl=3600)

# Sun events endpoint for frontend side panel
@api.route('/api/sunevents')
def api_sunevents():
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        tzname = request.args.get('tz', type=str)
        date_str = request.args.get('date', type=str)
        location_name = request.args.get('name', type=str, default=None)
        if lat is None or lon is None or not tzname or not date_str:
            return jsonify({'error': 'Missing or invalid parameters'}), 400
        from datetime import datetime
        from backend.astronomy.sun import get_sun_events_for_date
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception:
            return jsonify({'error': 'Invalid date format, expected YYYY-MM-DD'}), 400
        plain_text, json_data = get_sun_events_for_date(lat, lon, tzname, date_obj, location_name)
        return jsonify({'text': plain_text, 'data': json_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Timezone lookup endpoint for frontend location search
@api.route('/api/timezone')
def api_timezone():
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        if lat is None or lon is None:
            return jsonify({'error': 'Missing lat/lon'}), 400
        from backend.geolocation import get_timezone
        tz = get_timezone(lat, lon)
        return jsonify({'tz': tz.zone})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/api/calendar')
def api_calendar():
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        tzname = request.args.get('tz', type=str)

        logging.info(f"Received calendar request: lat={lat}, lon={lon}, tz={tzname}")

        if lat is None or lon is None or not tzname:
            logging.error("Missing or invalid parameters")
            return jsonify({"error": "Missing or invalid parameters"}), 400

        data = get_calendar_for_year(lat, lon, tzname)
        if not data or "months" not in data:
            logging.error("Calendar data generation failed")
            return jsonify({"error": "Calendar data generation failed"}), 500

        logging.info(f"Calendar data generated for lat={lat}, lon={lon}, tz={tzname}")
        return jsonify(data)

    except Exception as e:
        logging.exception("Exception in /api/calendar")
        return jsonify({"error": str(e)}), 500


# Multi-year calendar endpoint
@api.route('/api/multiyear-calendar')
def api_multiyear_calendar():
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        tzname = request.args.get('tz', type=str)
        start_year = request.args.get('start_year', type=int)
        end_year = request.args.get('end_year', type=int)

        logging.info(f"Received multiyear calendar request: lat={lat}, lon={lon}, tz={tzname}, start_year={start_year}, end_year={end_year}")

        if lat is None or lon is None or not tzname or start_year is None or end_year is None:
            logging.error("Missing or invalid parameters for multiyear calendar")
            return jsonify({"error": "Missing or invalid parameters"}), 400

        data = get_multi_year_calendar_data(start_year, end_year, lat, lon, tzname)
        if not data:
            logging.error("Multi-year calendar data generation failed")
            return jsonify({"error": "Multi-year calendar data generation failed"}), 500

        logging.info(f"Multi-year calendar data generated for lat={lat}, lon={lon}, tz={tzname}, years={start_year}-{end_year}")
        # Convert datetimes to isoformat for JSON
        for year in data:
            for month in year['months']:
                if month['start']:
                    month['start'] = month['start'].isoformat()
        return jsonify(data)

    except Exception as e:
        logging.exception("Exception in /api/multiyear-calendar")
        return jsonify({"error": str(e)}), 500


# Geocoding proxy to keep API key server-side
@api.route('/api/geocode')
def api_geocode():
    try:
        q = (request.args.get('q') or '').strip()
        if not q:
            return jsonify({'results': []})

        api_key = GEOAPIFY_API_KEY or os.getenv('GEOAPIFY_API_KEY')
        if not api_key:
            return jsonify({'error': 'Geocoding not configured'}), 503

        # Try cache first
        if q in _geocode_cache:
            data = _geocode_cache[q]
        else:
            resp = requests.get(
                'https://api.geoapify.com/v1/geocode/search',
                params={'text': q, 'limit': 5, 'format': 'json', 'apiKey': api_key},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
            _geocode_cache[q] = data
        items = data.get('results', []) if isinstance(data, dict) else []
        results = [
            {
                'name': (item.get('formatted') or item.get('result_type') or '').strip(),
                'lat': item.get('lat'),
                'lon': item.get('lon'),
            }
            for item in items
            if item.get('lat') is not None and item.get('lon') is not None
        ]
        return jsonify({'results': results})
    except requests.RequestException:
        logging.exception('Geocoding request failed')
        return jsonify({'error': 'Geocoding request failed'}), 502
    except Exception as e:
        logging.exception('Unexpected error in /api/geocode')
        return jsonify({'error': str(e)}), 500


# Current dawn information endpoint for frontend day calculations
@api.route('/api/current-dawn')
def api_current_dawn():
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        tzname = request.args.get('tz', type=str)
        
        if lat is None or lon is None or not tzname:
            return jsonify({'error': 'Missing or invalid parameters'}), 400
            
        from datetime import datetime, date, timedelta
        from backend.astronomy.sun import get_event_with_fallback
        import pytz
        
        # Get current time in the specified timezone
        local_tz = pytz.timezone(tzname)
        now_local = datetime.now(local_tz)
        today = now_local.date()
        
        # Get dawn for today
        dawn_time, dawn_tag = get_event_with_fallback('dawn', lat, lon, tzname, today)
        
        # Get dawn for tomorrow (for day boundary calculations)
        tomorrow = today + timedelta(days=1)
        dawn_time2, dawn_tag2 = get_event_with_fallback('dawn', lat, lon, tzname, tomorrow)
        
        # Determine if we're currently after today's dawn
        is_after_today_dawn = False
        if dawn_time:
            is_after_today_dawn = now_local >= dawn_time
        
        # Format times as ISO strings
        dawn_iso = dawn_time.isoformat() if dawn_time else None
        dawn2_iso = dawn_time2.isoformat() if dawn_time2 else None
        current_iso = now_local.isoformat()
        
        return jsonify({
            'today_dawn': dawn_iso,
            'today_tag': dawn_tag,
            'tomorrow_dawn': dawn2_iso,
            'tomorrow_tag': dawn_tag2,
            'current_time': current_iso,
            'is_after_today_dawn': is_after_today_dawn
        })
        
    except Exception as e:
        logging.exception("Exception in /api/current-dawn")
        return jsonify({"error": str(e)}), 500


# Serve Strong's Hebrew data
@api.route('/backend/data/hebrew_strongs.json')
def serve_hebrew_strongs():
    try:
        # Try MongoDB first
        db = get_mongo_client()
        if db is not None:
            collection = db[STRONG_COLLECTION]
            # Get all documents from the collection
            data = list(collection.find({}, {'_id': 0}))  # Exclude MongoDB _id field
            logging.info(f"Served {len(data)} Strong's entries from MongoDB")
            return jsonify(data)

        # Fallback to static file
        logging.warning("MongoDB not available, falling back to static file")
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        return send_from_directory(data_dir, 'hebrew_strongs.json', mimetype='application/json')
    except Exception as e:
        logging.exception("Exception serving hebrew_strongs.json")
        return jsonify({"error": str(e)}), 500


# Serve KJV verses data
@api.route('/backend/data/kjv_verses.json')
def serve_kjv_verses():
    try:
        # Try MongoDB first
        db = get_mongo_client()
        if db is not None:
            collection = db[KJV_COLLECTION]
            # Get all documents from the collection
            data = list(collection.find({}, {'_id': 0}))  # Exclude MongoDB _id field
            logging.info(f"Served {len(data)} KJV verses from MongoDB")
            return jsonify(data)

        # Fallback to static file
        logging.warning("MongoDB not available, falling back to static file")
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        return send_from_directory(data_dir, 'kjv_verses.json', mimetype='application/json')
    except Exception as e:
        logging.exception("Exception serving kjv_verses.json")
        return jsonify({"error": str(e)}), 500


# Test MongoDB connection endpoint
@api.route('/api/test-mongodb')
def test_mongodb():
    try:
        db = get_mongo_client()
        if db is None:
            return jsonify({
                'status': 'disconnected',
                'message': 'MongoDB not configured or unavailable',
                'fallback': 'static files'
            })

        # Test collections
        strong_collection = db[STRONG_COLLECTION]
        kjv_collection = db[KJV_COLLECTION]

        strong_count = strong_collection.count_documents({})
        kjv_count = kjv_collection.count_documents({})

        return jsonify({
            'status': 'connected',
            'database': DATABASE_NAME,
            'strongs_collection': STRONG_COLLECTION,
            'kjv_collection': KJV_COLLECTION,
            'strongs_count': strong_count,
            'kjv_count': kjv_count,
            'message': 'MongoDB Atlas connected successfully!'
        })

    except Exception as e:
        logging.exception("Exception testing MongoDB")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'fallback': 'static files'
        }), 500


# Alternative routes for Vercel compatibility
@api.route('/api/strongs-data')
def api_strongs_data():
    """Alternative endpoint for Strong's data"""
    try:
        db = get_mongo_client()
        if db is not None:
            collection = db[STRONG_COLLECTION]
            data = list(collection.find({}, {'_id': 0}))
            logging.info(f"API: Served {len(data)} Strong's entries from MongoDB")
            return jsonify(data)

        # Fallback
        logging.warning("API: MongoDB not available, using static fallback")
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        return send_from_directory(data_dir, 'hebrew_strongs.json', mimetype='application/json')
    except Exception as e:
        logging.exception("Exception in /api/strongs-data")
        return jsonify({"error": str(e)}), 500


@api.route('/api/kjv-data')
def api_kjv_data():
    """Alternative endpoint for KJV data"""
    try:
        db = get_mongo_client()
        if db is not None:
            collection = db[KJV_COLLECTION]
            data = list(collection.find({}, {'_id': 0}))
            logging.info(f"API: Served {len(data)} KJV verses from MongoDB")
            return jsonify(data)

        # Fallback
        logging.warning("API: MongoDB not available, using static fallback")
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        return send_from_directory(data_dir, 'kjv_verses.json', mimetype='application/json')
    except Exception as e:
        logging.exception("Exception in /api/kjv-data")
        return jsonify({"error": str(e)}), 500
