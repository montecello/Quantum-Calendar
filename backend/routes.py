from flask import Blueprint, request, jsonify, send_from_directory
import logging
import os
import requests
from config import GEOAPIFY_API_KEY
from cachetools import TTLCache
from backend.calendar import get_calendar_for_year
from backend.astronomy.years import get_multi_year_calendar_data
from config import ASTRO_API_BASE

api = Blueprint('api', __name__)

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
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        return send_from_directory(data_dir, 'hebrew_strongs.json', mimetype='application/json')
    except Exception as e:
        logging.exception("Exception serving hebrew_strongs.json")
        return jsonify({"error": str(e)}), 500


# Serve KJV verses data
@api.route('/backend/data/kjv_verses.json')
def serve_kjv_verses():
    try:
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        return send_from_directory(data_dir, 'kjv_verses.json', mimetype='application/json')
    except Exception as e:
        logging.exception("Exception serving kjv_verses.json")
        return jsonify({"error": str(e)}), 500


@api.route('/api/mongodb-test')
def api_mongodb_test():
    """Test endpoint to diagnose MongoDB connection issues"""
    try:
        print("🧪 [TEST] MongoDB test endpoint called")  # Use print instead of logging for Vercel

        # Check environment variables
        from config import MONGODB_URI, DATABASE_NAME, STRONG_COLLECTION, KJV_COLLECTION
        env_status = {
            'mongodb_uri_configured': bool(MONGODB_URI),
            'database_name': DATABASE_NAME,
            'strongs_collection': STRONG_COLLECTION,
            'kjv_collection': KJV_COLLECTION
        }
        print(f"🔧 [TEST] Environment status: {env_status}")

        # Check Flask app config
        from flask import current_app
        client = current_app.config.get('mongo_client')
        db = current_app.config.get('mongo_db')

        config_status = {
            'client_available': client is not None,
            'db_available': db is not None
        }
        print(f"🔧 [TEST] Flask config status: {config_status}")

        if client is None or db is not None:
            print("⚠️ [TEST] MongoDB not available in Flask config")

        # Test connection if available
        if client:
            try:
                print("🔌 [TEST] Testing MongoDB connection...")
                ping_result = client.admin.command('ping')
                print(f"✅ [TEST] MongoDB ping successful: {ping_result}")

                # Test database access
                db_info = {
                    'database_name': db.name if db else None,
                    'collections': db.list_collection_names() if db else []
                }
                print(f"📊 [TEST] Database info: {db_info}")

                # Test collection access
                strongs_collection = db[STRONG_COLLECTION] if db else None
                kjv_collection = db[KJV_COLLECTION] if db else None

                collection_status = {
                    'strongs_count': strongs_collection.count_documents({}) if strongs_collection else 0,
                    'kjv_count': kjv_collection.count_documents({}) if kjv_collection else 0
                }
                print(f"📊 [TEST] Collection status: {collection_status}")

                return jsonify({
                    'status': 'success',
                    'message': 'MongoDB connection successful',
                    'env_status': env_status,
                    'config_status': config_status,
                    'db_info': db_info,
                    'collection_status': collection_status
                })

            except Exception as test_error:
                print(f"❌ [TEST] MongoDB test failed: {test_error}")
                print(f"❌ [TEST] Error type: {type(test_error).__name__}")
                return jsonify({
                    'status': 'error',
                    'message': f'MongoDB test failed: {str(test_error)}',
                    'error_type': type(test_error).__name__,
                    'env_status': env_status,
                    'config_status': config_status
                }), 500
        else:
            print("❌ [TEST] MongoDB client not available")
            return jsonify({
                'status': 'error',
                'message': 'MongoDB client not available',
                'env_status': env_status,
                'config_status': config_status
            }), 500

    except Exception as e:
        print(f"💥 [TEST] Unexpected error in MongoDB test: {e}")
        print(f"💥 [TEST] Error type: {type(e).__name__}")
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}',
            'error_type': type(e).__name__
        }), 500


