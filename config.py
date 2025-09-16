
# Configuration file for the calendar web app


import os

# ...existing code...
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
if not GEOAPIFY_API_KEY:
    print("Warning: GEOAPIFY_API_KEY not set; geocoding proxy will be disabled")
# ...existing code...

# Base URL for external astronomy microservice (astro-service)
# Defaults to local dev port; set in Vercel to your deployed service URL
ASTRO_API_BASE = os.getenv("ASTRO_API_BASE", "http://localhost:8001")

# MongoDB Atlas configuration
import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # MongoDB configuration with enhanced debugging
    MONGODB_URI = os.environ.get('MONGODB_URI') or os.environ.get('DATABASE_URL')
    
    # Debug MongoDB configuration
    @classmethod
    def debug_mongodb_config(cls):
        uri = cls.MONGODB_URI
        if uri:
            # Don't log the full URI for security, just check format
            uri_length = len(uri)
            uri_prefix = uri[:20] if len(uri) > 20 else uri
            print(f"🔧 CONFIG: MongoDB URI length: {uri_length} characters")
            print(f"🔧 CONFIG: MongoDB URI starts with: {uri_prefix}")
            print(f"🔧 CONFIG: URI contains 'mongodb': {'mongodb' in uri}")
        else:
            print("❌ CONFIG: No MongoDB URI found in environment variables")
            print("🔍 CONFIG: Checking available env vars...")
            env_vars = [k for k in os.environ.keys() if 'MONGO' in k.upper() or 'DATABASE' in k.upper()]
            print(f"🔍 CONFIG: Found env vars: {env_vars}")
    
    # Session configuration
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # CORS configuration
    CORS_ORIGINS = ["http://localhost:3000", "https://calendar.heyyou.eth"]

# Export class configuration for backward compatibility
Config.debug_mongodb_config()  # Run debug on import
MONGODB_URI = Config.MONGODB_URI

DATABASE_NAME = os.getenv("DATABASE_NAME", "quantum-calendar")
STRONG_COLLECTION = os.getenv("STRONG_COLLECTION", "strongs")
KJV_COLLECTION = os.getenv("KJV_COLLECTION", "kjv_verses")
