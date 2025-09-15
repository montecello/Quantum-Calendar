
# Configuration file for the calendar web app

import os
import logging

# Set up logging for configuration
logging.basicConfig(level=logging.INFO)

# Geoapify API Configuration
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
if not GEOAPIFY_API_KEY:
    logging.warning("⚠️  GEOAPIFY_API_KEY not set; geocoding proxy will be disabled")
else:
    logging.info("✅ GEOAPIFY_API_KEY loaded successfully")

# Base URL for external astronomy microservice (astro-service)
# Defaults to local dev port; set in Vercel to your deployed service URL
ASTRO_API_BASE = os.getenv("ASTRO_API_BASE", "http://localhost:8001")
logging.info(f"🔗 ASTRO_API_BASE: {ASTRO_API_BASE}")

# MongoDB Atlas Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    logging.warning("⚠️  MONGODB_URI not set; MongoDB features will be disabled")
    logging.warning("💡 To enable MongoDB, set MONGODB_URI environment variable in Vercel")
else:
    # Log partial URI for debugging (hide credentials)
    uri_preview = MONGODB_URI
    if "@" in MONGODB_URI:
        # Hide password in logs
        parts = MONGODB_URI.split("@")
        if len(parts) > 1:
            uri_preview = f"mongodb+srv://***@{parts[1]}"
    logging.info(f"✅ MONGODB_URI loaded: {uri_preview}")

DATABASE_NAME = os.getenv("DATABASE_NAME", "quantum-calendar")
logging.info(f"📊 DATABASE_NAME: {DATABASE_NAME}")

STRONG_COLLECTION = os.getenv("STRONG_COLLECTION", "strongs_complete")
logging.info(f"📚 STRONG_COLLECTION: {STRONG_COLLECTION}")

KJV_COLLECTION = os.getenv("KJV_COLLECTION", "kjv_verses")
logging.info(f"📖 KJV_COLLECTION: {KJV_COLLECTION}")

# Log all environment variables for debugging (filter sensitive ones)
logging.info("🔍 Environment Variables Check:")
env_vars_to_check = ["MONGODB_URI", "DATABASE_NAME", "STRONG_COLLECTION", "KJV_COLLECTION", "GEOAPIFY_API_KEY", "ASTRO_API_BASE"]
for var in env_vars_to_check:
    value = os.getenv(var)
    if value:
        if "URI" in var or "KEY" in var:
            # Hide sensitive parts
            display_value = "***" + value[-10:] if len(value) > 10 else "***"
        else:
            display_value = value
        logging.info(f"   ✅ {var}: {display_value}")
    else:
        logging.info(f"   ❌ {var}: Not set")
