import os
import logging
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
from skyfield.api import Loader, wgs84
from skyfield import almanac
from datetime import datetime, timezone

HERE = os.path.dirname(__file__)
DATA_DIR = os.path.join(HERE, 'data')
os.makedirs(DATA_DIR, exist_ok=True)
load = Loader(DATA_DIR)
ts = load.timescale()

# Lazy-load ephemeris on first request to keep startup snappy
_eph = None

def eph():
    global _eph
    if _eph is None:
        # de421.bsp is downloaded at build time into app/data
        _eph = load('de421.bsp')
    return _eph

app = FastAPI(title='Astro Service', version='0.1.0')

# CORS config
origins = os.getenv('CORS_ALLOW_ORIGINS', '*')
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins.split(',') if origins else ['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

class IlluminationResp(BaseModel):
    iso: str
    percent: float


class SubpointResp(BaseModel):
    iso: str
    lat: float
    lon: float

@app.on_event('startup')
def preload_ephemeris():
    try:
        _ = eph()
        logging.getLogger("uvicorn").info("Ephemeris loaded: de421.bsp ready")
    except Exception as e:
        logging.getLogger("uvicorn").exception(f"Failed to preload ephemeris: {e}")

@app.get('/health')
def health():
    return {'ok': True}

@app.get('/illumination/moon', response_model=IlluminationResp)
def moon_illumination(iso: str = Query(..., description='UTC ISO8601, e.g., 2025-08-10T12:00:00Z')):
    dt = datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(timezone.utc)
    t = ts.from_datetime(dt)
    percent = float(almanac.fraction_illuminated(eph(), 'moon', t) * 100.0)
    return IlluminationResp(iso=iso, percent=percent)

@app.get('/illumination/moon-batch')
def moon_illumination_batch(iso: List[str] = Query(...)):
    out = []
    e = eph()
    for s in iso:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(timezone.utc)
        t = ts.from_datetime(dt)
        percent = float(almanac.fraction_illuminated(e, 'moon', t) * 100.0)
        out.append({'iso': s, 'percent': percent})
    return out


@app.get('/position/sun', response_model=SubpointResp)
def sun_position(iso: str = Query(..., description='UTC ISO8601, e.g., 2025-08-10T12:00:00Z')):
    dt = datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(timezone.utc)
    t = ts.from_datetime(dt)
    e = eph()
    earth = e['earth']
    sun = e['sun']
    pos = earth.at(t).observe(sun).apparent()
    gp = wgs84.subpoint(pos)
    return SubpointResp(iso=iso, lat=gp.latitude.degrees, lon=gp.longitude.degrees)


@app.get('/position/moon', response_model=SubpointResp)
def moon_position(iso: str = Query(..., description='UTC ISO8601, e.g., 2025-08-10T12:00:00Z')):
    dt = datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(timezone.utc)
    t = ts.from_datetime(dt)
    e = eph()
    earth = e['earth']
    moon = e['moon']
    pos = earth.at(t).observe(moon).apparent()
    gp = wgs84.subpoint(pos)
    return SubpointResp(iso=iso, lat=gp.latitude.degrees, lon=gp.longitude.degrees)


