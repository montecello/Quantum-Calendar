#!/usr/bin/env python3
"""
Generate a 0.5° raster heatmap (PNG) showing Day/Civil/Nautical/Astronomical/Night
at the time of the most recent full moon (prev_full).

Output: backend/astronomy/daytype_heatmap.png
"""
import os
import math
import requests
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

from moon import find_prev_next_full_moon
from config import ASTRO_API_BASE

OUT = os.path.join(os.path.dirname(__file__), 'daytype_heatmap.png')
SIZE_PX = 2000
MARGIN_RATIO = 0.05
LAT_STEP = 0.5
LON_STEP = 0.5

# colors
CMAP = {
    'day': (255, 236, 153),          # pale yellow
    'civil': (255, 208, 138),        # light orange
    'nautical': (193, 218, 251),     # light blue
    'astronomical': (155, 176, 232), # blue-gray
    'night': (15, 35, 63)            # dark navy
}


def _deg2rad(d):
    return d * math.pi / 180.0

def _rad2deg(r):
    return r * 180.0 / math.pi


def angular_distance_deg(lat1, lon1, lat2, lon2):
    phi1 = _deg2rad(lat1)
    phi2 = _deg2rad(lat2)
    dl = _deg2rad(lon2 - lon1)
    cos_c = math.sin(phi1)*math.sin(phi2) + math.cos(phi1)*math.cos(phi2)*math.cos(dl)
    cos_c = max(-1.0, min(1.0, cos_c))
    return _rad2deg(math.acos(cos_c))


def sun_altitude_from_subsolar(lat, lon, sub_lat, sub_lon):
    central = angular_distance_deg(lat, lon, sub_lat, sub_lon)
    return 90.0 - central


def get_subsolar(prev_full):
    iso = prev_full.isoformat().replace('+00:00', 'Z')
    url = f"{ASTRO_API_BASE.rstrip('/')}/position/sun"
    resp = requests.get(url, params={'iso': iso}, timeout=10)
    resp.raise_for_status()
    j = resp.json()
    return float(j['lat']), float(j['lon'])


def _azimuthal_eq_coords(lat_deg, lon_deg, center_lon_deg=0, R=1.0):
    phi = math.radians(lat_deg)
    delta_lambda = math.radians(center_lon_deg - lon_deg)
    c = (math.pi / 2.0) - phi
    rho = R * c
    x = rho * math.sin(delta_lambda)
    y = -rho * math.cos(delta_lambda)
    return x, y


def generate_heatmap(prev_full=None, out_path=OUT, size_px=SIZE_PX, lat_step=LAT_STEP, lon_step=LON_STEP):
    if prev_full is None:
        prev_full, _ = find_prev_next_full_moon(datetime.now(timezone.utc))

    sub_lat, sub_lon = get_subsolar(prev_full)

    # prepare projection/scaling
    R = 1.0
    rho_max = math.pi * R
    half = size_px / 2.0
    scale = (half * (1 - MARGIN_RATIO)) / rho_max
    cx = cy = half

    def proj(lat, lon):
        x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
        return int(round(cx + x_rel * scale)), int(round(cy + y_rel * scale))

    # image
    img = Image.new('RGB', (size_px, size_px), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # grid: iterate lat descending for nicer drawing
    lats = [85 - i*lat_step for i in range(int((85 - (-85))/lat_step) + 1)]
    lons = [(-180) + i*lon_step for i in range(int((360)/lon_step))]

    # pixel marker size (square) scaled to image
    base_px = max(1, int(size_px * 0.002))
    half_px = base_px // 2

    # draw background graticule lightly first (optional)
    # classify and draw
    for lat in lats:
        for lon in lons:
            alt = sun_altitude_from_subsolar(lat, lon, sub_lat, sub_lon)
            if alt > 0:
                cls = 'day'
            elif alt >= -6:
                cls = 'civil'
            elif alt >= -12:
                cls = 'nautical'
            elif alt >= -18:
                cls = 'astronomical'
            else:
                cls = 'night'
            x, y = proj(lat, lon)
            # draw small rect centered
            x0 = x - half_px
            y0 = y - half_px
            x1 = x + half_px
            y1 = y + half_px
            # bounds check
            if x1 < 0 or y1 < 0 or x0 >= size_px or y0 >= size_px:
                continue
            draw.rectangle([x0, y0, x1, y1], fill=CMAP[cls])

    # mark subsolar point
    sx, sy = proj(sub_lat, sub_lon)
    draw.ellipse([sx-6, sy-6, sx+6, sy+6], fill=(255,140,0), outline=(179,90,0))

    # draw legend
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    legend_x = int(size_px - 220)
    legend_y = 20
    items = [('day','Day'),('civil','Civil Twilight'),('nautical','Nautical Twilight'),('astronomical','Astronomical Twilight'),('night','Night')]
    for i, (k, label) in enumerate(items):
        yy = legend_y + i*20
        draw.rectangle([legend_x, yy, legend_x+18, yy+12], fill=CMAP[k], outline=(50,50,50))
        draw.text((legend_x+22, yy), label, fill=(0,0,0), font=font)

    # footer
    draw.text((12, size_px-28), f'Day/twilight map at full-moon time {prev_full.isoformat()}', fill=(0,0,0), font=font)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path)
    return out_path


if __name__ == '__main__':
    out = generate_heatmap()
    print('Wrote', out)
