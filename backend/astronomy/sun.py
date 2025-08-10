import os
import requests
import time
from config import ASTRO_API_BASE

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

    # Moon illumination at dawn and next dawn via astro-service (Skyfield offloaded)
    illum1 = illum2 = None
    try:
        dawn_utc = dawn_time.astimezone(pytz.UTC) if dawn_time else None
        tomorrow = date_ + timedelta(days=1)
        dawn_time2, _ = get_event_with_fallback('dawn', lat, lon, timezone, tomorrow)
        dawn2_utc = dawn_time2.astimezone(pytz.UTC) if dawn_time2 else None
        iso_list = []
        if dawn_utc:
            iso_list.append(dawn_utc.isoformat().replace('+00:00', 'Z'))
        if dawn2_utc:
            iso_list.append(dawn2_utc.isoformat().replace('+00:00', 'Z'))
        if iso_list:
            params = [('iso', s) for s in iso_list]
            last_exc = None
            for attempt in range(3):
                try:
                    resp = requests.get(f"{ASTRO_API_BASE}/illumination/moon-batch", params=params, timeout=20)
                    resp.raise_for_status()
                    arr = resp.json()
                    break
                except Exception as e:
                    last_exc = e
                    if attempt < 2:
                        time.sleep(0.5 * (attempt + 1))
                    else:
                        raise
            # Map back in order
            if len(arr) >= 1:
                illum1 = float(arr[0]['percent'])
            if len(arr) >= 2:
                illum2 = float(arr[1]['percent'])
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

    # Moon illumination via astro-service
    try:
        dawn_utc = dawn_time.astimezone(pytz.UTC) if dawn_time else None
        tomorrow = today + timedelta(days=1)
        dawn_time2, _ = get_event_with_fallback('dawn', lat, lon, timezone, tomorrow)
        dawn2_utc = dawn_time2.astimezone(pytz.UTC) if dawn_time2 else None
        iso_list = []
        if dawn_utc:
            iso_list.append(dawn_utc.isoformat().replace('+00:00', 'Z'))
        if dawn2_utc:
            iso_list.append(dawn2_utc.isoformat().replace('+00:00', 'Z'))
        if iso_list:
            params = [('iso', s) for s in iso_list]
            last_exc = None
            for attempt in range(3):
                try:
                    resp = requests.get(f"{ASTRO_API_BASE}/illumination/moon-batch", params=params, timeout=20)
                    resp.raise_for_status()
                    arr = resp.json()
                    break
                except Exception as e:
                    last_exc = e
                    if attempt < 2:
                        time.sleep(0.5 * (attempt + 1))
                    else:
                        raise
            if len(arr) >= 1:
                illum1 = float(arr[0]['percent'])
            if len(arr) >= 2:
                illum2 = float(arr[1]['percent'])
            if illum1 is not None and illum2 is not None:
                print(f"Moon %: {illum1:.2f}% -> {illum2:.2f}%")
            else:
                print("Moon %: --")
        else:
            print("Moon %: --")
    except Exception as e:
        print(f"Moon %: -- (error: {e})")
