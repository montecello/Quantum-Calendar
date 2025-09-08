import math
import os
from datetime import datetime, date, timedelta
import pytz
import sys

# If running as a script, add the repo root to sys.path so top-level imports (e.g. config)
# used by sibling modules resolve. Repo root is two levels up from this file
# (../.. -> Quantum-Calendar).
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if repo_root not in sys.path:
	sys.path.insert(0, repo_root)

# allow running map.py directly (script) or as a package module
try:
	from .sun import get_event_with_fallback
except Exception:
	# when run as a script (__main__), relative imports fail; fall back to sibling import
	from sun import get_event_with_fallback
try:
	from .moon import find_prev_next_full_moon
except Exception:
	from moon import find_prev_next_full_moon

# Try to load skyfield for accurate sun/moon subpoint calculations. If unavailable, we'll skip plotting.
_skyfield_available = False
try:
	from skyfield.api import load, wgs84
	_skyfield_available = True
except Exception:
	_skyfield_available = False

import requests
from config import ASTRO_API_BASE


def _tz_from_lon(lon):
	"""
	Approximate timezone as fixed-offset from longitude.
	15° = 1 hour. Returns a pytz.FixedOffset tzinfo.
	"""
	offset_hours = int(round(lon / 15.0))
	return pytz.FixedOffset(offset_hours * 60)


def _azimuthal_eq_coords(lat_deg, lon_deg, center_lon_deg=0, R=1.0):
	"""
	Azimuthal equidistant projection centered on the North Pole (lat=90°).
	Returns (x, y) where x to the right, y down (SVG coordinates will flip y as needed).
	"""
	# convert to radians
	phi = math.radians(lat_deg)  # latitude
	# invert longitude delta so that increasing longitude maps in the
	# opposite rotational direction (clockwise motion on the plot)
	delta_lambda = math.radians(center_lon_deg - lon_deg)
	# c = pi/2 - phi
	c = (math.pi / 2.0) - phi
	rho = R * c
	x = rho * math.sin(delta_lambda)
	y = -rho * math.cos(delta_lambda)
	return x, y


