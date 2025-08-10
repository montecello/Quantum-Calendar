
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
