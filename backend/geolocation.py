# Geolocation utilities
import re

from timezonefinder import TimezoneFinder
import pytz


def parse_coordinates(input_str):
    # Decimal degrees (e.g., "40.7128, -74.0060")
    dd_match = re.match(r'^\s*([+-]?\d+\.\d+),\s*([+-]?\d+\.\d+)\s*$', input_str)
    if dd_match:
        lat, lon = float(dd_match[1]), float(dd_match[2])
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            print(f"Parsed decimal degrees: {lat}, {lon}")
            return lat, lon
    # DMS (e.g., "40°42'46.08\"N, 74°0'21.6\"W")
    dms_match = re.match(
        r'(\d+)°(\d+)\'([\d.]+)"([NS]),\s*(\d+)°(\d+)\'([\d.]+)"([EW])', input_str)
    if dms_match:
        lat = int(dms_match[1]) + int(dms_match[2])/60 + float(dms_match[3])/3600
        lon = int(dms_match[5]) + int(dms_match[6])/60 + float(dms_match[7])/3600
        if dms_match[4] == 'S': lat = -lat
        if dms_match[8] == 'W': lon = -lon
        print(f"Parsed DMS: {lat}, {lon}")
        return lat, lon
    print("Invalid coordinates")
    return None

tf = TimezoneFinder()
def get_timezone(lat, lon):
    tz_name = tf.timezone_at(lat=lat, lng=lon)
    if tz_name:
        tz = pytz.timezone(tz_name)
        print(f"Timezone for {lat}, {lon}: {tz_name}")
        return tz
    print("No timezone found")
    return pytz.UTC