# MongoDB API endpoints for Strong's data
@api.route('/api/strongs-data')
def api_strongs_data():
    try:
        print("🔍 [API] /api/strongs-data endpoint called")

        # Log environment and configuration
        from config import MONGODB_URI, DATABASE_NAME, STRONG_COLLECTION
        print(f"🔧 [API] MongoDB URI configured: {'Yes' if MONGODB_URI else 'No'}")
        print(f"🔧 [API] Database name: {DATABASE_NAME}")
        print(f"🔧 [API] Collection name: {STRONG_COLLECTION}")

        from flask import current_app
        client, db = current_app.config.get('mongo_client'), current_app.config.get('mongo_db')

        print(f"🔧 [API] MongoDB client available: {'Yes' if client else 'No'}")
        print(f"🔧 [API] MongoDB database available: {'Yes' if db else 'No'}")

        if client is None or db is None:
            print("❌ [API] MongoDB client or database not available, falling back to static file")
            return serve_hebrew_strongs()

        # Test MongoDB connection
        try:
            print("🔌 [API] Testing MongoDB connection...")
            client.admin.command('ping')
            print("✅ [API] MongoDB connection test successful")
        except Exception as conn_error:
            print(f"❌ [API] MongoDB connection test failed: {conn_error}")
            print(f"❌ [API] Connection error type: {type(conn_error).__name__}")
            return serve_hebrew_strongs()

        from config import STRONG_COLLECTION
        collection = db[STRONG_COLLECTION]

        # Get query parameters
        strongs_num = request.args.get('strongs_num', type=int)
        search = request.args.get('search', type=str)
        language = request.args.get('language', type=str)
        limit = request.args.get('limit', 100, type=int)

        print(f"🔍 [API] Query parameters: strongs_num={strongs_num}, search='{search}', language='{language}', limit={limit}")

        query = {}

        if strongs_num:
            query['strongsNumber'] = strongs_num
        if language:
            query['language'] = language
        if search:
            # Search in word, transliteration, or definitions
            query['$or'] = [
                {'word': {'$regex': search, '$options': 'i'}},
                {'transliteration': {'$regex': search, '$options': 'i'}},
                {'definitions': {'$regex': search, '$options': 'i'}}
            ]

        print(f"🔍 [API] MongoDB query: {query}")

        try:
            results = list(collection.find(query, {'_id': 0}).limit(limit))
            print(f"✅ [API] MongoDB query successful, found {len(results)} results")

            if results:
                print(f"📊 [API] Sample result: {results[0]}")

            return jsonify(results)

        except Exception as query_error:
            print(f"❌ [API] MongoDB query failed: {query_error}")
            print(f"❌ [API] Query error type: {type(query_error).__name__}")
            return serve_hebrew_strongs()

    except Exception as e:
        print(f"💥 [API] Unexpected exception in /api/strongs-data: {e}")
        print(f"❌ [API] Exception type: {type(e).__name__}")
        print(f"❌ [API] Exception message: {str(e)}")
        # Fallback to static file
        return serve_hebrew_strongs()


# MongoDB API endpoints for KJV verses data
@api.route('/api/kjv-data')
def api_kjv_data():
    try:
        print("🔍 [API] /api/kjv-data endpoint called")

        # Log environment and configuration
        from config import MONGODB_URI, DATABASE_NAME, KJV_COLLECTION
        print(f"🔧 [API] MongoDB URI configured: {'Yes' if MONGODB_URI else 'No'}")
        print(f"🔧 [API] Database name: {DATABASE_NAME}")
        print(f"🔧 [API] Collection name: {KJV_COLLECTION}")

        from flask import current_app
        client, db = current_app.config.get('mongo_client'), current_app.config.get('mongo_db')

        print(f"🔧 [API] MongoDB client available: {'Yes' if client else 'No'}")
        print(f"🔧 [API] MongoDB database available: {'Yes' if db else 'No'}")

        if client is None or db is None:
            print("❌ [API] MongoDB client or database not available, falling back to static file")
            return serve_kjv_verses()

        # Test MongoDB connection
        try:
            print("🔌 [API] Testing MongoDB connection...")
            client.admin.command('ping')
            print("✅ [API] MongoDB connection test successful")
        except Exception as conn_error:
            print(f"❌ [API] MongoDB connection test failed: {conn_error}")
            print(f"❌ [API] Connection error type: {type(conn_error).__name__}")
            return serve_kjv_verses()

        from config import KJV_COLLECTION
        collection = db[KJV_COLLECTION]

        # Get query parameters
        book = request.args.get('book', type=str)
        chapter = request.args.get('chapter', type=int)
        verse = request.args.get('verse', type=int)
        search = request.args.get('search', type=str)
        limit = request.args.get('limit', 100, type=int)

        print(f"🔍 [API] Query parameters: book='{book}', chapter={chapter}, verse={verse}, search='{search}', limit={limit}")

        query = {}

        if book:
            query['book'] = {'$regex': f'^{book}$', '$options': 'i'}
        if chapter:
            query['chapter'] = chapter
        if verse:
            query['verse'] = verse
        if search:
            # Search in text
            query['text'] = {'$regex': search, '$options': 'i'}

        print(f"🔍 [API] MongoDB query: {query}")

        try:
            results = list(collection.find(query, {'_id': 0}).limit(limit))
            print(f"✅ [API] MongoDB query successful, found {len(results)} results")

            if results:
                print(f"📊 [API] Sample result: {results[0]}")

            return jsonify(results)

        except Exception as query_error:
            print(f"❌ [API] MongoDB query failed: {query_error}")
            print(f"❌ [API] Query error type: {type(query_error).__name__}")
            return serve_kjv_verses()

    except Exception as e:
        print(f"💥 [API] Unexpected exception in /api/kjv-data: {e}")
        print(f"❌ [API] Exception type: {type(e).__name__}")
        print(f"❌ [API] Exception message: {str(e)}")
        # Fallback to static file
        return serve_kjv_verses()
