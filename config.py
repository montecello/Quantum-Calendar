
# Configuration file for the calendar web app


import os

# ...existing code...
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
if not GEOAPIFY_API_KEY:
    print("Warning: GEOAPIFY_API_KEY not set; geocoding proxy will be disabled")
# ...existing code...