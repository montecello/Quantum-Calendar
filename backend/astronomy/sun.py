import os
from skyfield.api import load
from skyfield import almanac

# Returns both plain text and JSON for sun events and moon illumination
def get_sun_events_for_date(lat, lon, timezone, date_, location_name=None):
    dawn_time, dawn_tag = get_event_with_fallback('dawn', lat, lon, timezone, date_)
    sunrise_time = get_sunrise(lat, lon, timezone, date_)
    sunset_time = get_sunset(lat, lon, timezone, date_)
    dusk_time, dusk_tag = get_event_with_fallback('dusk', lat, lon, timezone, date_)

    def fmt(t):
        return t.strftime('%H:%M') if t else '--:--'

    # Prepare plain text output (frontend-friendly)
    lines = []
    display_location = location_name if location_name else 'Greenwich, England'
    lines.append(f"Location: {display_location}")
    # Dawn
    if dawn_tag == 'astronomical':
        lines.append(f"Dawn: {fmt(dawn_time)}")
    elif dawn_tag in ('nautical', 'civil', 'sunrise'):
        lines.append(f"Dawn: {fmt(dawn_time)} (secondary: {dawn_tag})")
    elif dawn_tag == 'migrated':
        lines.append(f"Dawn: {fmt(dawn_time)} (secondary: migrated)")
    else:
        lines.append("Dawn: --:-- (not found)")
    # Sunrise/Sunset
    lines.append(f"Sunrise: {fmt(sunrise_time)}")
    lines.append(f"Sunset: {fmt(sunset_time)}")
    # Dusk
    if dusk_tag == 'astronomical':
        lines.append(f"Dusk: {fmt(dusk_time)}")
    elif dusk_tag in ('nautical', 'civil', 'sunset'):
        lines.append(f"Dusk: {fmt(dusk_time)} (secondary: {dusk_tag})")
    elif dusk_tag == 'migrated':
        lines.append(f"Dusk: {fmt(dusk_time)} (secondary: migrated)")
    else:
        lines.append("Dusk: --:-- (not found)")

    # Moon illumination at dawn and next dawn using Skyfield
    try:
        bsp_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../de421.bsp'))
        eph = load(bsp_path)
        ts = load.timescale()
        dawn_utc = dawn_time.astimezone(pytz.UTC) if dawn_time else None
        tomorrow = date_ + timedelta(days=1)
        dawn_time2, _ = get_event_with_fallback('dawn', lat, lon, timezone, tomorrow)
        dawn2_utc = dawn_time2.astimezone(pytz.UTC) if dawn_time2 else None
        illum1 = illum2 = None
        if dawn_utc:
            illum1 = almanac.fraction_illuminated(eph, 'moon', ts.from_datetime(dawn_utc)) * 100
        if dawn2_utc:
            illum2 = almanac.fraction_illuminated(eph, 'moon', ts.from_datetime(dawn2_utc)) * 100
        if illum1 is not None and illum2 is not None:
            lines.append(f"Moon %: {illum1:.2f}% -> {illum2:.2f}%")
        else:
            lines.append("Moon %: --")
    except Exception as e:
        lines.append(f"Moon %: -- (error: {e})")

    plain_text = "\n".join(lines)

    # Prepare JSON output
    json_dict = {
        "date": str(date_),
        "location": display_location,
        "lat": lat,
        "lon": lon,
        "tz": timezone,
        "dawn": {"time": fmt(dawn_time), "type": dawn_tag},
        "sunrise": fmt(sunrise_time),
        "sunset": fmt(sunset_time),
        "dusk": {"time": fmt(dusk_time), "type": dusk_tag},
        "moon_percent": {
            "today_dawn": round(illum1, 2) if illum1 is not None else None,
            "tomorrow_dawn": round(illum2, 2) if illum2 is not None else None
        }
    }

    return plain_text, json_dict

# Sun calculations with fallback logic for extreme latitudes
from astral import LocationInfo
from astral.sun import dawn, sunrise, sunset, dusk
from datetime import datetime, date, timedelta
import pytz

