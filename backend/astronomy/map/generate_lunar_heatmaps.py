#!/usr/bin/env python3
"""
Enhanced Lunar Month Heatmap Generator
Generates heatmaps for current and next lunar months with CSV-based naming
"""

import os
import sys
import math
import logging
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont
import pytz
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from backend.astronomy.moon import find_prev_next_full_moon, find_first_dawn_after, count_dawn_cycles
from backend.data import load_full_moon_times

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

# Configuration
SIZE_PX = 800
LAT_STEP = 0.5
LON_STEP = 0.5
MARGIN_RATIO = 0.05

# Color mapping for lunar month lengths
CMAP = {
    '29': (0, 0, 255, 180),          # Blue for 29-day primary months
    '30': (255, 0, 0, 180),          # Red for 30-day primary months
    '29-secondary': (135, 206, 235, 180),  # Sky Blue for 29-day secondary months
    '30-secondary': (255, 192, 203, 180),  # Pink for 30-day secondary months
    'unknown': (128, 128, 128, 180)       # Gray for unknown
}

def _azimuthal_eq_coords(lat_deg, lon_deg, center_lon_deg=0, R=1.0):
    """Azimuthal equidistant projection centered on the North Pole"""
    phi = math.radians(lat_deg)
    delta_lambda = math.radians(center_lon_deg - lon_deg) + math.pi
    c = (math.pi / 2.0) - phi
    rho = R * c
    x = rho * math.sin(delta_lambda)
    y = -rho * math.cos(delta_lambda)
    return x, y

def get_local_timezone(lat, lon):
    """Approximate local timezone from lat/lon"""
    tz_offset_hours = round(lon / 15.0)
    tz_name = f'Etc/GMT{-tz_offset_hours}' if tz_offset_hours != 0 else 'UTC'
    try:
        return pytz.timezone(tz_name)
    except:
        return pytz.UTC

def get_days_in_current_month(lat, lon, tzname='UTC', target_date=None):
    """Calculate days in the current lunar month for a given lat/lon"""
    try:
        if target_date is None:
            now_utc = datetime.now(timezone.utc)
        else:
            if target_date.tzinfo is None:
                now_utc = pytz.UTC.localize(target_date)
            else:
                now_utc = target_date.astimezone(pytz.UTC)

        local_tz = get_local_timezone(lat, lon)
        now_local = now_utc.astimezone(local_tz)

        prev_full_utc, next_full_utc = find_prev_next_full_moon_optimized(now_utc)
        prev_full_local = prev_full_utc.astimezone(local_tz) if prev_full_utc else None
        next_full_local = next_full_utc.astimezone(local_tz) if next_full_utc else None

        dawn_start_local, dawn_tag = find_first_dawn_after(prev_full_local, lat, lon, local_tz.zone)
        if not dawn_start_local:
            return 'unknown'

        is_secondary = dawn_tag != 'astronomical'

        dawn_end_local, _ = find_first_dawn_after(next_full_local, lat, lon, local_tz.zone)
        if not dawn_end_local:
            return 'unknown'

        days = count_dawn_cycles(dawn_start_local, dawn_end_local, lat, lon, local_tz.zone)

        if days not in [29, 30]:
            return 'unknown'

        result = str(days)
        if is_secondary:
            result += '-secondary'

        return result
    except Exception as e:
        logging.warning(f"Failed to calculate days for lat={lat}, lon={lon}: {e}")
        return 'unknown'

