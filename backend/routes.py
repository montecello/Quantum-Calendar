from flask import Blueprint, request, jsonify, send_from_directory
import logging
import os
import requests
from config import GEOAPIFY_API_KEY
from cachetools import TTLCache
from backend.calendar import get_calendar_for_year
from backend.astronomy.years import get_multi_year_calendar_data
from backend.etymology_api import etymology_chain_handler
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
    """Fallback JSON implementation with frequency counting support"""
    try:
        import json
        import os
        
        print("📁 DATA SOURCE: Loading KJV verses from JSON file (FALLBACK MODE)")
        
        # Get query parameters for JSON fallback
        query_text = request.args.get('query', '').strip()
        limit = request.args.get('limit', 100, type=int)
        
        # Load JSON data
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        verses_file = os.path.join(data_dir, 'verses.json')
        
        with open(verses_file, 'r') as f:
            all_data = json.load(f)
        
        print(f"INFO: JSON loaded with {len(all_data)} verses (fallback)")
        
        if query_text:
            # Filter JSON data by text content
            filtered = []
            for entry in all_data:
                text = entry.get('text', '').lower()
                if query_text.lower() in text:
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
            print(f"INFO: JSON search for '{query_text}' found {len(filtered)} verses")
            print(f"INFO: Found {len(sorted_strongs)} unique Strong's numbers")
            if sorted_strongs:
                print(f"INFO: Top 5 Strong's by frequency: {sorted_strongs[:5]}")
            
            return jsonify({
                'verses': filtered,
                'strongsFrequency': sorted_strongs,
                'totalVerses': len(filtered)
            })
        else:
            # No query - return first 'limit' verses
            data = all_data[:limit]
            return jsonify({'verses': data, 'strongsFrequency': [], 'totalVerses': len(data)})
            
    except Exception as e:
        logging.exception("Exception serving kjv verses with frequency counting")
        return jsonify({"error": str(e)}), 500


# MongoDB API endpoints for Strong's data
@api.route('/api/strongs-data')
def api_strongs_data():
    try:
        from flask import current_app
        client, db = current_app.config.get('mongo_client'), current_app.config.get('mongo_db')

        if client is not None and db is not None:
            print("✓ DATA SOURCE: Using MongoDB Atlas for Strong's data (PRIMARY)")
            from config import STRONG_COLLECTION
            collection = db[STRONG_COLLECTION]

        # Get query parameters
        strongs_num = request.args.get('strongs_num', type=int)
        search = request.args.get('search', type=str)
        query_param = request.args.get('query', type=str)  # Add support for 'query' parameter
        language = request.args.get('language', type=str)
        limit = request.args.get('limit', 100, type=int)

        query = {}

        # Handle 'query' parameter (e.g., 'H4714' or '4714')
        if query_param:
            # Extract number from query like 'H4714' or '4714'
            if query_param.startswith('H'):
                try:
                    num = int(query_param[1:])
                    query['strongsNumber'] = num
                    print(f"DEBUG: Searching for Strong's number {num} from query '{query_param}'")
                except ValueError:
                    # If not a number, treat as text search
                    query['$or'] = [
                        {'word': {'$regex': query_param, '$options': 'i'}},
                        {'transliteration': {'$regex': query_param, '$options': 'i'}},
                        {'definitions': {'$regex': query_param, '$options': 'i'}}
                    ]
                    print(f"DEBUG: Text searching for '{query_param}'")
            else:
                try:
                    num = int(query_param)
                    query['strongsNumber'] = num
                    print(f"DEBUG: Searching for Strong's number {num} from query '{query_param}'")
                except ValueError:
                    # If not a number, treat as text search
                    query['$or'] = [
                        {'word': {'$regex': query_param, '$options': 'i'}},
                        {'transliteration': {'$regex': query_param, '$options': 'i'}},
                        {'definitions': {'$regex': query_param, '$options': 'i'}}
                    ]
                    print(f"DEBUG: Text searching for '{query_param}'")
        elif strongs_num:
            query['strongsNumber'] = strongs_num
        elif search:
            # Search in word, transliteration, or definitions
            query['$or'] = [
                {'word': {'$regex': search, '$options': 'i'}},
                {'transliteration': {'$regex': search, '$options': 'i'}},
                {'definitions': {'$regex': search, '$options': 'i'}}
            ]
        
        if language:
            query['language'] = language

        results = list(collection.find(query, {'_id': 0}).limit(limit))
        return jsonify(results)

    except Exception as e:
        logging.exception("Exception in /api/strongs-data")
        print("⚠️  DATA SOURCE: Using JSON file fallback for Strong's data (SECONDARY)")
        print(f"⚠️  Reason: MongoDB error - {e}")
        # Fallback to static file
        return serve_hebrew_strongs()


