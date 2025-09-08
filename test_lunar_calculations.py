#!/usr/bin/env python3
"""
Test script to verify lunar month calculations for different locations
"""

import sys
import os
from datetime import datetime, timezone
import pytz

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from backend.astronomy.map.generate_lunar_heatmaps import get_days_in_current_month, get_local_timezone
from backend.astronomy.moon import find_prev_next_full_moon, find_first_dawn_after, count_dawn_cycles
from backend.astronomy.sun import get_event_with_fallback

def test_location(lat, lon, location_name):
    """Test lunar month calculation for a specific location"""
    print(f"\n=== Testing {location_name} (lat={lat}, lon={lon}) ===")

    # Get timezone for this location
    tz = get_local_timezone(lat, lon)
    print(f"Timezone: {tz.zone}")

    # Get current time
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(tz)
    print(f"Current time: {now_local.strftime('%Y-%m-%d %H:%M:%S %Z')}")

    # Find full moons
    prev_full_utc, next_full_utc = find_prev_next_full_moon(now_utc)
    if prev_full_utc and next_full_utc:
        prev_full_local = prev_full_utc.astimezone(tz)
        next_full_local = next_full_utc.astimezone(tz)
        print(f"Previous Full Moon: {prev_full_local.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Next Full Moon: {next_full_local.strftime('%Y-%m-%d %H:%M:%S')}")

        # Find dawn after each full moon
        dawn_after_prev, tag_prev = find_first_dawn_after(prev_full_utc, lat, lon, tz.zone)
        dawn_after_next, tag_next = find_first_dawn_after(next_full_utc, lat, lon, tz.zone)

        if dawn_after_prev:
            print(f"Dawn after previous full moon: {dawn_after_prev.strftime('%Y-%m-%d %H:%M:%S')} ({tag_prev})")
        else:
            print("Dawn after previous full moon: NOT FOUND")

        if dawn_after_next:
            print(f"Dawn after next full moon: {dawn_after_next.strftime('%Y-%m-%d %H:%M:%S')} ({tag_next})")
        else:
            print("Dawn after next full moon: NOT FOUND")

        # Count days
        if dawn_after_prev and dawn_after_next:
            days = count_dawn_cycles(dawn_after_prev, dawn_after_next, lat, lon, tz.zone)
            print(f"Days in lunar month: {days}")

            # Test the main function
            result = get_days_in_current_month(lat, lon, tz.zone)
            print(f"get_days_in_current_month result: {result}")
        else:
            print("Cannot count days - missing dawn times")
    else:
        print("Cannot find full moon data")

def test_dawn_calculation(lat, lon, location_name):
    """Test dawn calculation for a specific location"""
    print(f"\n--- Dawn Calculation Test for {location_name} ---")

    tz = get_local_timezone(lat, lon)
    today = datetime.now(tz).date()

    print(f"Location: {location_name} (lat={lat}, lon={lon})")
    print(f"Timezone: {tz.zone}")
    print(f"Date: {today}")

    dawn_time, dawn_tag = get_event_with_fallback('dawn', lat, lon, tz.zone, today)

    if dawn_time:
        print(f"Dawn: {dawn_time.strftime('%H:%M:%S')} ({dawn_tag})")
    else:
        print("Dawn: NOT FOUND")

    # Test tomorrow too
    tomorrow = today.replace(day=today.day + 1)
    dawn_time2, dawn_tag2 = get_event_with_fallback('dawn', lat, lon, tz.zone, tomorrow)

    if dawn_time2:
        print(f"Dawn tomorrow: {dawn_time2.strftime('%H:%M:%S')} ({dawn_tag2})")
    else:
        print("Dawn tomorrow: NOT FOUND")

if __name__ == '__main__':
    print("Testing Lunar Month Calculations")
    print("=" * 50)

    # Test various locations
    test_locations = [
        (51.48, 0.0, "Greenwich, UK"),  # Current default
        (40.7128, -74.0060, "New York City"),
        (34.0522, -118.2437, "Los Angeles"),
        (-33.8688, 151.2093, "Sydney"),
        (35.6762, 139.6503, "Tokyo"),
        (55.7558, 37.6173, "Moscow"),
        (64.1466, -21.9426, "Reykjavik"),  # High latitude
        (-77.0428, 39.9042, "McMurdo Station"),  # Very high latitude
    ]

    for lat, lon, name in test_locations:
        test_location(lat, lon, name)
        test_dawn_calculation(lat, lon, name)

    print("\n" + "=" * 50)
    print("Testing complete!")
