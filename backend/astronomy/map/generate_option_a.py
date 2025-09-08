#!/usr/bin/env python3
"""
Generate Option A: produce a 0.1° day/twilight heatmap using the existing
daytype_heatmap generator, then compute a continuous night/astronomical
boundary by radial sampling, smooth it, write a per-azimuth CSV, and draw
overlay lines + western-night crop.
"""
import os
import math
from datetime import datetime, timezone
from backend.astronomy.map import daytype_heatmap
from backend.astronomy.map.daytype_heatmap import (
    find_prev_next_full_moon,
    get_subsolar,
    _azimuthal_eq_coords,
    sun_altitude_from_subsolar,
)
from PIL import Image, ImageDraw, ImageFont


def run(out_png=None, csv_out=None, size_px=2000, az_step=0.5, rho_steps=800):
    if out_png is None:
        out_png = os.path.join(os.path.dirname(__file__), 'daytype_heatmap_full_0.1.png')
    if csv_out is None:
        csv_out = os.path.join(os.path.dirname(__file__), 'daytype_boundary_debug.csv')

    now = datetime.now(timezone.utc)
    prev_full, _ = find_prev_next_full_moon(now)

    # 1) generate base heatmap at 0.1° using existing generator
    print('Rendering base heatmap (0.1°) ...')
    daytype_heatmap.generate_heatmap(prev_full=prev_full, out_path=out_png, size_px=size_px, lat_step=0.1, lon_step=0.1)

    # prepare projection/scaling (match daytype_heatmap)
    R = 1.0
    rho_max = math.pi * R
    half = size_px / 2.0
    margin_ratio = 0.05
    scale = (half * (1 - margin_ratio)) / rho_max
    cx = cy = half

    # get subsolar for altitude calculations
    sub_lat, sub_lon = get_subsolar(prev_full)

    # radial sampling angles
    n_angles = max(360, int(round(360.0 / az_step)))
    angles = [math.radians(i * az_step) for i in range(n_angles)]

    boundary_rhos = []  # per-angle rho (rad) where alt crosses >= -18 (astronomical twilight edge)
    outer_night = []  # maximum night rho per angle

    for angle in angles:
        found_boundary = None
        max_night = None
        for j in range(rho_steps + 1):
            rho = (j / rho_steps) * rho_max
            phi = (math.pi / 2.0) - rho
            lat_deg = math.degrees(phi)
            lon_deg = math.degrees(angle)
            if lon_deg >= 180.0:
                lon_deg -= 360.0
            alt = sun_altitude_from_subsolar(lat_deg, lon_deg, sub_lat, sub_lon)
            if alt < -18:
                max_night = rho
            if found_boundary is None and alt >= -18:
                # first point outside night
                found_boundary = rho
                break
        # prefer using the night-side rho as the boundary location (closest night pixel)
        chosen_rho = max_night if max_night is not None else found_boundary
        boundary_rhos.append(chosen_rho)
        outer_night.append(max_night)

    # Convert rhos to pixels, smooth with circular median + moving average
    def median_filter(vals, window=7):
        if not vals:
            return vals
        n = len(vals)
        half = window // 2
        out = []
        for i in range(n):
            win = [vals[(i + j) % n] for j in range(-half, half+1)]
            out.append(sorted([v if v is not None else 0.0 for v in win])[len(win)//2])
        return out

    def moving_avg(vals, window=3):
        if not vals:
            return vals
        n = len(vals)
        half = window // 2
        out = []
        for i in range(n):
            win = [vals[(i + j) % n] for j in range(-half, half+1)]
            out.append(sum(win) / len(win))
        return out

    # map None -> 0 for smoothing then mask later
    rhos_px = [ (rho * scale) if (rho is not None) else 0.0 for rho in boundary_rhos ]
    rhos_med = median_filter(rhos_px, window=7)
    rhos_smooth = moving_avg(rhos_med, window=3)

    # Build XY points
    merged_xy = []
    csv_rows = []
    for ang_rad, rho_px, rho_rad in zip(angles, rhos_smooth, [r for r in boundary_rhos]):
        if rho_rad is None:
            continue
        phi = (math.pi / 2.0) - rho_rad
        lat_deg = math.degrees(phi)
        lon_deg = math.degrees(ang_rad)
        if lon_deg >= 180.0:
            lon_deg -= 360.0
        x_rel, y_rel = _azimuthal_eq_coords(lat_deg, lon_deg, center_lon_deg=0, R=R)
        x = cx + x_rel * scale
        y = cy + y_rel * scale
        merged_xy.append((x, y))
        csv_rows.append((math.degrees(ang_rad), rho_px, lat_deg, lon_deg))

    # write CSV
    try:
        with open(csv_out, 'w', encoding='utf-8') as cf:
            cf.write('angle_deg,rho_px,lat_deg,lon_deg\n')
            for row in csv_rows:
                cf.write(','.join([str(x) for x in row]) + '\n')
        print('Wrote CSV:', csv_out)
    except Exception as e:
        print('CSV write failed:', e)

    # Load base image and draw overlays
    im = Image.open(out_png).convert('RGBA')
    draw = ImageDraw.Draw(im)

    # merged boundary (pink)
    if merged_xy:
        try:
            draw.line(merged_xy, fill=(255,20,120,255), width=max(3, int(size_px * 0.006)))
        except Exception:
            draw.line(merged_xy, fill=(255,20,120,255), width=max(3, int(size_px * 0.006)))

    # western-night crop: build polygon from outer_night
    outer_xy = []
    for ang_rad, r in zip(angles, outer_night):
        if r is None:
            continue
        phi = (math.pi / 2.0) - r
        lat_deg = math.degrees(phi)
        lon_deg = math.degrees(ang_rad)
        if lon_deg >= 180.0:
            lon_deg -= 360.0
        x_rel, y_rel = _azimuthal_eq_coords(lat_deg, lon_deg, center_lon_deg=0, R=R)
        x = cx + x_rel * scale
        y = cy + y_rel * scale
        outer_xy.append((math.degrees(ang_rad), x, y))

    outer_xy.sort(key=lambda t: t[0])
    poly_full = [(x, y) for _, x, y in outer_xy]
    if len(poly_full) >= 3:
        mask = Image.new('L', (size_px, size_px), 0)
        md = ImageDraw.Draw(mask)
        try:
            md.polygon(poly_full, fill=255)
            # zero out eastern half
            md.rectangle([int(round(cx))+1, 0, size_px, size_px], fill=0)
            night_overlay = Image.new('RGBA', (size_px, size_px), (20, 40, 80, 140))
            im = Image.composite(night_overlay, im, mask)
            draw = ImageDraw.Draw(im)
            # draw visible western boundary
            west_boundary = [(x, y) for (_, x, y) in outer_xy if x <= cx]
            if len(west_boundary) >= 2:
                draw.line(west_boundary, fill=(255,20,120,255), width=max(2, int(size_px * 0.005)))
        except Exception as e:
            print('Western-night crop failed:', e)

    # final save
    final_out = out_png.replace('.png', '_with_boundary.png')
    im.convert('RGB').save(final_out)
    print('Wrote final image:', final_out)
    return final_out, csv_out


if __name__ == '__main__':
    run()