def generate_dawn_map_svg(
	out_path=None,
	year=None,
	month=None,
	lat_step=1,
	lon_step=1,
	size_px=2000,
	margin_ratio=0.05
):
	"""
	Compute, for each integer longitude, the latitude where local dawn of the 1st
	of (year,month) occurs earliest in UTC. Project points with azimuthal equidistant
	centered on the north pole and write a zoom-friendly SVG.
	"""
	if year is None or month is None:
		now = datetime.utcnow()
		year = now.year
		month = now.month

	if out_path is None:
		out_path = os.path.join(os.path.dirname(__file__), "dawn_map.svg")

	first_of_month = date(year, month, 1)

	points_by_lon = []  # list of (lon, best_lat, best_utc_datetime, tag)

	lons = list(range(-180, 180, lon_step))
	lats = list(range(-90, 91, lat_step))

	for lon in lons:
		best = None  # tuple (utc_datetime, lat, tag)
		tz = _tz_from_lon(lon)
		for lat in lats:
			try:
				dawn_dt, tag = get_event_with_fallback('dawn', lat, lon, tz, first_of_month)
			except Exception:
				dawn_dt = None
				tag = 'error'
			if dawn_dt is None:
				continue
			# dawn_dt should be timezone-aware in tz; convert to UTC for comparison
			try:
				dawn_utc = dawn_dt.astimezone(pytz.UTC)
			except Exception:
				continue
			if best is None or dawn_utc < best[0]:
				best = (dawn_utc, lat, tag)
		if best is not None:
			points_by_lon.append((lon, best[1], best[0], best[2]))
		# if best is None we skip that longitude (no dawn found in sweep)

	# Prepare SVG projection scaling
	# For azimuthal eq. with R=1, max rho = pi (south pole).
	R = 1.0
	rho_max = math.pi * R
	half = size_px / 2.0
	scale = (half * (1 - margin_ratio)) / rho_max

	cx = cy = half

	# Build path and circles
	path_pts = []
	circle_elems = []
	for lon, lat, utc_dt, tag in points_by_lon:
		x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		path_pts.append((x, y))
		# circle with small radius (adjust to image size)
		r = max(1.5, size_px * 0.002)
		circle_elems.append((x, y, r, lon, lat, utc_dt.isoformat(), tag))

	# Create SVG content (simple, pure XML)
	svg_lines = []
	svg_lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{size_px}" height="{size_px}" viewBox="0 0 {size_px} {size_px}">')
	svg_lines.append(f'<rect width="100%" height="100%" fill="white"/>')

	# Optional: draw graticule circles for latitudes (every 30°)
	for lat_mark in range(60, -91, -30):  # 60,30,0,-30,-60,-90
		# compute radius for that latitude
		phi = math.radians(lat_mark)
		c = (math.pi / 2.0) - phi
		rho = R * c
		r_px = rho * scale
		svg_lines.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r_px:.2f}" fill="none" stroke="#ddd" stroke-width="1"/>')
		svg_lines.append(f'<text x="{cx + 5:.1f}" y="{cy - r_px - 4:.1f}" font-size="12" fill="#666">{lat_mark}°</text>')

	# Draw path connecting longitudes in sequence
	if path_pts:
		# smooth the path using Catmull-Rom to Bezier conversion for a natural curve
		def _smooth_path(pts):
			# pts: list of (x,y)
			n = len(pts)
			if n < 2:
				return ''
			if n == 2:
				x0, y0 = pts[0]
				x1, y1 = pts[1]
				return f'M {x0:.2f} {y0:.2f} L {x1:.2f} {y1:.2f}'
			path = []
			path.append(f'M {pts[0][0]:.2f} {pts[0][1]:.2f}')
			for i in range(n-1):
				p0 = pts[i-1] if i-1 >= 0 else pts[0]
				p1 = pts[i]
				p2 = pts[i+1]
				p3 = pts[i+2] if i+2 < n else pts[-1]
				# Catmull-Rom to Bezier control points
				cp1x = p1[0] + (p2[0] - p0[0]) / 6.0
				cp1y = p1[1] + (p2[1] - p0[1]) / 6.0
				cp2x = p2[0] - (p3[0] - p1[0]) / 6.0
				cp2y = p2[1] - (p3[1] - p1[1]) / 6.0
				path.append(f'C {cp1x:.2f} {cp1y:.2f}, {cp2x:.2f} {cp2y:.2f}, {p2[0]:.2f} {p2[1]:.2f}')
			return ' '.join(path)
		p = _smooth_path(path_pts)
		svg_lines.append(f'<path d="{p}" fill="none" stroke="#c33" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />')

	# Draw points
	for x, y, r, lon, lat, iso, tag in circle_elems:
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#c33" stroke="#600" stroke-width="0.5">')
		svg_lines.append(f'<title>lon={lon} lat={lat} utc={iso} tag={tag}</title>')
		svg_lines.append('</circle>')

	# label and footer
	svg_lines.append(f'<text x="12" y="{size_px-24}" font-size="14" fill="#222">Dawn-first along each longitude for {year}-{month:02d} (azimuthal eq., N-pole center)</text>')
	svg_lines.append('</svg>')

	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	with open(out_path, 'w', encoding='utf-8') as f:
		f.write("\n".join(svg_lines))

	return out_path





