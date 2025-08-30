# Geolocation utilities
import re

from timezonefinder import TimezoneFinder
import pytz


def parse_coordinates(input_str):
    """
    Parse latitude and longitude from various formats:
    - Decimal: "40.7128, -74.0060", "40.7128,-74.0060", "40.7128 -74.0060"
    - DMS: "40°42'46.08\"N, 74°0'21.6\"W", "40 42 46 N, 74 0 21 W", "40:42:46 N; 74:0:21 W"
    - Mixed: "40.7128 N, 74.0060 W", "40.7128 N 74.0060 W"
    - Separators: commas, spaces, semicolons, pipes
    - Cardinal directions: N/S/E/W (case-insensitive, can be separated by spaces)
    """
    if not input_str:
        return None
    
    # Split into parts using common separators, but be smarter about spaces
    # First, replace multiple spaces with single space
    input_str = re.sub(r'\s+', ' ', input_str.strip())
    
    # Split on commas, semicolons, or pipes, but keep spaces within coordinates
    parts = re.split(r'[;,|]', input_str)
    parts = [p.strip() for p in parts if p.strip()]
    
    if len(parts) < 2:
        # If no comma/semicolon/pipe separators, try space separation
        parts = input_str.split()
        if len(parts) >= 2:
            # For space-separated, group lat/lon parts
            if len(parts) == 4 and all(p.lower() in ['n', 's', 'e', 'w'] for p in [parts[1], parts[3]]):
                # Format: "40.7128 N 74.0060 W"
                parts = [f"{parts[0]} {parts[1]}", f"{parts[2]} {parts[3]}"]
            elif len(parts) == 2:
                # Format: "40.7128 -74.0060"
                parts = parts
            else:
                parts = []
    
    if len(parts) < 2:
        print("Invalid coordinates: not enough parts")
        return None
    
    lat_part = parts[0]
    lon_part = parts[1]
    
    # Helper to parse a single coordinate (lat or lon)
    def parse_single_coord(coord_str, is_lat=True):
        coord_str = coord_str.strip()
        
        # Check for cardinal direction (could be at end or separated by space)
        direction = None
        direction_match = re.search(r'\b([nsew])\b', coord_str, re.IGNORECASE)
        if direction_match:
            direction = direction_match[1].upper()
            coord_str = re.sub(r'\b[nsew]\b', '', coord_str, flags=re.IGNORECASE).strip()
        
        # Try decimal first
        try:
            value = float(coord_str)
            if is_lat and not (-90 <= value <= 90):
                raise ValueError("Latitude out of range")
            if not is_lat and not (-180 <= value <= 180):
                raise ValueError("Longitude out of range")
            # Apply direction
            if direction:
                if is_lat and direction == 'S':
                    value = -abs(value)
                elif not is_lat and direction == 'W':
                    value = -abs(value)
                elif (is_lat and direction in ('N', 'E')) or (not is_lat and direction in ('N', 'E')):
                    value = abs(value)
                else:
                    raise ValueError("Invalid direction for coordinate type")
            return value
        except ValueError:
            pass
        
        # Try DMS format: e.g., "40°42'46.08\"", "40 42 46", "40:42:46"
        dms_match = re.match(r'^(\d+)[°:\s](\d+)[\' :\s](\d+(?:\.\d+)?)"?$', coord_str)
        if dms_match:
            degrees = int(dms_match[1])
            minutes = int(dms_match[2])
            seconds = float(dms_match[3])
            
            if minutes >= 60 or seconds >= 60:
                raise ValueError("Invalid DMS values")
            
            value = degrees + minutes / 60 + seconds / 3600
            
            # Apply direction
            if direction:
                if is_lat and direction == 'S':
                    value = -value
                elif not is_lat and direction == 'W':
                    value = -value
                elif (is_lat and direction in ('N', 'E')) or (not is_lat and direction in ('N', 'E')):
                    value = abs(value)
                else:
                    raise ValueError("Invalid direction for coordinate type")
            
            if is_lat and not (-90 <= value <= 90):
                raise ValueError("Latitude out of range")
            if not is_lat and not (-180 <= value <= 180):
                raise ValueError("Longitude out of range")
            
            return value
        
        raise ValueError("Could not parse coordinate")
    
    try:
        lat = parse_single_coord(lat_part, is_lat=True)
        lon = parse_single_coord(lon_part, is_lat=False)
        print(f"Parsed coordinates: {lat}, {lon}")
        return lat, lon
    except ValueError as e:
        print(f"Error parsing coordinates: {e}")
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