def get_event_with_fallback(event_type, lat, lon, timezone, date_):
    """
    Try to get astronomical, nautical, civil, and sunrise/sunset for dawn/dusk events.
    Returns: (event_time, tag) where tag is 'astronomical', 'nautical', 'civil', 'sunrise'/'sunset', or 'migrated'.
    """
    location = LocationInfo("Custom", "Custom", timezone, lat, lon)
    tags = []
    # For dawn: try astro -> nautical -> civil -> sunrise
    # For dusk: try astro -> nautical -> civil -> sunset
    if event_type == 'dawn':
        try:
            t = dawn(location.observer, date=date_, tzinfo=timezone, depression=18)
            return t, 'astronomical'
        except Exception:
            pass
        try:
            t = dawn(location.observer, date=date_, tzinfo=timezone, depression=12)
            return t, 'nautical'
        except Exception:
            pass
        try:
            t = dawn(location.observer, date=date_, tzinfo=timezone, depression=6)
            return t, 'civil'
        except Exception:
            pass
        try:
            t = sunrise(location.observer, date=date_, tzinfo=timezone)
            return t, 'sunrise'
        except Exception:
            pass
        # Migrate latitude toward equator and try again
        migrated_lat = lat
        while abs(migrated_lat) > 0:
            migrated_lat = migrated_lat - 1 if migrated_lat > 0 else migrated_lat + 1
            location = LocationInfo("Custom", "Custom", timezone, migrated_lat, lon)
            try:
                t = dawn(location.observer, date=date_, tzinfo=timezone, depression=18)
                return t, 'migrated'
            except Exception:
                continue
        return None, 'not_found'
    elif event_type == 'dusk':
        try:
            t = dusk(location.observer, date=date_, tzinfo=timezone, depression=18)
            return t, 'astronomical'
        except Exception:
            pass
        try:
            t = dusk(location.observer, date=date_, tzinfo=timezone, depression=12)
            return t, 'nautical'
        except Exception:
            pass
        try:
            t = dusk(location.observer, date=date_, tzinfo=timezone, depression=6)
            return t, 'civil'
        except Exception:
            pass
        try:
            t = sunset(location.observer, date=date_, tzinfo=timezone)
            return t, 'sunset'
        except Exception:
            pass
        # Migrate latitude toward equator and try again
        migrated_lat = lat
        while abs(migrated_lat) > 0:
            migrated_lat = migrated_lat - 1 if migrated_lat > 0 else migrated_lat + 1
            location = LocationInfo("Custom", "Custom", timezone, migrated_lat, lon)
            try:
                t = dusk(location.observer, date=date_, tzinfo=timezone, depression=18)
                return t, 'migrated'
            except Exception:
                continue
        return None, 'not_found'
    else:
        raise ValueError('event_type must be "dawn" or "dusk"')

def get_sunrise(lat, lon, timezone, date_):
    location = LocationInfo("Custom", "Custom", timezone, lat, lon)
    try:
        t = sunrise(location.observer, date=date_, tzinfo=timezone)
        return t
    except Exception:
        return None

def get_sunset(lat, lon, timezone, date_):
    location = LocationInfo("Custom", "Custom", timezone, lat, lon)
    try:
        t = sunset(location.observer, date=date_, tzinfo=timezone)
        return t
    except Exception:
        return None

def print_today_sun_events(lat, lon, timezone):
    today = datetime.now(pytz.timezone(timezone)).date()
    print(f"{today}")
    dawn_time, dawn_tag = get_event_with_fallback('dawn', lat, lon, timezone, today)
    sunrise_time = get_sunrise(lat, lon, timezone, today)
    sunset_time = get_sunset(lat, lon, timezone, today)
    dusk_time, dusk_tag = get_event_with_fallback('dusk', lat, lon, timezone, today)

    def fmt(t):
        return t.strftime('%H:%M') if t else '--:--'

    # Print Dawn
    if dawn_tag == 'astronomical':
        print(f"Dawn: {fmt(dawn_time)}")
    elif dawn_tag in ('nautical', 'civil', 'sunrise'):
        print(f"Dawn: {fmt(dawn_time)} (secondary: {dawn_tag})")
    elif dawn_tag == 'migrated':
        print(f"Dawn: {fmt(dawn_time)} (secondary: migrated)")
    else:
        print("Dawn: --:-- (not found)")

    print(f"Sunrise: {fmt(sunrise_time)}")
    print(f"Sunset: {fmt(sunset_time)}")

    # Print Dusk
    if dusk_tag == 'astronomical':
        print(f"Dusk: {fmt(dusk_time)}")
    elif dusk_tag in ('nautical', 'civil', 'sunset'):
        print(f"Dusk: {fmt(dusk_time)} (secondary: {dusk_tag})")
    elif dusk_tag == 'migrated':
        print(f"Dusk: {fmt(dusk_time)} (secondary: migrated)")
    else:
        print("Dusk: --:-- (not found)")

    # Moon illumination at dawn and next dawn using Skyfield's built-in illumination
    try:
        import os
        from skyfield.api import load
        from skyfield import almanac
        bsp_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../de421.bsp'))
        eph = load(bsp_path)
        ts = load.timescale()
        # Get dawn time for today and tomorrow (in UTC)
        dawn_utc = dawn_time.astimezone(pytz.UTC) if dawn_time else None
        tomorrow = today + timedelta(days=1)
        dawn_time2, _ = get_event_with_fallback('dawn', lat, lon, timezone, tomorrow)
        dawn2_utc = dawn_time2.astimezone(pytz.UTC) if dawn_time2 else None
        illum1 = None
        illum2 = None
        if dawn_utc:
            illum1 = almanac.fraction_illuminated(eph, 'moon', ts.from_datetime(dawn_utc)) * 100
        if dawn2_utc:
            illum2 = almanac.fraction_illuminated(eph, 'moon', ts.from_datetime(dawn2_utc)) * 100
        if illum1 is not None and illum2 is not None:
            print(f"Moon %: {illum1:.2f}% -> {illum2:.2f}%")
        else:
            print("Moon %: --")
    except Exception as e:
        print(f"Moon %: -- (error: {e})")