def _first_dawn_after(dt_utc, lat, lon, max_days=10):
	"""Return the first dawn (UTC datetime) after dt_utc at given lat/lon using fixed-offset tz approximation."""
	tz = _tz_from_lon(lon)
	# local start date
	local = dt_utc.astimezone(tz)
	start_date = local.date()
	for i in range(0, max_days):
		cand_date = start_date + timedelta(days=i)
		try:
			dawn_local, tag = get_event_with_fallback('dawn', lat, lon, tz, cand_date)
		except Exception:
			dawn_local = None
		if dawn_local:
			try:
				dawn_utc = dawn_local.astimezone(pytz.UTC)
			except Exception:
				continue
			if dawn_utc > dt_utc:
				return dawn_utc
	return None


def _first_dawn_after_with_tag(dt_utc, lat, lon, max_days=10):
	"""Return tuple (dawn_utc, tag) for first dawn after dt_utc or (None, tag).
	Tag comes from get_event_with_fallback and helps identify secondary indicators.
	"""
	tz = _tz_from_lon(lon)
	local = dt_utc.astimezone(tz)
	start_date = local.date()
	for i in range(0, max_days):
		cand_date = start_date + timedelta(days=i)
		try:
			dawn_local, tag = get_event_with_fallback('dawn', lat, lon, tz, cand_date)
		except Exception:
			dawn_local = None
			tag = 'error'
		if dawn_local:
			try:
				dawn_utc = dawn_local.astimezone(pytz.UTC)
			except Exception:
				continue
			if dawn_utc > dt_utc:
				return dawn_utc, tag
	# if nothing found, try to return last-known tag if any (None, 'not_found')
	return None, 'not_found'


