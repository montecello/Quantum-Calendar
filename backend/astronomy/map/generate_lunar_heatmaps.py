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
LAT_STEP = 0.1
LON_STEP = 0.1
MARGIN_RATIO = 0.05

# Color mapping for lunar month lengths
CMAP = {
    '29': (0, 0, 255, 128),          # Blue for 29-day primary months
    '30': (255, 0, 0, 128),          # Red for 30-day primary months
    '29-secondary': (135, 206, 235, 128),  # Sky Blue for 29-day secondary months
    '30-secondary': (255, 192, 203, 128),  # Pink for 30-day secondary months
    'unknown': (128, 128, 128, 128)       # Gray for unknown
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

    base_px = 1  # Single pixel for higher resolution
    half_px = 0

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

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    combined.save(output_path)
    logging.info(f'Saved heatmap to {output_path}')
    return output_path

def generate_all_heatmaps():
    """Generate heatmaps for all full moons in the CSV, starting with current month and alternating forward/backward"""
    # Load full moon times
    full_moon_df = load_full_moon_times()
    full_moons = [pytz.UTC.localize(datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')) for s in full_moon_df['Full Moon Time (UTC)']]

    base_dir = os.path.dirname(os.path.abspath(__file__))
    map_dir = os.path.join(base_dir, '..', '..', '..', 'frontend', 'static', 'img', 'map')
    os.makedirs(map_dir, exist_ok=True)

    # Count existing files
    existing_files = set()
    if os.path.exists(map_dir):
        for f in os.listdir(map_dir):
            if f.endswith('.png'):
                existing_files.add(f)

    # Find current date and closest full moon
    now_utc = datetime.now(timezone.utc)
    current_full_moon_idx = None
    min_diff = float('inf')

    for i, full_moon_time in enumerate(full_moons):
        diff = abs((full_moon_time - now_utc).total_seconds())
        if diff < min_diff:
            min_diff = diff
            current_full_moon_idx = i

    print(f"Current date: {now_utc}")
    print(f"Closest full moon index: {current_full_moon_idx}")
    if current_full_moon_idx is not None:
        print(f"Closest full moon time: {full_moons[current_full_moon_idx]}")

    # Create ordered list starting with current month and alternating forward/backward
    ordered_indices = []
    if current_full_moon_idx is not None:
        ordered_indices.append(current_full_moon_idx)

        # Alternate between forward and backward from current
        forward_idx = current_full_moon_idx + 1
        backward_idx = current_full_moon_idx - 1
        direction = 1  # Start with forward

        while len(ordered_indices) < len(full_moons):
            if direction == 1 and forward_idx < len(full_moons):
                ordered_indices.append(forward_idx)
                forward_idx += 1
            elif direction == -1 and backward_idx >= 0:
                ordered_indices.append(backward_idx)
                backward_idx -= 1

            direction *= -1  # Switch direction
    else:
        # Fallback to original order if no current month found
        ordered_indices = list(range(len(full_moons)))

    total_full_moons = len(full_moons)
    print(f"Total full moons in CSV: {total_full_moons}")
    print(f"Existing heatmap files: {len(existing_files)}")
    print(f"Remaining to generate: {total_full_moons - len(existing_files)}")
    print(f"Processing order: Current month first, then alternating forward/backward")

    generated_files = []
    skipped_files = []
    processed_count = 0

    for idx in ordered_indices:
        processed_count += 1
        full_moon_time = full_moons[idx]

        # Use the full moon time as the target date
        target_datetime = full_moon_time

        # Format filename as YYYY-MM-DD_HH:MM:SS.png
        filename = full_moon_time.strftime('%Y-%m-%d_%H:%M:%S') + '.png'
        output_path = os.path.join(map_dir, filename)

        # Check if file already exists
        if os.path.exists(output_path):
            logging.info(f"[{processed_count}/{total_full_moons}] Skipping {filename} - already exists")
            skipped_files.append(filename)
            continue

        logging.info(f"[{processed_count}/{total_full_moons}] Generating heatmap for {full_moon_time}")
        try:
            generate_heatmap_for_date(target_datetime, output_path)
            generated_files.append(filename)
        except Exception as e:
            logging.error(f"Failed to generate heatmap for {full_moon_time}: {e}")

    return generated_files, skipped_files

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    print("Generating lunar month heatmaps for all full moons in CSV...")
    generated_files, skipped_files = generate_all_heatmaps()

    print(f"\nGeneration Summary:")
    print(f"  - Total full moons processed: {len(generated_files) + len(skipped_files)}")
    print(f"  - Newly generated: {len(generated_files)}")
    print(f"  - Skipped (already existed): {len(skipped_files)}")
    print("Heatmap generation complete!")
