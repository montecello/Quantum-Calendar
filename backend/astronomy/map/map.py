import math
import os
from datetime import datetime, date, timedelta, timezone
import pytz
import sys

# If running as a script, add the repo root to sys.path so top-level imports (e.g. config)
# used by sibling modules resolve. Repo root is two levels up from this file
# (../.. -> Quantum-Calendar).
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# When running this file as a script, make the repo root importable but append it
# to sys.path so we don't shadow standard library modules (e.g. calendar).
if __name__ == '__main__' and repo_root not in sys.path:
	sys.path.append(repo_root)

# Import core astronomy helpers from the package root. These live in
# backend/astronomy and must be referenced by their package path when this
# file is located in backend/astronomy/map/.
# Import the local astronomy helpers. Try package-style imports first
# (what editors/linters often expect) and fall back to relative imports
# so the module works when executed as part of the package or as a script.
try:
	from backend.astronomy.sun import get_event_with_fallback
except Exception:
	try:
		from ..sun import get_event_with_fallback
	except Exception:
		# last-resort dynamic import to avoid hard failure during static checks
		import importlib
		try:
			get_event_with_fallback = importlib.import_module('backend.astronomy.sun').get_event_with_fallback
		except Exception:
			get_event_with_fallback = None

try:
	from backend.astronomy.moon import find_prev_next_full_moon
except Exception:
	try:
		from ..moon import find_prev_next_full_moon
	except Exception:
		try:
			from moon import find_prev_next_full_moon
		except Exception:
			try:
				import sys
				sys.path.append('/Users/m/calendar.heyyou.eth/Quantum-Calendar')
				from backend.astronomy.moon import find_prev_next_full_moon
			except Exception:
				find_prev_next_full_moon = None

# Try to load skyfield for accurate sun/moon subpoint calculations. If unavailable, we'll skip plotting.
_skyfield_available = False
try:
	from skyfield.api import load, wgs84
	_skyfield_available = True
except Exception:
	_skyfield_available = False

import requests
# Config: prefer importing project `config.py`; fall back to an environment variable
try:
	from config import ASTRO_API_BASE
except Exception:
	ASTRO_API_BASE = os.environ.get('ASTRO_API_BASE', 'http://localhost:8000')
from PIL import Image, ImageDraw, ImageFont
import time
try:
	from tqdm import tqdm
except Exception:
	tqdm = None


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
	# Use longitude delta so that increasing longitude produces clockwise
	# motion on the plot. Keep lon=0 pointing down (handled by y sign).
	delta_lambda = math.radians(lon_deg - center_lon_deg)
	# c = pi/2 - phi
	c = (math.pi / 2.0) - phi
	rho = R * c
	x = rho * math.sin(delta_lambda)
	# NOTE: map.png uses 0° longitude drawn straight down from the center.
	# The original implementation produced lon=0 pointing up; flip the
	# vertical sign so lon=0 maps downward to match the background image.
	y = rho * math.cos(delta_lambda)
	return x, y


# --- Daytype heatmap generator (merged from daytype_heatmap.py) ---
def angular_distance_deg(lat1, lon1, lat2, lon2):
	phi1 = math.radians(lat1)
	phi2 = math.radians(lat2)
	dl = math.radians(lon2 - lon1)
	cos_c = math.sin(phi1) * math.sin(phi2) + math.cos(phi1) * math.cos(phi2) * math.cos(dl)
	cos_c = max(-1.0, min(1.0, cos_c))
	return math.degrees(math.acos(cos_c))


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


def get_sublunar(prev_full):
	iso = prev_full.isoformat().replace('+00:00', 'Z')
	url = f"{ASTRO_API_BASE.rstrip('/')}/position/moon"
	resp = requests.get(url, params={'iso': iso}, timeout=10)
	resp.raise_for_status()
	j = resp.json()
	return float(j['lat']), float(j['lon'])