def generate_flip_test_svg(out_path=None):
	"""Perform the limited sweeps described and plot flip points to an SVG.

	- Start at most recent full moon (prev_full)
	- Sweep longitude from 0 west to -45 at equator (lat=0), step -1. For each adjacent pair,
	  if the later longitude has an earlier dawn UTC, record a flip point at that longitude.
	- From final longitude, sweep latitude from 0 south to -45, step -1, apply same adjacent comparison
	  and record flip points at those latitudes.
	"""
	now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
	prev_full, _ = find_prev_next_full_moon(now_utc)

	# compute subsolar and sublunar points at prev_full using astro-service as fallback
	sun_pos = None
	moon_pos = None
	iso = prev_full.isoformat().replace('+00:00', 'Z')
	try:
		resp = requests.get(f"{ASTRO_API_BASE}/position/sun", params={'iso': iso}, timeout=10)
		print(f"astro-service sun response: {resp.status_code} {resp.text[:200]}")
		if resp.status_code == 200:
			j = resp.json()
			sun_pos = (float(j['lat']), float(j['lon']))
	except Exception:
		import traceback
		print("astro-service sun request failed:")
		traceback.print_exc()
		sun_pos = None
	try:
		resp = requests.get(f"{ASTRO_API_BASE}/position/moon", params={'iso': iso}, timeout=10)
		print(f"astro-service moon response: {resp.status_code} {resp.text[:200]}")
		if resp.status_code == 200:
			j = resp.json()
			moon_pos = (float(j['lat']), float(j['lon']))
	except Exception:
		import traceback
		print("astro-service moon request failed:")
		traceback.print_exc()
		moon_pos = None

	# lon sweep (equator) - samples and flips
	lon_list = list(range(0, -46, -1))  # 0, -1, ..., -45
	lat0 = 0
	dawns = {}
	for lon in lon_list:
		dawns[lon] = _first_dawn_after(prev_full, lat0, lon)

	lon_points = []
	lon_flip_points = []
	for i, lon in enumerate(lon_list):
		d = dawns.get(lon)
		if d:
			lon_points.append((lon, lat0, d))
		# compare to previous longitude (westwards)
		if i > 0:
			lon_prev = lon_list[i-1]
			da = dawns.get(lon_prev)
			db = d
			if da and db and db < da:
				lon_flip_points.append((lon, lat0, db))

	# green-plot sweep: for each latitude starting at equator, move west from lon=0 until first dawn is found
	green_points = []
	# north from 0..85
	for lat in range(0, 86, 1):
		found = False
		for lon in range(0, -181, -1):
			d = _first_dawn_after(prev_full, lat, lon)
			if d:
				green_points.append((lon, lat, d))
				found = True
				break
		if not found:
			# no dawn found in sweep for this latitude
			continue
	# south from -1..-85
	for lat in range(-1, -86, -1):
		found = False
		for lon in range(0, -181, -1):
			d = _first_dawn_after(prev_full, lat, lon)
			if d:
				green_points.append((lon, lat, d))
				found = True
				break
		if not found:
			continue

	# Build SVG similar to generate_dawn_map_svg but only plotting these points
	if out_path is None:
		out_path = os.path.join(os.path.dirname(__file__), "dawn_flip_test.svg")

	size_px = 1200
	margin_ratio = 0.05
	R = 1.0
	rho_max = math.pi * R
	half = size_px / 2.0
	scale = (half * (1 - margin_ratio)) / rho_max
	cx = cy = half

	svg_lines = []
	svg_lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{size_px}" height="{size_px}" viewBox="0 0 {size_px} {size_px}">')
	svg_lines.append(f'<rect width="100%" height="100%" fill="white"/>')
	# draw graticule
	for lat_mark in range(60, -91, -30):
		phi = math.radians(lat_mark)
		c = (math.pi / 2.0) - phi
		rho = R * c
		r_px = rho * scale
		svg_lines.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r_px:.2f}" fill="none" stroke="#eee" stroke-width="1"/>')

	# draw lon samples (small dark) and flips (red larger)
	for lon, lat, dt in lon_points:
		x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		r = 3
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="#444" stroke="none"/>')
	for lon, lat, dt in lon_flip_points:
		x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		r = 6
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="#c33" stroke="#600" stroke-width="1">')
		svg_lines.append(f'<title>lon flip: lon={lon} lat={lat} utc={dt.isoformat()}</title>')
		svg_lines.append('</circle>')

	# draw smoothed curve through lon_points for visual
	if len(lon_points) >= 2:
		pts = [(_azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)[0] * scale + cx,
				_azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)[1] * scale + cy)
			   for lon, lat, _ in lon_points]
		def _smooth_path_simple(pts):
			n = len(pts)
			if n < 2:
				return ''
			if n == 2:
				return f'M {pts[0][0]:.2f} {pts[0][1]:.2f} L {pts[1][0]:.2f} {pts[1][1]:.2f}'
			path = [f'M {pts[0][0]:.2f} {pts[0][1]:.2f}']
			for i in range(n-1):
				p0 = pts[i-1] if i-1 >= 0 else pts[0]
				p1 = pts[i]
				p2 = pts[i+1]
				p3 = pts[i+2] if i+2 < n else pts[-1]
				cp1x = p1[0] + (p2[0] - p0[0]) / 6.0
				cp1y = p1[1] + (p2[1] - p0[1]) / 6.0
				cp2x = p2[0] - (p3[0] - p1[0]) / 6.0
				cp2y = p2[1] - (p3[1] - p1[1]) / 6.0
				path.append(f'C {cp1x:.2f} {cp1y:.2f}, {cp2x:.2f} {cp2y:.2f}, {p2[0]:.2f} {p2[1]:.2f}')
			return ' '.join(path)
		svg_lines.append(f'<path d="{_smooth_path_simple(pts)}" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="4 3"/>')

	# draw green sweep points (one per latitude found)
	for lon, lat, dt in green_points:
		x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		r = 5
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="#3a3" stroke="#060" stroke-width="1">')
		svg_lines.append(f'<title>green sweep: lon={lon} lat={lat} utc={dt.isoformat()}</title>')
		svg_lines.append('</circle>')

	# plot sun (orange) and moon (blue) if available
	if sun_pos:
		slat, slon = sun_pos
		x_rel, y_rel = _azimuthal_eq_coords(slat, slon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="10" fill="#f90" stroke="#c60" stroke-width="1"><title>Sun @ {prev_full.isoformat()} lat={slat:.3f} lon={slon:.3f}</title></circle>')
	if moon_pos:
		mlat, mlon = moon_pos
		x_rel, y_rel = _azimuthal_eq_coords(mlat, mlon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="8" fill="#39f" stroke="#06c" stroke-width="1"><title>Moon @ {prev_full.isoformat()} lat={mlat:.3f} lon={mlon:.3f}</title></circle>')

	svg_lines.append(f'<text x="12" y="{size_px-20}" font-size="12" fill="#222">Flip test: equator lon 0..-45 (dark), lon-flips (red), green sweep from equator north/south. prev_full={prev_full.isoformat()}</text>')
	svg_lines.append('</svg>')

	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	with open(out_path, 'w', encoding='utf-8') as f:
		f.write('\n'.join(svg_lines))

	return out_path


def generate_true_points_svg(prev_full, out_path=None, max_west=-90):
	"""Generate a single SVG plotting the chosen (is_final) points per latitude.

	prev_full: datetime UTC used as baseline for _first_dawn_after
	"""
	if out_path is None:
		out_path = os.path.join(os.path.dirname(__file__), 'true_points.svg')

	# compute chosen_by_lat similar to debug generator, but keep the tag
	chosen_by_lat = {}
	lon_range = list(range(0, max_west-1, -1))
	for lat in range(0, 86):
		best = None
		for lon in lon_range:
			d, dtag = _first_dawn_after_with_tag(prev_full, lat, lon)
			if d:
				if best is None or d < best[0]:
					best = (d, lon, dtag)
		chosen_by_lat[lat] = (best[1], best[2]) if best else None
	for lat in range(-1, -86, -1):
		best = None
		for lon in lon_range:
			d, dtag = _first_dawn_after_with_tag(prev_full, lat, lon)
			if d:
				if best is None or d < best[0]:
					best = (d, lon, dtag)
		chosen_by_lat[lat] = (best[1], best[2]) if best else None

	# fetch sun and moon subpoints at prev_full (use astro-service)
	sun_pos = None
	moon_pos = None
	iso = prev_full.isoformat().replace('+00:00', 'Z')
	try:
		resp = requests.get(f"{ASTRO_API_BASE}/position/sun", params={'iso': iso}, timeout=10)
		if resp.status_code == 200:
			j = resp.json()
			sun_pos = (float(j['lat']), float(j['lon']))
	except Exception:
		sun_pos = None
	try:
		resp = requests.get(f"{ASTRO_API_BASE}/position/moon", params={'iso': iso}, timeout=10)
		if resp.status_code == 200:
			j = resp.json()
			moon_pos = (float(j['lat']), float(j['lon']))
	except Exception:
		moon_pos = None

	# Build SVG
	size_px = 1200
	margin_ratio = 0.05
	R = 1.0
	rho_max = math.pi * R
	half = size_px / 2.0
	scale = (half * (1 - margin_ratio)) / rho_max
	cx = cy = half

	svg_lines = []
	svg_lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{size_px}" height="{size_px}" viewBox="0 0 {size_px} {size_px}">')
	svg_lines.append('<rect width="100%" height="100%" fill="white"/>')
	# graticule
	for lat_mark in range(60, -91, -30):
		phi = math.radians(lat_mark)
		c = (math.pi / 2.0) - phi
		rho = R * c
		r_px = rho * scale
		svg_lines.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r_px:.2f}" fill="none" stroke="#eee" stroke-width="1"/>')

	# draw chosen points (include tag)
	for lat, lon_tag in sorted(chosen_by_lat.items(), key=lambda x: (-x[0] if x[0] >= 0 else (90 + abs(x[0])))):
		if lon_tag is None:
			continue
		lon, tag = lon_tag
		d, dtag = _first_dawn_after_with_tag(prev_full, lat, lon)
		x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="6" fill="#3a3" stroke="#060" stroke-width="1">')
		svg_lines.append(f'<title>chosen: lat={lat} lon={lon} dawn={d} tag={dtag}</title>')
		svg_lines.append('</circle>')

	# plot sun and moon if available
	if sun_pos:
		slat, slon = sun_pos
		x_rel, y_rel = _azimuthal_eq_coords(slat, slon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="10" fill="#f90" stroke="#c60" stroke-width="1"><title>Sun @ {prev_full.isoformat()} lat={slat:.3f} lon={slon:.3f}</title></circle>')
	if moon_pos:
		mlat, mlon = moon_pos
		x_rel, y_rel = _azimuthal_eq_coords(mlat, mlon, center_lon_deg=0, R=R)
		x = cx + x_rel * scale
		y = cy + y_rel * scale
		svg_lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="8" fill="#39f" stroke="#06c" stroke-width="1"><title>Moon @ {prev_full.isoformat()} lat={mlat:.3f} lon={mlon:.3f}</title></circle>')

	svg_lines.append(f'<text x="12" y="{size_px-20}" font-size="12" fill="#222">Chosen dawn-first longitudes per latitude (baseline prev_full={prev_full.isoformat()})</text>')
	svg_lines.append('</svg>')

	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	with open(out_path, 'w', encoding='utf-8') as f:
		f.write('\n'.join(svg_lines))
	return out_path


if __name__ == "__main__":
	# determine the reference prev_full time (same logic as generate_flip_test_svg)
	now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
	prev_full, _ = find_prev_next_full_moon(now_utc)

	# For debugging: generate per-step SVG frames and a log so we can inspect the exact
	# decisions made while scanning longitudes/latitudes. This writes to
	# backend/astronomy/debug_frames/ and a debug_log.txt file.
	def generate_debug_animation(out_dir=None, max_west=-90):
		"""Write SVG frames and a step log showing each sample and decision.

		max_west: limit on how far west to search (negative, e.g. -90). This keeps
		frame count reasonable for interactive debugging. Increase as needed.
		"""
		if out_dir is None:
			out_dir = os.path.join(os.path.dirname(__file__), 'debug_frames')
		os.makedirs(out_dir, exist_ok=True)
		log_path = os.path.join(out_dir, 'debug_log.txt')
		f_log = open(log_path, 'w', encoding='utf-8')
		# per-frame CSV: frame_idx,lat,lon,dawn_iso,dawn_tag,is_final,note
		frame_log_path = os.path.join(out_dir, 'debug_frame_log.csv')
		f_frame_log = open(frame_log_path, 'w', encoding='utf-8')
		f_frame_log.write('frame,lat,lon,dawn_iso,dawn_tag,is_final,note\n')
		frame_i = 0

		# collected green points so far (populated during sweep)
		green_so_far = []

		def write_frame(highlight=None, highlights=None, note=None, is_final=False):
			nonlocal frame_i
			# Only write a CSV entry per frame (no SVGs). Keeps the log but avoids many files.
			# highlight: (lon, lat, dawn)
			if highlight:
				# safe indexing in case highlight is a tuple of 3 or 4 elements
				lon_h = highlight[0] if len(highlight) > 0 else ''
				lat_h = highlight[1] if len(highlight) > 1 else ''
				d_h = highlight[2] if len(highlight) > 2 else None
				d_tag = highlight[3] if len(highlight) > 3 else ''
			else:
				lon_h = ''
				lat_h = ''
				d_h = None
				d_tag = ''
			d_iso = d_h.isoformat() if (d_h is not None) else ''
			f_frame_log.write(f'{frame_i},{lat_h},{lon_h},{d_iso},{d_tag},{is_final},{(note or "").replace(",",";")}\n')
			f_frame_log.flush()
			frame_i += 1

		# Determine chosen (earliest-dawn) longitude for each latitude within the search range.
		# This enforces the rule: the plotted point for a latitude is the longitude with the
		# earliest UTC dawn (if any). We'll compute for north and south separately.
		chosen_by_lat = {}
		lon_range = list(range(0, max_west-1, -1))  # 0, -1, ... max_west
		# north
		for lat in range(0, 86):
			best = None  # (dawn_utc, lon)
			for lon in lon_range:
				d = _first_dawn_after(prev_full, lat, lon)
				f_log.write(f'precompute lat={lat} lon={lon} dawn={d}\n')
				if d:
					if best is None or d < best[0]:
						best = (d, lon)
			if best:
				chosen_by_lat[lat] = best[1]
			else:
				chosen_by_lat[lat] = None
		# south
		for lat in range(-1, -86, -1):
			best = None
			for lon in lon_range:
				d = _first_dawn_after(prev_full, lat, lon)
				f_log.write(f'precompute lat={lat} lon={lon} dawn={d}\n')
				if d:
					if best is None or d < best[0]:
						best = (d, lon)
			if best:
				chosen_by_lat[lat] = best[1]
			else:
				chosen_by_lat[lat] = None

		# now perform scanning frames: for each latitude, scan from lon=0 westward but
		# continue scanning until we reach the chosen longitude (if any). Mark is_final=True
		# only when the tested lon equals the chosen longitude and dawn exists.
		green_so_far = []
		# north
		for lat in range(0, 86):
			chosen = chosen_by_lat.get(lat)
			if chosen is None:
				f_log.write(f'green_not_found lat={lat}\n')
				continue
			lon = 0
			while lon >= max_west:
				d, dtag = _first_dawn_after_with_tag(prev_full, lat, lon)
				f_log.write(f'green_scan lat={lat} test_lon={lon} dawn={d} tag={dtag}\n')
				is_final = (lon == chosen and d is not None)
				write_frame(highlight=(lon, lat, d, dtag), note=f'scanning lat={lat} lon={lon} dawn={d} tag={dtag}', is_final=is_final)
				if is_final:
					# append chosen point using computed chosen lon and its dawn
					chosen_d, chosen_tag = _first_dawn_after_with_tag(prev_full, lat, chosen)
					green_so_far.append((chosen, lat, chosen_d, chosen_tag))
					f_log.write(f'green_found lat={lat} lon={chosen} dawn={chosen_d} tag={chosen_tag}\n')
					break
				lon -= 1
		# south
		for lat in range(-1, -86, -1):
			chosen = chosen_by_lat.get(lat)
			if chosen is None:
				f_log.write(f'green_not_found lat={lat}\n')
				continue
			lon = 0
			while lon >= max_west:
				d, dtag = _first_dawn_after_with_tag(prev_full, lat, lon)
				f_log.write(f'green_scan lat={lat} test_lon={lon} dawn={d} tag={dtag}\n')
				is_final = (lon == chosen and d is not None)
				write_frame(highlight=(lon, lat, d, dtag), note=f'scanning lat={lat} lon={lon} dawn={d} tag={dtag}', is_final=is_final)
				if is_final:
					chosen_d, chosen_tag = _first_dawn_after_with_tag(prev_full, lat, chosen)
					green_so_far.append((chosen, lat, chosen_d, chosen_tag))
					f_log.write(f'green_found lat={lat} lon={chosen} dawn={chosen_d} tag={chosen_tag}\n')
					break
				lon -= 1

		f_log.close()
		f_frame_log.close()
		return out_dir

	print('Generating debug animation frames (full west to -180) ...')
	out = generate_debug_animation(max_west=-180)
	print(f"Wrote debug frames and log to: {out}")

	# also write a compact SVG of the chosen (is_final) points (full longitude coverage)
	svg_out = generate_true_points_svg(prev_full, out_path=os.path.join(os.path.dirname(__file__), 'true_points.svg'), max_west=-180)
	print(f"Wrote chosen-point SVG to: {svg_out}")

