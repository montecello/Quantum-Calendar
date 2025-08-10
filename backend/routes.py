from flask import Blueprint, request, jsonify
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


# Optional pass-through to astro-service (keeps browser same-origin)
@api.route('/api/astro/illumination/moon')
def api_astro_moon():
    try:
        iso = request.args.get('iso')
        if not iso:
            return jsonify({'error': 'iso required'}), 400
        r = requests.get(f"{ASTRO_API_BASE}/illumination/moon", params={'iso': iso}, timeout=8)
        return (r.text, r.status_code, {'Content-Type': r.headers.get('Content-Type', 'application/json')})
    except Exception as e:
        logging.exception('Error proxying to astro-service')
        return jsonify({'error': str(e)}), 502
