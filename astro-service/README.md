Astro Service

Lightweight FastAPI microservice that handles heavy Skyfield computations (e.g., moon illumination) so your Vercel app can stay small and fast.

Endpoints
- GET /health — liveness check
- GET /illumination/moon?iso=YYYY-MM-DDTHH:MM:SSZ — returns fraction illuminated (0..100)
- GET /illumination/moon-batch?iso=...&iso=... — returns array for multiple timestamps

Run locally
1) Install deps:
   pip install -r requirements.txt
2) Start server:
   uvicorn app.main:app --host 0.0.0.0 --port 8001

Notes
- The service will download de421.bsp on first run into ./data (ignored by git).
- Set CORS_ALLOW_ORIGINS to your dev origins (comma-separated) if calling directly from the browser; server-to-server doesn’t need it.
