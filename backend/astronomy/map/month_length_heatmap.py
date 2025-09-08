#!/usr/bin/env python3
"""
Generate a 1° raster heatmap showing 29-day vs 30-day months in the custom calendar
at the current time, using azimuthal equidistant projection.

Output: backend/astronomy/map/month_length_heatmap.png
"""
import os
import math
import logging
import csv
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont
from tqdm import tqdm
import pytz

from backend.astronomy.moon import find_prev_next_full_moon, find_first_dawn_after, count_dawn_cycles
from backend.data import load_full_moon_times
from config import ASTRO_API_BASE  # Assuming this is needed for any API calls in dawn calculations

OUT = os.path.join(os.path.dirname(__file__), 'month_length_heatmap.png')
SIZE_PX = 2000
MARGIN_RATIO = 0.00
LAT_STEP = 1
LON_STEP = 1

# Colors for month lengths (with 50% opacity)
CMAP = {
    '29': (0, 0, 255, 128),      # Blue for 29-day months
    '30': (255, 0, 0, 128),      # Red for 30-day months
    '29-secondary': (64, 224, 208, 128),  # Turquoise for 29-day secondary
    '30-secondary': (255, 192, 203, 128),  # Pink for 30-day secondary
    'unknown': (128, 128, 128, 128)  # Gray for calculation failures
}

logging.basicConfig(level=logging.INFO)

# Global parsed full moon times to avoid re-parsing
parsed_full_moon_times = None

