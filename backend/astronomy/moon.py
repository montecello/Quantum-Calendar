
# Moon calculations: full moon, dawn-after, and month length logic
from datetime import datetime, timedelta
import pytz
from backend.data import full_moon_times, load_full_moon_times
from backend.astronomy.sun import get_event_with_fallback

def find_prev_next_full_moon(now_utc):
    """Return previous and next full moon datetimes (UTC) from full_moon_times DataFrame."""
    global full_moon_times
    if full_moon_times is None:
        full_moon_times = load_full_moon_times()
    times = full_moon_times['Full Moon Time (UTC)'].apply(lambda s: pytz.UTC.localize(datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')))
    prev = times[times <= now_utc].max()
    nxt = times[times > now_utc].min()
    return prev, nxt

def find_first_dawn_after(dt_utc, lat, lon, tzname):
    """Return first dawn (or fallback) after dt_utc, in local time and tag."""
    # Start searching from the next day if dt_utc is after dawn for that day
    local_tz = pytz.timezone(tzname)
    dt_local = dt_utc.astimezone(local_tz)
    search_date = dt_local.date()
    # If dt_local is after dawn for that day, start from next day
    for i in range(0, 10):  # search up to 10 days ahead (should always find one)
        candidate_date = search_date + timedelta(days=i)
        dawn, tag = get_event_with_fallback('dawn', lat, lon, tzname, candidate_date)
        if dawn:
            if dawn > dt_local:
                return dawn, tag
    return None, 'not_found'

def count_dawn_cycles(start_dawn, end_dawn, lat, lon, tzname):
    """Count number of dawn-to-dawn cycles between two dawn datetimes (inclusive of start, exclusive of end)."""
    dawns = [start_dawn]
    current = start_dawn
    while True:
        next_date = (current + timedelta(days=1)).date()
        next_dawn, _ = get_event_with_fallback('dawn', lat, lon, tzname, next_date)
        if not next_dawn or next_dawn > end_dawn:
            break
        dawns.append(next_dawn)
        current = next_dawn
    # If the last dawn is before end_dawn, add end_dawn as the final dawn
    if dawns[-1] < end_dawn:
        dawns.append(end_dawn)
    return len(dawns) - 1

def print_today_moon_events(lat, lon, tzname, location_name=None):
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    local_tz = pytz.timezone(tzname)
    location_str = location_name or f"lat={lat}, lon={lon}, tz={tzname}"
    print(f"\n--- Moon Events for Today ({location_str}) ---")
    prev_full, next_full = find_prev_next_full_moon(now_utc)
    # Convert to local time
    prev_full_local = prev_full.astimezone(local_tz)
    next_full_local = next_full.astimezone(local_tz)
    print(f"Previous Full Moon: {prev_full_local.strftime('%Y-%m-%d %H:%M:%S')}")
    dawn_after_prev, tag_prev = find_first_dawn_after(prev_full, lat, lon, tzname)
    if dawn_after_prev:
        print(f"Dawn After Previous Full Moon: {dawn_after_prev.strftime('%Y-%m-%d %H:%M:%S')}" + (f" (secondary: {tag_prev})" if tag_prev != 'astronomical' else ""))
    else:
        print("Dawn After Previous Full Moon: --:-- (not found)")
    print(f"Following Full Moon: {next_full_local.strftime('%Y-%m-%d %H:%M:%S')}")
    dawn_after_next, tag_next = find_first_dawn_after(next_full, lat, lon, tzname)
    if dawn_after_next:
        print(f"Dawn After Following Full Moon: {dawn_after_next.strftime('%Y-%m-%d %H:%M:%S')}" + (f" (secondary: {tag_next})" if tag_next != 'astronomical' else ""))
    else:
        print("Dawn After Following Full Moon: --:-- (not found)")
    # Count dawn-dawn cycles between dawn_after_prev and dawn_after_next
    if dawn_after_prev and dawn_after_next:
        days_in_month = count_dawn_cycles(dawn_after_prev, dawn_after_next, lat, lon, tzname)
        print(f"Days in this Month: {days_in_month}")
        # Calculate current day in this month
        # Find all dawns in this month
        dawns = [dawn_after_prev]
        current = dawn_after_prev
        now_local = datetime.now(local_tz)
        while True:
            next_date = (current + timedelta(days=1)).date()
            next_dawn, _ = get_event_with_fallback('dawn', lat, lon, tzname, next_date)
            if not next_dawn or next_dawn > dawn_after_next:
                break
            dawns.append(next_dawn)
            current = next_dawn
        # If the last dawn is before end, add end dawn
        if dawns[-1] < dawn_after_next:
            dawns.append(dawn_after_next)
        # Find which interval now_local is in
        current_day = None
        for i in range(len(dawns)-1):
            if dawns[i] <= now_local < dawns[i+1]:
                current_day = i+1
                break
        if current_day is None:
            # If now_local is before first dawn, set to 1; if after last, set to last
            if now_local < dawns[0]:
                current_day = 1
            else:
                current_day = days_in_month
        print(f"Current Day in this Month: {current_day}")
    else:
        print("Days in this Month: --")
    print("--- End Moon Events ---\n")
