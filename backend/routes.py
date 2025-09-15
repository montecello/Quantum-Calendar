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
    logging.info("🔍 [MongoDB Debug] Checking MongoDB connection requirements...")

    # Check if MongoDB is available
    if not MONGODB_AVAILABLE:
        logging.error("❌ [MongoDB Debug] PyMongo not available - MongoDB features disabled")
        logging.error("💡 [MongoDB Debug] Install PyMongo: pip install pymongo")
        return None

    # Check if URI is configured
    if not MONGODB_URI:
        logging.error("❌ [MongoDB Debug] MONGODB_URI not configured")
        logging.error("💡 [MongoDB Debug] Set MONGODB_URI environment variable in Vercel")
        logging.error("🔗 [MongoDB Debug] Expected format: mongodb+srv://username:password@cluster.mongodb.net/")
        return None

    # Check if already connected
    if _mongo_client is not None:
        logging.info("✅ [MongoDB Debug] Using existing MongoDB connection")
        return _db

    logging.info("🚀 [MongoDB Debug] Attempting new MongoDB Atlas connection...")
    logging.info(f"📊 [MongoDB Debug] Database: {DATABASE_NAME}")
    logging.info(f"📚 [MongoDB Debug] Strong's Collection: {STRONG_COLLECTION}")
    logging.info(f"📖 [MongoDB Debug] KJV Collection: {KJV_COLLECTION}")

    try:
        # Log connection attempt
        logging.info("🔌 [MongoDB Debug] Creating MongoClient...")
        _mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)

        logging.info("📡 [MongoDB Debug] Testing connection with ping...")
        _mongo_client.admin.command('ping')
        logging.info("✅ [MongoDB Debug] Ping successful!")

        logging.info("🗄️  [MongoDB Debug] Accessing database...")
        _db = _mongo_client[DATABASE_NAME]

        logging.info("📋 [MongoDB Debug] Testing database access...")
        # Test database access by listing collections
        collections = _db.list_collection_names()
        logging.info(f"📋 [MongoDB Debug] Available collections: {collections}")

        # Check if our collections exist
        if STRONG_COLLECTION in collections:
            strong_count = _db[STRONG_COLLECTION].count_documents({})
            logging.info(f"📚 [MongoDB Debug] Strong's collection has {strong_count} documents")
        else:
            logging.warning(f"⚠️  [MongoDB Debug] Strong's collection '{STRONG_COLLECTION}' not found")

        if KJV_COLLECTION in collections:
            kjv_count = _db[KJV_COLLECTION].count_documents({})
            logging.info(f"📖 [MongoDB Debug] KJV collection has {kjv_count} documents")
        else:
            logging.warning(f"⚠️  [MongoDB Debug] KJV collection '{KJV_COLLECTION}' not found")

        logging.info("🎉 [MongoDB Debug] MongoDB Atlas connection successful!")
        return _db

    except Exception as e:
        logging.error("❌ [MongoDB Debug] MongoDB connection failed!")
        logging.error(f"🚨 [MongoDB Debug] Error type: {type(e).__name__}")
        logging.error(f"🚨 [MongoDB Debug] Error message: {str(e)}")

        # Provide specific guidance based on error type
        if "Authentication failed" in str(e):
            logging.error("🔐 [MongoDB Debug] Authentication failed - check username/password in MONGODB_URI")
        elif "getaddrinfo failed" in str(e) or "ENOTFOUND" in str(e):
            logging.error("🌐 [MongoDB Debug] DNS resolution failed - check cluster URL in MONGODB_URI")
        elif "connection timed out" in str(e).lower():
            logging.error("⏱️  [MongoDB Debug] Connection timed out - check network access and firewall rules")
        elif "SSL" in str(e):
            logging.error("🔒 [MongoDB Debug] SSL/TLS error - check MongoDB Atlas network access settings")
        else:
            logging.error("❓ [MongoDB Debug] Unknown connection error - check MongoDB Atlas dashboard")

        logging.error("💡 [MongoDB Debug] Troubleshooting steps:")
        logging.error("   1. Verify MONGODB_URI format: mongodb+srv://user:pass@cluster.mongodb.net/")
        logging.error("   2. Check MongoDB Atlas dashboard for connection issues")
        logging.error("   3. Ensure IP whitelist includes 0.0.0.0/0 for Vercel")
        logging.error("   4. Verify database user has read access to collections")

        _mongo_client = None
        return None

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
        logging.info("🧪 [Test Debug] /api/test-mongodb endpoint called")

        # Check environment variables first
        logging.info("🔍 [Test Debug] Checking environment variables...")
        env_status = {
            "MONGODB_URI": bool(MONGODB_URI),
            "DATABASE_NAME": bool(DATABASE_NAME),
            "STRONG_COLLECTION": bool(STRONG_COLLECTION),
            "KJV_COLLECTION": bool(KJV_COLLECTION),
            "MONGODB_AVAILABLE": MONGODB_AVAILABLE
        }
        logging.info(f"📋 [Test Debug] Environment status: {env_status}")

        db = get_mongo_client()
        if db is None:
            logging.error("❌ [Test Debug] MongoDB connection failed")
            return jsonify({
                'status': 'disconnected',
                'message': 'MongoDB not configured or unavailable',
                'environment': env_status,
                'fallback': 'static files',
                'troubleshooting': [
                    'Check MONGODB_URI environment variable in Vercel',
                    'Verify MongoDB Atlas cluster is running',
                    'Ensure IP whitelist includes 0.0.0.0/0',
                    'Check database user credentials'
                ]
            })

        # Test collections
        logging.info("📊 [Test Debug] Testing collection access...")
        strong_collection = db[STRONG_COLLECTION]
        kjv_collection = db[KJV_COLLECTION]

        # Use estimated_document_count() for faster performance
        strong_count = strong_collection.estimated_document_count()
        kjv_count = kjv_collection.estimated_document_count()

        logging.info(f"✅ [Test Debug] Strong's collection: {strong_count} documents (estimated)")
        logging.info(f"✅ [Test Debug] KJV collection: {kjv_count} documents (estimated)")

        # Test sample data
        sample_strongs = list(strong_collection.find({}, {'_id': 0}).limit(1))
        sample_kjv = list(kjv_collection.find({}, {'_id': 0}).limit(1))

        return jsonify({
            'status': 'connected',
            'database': DATABASE_NAME,
            'strongs_collection': STRONG_COLLECTION,
            'kjv_collection': KJV_COLLECTION,
            'strongs_count': strong_count,
            'kjv_count': kjv_count,
            'sample_strongs': sample_strongs[0] if sample_strongs else None,
            'sample_kjv': sample_kjv[0] if sample_kjv else None,
            'environment': env_status,
            'message': 'MongoDB Atlas connected successfully!'
        })

    except Exception as e:
        logging.exception("💥 [Test Debug] Exception testing MongoDB")
        logging.error(f"🚨 [Test Debug] Error type: {type(e).__name__}")
        logging.error(f"🚨 [Test Debug] Error message: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'error_type': type(e).__name__,
            'fallback': 'static files'
        }), 500


