from xml.etree import ElementTree as ET
import math
import os

MAP = os.path.join(os.path.dirname(__file__), 'dawn_map.svg')
CHOSEN = os.path.join(os.path.dirname(__file__), 'debug_frames', 'chosen_points_compact.csv')
OUT = os.path.join(os.path.dirname(__file__), 'overlay_dawn_map.svg')

# read map svg
if not os.path.exists(MAP):
    raise SystemExit('dawn_map.svg not found; generate it with generate_dawn_map_svg')

# parse svg
tree = ET.parse(MAP)
root = tree.getroot()
ns = {'svg':'http://www.w3.org/2000/svg'}

# Find viewBox or width/height to infer size
width = root.attrib.get('width')
height = root.attrib.get('height')
if width is None or height is None:
    vb = root.attrib.get('viewBox')
    if vb:
        _,_,width,height = vb.split()
width = float(width)
height = float(height)

# helper projection copied from map.py
def _azimuthal_eq_coords(lat_deg, lon_deg, center_lon_deg=0, R=1.0):
    phi = math.radians(lat_deg)
    delta_lambda = math.radians(center_lon_deg - lon_deg)
    c = (math.pi / 2.0) - phi
    rho = R * c
    x = rho * math.sin(delta_lambda)
    y = -rho * math.cos(delta_lambda)
    return x, y

# compute scale same as generate_dawn_map_svg
R = 1.0
rho_max = math.pi * R
half = width / 2.0
margin_ratio = 0.05
scale = (half * (1 - margin_ratio)) / rho_max
cx = cy = half

# prepare overlay group
g = ET.Element('g')
# green chosen points
with open(CHOSEN, 'r', encoding='utf-8') as f:
    hdr = f.readline()
    for line in f:
        parts = line.strip().split(',')
        if len(parts) < 7:
            continue
        frame, lat, lon, dawn_iso, dawn_tag, is_final, note = parts
        if is_final.strip() != 'True':
            continue
        lat_f = float(lat)
        lon_f = float(lon)
        x_rel, y_rel = _azimuthal_eq_coords(lat_f, lon_f, center_lon_deg=0, R=R)
        x = cx + x_rel * scale
        y = cy + y_rel * scale
        c = ET.Element('circle', {
            'cx': f'{x:.2f}', 'cy': f'{y:.2f}', 'r': '6', 'fill': '#3a3', 'stroke':'#060','stroke-width':'1'
        })
        title = ET.Element('title')
        title.text = f'lat={lat} lon={lon} dawn={dawn_iso} tag={dawn_tag}'
        c.append(title)
        g.append(c)

# append overlay group at end
root.append(g)

# write combined svg
ET.register_namespace('', 'http://www.w3.org/2000/svg')
with open(OUT, 'wb') as f:
    tree.write(f, encoding='utf-8', xml_declaration=True)

print('Wrote overlay to', OUT)