def generate_heatmap_for_date(target_date, output_path):
    """Generate heatmap for a specific date"""
    if target_date.tzinfo is None:
        now_utc = pytz.UTC.localize(target_date)
    else:
        now_utc = target_date.astimezone(pytz.UTC)

    date_str = target_date.strftime('%Y-%m-%d')

    # Load parsed times once
    load_parsed_full_moons()

    # Projection setup
    R = 1.0
    rho_max = math.pi * R
    half = SIZE_PX / 2.0
    scale = (half * (1 - MARGIN_RATIO)) / rho_max
    cx = cy = half

    def proj(lat, lon):
        x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
        return int(round(cx + x_rel * scale)), int(round(cy + y_rel * scale))

    try:
        base_path = os.path.join(os.path.dirname(__file__), 'map.png')
        if os.path.exists(base_path):
            base_img = Image.open(base_path).convert('RGBA')
            base_img = base_img.resize((SIZE_PX, SIZE_PX), Image.Resampling.LANCZOS)
        else:
            base_img = Image.new('RGBA', (SIZE_PX, SIZE_PX), (255,255,255,255))
    except Exception:
        base_img = Image.new('RGBA', (SIZE_PX, SIZE_PX), (255,255,255,255))

    overlay = Image.new('RGBA', (SIZE_PX, SIZE_PX), (255,255,255,0))
    overlay_draw = ImageDraw.Draw(overlay)

    # Grid
    lats = [85 - i * LAT_STEP for i in range(int((85 - (-85)) / LAT_STEP) + 1)]
    lons = [(-180) + i * LON_STEP for i in range(int(360 / LON_STEP))]

    base_px = max(1, int(SIZE_PX * 0.001))  # Reduced for higher resolution
    half_px = base_px // 2

    total_points = len(lats) * len(lons)

    # Generate heatmap
    with tqdm(total=total_points, desc=f"Generating heatmap for {date_str}") as pbar:
        for lat in lats:
            for lon in lons:
                cls = get_days_in_current_month(lat, lon, target_date=target_date)
                x, y = proj(lat, lon)
                x0 = x - half_px
                y0 = y - half_px
                x1 = x + half_px
                y1 = y + half_px
                if x1 < 0 or y1 < 0 or x0 >= SIZE_PX or y0 >= SIZE_PX:
                    pbar.update(1)
                    continue
                overlay_draw.rectangle([x0, y0, x1, y1], fill=CMAP[cls])
                pbar.update(1)

    # Legend - removed from image, will be on webpage instead
    # try:
    #     font = ImageFont.load_default()
    # except Exception:
    #     font = None
    # legend_x = int(SIZE_PX - 220)
    # legend_y = 20
    # items = [('29', '29-Day Month'), ('30', '30-Day Month'), ('29-secondary', '29-Day Secondary'), ('30-secondary', '30-Day Secondary'), ('unknown', 'Unknown')]
    # for i, (k, label) in enumerate(items):
    #     yy = legend_y + i * 20
    #     overlay_draw.rectangle([legend_x, yy, legend_x + 18, yy + 12], fill=CMAP[k], outline=(50, 50, 50))
    #     overlay_draw.text((legend_x + 22, yy), label, fill=(0, 0, 0), font=font)

    # Longitude tick marks
    try:
        for i in range(24):
            angle = i * 15.0
            x_outer = cx + (half - 10) * math.sin(math.radians(angle))
            y_outer = cy + (half - 10) * math.cos(math.radians(angle))
            x_inner = cx + (half - 20) * math.sin(math.radians(angle))
            y_inner = cy + (half - 20) * math.cos(math.radians(angle))
            overlay_draw.line([x_outer, y_outer, x_inner, y_inner], fill=(100,100,100), width=1)
    except Exception:
        pass

    # Composite images
    try:
        base_img = base_img.convert('RGBA')
        overlay = overlay.convert('RGBA')
        combined = Image.alpha_composite(base_img, overlay)
    except Exception:
        combined = overlay.convert('RGBA')

    # Reference cities
    try:
        font = ImageFont.load_default()
        draw = ImageDraw.Draw(combined)
        cities = [
            ('Los Angeles', 34.0522, -118.2437, (220,20,60)),
            ('New York City', 40.7128, -74.0060, (0,120,200)),
            ('London', 51.5074, -0.1278, (80,80,200)),
            ('Sydney', -33.8688, 151.2093, (255,100,50)),
            ('Tokyo', 35.6762, 139.6503, (120,20,200)),
            ('Moscow', 55.7558, 37.6173, (160,100,220)),
        ]
        for label, lat_c, lon_c, col in cities:
            x, y = proj(lat_c, lon_c)
            draw.ellipse([x-3, y-3, x+3, y+3], fill=col)
            draw.text((x+5, y-5), label, fill=col, font=font)
    except Exception:
        pass

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    combined.save(output_path)
    logging.info(f'Saved heatmap to {output_path}')
    return output_path

def get_lunar_month_dates():
    """Get dates for current and next lunar months based on full moon data"""
    now_utc = datetime.now(timezone.utc)

    # Load full moon data
    full_moons = load_parsed_full_moons()

    # Find current lunar month boundaries
    prev_full = max((t for t in full_moons if t <= now_utc), default=None)
    next_full = min((t for t in full_moons if t > now_utc), default=None)

    if not prev_full or not next_full:
        # Fallback to approximate dates
        current_date = now_utc.date()
        next_month_date = (now_utc.replace(day=1) + timedelta(days=32)).replace(day=1)
        return [current_date, next_month_date.date()]

    # Get the full moon after next for the second month
    next_next_full = min((t for t in full_moons if t > next_full), default=None)

    dates = []
    if prev_full:
        dates.append(prev_full.date())
    if next_full and next_next_full:
        dates.append(next_full.date())

    return dates[:2]  # Return current and next month dates

def generate_current_heatmap():
    """Generate heatmap for current lunar month only"""
    dates = get_lunar_month_dates()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(base_dir, '..', '..', '..', 'frontend', 'static', 'img')

    generated_files = []

    # Only generate current month (first date in the list)
    if dates:
        date = dates[0]  # Current month only
        # Use new naming convention: heatmap_YYYY-MM-DD_start.png
        filename = f"heatmap_{date.strftime('%Y-%m-%d')}_start.png"
        output_path = os.path.join(static_dir, filename)

        # Check if file already exists and is recent (within 24 hours)
        if os.path.exists(output_path):
            file_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(output_path))
            if file_age.days < 1:
                logging.info(f"Skipping {filename} - already exists and is recent")
                generated_files.append(filename)
                return generated_files

        logging.info(f"Generating heatmap for current month ({date})")
        try:
            # Convert date to datetime at noon UTC for the target date
            target_datetime = datetime.combine(date, datetime.min.time().replace(hour=12))
            generate_heatmap_for_date(target_datetime, output_path)
            generated_files.append(filename)
        except Exception as e:
            logging.error(f"Failed to generate heatmap for {date}: {e}")

    return generated_files

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    print("Generating lunar month heatmap...")
    files = generate_current_heatmap()

    print(f"Generated {len(files)} heatmap file:")
    for f in files:
        print(f"  - {f}")

    print("Heatmap generation complete!")