# Debug endpoint for configuration and environment
@api.route('/api/debug')
def api_debug():
    """Debug endpoint to check configuration and environment"""
    try:
        logging.info("🔧 [Debug] /api/debug endpoint called")

        import os
        import sys

        # Environment variables
        env_vars = {}
        important_vars = [
            'MONGODB_URI', 'DATABASE_NAME', 'STRONG_COLLECTION', 'KJV_COLLECTION',
            'GEOAPIFY_API_KEY', 'ASTRO_API_BASE', 'VERCEL', 'VERCEL_ENV'
        ]

        for var in important_vars:
            value = os.getenv(var)
            if value:
                if 'URI' in var or 'KEY' in var:
                    # Hide sensitive parts
                    env_vars[var] = f"***{value[-10:]}" if len(value) > 10 else "***"
                else:
                    env_vars[var] = value
            else:
                env_vars[var] = None

        # Python environment
        python_info = {
            'version': sys.version,
            'platform': sys.platform,
            'executable': sys.executable
        }

        # File system checks
        backend_data_dir = os.path.join(os.path.dirname(__file__), 'data')
        static_data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'static', 'data')

        file_checks = {
            'backend_data_dir': backend_data_dir,
            'backend_data_exists': os.path.exists(backend_data_dir),
            'static_data_dir': static_data_dir,
            'static_data_exists': os.path.exists(static_data_dir),
            'backend_strongs_file': os.path.exists(os.path.join(backend_data_dir, 'hebrew_strongs.json')),
            'backend_kjv_file': os.path.exists(os.path.join(backend_data_dir, 'kjv_verses.json')),
            'static_strongs_file': os.path.exists(os.path.join(static_data_dir, 'strongs_complete.json')),
            'static_kjv_file': os.path.exists(os.path.join(static_data_dir, 'kjv_verses.json'))
        }

        # MongoDB availability
        mongodb_status = {
            'MONGODB_AVAILABLE': MONGODB_AVAILABLE,
            'pymongo_importable': True
        }

        try:
            import pymongo
            mongodb_status['pymongo_version'] = pymongo.version
        except ImportError:
            mongodb_status['pymongo_importable'] = False
            mongodb_status['pymongo_version'] = None

        # Current working directory and paths
        cwd_info = {
            'current_working_directory': os.getcwd(),
            'script_directory': os.path.dirname(__file__),
            'project_root': os.path.dirname(os.path.dirname(__file__))
        }

        return jsonify({
            'status': 'debug_info',
            'timestamp': str(datetime.now()),
            'environment_variables': env_vars,
            'python_info': python_info,
            'file_system': file_checks,
            'mongodb_status': mongodb_status,
            'paths': cwd_info,
            'message': 'Debug information retrieved successfully'
        })

    except Exception as e:
        logging.exception("💥 [Debug] Exception in /api/debug")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'error_type': type(e).__name__
        }), 500