def generate_heatmap(prev_full=None, out_path=None, size_px=2000, lat_step=0.1, lon_step=0.1, draw_tiles=True, additional_prev_fulls=[]):
	"""Render a day/twilight heatmap (PNG) at the time of prev_full.

	Defaults write to backend/astronomy/map/daytype_heatmap.png when run from this module.
	"""
	if out_path is None:
		out_path = os.path.join(os.path.dirname(__file__), 'daytype_heatmap.png')
	if prev_full is None:
		prev_full, _ = find_prev_next_full_moon(datetime.now(timezone.utc))

	sub_lat, sub_lon = get_subsolar(prev_full)
	# try to get sublunar point; if astro-service fails, continue without moon marker
	moon_lat = moon_lon = None
	try:
		moon_lat, moon_lon = get_sublunar(prev_full)
	except Exception:
		moon_lat = moon_lon = None

	# prepare projection/scaling
	# prepare projection/scaling
	R = 1.0
	rho_max = math.pi * R
	half = size_px / 2.0
	margin_ratio = 0.05
	scale = (half * (1 - margin_ratio)) / rho_max
	cx = cy = half

	def proj(lat, lon):
		x_rel, y_rel = _azimuthal_eq_coords(lat, lon, center_lon_deg=0, R=R)
		return int(round(cx + x_rel * scale)), int(round(cy + y_rel * scale))

	def draw_boundary(sub_lat, sub_lon, color=(255, 255, 0), width=2):
		if abs(math.sin(math.radians(sub_lat))) > 0.01:
			cos_c = -math.sin(math.radians(18)) / math.sin(math.radians(sub_lat))
			if -1 <= cos_c <= 1:
				c_rad = math.acos(cos_c)
				boundary_points = []
				num_points = 90
				for i in range(num_points + 1):
					angle_from_subsolar = i * 2
					angle_rad = math.radians(angle_from_subsolar)
					lat_rad = math.asin(
						math.sin(math.radians(sub_lat)) * math.cos(c_rad) +
						math.cos(math.radians(sub_lat)) * math.sin(c_rad) * math.cos(angle_rad)
					)
					lon_diff_rad = math.atan2(
						math.sin(c_rad) * math.sin(angle_rad),
						math.cos(math.radians(sub_lat)) * math.cos(c_rad) -
						math.sin(math.radians(sub_lat)) * math.sin(c_rad) * math.cos(angle_rad)
					)
					lat_boundary = math.degrees(lat_rad)
					lon_boundary = sub_lon + math.degrees(lon_diff_rad)
					lon_boundary = (lon_boundary + 180) % 360 - 180
					x, y = proj(lat_boundary, lon_boundary)
					boundary_points.append((x, y))
				draw.line(boundary_points, fill=color, width=width)

	# colors (match daytype_heatmap style)
	CMAP = {
		'day': (255, 236, 153),
		'civil': (255, 208, 138),
		'nautical': (193, 218, 251),
		'astronomical': (155, 176, 232),
		'night': (15, 35, 63),
	}

	# load base map if available (map.png in same dir), else white background
	try:
		base_path = os.path.join(os.path.dirname(__file__), 'map.png')
		if os.path.exists(base_path):
			base_img = Image.open(base_path).convert('RGBA').resize((size_px, size_px))
		else:
			base_img = Image.new('RGBA', (size_px, size_px), (255,255,255,255))
	except Exception:
		base_img = Image.new('RGBA', (size_px, size_px), (255,255,255,255))

	# overlay image for semi-transparent tiles
	overlay = Image.new('RGBA', (size_px, size_px), (255,255,255,0))
	overlay_draw = ImageDraw.Draw(overlay)

	# grid definitions (iterate lat descending for nicer drawing)
	lats = [85 - i*lat_step for i in range(int((85 - (-85))/lat_step) + 1)]
	lons = [(-180) + i*lon_step for i in range(int((360)/lon_step))]

	# pixel marker size
	base_px = max(1, int(size_px * 0.002))
	half_px = base_px // 2

	# progress/logging
	processed = 0
	total_cells = len(lats) * len(lons)
	last_report = time.time()
	start_all = time.time()
	if tqdm:
		pbar = tqdm(total=total_cells)
	else:
		pbar = None

	log_path = os.path.join(os.path.dirname(__file__), 'daytype_heatmap.log')
	f_log = open(log_path, 'a', encoding='utf-8')

	min_night_r_px = float('inf')
	# track the maximal radius (in pixels) of any astronomical-twilight cell
	max_astro_r_px = 0.0
	nearest_night_x = None
	nearest_night_y = None

	for lat in lats:
		lat_start = time.time()
		counts = {'day': 0, 'civil': 0, 'nautical': 0, 'astronomical': 0, 'night': 0}
		processed_lat = 0
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
			# distance from center (pole) in pixels
			dx = x - cx
			dy = y - cy
			r_px = math.hypot(dx, dy)
			x0 = x - half_px
			y0 = y - half_px
			x1 = x + half_px
			y1 = y + half_px
			if x1 < 0 or y1 < 0 or x0 >= size_px or y0 >= size_px:
				# still count as processed for progress
				if pbar:
					pbar.update(1)
				else:
					processed += 1
				processed_lat += 1
				continue
			# For 'night' leave tiles transparent (no shading). For all other
			# day/twilight classes draw at 50% opacity.
			if cls == 'night':
				counts[cls] += 1
				# update minimal radius to nearest night pixel encountered
				if r_px < min_night_r_px:
					min_night_r_px = r_px
					nearest_night_x = x
					nearest_night_y = y
				# Leave night tiles transparent (no shading)
			elif cls == 'astronomical':
				# record outermost astronomical tile radius so the circle can include it
				if r_px > max_astro_r_px:
					max_astro_r_px = r_px
				# draw astronomical tile as usual
				if draw_tiles:
					alpha = int(255 * 0.50)
					r, g, b = CMAP[cls]
					overlay_draw.rectangle([x0, y0, x1, y1], fill=(r, g, b, alpha))
				counts[cls] += 1
			else:
				# use 50% opacity for other non-night classes
				if draw_tiles:
					alpha = int(255 * 0.50)
					r, g, b = CMAP[cls]
					overlay_draw.rectangle([x0, y0, x1, y1], fill=(r, g, b, alpha))
				counts[cls] += 1
			processed_lat += 1
			if pbar:
				pbar.update(1)
			else:
				processed += 1
				# occasional console progress
				if processed % 10000 == 0 or time.time() - last_report > 5:
					print(f"Rendered {processed}/{total_cells} cells...")
					last_report = time.time()

		lat_elapsed = time.time() - lat_start
		# write per-lat summary to log
		f_log.write(f"{lat},{processed_lat},{counts['day']},{counts['civil']},{counts['nautical']},{counts['astronomical']},{counts['night']},{lat_elapsed:.2f}\n")
		f_log.flush()

	total_elapsed = time.time() - start_all
	if pbar:
		pbar.close()
	f_log.write(f"# total_cells={total_cells} total_elapsed_s={total_elapsed:.2f}\n")
	f_log.close()

	# Composite overlay onto base image
	try:
		# ensure both are RGBA and same size
		base_img = base_img.convert('RGBA')
		overlay = overlay.convert('RGBA')
		combined = Image.alpha_composite(base_img, overlay)
	except Exception:
		# fallback: if something goes wrong just use overlay flattened on white
		combined = overlay.convert('RGBA')

	# draw sun and moon icons (emoji when possible, otherwise fallback circles)
	try:
		draw = ImageDraw.Draw(combined)
		sx, sy = proj(sub_lat, sub_lon)
		# try to load an emoji-capable font (macOS default path); fallback to default
		emoji_font = None
		try:
			emoji_path = '/System/Library/Fonts/Apple Color Emoji.ttc'
			if os.path.exists(emoji_path):
				emoji_font = ImageFont.truetype(emoji_path, int(size_px * 0.045))
			else:
				emoji_font = ImageFont.load_default()
		except Exception:
			emoji_font = ImageFont.load_default()

		sun_emoji = '☀️'
		moon_emoji = '🌕'
		# draw sun
		if emoji_font:
			try:
				w, h = draw.textsize(sun_emoji, font=emoji_font)
				draw.text((sx - w/2, sy - h/2), sun_emoji, font=emoji_font)
			except Exception:
				draw.ellipse([sx-8, sy-8, sx+8, sy+8], fill=(255,140,0), outline=(179,90,0))
		else:
			draw.ellipse([sx-8, sy-8, sx+8, sy+8], fill=(255,140,0), outline=(179,90,0))

		# draw moon if available
		if moon_lat is not None and moon_lon is not None:
			mx, my = proj(moon_lat, moon_lon)
			if emoji_font:
				try:
					w2, h2 = draw.textsize(moon_emoji, font=emoji_font)
					draw.text((mx - w2/2, my - h2/2), moon_emoji, font=emoji_font)
				except Exception:
					draw.ellipse([mx-6, my-6, mx+6, my+6], fill=(220,220,255), outline=(100,140,200))
			else:
				draw.ellipse([mx-6, my-6, mx+6, my+6], fill=(220,220,255), outline=(100,140,200))
	except Exception:
		# if anything goes wrong, ignore icon drawing
		pass

	try:
		font = ImageFont.load_default()
	except Exception:
		font = None

	# Plot reference cities to verify map alignment. Draw after compositing so
	# markers are always visible on top of the background/overlay.
	try:
		cities = [
			('Los Angeles', 34.0522, -118.2437, (220,20,60)),
			('New York City', 40.7128, -74.0060, (0,120,200)),
			('Seoul', 37.5665, 126.9780, (120,20,200)),
			('Perth', -31.9505, 115.8605, (20,160,80)),
			('Cairo', 30.0444, 31.2357, (200,140,20)),
			('Rio de Janeiro', -22.9068, -43.1729, (200,40,120)),
		]
		# Additional reference cities requested
		cities.extend([
			('Sydney', -33.8688, 151.2093, (255,100,50)),
			('London', 51.5074, -0.1278, (80,80,200)),
			('Cape Town', -33.9249, 18.4241, (120,200,120)),
			('Buenos Aires', -34.6037, -58.3816, (200,80,120)),
			('Moscow', 55.7558, 37.6173, (160,100,220)),
			('Singapore', 1.3521, 103.8198, (255,200,0)),
			('Auckland', -36.8485, 174.7633, (100,200,240)),
			# Additional north-american markers
			('Boston', 42.3601, -71.0589, (30,144,255)),
			('Montreal', 45.5017, -73.5673, (25,130,200)),
		])
		for label, lat_c, lon_c, col in cities:
			try:
				cxp, cyp = proj(lat_c, lon_c)
				draw.ellipse([cxp-6, cyp-6, cxp+6, cyp+6], fill=col, outline=(0,0,0))
				try:
					tw, th = draw.textsize(label, font=font)
				except Exception:
					tw, th = (len(label)*6, 10)
				# place label to the right of marker, adjust if near edge
				lx = cxp + 8
				ly = cyp - th/2
				if lx + tw > size_px - 10:
					lx = cxp - 8 - tw
				draw.text((lx, ly), label, fill=(0,0,0), font=font)
			except Exception:
				# continue drawing other cities even if one fails
				continue
	except Exception:
		pass

	legend_x = int(size_px - 220)
	legend_y = 20
	items = [('day','Day'),('civil','Civil Twilight'),('nautical','Nautical Twilight'),('astronomical','Astronomical Twilight'),('night','Night')]
	# draw legend and footer text on the combined image
	try:
		# Draw 15° longitude tick marks around the outer edge so the background
	# `map.png` alignment can be verified. Longitude 0 is drawn straight
	# down from the center (matches map.png convention).
		try:
			tick_deg = 15
			tick_len = max(8, int(size_px * 0.01))
			# radius in pixels for the outermost circle (south pole)
			r_px = rho_max * scale
			for lon_tick in range(-180, 180, tick_deg):
				# with the projection using (lon - center), use lon_tick directly
				dl = math.radians(lon_tick)
				# tip of tick at outer radius
				x_tip = cx + r_px * math.sin(dl)
				y_tip = cy + r_px * math.cos(dl)
				# inner end of tick slightly inset
				x_in = cx + (r_px - tick_len) * math.sin(dl)
				y_in = cy + (r_px - tick_len) * math.cos(dl)
				draw.line([(x_in, y_in), (x_tip, y_tip)], fill=(0, 0, 0), width=2)
				# label placed slightly inside the tick
				label_offset = tick_len + 12
				lx = cx + (r_px - label_offset) * math.sin(dl)
				ly = cy + (r_px - label_offset) * math.cos(dl)
				# format label with E/W, 0° and 180° simple
				if lon_tick == 0:
					label = '0°'
				elif abs(lon_tick) == 180:
					label = '180°'
				else:
					label = f"{abs(lon_tick)}°{'E' if lon_tick>0 else 'W'}"
				# center the text roughly
				try:
					w, h = draw.textsize(label, font=font)
				except Exception:
					w = len(label) * 6
					h = 10
				draw.text((lx - w/2, ly - h/2), label, fill=(0,0,0), font=font)
		except Exception:
			# non-fatal: if ticks fail, continue
			pass
		for i, (k, label) in enumerate(items):
			yy = legend_y + i*20
			r, g, b = CMAP[k]
			draw.rectangle([legend_x, yy, legend_x+18, yy+12], fill=(r, g, b, 255), outline=(50,50,50))
			draw.text((legend_x+22, yy), label, fill=(0,0,0), font=font)

		draw.text((12, size_px-28), f'Day/twilight map at full-moon time {prev_full.isoformat()}', fill=(0,0,0), font=font)
	except Exception:
		pass



	# Draw a red circle from the North Pole to include both the nearest night area
	# and the edge of astronomical twilight (whichever extends farther).
	try:
		# determine radius: smallest radius required to touch a night pixel
		radius_px = None
		if min_night_r_px != float('inf'):
			radius_px = min_night_r_px
		if radius_px is not None and radius_px > 0:
			alpha = int(255 * 0.50)
			bbox = [cx - radius_px, cy - radius_px, cx + radius_px, cy + radius_px]
			try:
				tmp = Image.new('RGBA', (size_px, size_px), (255, 255, 255, 0))
				td = ImageDraw.Draw(tmp)
				td.ellipse(bbox, fill=(220, 20, 20, alpha))
				# draw a slightly darker outline for contrast (thinned)
				stroke_w = max(1, int(size_px * 0.001))
				td.ellipse(bbox, outline=(140, 10, 10, 255), width=stroke_w)
				# composite the semi-transparent filled circle over the combined image
				combined = Image.alpha_composite(combined, tmp)
				# redraw draw handle so further drawing targets the new combined image
				draw = ImageDraw.Draw(combined)
			except Exception:
				# fallback: draw a stroked circle if alpha compositing fails
				stroke_w = max(2, int(size_px * 0.003))
				draw.ellipse(bbox, outline=(220,20,20), width=stroke_w)
			# label the circle
			label = 'Nearest night boundary'
			try:
				w, h = draw.textsize(label, font=font)
			except Exception:
				w, h = (len(label)*6, 10)
			# place label just outside the circle on the right side
			lx = cx + radius_px + 8
			ly = cy - h/2
			if lx + w > size_px - 10:
				lx = cx + radius_px - w - 8
			# draw a white translucent background for readability
			draw.rectangle([lx-4, ly-2, lx + w + 4, ly + h + 2], fill=(255,255,255,220))
			draw.text((lx, ly), label, fill=(180,20,20), font=font)
	except Exception:
		# non-fatal: if drawing the circle fails, continue
		pass

	# Draw the boundary between night and astronomical twilight (semicircle from subsolar point westward)
	try:
		draw_boundary(sub_lat, sub_lon)
		for i, additional_time in enumerate(additional_prev_fulls):
			sub_lat_add, sub_lon_add = get_subsolar(additional_time)
			opacity = 0.3 ** (len(additional_prev_fulls) - i)
			color = (int(255 * opacity), int(255 * opacity), 0)
			draw_boundary(sub_lat_add, sub_lon_add, color=color)
	except Exception:
		# non-fatal: if boundary plotting fails, continue
		pass	# ensure directory exists; if out_path has no dirname, use current dir
	out_dir = os.path.dirname(out_path) or '.'
	os.makedirs(out_dir, exist_ok=True)
	# save as PNG; ensure combined is RGBA and saved properly
	try:
		combined.save(out_path)
	except Exception:
		# fallback: convert to RGB and save
		combined.convert('RGB').save(out_path)
	return out_path

# --- end heatmap generator ---


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
	if find_prev_next_full_moon:
		prev_full, _ = find_prev_next_full_moon(now_utc)
	else:
		print("find_prev_next_full_moon is None")
		prev_full = None

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

	# Also generate the daytype heatmap PNG (merged generator)
	print('Generating daytype heatmap PNG...')
	heat_out = generate_heatmap(prev_full=prev_full, out_path=os.path.join(os.path.dirname(__file__), 'daytype_heatmap.png'))
	print(f'Wrote heatmap to: {heat_out}')
	# The daytype heatmap is the preferred visualization now; skip writing
	# per-latitude chosen-point SVGs and overlays to reduce artifact clutter.

