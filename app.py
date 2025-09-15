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
# Move this to lazy initialization to avoid import-time failures
client, db = None, None
app.config['mongo_client'] = client
app.config['mongo_db'] = db


def log_startup_status():
    """Log startup status for MongoDB and data loading (non-blocking)"""
    print("\n" + "="*60)
    print("🚀 QUANTUM CALENDAR STARTUP STATUS")
    print("="*60)

    # Log MongoDB status (try to connect but don't fail if it doesn't work)
    print("\n🔧 [STARTUP] Checking MongoDB connection...")
    try:
        from config import MONGODB_URI, DATABASE_NAME
        if MONGODB_URI:
            print(f"🔧 [STARTUP] MongoDB URI configured: Yes")
            print(f"🔧 [STARTUP] Database name: {DATABASE_NAME}")

            # Try to connect (but don't store in app config yet)
            from pymongo import MongoClient
            test_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            test_db = test_client[DATABASE_NAME]

            # Test connection
            test_client.admin.command('ping')
            print("✅ [STARTUP] MongoDB connection successful")

            # Log server info
            server_info = test_client.server_info()
            print(f"✅ [STARTUP] MongoDB version: {server_info.get('version', 'Unknown')}")

            # Test collections
            collections = test_db.list_collection_names()
            print(f"✅ [STARTUP] Available collections: {collections}")

            test_client.close()

        else:
            print("⚠️ [STARTUP] MongoDB URI not configured")

    except Exception as e:
        print(f"❌ [STARTUP] MongoDB connection failed: {e}")
        print("⚠️ [STARTUP] App will use fallback static files for MongoDB data")

    # Log data loading status
    print("\n📊 [STARTUP] Checking astronomical data loading...")
    try:
        from backend.data import load_all_data
        print("📊 [STARTUP] Astronomical data module available")
        print("📊 [STARTUP] Data will be loaded on first request (lazy loading)")
    except Exception as e:
        print(f"❌ [STARTUP] Data loading module error: {e}")

    print("\n🎯 [STARTUP] Flask app ready!")
    print("="*60 + "\n")


# Call startup logging
log_startup_status()


# Vercel requires the Flask app to be the main export
# This ensures Vercel can properly import and serve the Flask application
def create_app():
    """Factory function to create Flask app for Vercel"""
    return app

# Export the app for Vercel
application = app


if __name__ == "__main__":
    # Load data only for local dev to keep Vercel cold starts fast
    print("\n📊 [LOCAL] Loading astronomical data for local development...")
    load_all_data()
    print("✅ [LOCAL] Astronomical data loaded successfully")

    # Demo prints for local run
    print("\n" + "="*60)
    print("🌅 [LOCAL] Sun Events for Today (Demo: Greenwich, UTC, lat=51.48, lon=0.0)")
    print_today_sun_events(51.48, 0.0, 'UTC')
    print("✅ [LOCAL] Sun events calculated")
    print()

    print("🌙 [LOCAL] Moon Events for Today (Demo: Greenwich, UTC, lat=51.48, lon=0.0)")
    print_today_moon_events(51.48, 0.0, 'UTC', location_name="Greenwich, UK")
    print("✅ [LOCAL] Moon events calculated")
    print()

    print("📅 [LOCAL] Yearly Events for London (Demo: Europe/London timezone)")
    print_yearly_events(51.5074, -0.1278, 'Europe/London', location_name="London, ENG, United Kingdom")
    print("✅ [LOCAL] Yearly events calculated")
    print()

    # Print multi-year calendar data for demo (Greenwich, 2024-2026) at the end
    print("📊 [LOCAL] Multi-Year Calendar (Greenwich, 2024-2026)")
    print_multi_year_calendar(2024, 2026, 51.48, 0.0, 'Europe/London')
    print("✅ [LOCAL] Multi-year calendar calculated")
    print("="*60 + "\n")

    port = int(os.environ.get("PORT", "5001"))
    app.run(debug=True, port=port, host="0.0.0.0")