@api.route('/api/strongs-data')
def api_strongs_data():
    """Alternative endpoint for Strong's data"""
    try:
        logging.info("📡 [API Debug] /api/strongs-data endpoint called")
        logging.info(f"🔍 [API Debug] Request method: {request.method}")
        logging.info(f"🔍 [API Debug] Request headers: {dict(request.headers)}")
        logging.info(f"🔍 [API Debug] Request args: {dict(request.args)}")

        # Parse pagination parameters
        limit = request.args.get('limit', type=int, default=100)
        offset = request.args.get('offset', type=int, default=0)

        # Validate pagination parameters
        if limit < 1 or limit > 1000:
            limit = 100
        if offset < 0:
            offset = 0

        logging.info(f"📄 [API Debug] Pagination: limit={limit}, offset={offset}")

        db = get_mongo_client()

        if db is not None:
            logging.info("🗄️  [API Debug] Attempting to access Strong's collection from MongoDB")
            collection = db[STRONG_COLLECTION]

            # Test collection access
            logging.info("📊 [API Debug] Counting documents in Strong's collection...")
            doc_count = collection.estimated_document_count()
            logging.info(f"📊 [API Debug] Found {doc_count} documents in Strong's collection (estimated)")

            if doc_count == 0:
                logging.warning("⚠️  [API Debug] Strong's collection is empty!")
                return jsonify({"error": "Strong's collection is empty", "collection": STRONG_COLLECTION}), 500

            # Get paginated documents
            logging.info(f"📥 [API Debug] Fetching Strong's documents (limit={limit}, offset={offset})...")
            data = list(collection.find({}, {'_id': 0}).skip(offset).limit(limit))

            logging.info(f"✅ [API Debug] Successfully retrieved {len(data)} Strong's entries from MongoDB")
            logging.info(f"🚀 [API Debug] Data source: MongoDB Atlas ({DATABASE_NAME}.{STRONG_COLLECTION})")

            # Log sample data for verification
            if data and len(data) > 0:
                sample = data[0]
                logging.info(f"🔍 [API Debug] Sample Strong's entry: {sample.get('strongsNumber', 'N/A')} - {sample.get('word', 'N/A')}")

            # Calculate pagination info
            has_more = (offset + limit) < doc_count
            total_pages = (doc_count + limit - 1) // limit if limit > 0 else 1
            current_page = (offset // limit) + 1 if limit > 0 else 1

            # Return data with metadata
            response_data = {
                "data": data,
                "count": len(data),
                "total": doc_count,
                "source": "mongodb",
                "collection": STRONG_COLLECTION,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "has_more": has_more,
                    "current_page": current_page,
                    "total_pages": total_pages
                },
                "timestamp": str(datetime.now())
            }
            logging.info(f"📤 [API Debug] Returning {len(data)} Strong's entries (page {current_page}/{total_pages})")
            return jsonify(response_data)

        # Fallback to static file
        logging.warning("⚠️  [API Debug] MongoDB not available, falling back to static file")
        logging.info("📁 [API Debug] Attempting to serve from frontend/static/data/strongs_complete.json")

        static_data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'static', 'data')
        static_file_path = os.path.join(static_data_dir, 'strongs_complete.json')

        if os.path.exists(static_file_path):
            logging.info("✅ [API Debug] Static file exists, reading from frontend/static/data/")
            try:
                import json
                # Read file efficiently with streaming approach
                with open(static_file_path, 'r', encoding='utf-8') as f:
                    # Read the entire file but do it efficiently
                    file_content = f.read()
                    static_data = json.loads(file_content)
                
                logging.info(f"📊 [API Debug] Loaded {len(static_data)} entries from static file")

                # Apply pagination to static data more efficiently
                total_count = len(static_data)
                start_idx = min(offset, total_count)
                end_idx = min(start_idx + limit, total_count)
                paginated_data = static_data[start_idx:end_idx]

                # Calculate pagination info
                has_more = end_idx < total_count
                total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
                current_page = (offset // limit) + 1 if limit > 0 else 1

                # Return data with metadata
                response_data = {
                    "data": paginated_data,
                    "count": len(paginated_data),
                    "total": total_count,
                    "source": "static_file",
                    "path": static_file_path,
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "has_more": has_more,
                        "current_page": current_page,
                        "total_pages": total_pages
                    },
                    "timestamp": str(datetime.now())
                }
                logging.info(f"📤 [API Debug] Returning {len(paginated_data)} Strong's entries from static file (page {current_page}/{total_pages})")
                return jsonify(response_data)
            except Exception as file_error:
                logging.error(f"❌ [API Debug] Error reading static file: {str(file_error)}")
                return jsonify({"error": f"Error reading static file: {str(file_error)}", "path": static_file_path}), 500
        else:
            logging.error(f"❌ [API Debug] Static file not found: {static_file_path}")
            logging.info(f"📂 [API Debug] Directory contents: {os.listdir(static_data_dir) if os.path.exists(static_data_dir) else 'directory not found'}")
            return jsonify({"error": "Static file not found", "path": static_file_path}), 500

    except Exception as e:
        logging.exception("💥 [API Debug] Exception in /api/strongs-data")
        logging.error(f"🚨 [API Debug] Error type: {type(e).__name__}")
        logging.error(f"🚨 [API Debug] Error message: {str(e)}")
        return jsonify({"error": str(e), "endpoint": "/api/strongs-data"}), 500