# Hebrew word search endpoint - search Strong's data by Hebrew word
@api.route('/api/hebrew-search')
def api_hebrew_search():
    try:
        from flask import current_app
        import re
        
        # Get query parameters
        hebrew_query = request.args.get('query', '').strip()
        limit = request.args.get('limit', 20, type=int)
        
        print(f"INFO: Hebrew search called with query='{hebrew_query}', limit={limit}")
        
        if not hebrew_query:
            return jsonify([])
        
        client, db = current_app.config.get('mongo_client'), current_app.config.get('mongo_db')

        if client is not None and db is not None:
            print("✓ DATA SOURCE: Using MongoDB Atlas for Hebrew word search (PRIMARY)")
            from config import STRONG_COLLECTION
            collection = db[STRONG_COLLECTION]
            
            # Search for Hebrew words that contain the query
            # Try both exact match and regex match
            query = {
                '$or': [
                    {'word': hebrew_query},  # Exact match first
                    {'word': {'$regex': hebrew_query, '$options': 'i'}}  # Then regex match
                ]
            }
            
            print(f"DEBUG: Hebrew search query: {query}")
            results = list(collection.find(query, {'_id': 0}).limit(limit))
            print(f"INFO: Hebrew search found {len(results)} matches")
            
            if results:
                print(f"DEBUG: First Hebrew match: H{results[0].get('strongsNumber')} - {results[0].get('word')} ({results[0].get('transliteration')})")
                print(f"DEBUG: Language codes in results: {set(r.get('language') for r in results[:5])}")
            else:
                # Debug: Try to find any entries with Hebrew characters
                debug_query = {'word': {'$regex': '[\u0590-\u05FF]'}}  # Hebrew Unicode range
                debug_results = list(collection.find(debug_query, {'_id': 0}).limit(3))
                print(f"DEBUG: Found {len(debug_results)} entries with Hebrew characters")
                if debug_results:
                    for r in debug_results:
                        print(f"DEBUG: H{r.get('strongsNumber')} - {repr(r.get('word'))} ({r.get('transliteration')})")
            
            return jsonify(results)
        
        # Fallback to JSON file
        print("⚠️  DATA SOURCE: Using JSON file fallback for Hebrew word search (SECONDARY)")
        print("⚠️  Reason: MongoDB not available")
        try:
            import json
            import os
            
            data_dir = os.path.join(os.path.dirname(__file__), 'data')
            strongs_file = os.path.join(data_dir, 'strongs.json')
            
            with open(strongs_file, 'r') as f:
                all_data = json.load(f)
            
            # Filter for Hebrew entries that match the query
            filtered = []
            for entry in all_data:
                if (entry.get('language') == 'heb' and 
                    entry.get('word') and 
                    hebrew_query in entry.get('word', '')):
                    filtered.append(entry)
                    if len(filtered) >= limit:
                        break
            
            print(f"INFO: JSON Hebrew search found {len(filtered)} matches")
            return jsonify(filtered)
            
        except Exception as e:
            print(f"ERROR: JSON fallback failed: {e}")
            return jsonify([])

    except Exception as e:
        logging.exception("Exception in /api/hebrew-search")
        return jsonify([])


# MongoDB API endpoints for KJV verses data with frequency counting
@api.route('/api/kjv-data')
def api_kjv_data():
    try:
        from flask import current_app
        import os
        import json
        
        # Get query parameters - simplified to match app.py implementation
        query_text = request.args.get('query', '').strip()
        limit = request.args.get('limit', 100, type=int)
        
        print(f"INFO: Routes /api/kjv-data called with query='{query_text}', limit={limit}")
        
        client, db = current_app.config.get('mongo_client'), current_app.config.get('mongo_db')

        if client is not None and db is not None:
            print("✓ DATA SOURCE: Using MongoDB Atlas for KJV verse data (PRIMARY)")
            print(f"✓ MongoDB client status: Connected")
            print(f"✓ Database: {db.name if hasattr(db, 'name') else 'quantum-calendar'}")
            from config import KJV_COLLECTION
            collection = db[KJV_COLLECTION]
            
            if query_text:
                # Search verses by text content
                regex = {"$regex": query_text, "$options": "i"}
                print(f"DEBUG: Searching with regex: {regex}")
                matched_verses = list(collection.find({
                    "text": regex
                }, {'_id': 0}).limit(limit))
                print(f"INFO: MongoDB search for '{query_text}' found {len(matched_verses)} verses")
                
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
        print("⚠️  DATA SOURCE: Using JSON file fallback for KJV verse data (SECONDARY)")
        print("⚠️  Reason: MongoDB not available or connection failed")
        return serve_kjv_verses()

    except Exception as e:
        logging.exception("Exception in /api/kjv-data")
        # Fallback to static file
        return serve_kjv_verses()

# Etymology chain endpoint for building word trees
@api.route('/api/etymology-chain')
def api_etymology_chain():
    """Build complete etymological chain from a Strong's number to its primitive root"""
    return etymology_chain_handler()