def load_parsed_full_moons():
    global parsed_full_moon_times
    if parsed_full_moon_times is None:
        load_full_moon_times()
        from backend.data import full_moon_times
        import pytz
        parsed_full_moon_times = [pytz.UTC.localize(datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')) for s in full_moon_times['Full Moon Time (UTC)']]
    return parsed_full_moon_times

def find_prev_next_full_moon_optimized(now_utc):
    times = load_parsed_full_moons()
    prev = max((t for t in times if t <= now_utc), default=None)
    nxt = min((t for t in times if t > now_utc), default=None)
    return prev, nxt

def _deg2rad(d):
    return d * math.pi / 180.0

def _rad2deg(r):
    return r * 180.0 / math.pi

def _azimuthal_eq_coords(lat_deg, lon_deg, center_lon_deg=0, R=1.0):
    """
    Azimuthal equidistant projection centered on the North Pole (lat=90°).
    Returns (x, y) where x to the right, y down (SVG coordinates will flip y as needed).
    """
    # convert to radians
    phi = math.radians(lat_deg)  # latitude
    # invert longitude delta so that increasing longitude maps in the
    # opposite rotational direction (clockwise motion on the plot)
    delta_lambda = math.radians(center_lon_deg - lon_deg) + math.pi  # Rotate 180 degrees clockwise
    # c = pi/2 - phi
    c = (math.pi / 2.0) - phi
    rho = R * c
    x = rho * math.sin(delta_lambda)
    y = -rho * math.cos(delta_lambda)
    return x, y

def get_local_timezone(lat, lon):
    """
    Approximate local timezone from lat/lon using pytz.
    Rounds longitude to nearest hour offset.
    """
    tz_offset_hours = round(lon / 15.0)
    tz_name = f'Etc/GMT{-tz_offset_hours}' if tz_offset_hours != 0 else 'UTC'
    try:
        return pytz.timezone(tz_name)
    except:
        return pytz.UTC  # Fallback

def get_days_in_current_month(lat, lon, tzname='UTC', target_date=None):
    """
    Calculate days in the current lunar month for a given lat/lon, using local timezone.
    Returns 29, 30, 29-secondary, 30-secondary, or 'unknown' if calculation fails.
    If target_date is provided, calculate for that specific date instead of current time.
    """
    is_debug = False  # Will set to True if secondary is used
    debug_info = {}
    try:
        if target_date is None:
            now_utc = datetime.now(timezone.utc)
        else:
            # Convert target_date to UTC if it's not already
            if target_date.tzinfo is None:
                now_utc = pytz.UTC.localize(target_date)
            else:
                now_utc = target_date.astimezone(pytz.UTC)
        
        local_tz = get_local_timezone(lat, lon)
        now_local = now_utc.astimezone(local_tz)
        
        # Get full moons in UTC, then convert to local
        prev_full_utc, next_full_utc = find_prev_next_full_moon_optimized(now_utc)
        prev_full_local = prev_full_utc.astimezone(local_tz) if prev_full_utc else None
        next_full_local = next_full_utc.astimezone(local_tz) if next_full_utc else None
        
        debug_info = {
            'lon': lon,
            'lat': lat,
            'prev_full_moon_utc': prev_full_utc.isoformat() if prev_full_utc else None,
            'next_full_moon_utc': next_full_utc.isoformat() if next_full_utc else None,
            'dawn_start_local': None,
            'tag': None,
            'days': None
        }
        
        # Find dawns in local time (pass local tz to find_first_dawn_after)
        dawn_start_local, dawn_tag = find_first_dawn_after(prev_full_local, lat, lon, local_tz.zone)
        if not dawn_start_local:
            return 'unknown', debug_info
        
        debug_info['dawn_start_local'] = dawn_start_local.isoformat()
        debug_info['tag'] = dawn_tag
        
        # Check if secondary
        is_secondary = dawn_tag != 'astronomical'
        if is_secondary:
            is_debug = True
        
        dawn_end_local, _ = find_first_dawn_after(next_full_local, lat, lon, local_tz.zone)
        if not dawn_end_local:
            return 'unknown', debug_info
        
        # Count dawn cycles in local time
        days = count_dawn_cycles(dawn_start_local, dawn_end_local, lat, lon, local_tz.zone)
        debug_info['days'] = days
        
        if days not in [29, 30]:
            return 'unknown', debug_info
        
        result = str(days)
        if is_secondary:
            result += '-secondary'
        
        return result, debug_info
    except Exception as e:
        logging.warning(f"Failed to calculate days for lat={lat}, lon={lon}: {e}")
        return 'unknown', debug_info

def generate_heatmap(out_path=OUT, size_px=SIZE_PX, lat_step=LAT_STEP, lon_step=LON_STEP, target_date=None):
    """
    Generate the heatmap PNG.
    If target_date is provided, generate for that specific date instead of current time.
    """
    if target_date is None:
        now_utc = datetime.now(timezone.utc)
        date_str = "current time"
    else:
        if target_date.tzinfo is None:
            now_utc = pytz.UTC.localize(target_date)
        else:
            now_utc = target_date.astimezone(pytz.UTC)
        date_str = target_date.strftime('%Y-%m-%d')
    
    # Load parsed times once
    load_parsed_full_moons()
    
    # Projection setup (same as daytype_heatmap.py)
    R = 1.0
    rho_max = math.pi * R
    half = size_px / 2.0
    scale = (half * (1 - MARGIN_RATIO)) / rho_max
    cx = cy = half

    def proj(lat, lon):
        x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
        return int(round(cx + x_rel * scale)), int(round(cy + y_rel * scale))

    try:
        base_path = os.path.join(os.path.dirname(__file__), 'map.png')
        if os.path.exists(base_path):
            base_img = Image.open(base_path).convert('RGBA')
            # Resize to match the output size
            base_img = base_img.resize((size_px, size_px), Image.Resampling.LANCZOS)
        else:
            base_img = Image.new('RGBA', (size_px, size_px), (255,255,255,255))
    except Exception:
        base_img = Image.new('RGBA', (size_px, size_px), (255,255,255,255))

    # overlay image for semi-transparent tiles
    overlay = Image.new('RGBA', (size_px, size_px), (255,255,255,0))
    overlay_draw = ImageDraw.Draw(overlay)

    # Grid: lat descending for nicer drawing
    lats = [85 - i * lat_step for i in range(int((85 - (-85)) / lat_step) + 1)]
    lons = [(-180) + i * lon_step for i in range(int(360 / lon_step))]

    # Pixel marker size
    base_px = max(1, int(size_px * 0.002))
    half_px = base_px // 2

    total_points = len(lats) * len(lons)

    # CSV data collection
    csv_data = []

    # Classify and draw with progress bar
    with tqdm(total=total_points, desc=f"Generating heatmap for {date_str}") as pbar:
        for lat in lats:
            for lon in lons:
                cls, debug_info = get_days_in_current_month(lat, lon, target_date=target_date)
                x, y = proj(lat, lon)
                x0 = x - half_px
                y0 = y - half_px
                x1 = x + half_px
                y1 = y + half_px
                if x1 < 0 or y1 < 0 or x0 >= size_px or y0 >= size_px:
                    pbar.update(1)
                    continue
                overlay_draw.rectangle([x0, y0, x1, y1], fill=CMAP[cls])
                
                # Collect CSV data for ALL locations to analyze transitions
                csv_data.append(debug_info)
                
                pbar.update(1)

    # Write CSV
    csv_path = os.path.join(os.path.dirname(out_path), 'debug_all_locations.csv')
    with open(csv_path, 'w', newline='') as csvfile:
        fieldnames = ['Lon', 'Lat', 'Prev Full Moon UTC', 'Next Full Moon UTC', 'Dawn Start Local', 'tag', 'days']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for row in csv_data:
            writer.writerow({
                'Lon': row['lon'],
                'Lat': row['lat'],
                'Prev Full Moon UTC': row['prev_full_moon_utc'],
                'Next Full Moon UTC': row['next_full_moon_utc'],
                'Dawn Start Local': row['dawn_start_local'],
                'tag': row['tag'],
                'days': row['days']
            })

    # Legend
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    legend_x = int(size_px - 220)
    legend_y = 20
    items = [('29', '29-Day Month'), ('30', '30-Day Month'), ('29-secondary', '29-Day Secondary'), ('30-secondary', '30-Day Secondary'), ('unknown', 'Unknown')]
    for i, (k, label) in enumerate(items):
        yy = legend_y + i * 20
        overlay_draw.rectangle([legend_x, yy, legend_x + 18, yy + 12], fill=CMAP[k], outline=(50, 50, 50))
        overlay_draw.text((legend_x + 22, yy), label, fill=(0, 0, 0), font=font)

    # Draw 15° longitude tick marks around the outer edge so the background
    # map.png alignment can be verified. Longitude 0 is drawn straight
    # down from the center (matches map.png convention).
    try:
        for i in range(24):  # 15° increments
            angle = i * 15.0
            # outer edge
            x_outer = cx + (half - 10) * math.sin(math.radians(angle))
            y_outer = cy + (half - 10) * math.cos(math.radians(angle))
            # inner tick
            x_inner = cx + (half - 20) * math.sin(math.radians(angle))
            y_inner = cy + (half - 20) * math.cos(math.radians(angle))
            overlay_draw.line([x_outer, y_outer, x_inner, y_inner], fill=(100,100,100), width=1)
    except Exception:
        pass

    # Composite overlay onto base image
    try:
        # ensure both are RGBA and same size
        base_img = base_img.convert('RGBA')
        overlay = overlay.convert('RGBA')
        combined = Image.alpha_composite(base_img, overlay)
    except Exception:
        # fallback: if something goes wrong just use overlay flattened on white
        combined = overlay.convert('RGBA')

    # Plot reference cities to verify map alignment. Draw after compositing so
    # markers are always visible on top of the background/overlay.
    try:
        draw = ImageDraw.Draw(combined)
        cities = [
            ('Los Angeles', 34.0522, -118.2437, (220,20,60)),
            ('New York City', 40.7128, -74.0060, (0,120,200)),
            ('Seoul', 37.5665, 126.9780, (120,20,200)),
            ('Perth', -31.9505, 115.8605, (20,160,80)),
            ('Cairo', 30.0444, 31.2357, (200,140,20)),
            ('Rio de Janeiro', -22.9068, -43.1729, (200,40,120)),
        ]
        # Additional reference cities
        cities.extend([
            ('Sydney', -33.8688, 151.2093, (255,100,50)),
            ('London', 51.5074, -0.1278, (80,80,200)),
            ('Cape Town', -33.9249, 18.4241, (120,200,120)),
            ('Buenos Aires', -34.6037, -58.3816, (200,80,120)),
            ('Moscow', 55.7558, 37.6173, (160,100,220)),
            ('Singapore', 1.3521, 103.8198, (255,200,0)),
            ('Auckland', -36.8485, 174.7633, (100,200,240)),
            ('Boston', 42.3601, -71.0589, (30,144,255)),
            ('Montreal', 45.5017, -73.5673, (25,130,200)),
            ('Islamabad', 33.6844, 73.0479, (150, 50, 150)),
            ('Tehran', 35.6892, 51.3890, (255, 165, 0)),
            # Northern cities for winter analysis
            ('Calgary', 51.0447, -114.0719, (255, 215, 0)),      # Gold
            ('Edmonton', 53.5444, -113.4909, (255, 140, 0)),     # Orange
            ('Anchorage', 61.2181, -149.9003, (0, 191, 255)),    # Deep Sky Blue
            ('Fairbanks', 64.8378, -147.7164, (0, 255, 255)),    # Cyan
            ('Winnipeg', 49.8951, -97.1384, (255, 20, 147)),     # Deep Pink
            ('Helsinki', 60.1699, 24.9384, (255, 105, 180)),     # Hot Pink
            ('Stockholm', 59.3293, 18.0686, (255, 69, 0)),       # Red Orange
            ('Oslo', 59.9139, 10.7522, (255, 0, 255)),           # Magenta
            ('St Petersburg', 59.9343, 30.3351, (128, 0, 128)),  # Purple
        ])
        for label, lat_c, lon_c, col in cities:
            x, y = proj(lat_c, lon_c)
            draw.ellipse([x-3, y-3, x+3, y+3], fill=col)
            draw.text((x+5, y-5), label, fill=col, font=font)
    except Exception:
        pass

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    combined.save(out_path)
    logging.info(f'Saved heatmap to {out_path}')
    logging.info(f'Saved debug CSV to {csv_path}')
    return out_path

if __name__ == '__main__':
    # Generate heatmap for early June 2025 (using full moon on 2025-06-11)
    june_2025 = datetime(2025, 6, 10)
    out_path = os.path.join(os.path.dirname(__file__), 'month_length_heatmap_june_2025.png')
    out = generate_heatmap(out_path=out_path, target_date=june_2025)
    print(f'Generated heatmap for June 2025: {out}')