@api.route('/api/kjv-data')
def api_kjv_data():
    """Alternative endpoint for KJV data"""
    try:
        logging.info("📡 [API Debug] /api/kjv-data endpoint called")
        logging.info(f"🔍 [API Debug] Request method: {request.method}")
        logging.info(f"🔍 [API Debug] Request headers: {dict(request.headers)}")
        logging.info(f"🔍 [API Debug] Request args: {dict(request.args)}")

        # Parse pagination parameters
        limit = request.args.get('limit', type=int, default=100)
        offset = request.args.get('offset', type=int, default=0)

        # Validate pagination parameters
        if limit < 1 or limit > 1000:
            limit = 100
        if offset < 0:
            offset = 0

        logging.info(f"📄 [API Debug] Pagination: limit={limit}, offset={offset}")

        db = get_mongo_client()

        if db is not None:
            logging.info("🗄️  [API Debug] Attempting to access KJV collection from MongoDB")
            collection = db[KJV_COLLECTION]

            # Test collection access
            logging.info("📊 [API Debug] Counting documents in KJV collection...")
            doc_count = collection.estimated_document_count()
            logging.info(f"📊 [API Debug] Found {doc_count} documents in KJV collection (estimated)")

            if doc_count == 0:
                logging.warning("⚠️  [API Debug] KJV collection is empty!")
                return jsonify({"error": "KJV collection is empty", "collection": KJV_COLLECTION}), 500

            # Get paginated documents
            logging.info(f"📥 [API Debug] Fetching KJV documents (limit={limit}, offset={offset})...")
            data = list(collection.find({}, {'_id': 0}).skip(offset).limit(limit))

            logging.info(f"✅ [API Debug] Successfully retrieved {len(data)} KJV entries from MongoDB")
            logging.info(f"🚀 [API Debug] Data source: MongoDB Atlas ({DATABASE_NAME}.{KJV_COLLECTION})")

            # Log sample data for verification
            if data and len(data) > 0:
                sample = data[0]
                logging.info(f"🔍 [API Debug] Sample KJV entry: {sample.get('book', 'N/A')} {sample.get('chapter', 'N/A')}:{sample.get('verse', 'N/A')}")

            # Calculate pagination info
            has_more = (offset + limit) < doc_count
            total_pages = (doc_count + limit - 1) // limit if limit > 0 else 1
            current_page = (offset // limit) + 1 if limit > 0 else 1

            # Return data with metadata
            response_data = {
                "data": data,
                "count": len(data),
                "total": doc_count,
                "source": "mongodb",
                "collection": KJV_COLLECTION,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "has_more": has_more,
                    "current_page": current_page,
                    "total_pages": total_pages
                },
                "timestamp": str(datetime.now())
            }
            logging.info(f"📤 [API Debug] Returning {len(data)} KJV entries (page {current_page}/{total_pages})")
            return jsonify(response_data)

        # Fallback to static file
        logging.warning("⚠️  [API Debug] MongoDB not available, falling back to static file")
        logging.info("📁 [API Debug] Attempting to serve from frontend/static/data/kjv_verses.json")

        static_data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'static', 'data')
        static_file_path = os.path.join(static_data_dir, 'kjv_verses.json')

        if os.path.exists(static_file_path):
            logging.info("✅ [API Debug] Static file exists, reading from frontend/static/data/")
            try:
                import json
                # Read file efficiently with streaming approach
                with open(static_file_path, 'r', encoding='utf-8') as f:
                    # Read the entire file but do it efficiently
                    file_content = f.read()
                    static_data = json.loads(file_content)
                
                logging.info(f"📊 [API Debug] Loaded {len(static_data)} entries from static file")

                # Apply pagination to static data more efficiently
                total_count = len(static_data)
                start_idx = min(offset, total_count)
                end_idx = min(start_idx + limit, total_count)
                paginated_data = static_data[start_idx:end_idx]

                # Calculate pagination info
                has_more = end_idx < total_count
                total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
                current_page = (offset // limit) + 1 if limit > 0 else 1

                # Return data with metadata
                response_data = {
                    "data": paginated_data,
                    "count": len(paginated_data),
                    "total": total_count,
                    "source": "static_file",
                    "path": static_file_path,
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "has_more": has_more,
                        "current_page": current_page,
                        "total_pages": total_pages
                    },
                    "timestamp": str(datetime.now())
                }
                logging.info(f"📤 [API Debug] Returning {len(paginated_data)} KJV entries from static file (page {current_page}/{total_pages})")
                return jsonify(response_data)
            except Exception as file_error:
                logging.error(f"❌ [API Debug] Error reading static file: {str(file_error)}")
                return jsonify({"error": f"Error reading static file: {str(file_error)}", "path": static_file_path}), 500
        else:
            logging.error(f"❌ [API Debug] Static file not found: {static_file_path}")
            logging.info(f"📂 [API Debug] Directory contents: {os.listdir(static_data_dir) if os.path.exists(static_data_dir) else 'directory not found'}")
            return jsonify({"error": "Static file not found", "path": static_file_path}), 500

    except Exception as e:
        logging.exception("💥 [API Debug] Exception in /api/kjv-data")
        logging.error(f"🚨 [API Debug] Error type: {type(e).__name__}")
        logging.error(f"🚨 [API Debug] Error message: {str(e)}")
        return jsonify({"error": str(e), "endpoint": "/api/kjv-data"}), 500
