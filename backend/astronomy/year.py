
# Yearly anchor and month cycle logic
from datetime import datetime, timedelta
import pytz
from backend.data import new_years_days, full_moon_times, load_new_years_days, load_full_moon_times
from backend.astronomy.sun import get_event_with_fallback
from backend.astronomy.moon import count_dawn_cycles, find_first_dawn_after

def find_prev_next_new_year(now_utc):
    global new_years_days
    if new_years_days is None:
        new_years_days = load_new_years_days()
    times = new_years_days['Full Moon Time (UTC)'].apply(lambda s: pytz.UTC.localize(datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')))
    prev = times[times <= now_utc].max()
    nxt = times[times > now_utc].min()
    return prev, nxt

def get_full_moons_in_range(start, end):
    global full_moon_times
    if full_moon_times is None:
        full_moon_times = load_full_moon_times()
    times = full_moon_times['Full Moon Time (UTC)'].apply(lambda s: pytz.UTC.localize(datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')))
    moons = times[(times >= start) & (times < end)].tolist()
    return moons

def print_yearly_events(lat, lon, tzname, location_name=None):
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    local_tz = pytz.timezone(tzname)
    location_str = location_name or f"lat={lat}, lon={lon}, tz={tzname}"
    print(f"\n--- Yearly Events ({location_str}) ---")
    prev_anchor, next_anchor = find_prev_next_new_year(now_utc)
    prev_anchor_local = prev_anchor.astimezone(local_tz)
    next_anchor_local = next_anchor.astimezone(local_tz)
    print(f"1st Full Moon: {prev_anchor_local.strftime('%Y-%m-%d %H:%M:%S')}")
    dawn_after_prev, tag_prev = find_first_dawn_after(prev_anchor, lat, lon, tzname)
    if dawn_after_prev:
        print(f"Dawn After New Year Full Moon Indicator: {dawn_after_prev.strftime('%Y-%m-%d %H:%M:%S')}" + (f" (secondary: {tag_prev})" if tag_prev != 'astronomical' else ""))
    else:
        print("Dawn After New Year Full Moon Indicator: --:-- (not found)")
    print(f"Next 1st Full Moon: {next_anchor_local.strftime('%Y-%m-%d %H:%M:%S')}")
    dawn_after_next, tag_next = find_first_dawn_after(next_anchor, lat, lon, tzname)
    if dawn_after_next:
        print(f"Dawn After Following New Year Full Moon Indicator: {dawn_after_next.strftime('%Y-%m-%d %H:%M:%S')}" + (f" (secondary: {tag_next})" if tag_next != 'astronomical' else ""))
    else:
        print("Dawn After Following New Year Full Moon Indicator: --:-- (not found)")
    # Find all full moons in this year
    moons = get_full_moons_in_range(prev_anchor, next_anchor)
    print(f"Months in this year: {len(moons)}")
    # For each month, print dawn after full moon and days in month
    print("\nAll Dawns (including secondary indicators) that Immediately Follow a Full Moon event in this yearly cycle:")
    month_dawns = []
    for i, moon in enumerate(moons):
        dawn, tag = find_first_dawn_after(moon, lat, lon, tzname)
        # Find next full moon for this month (or anchor for last month)
        if i+1 < len(moons):
            next_moon = moons[i+1]
        else:
            next_moon = next_anchor
        next_dawn, _ = find_first_dawn_after(next_moon, lat, lon, tzname)
        # Days in this month
        if dawn and next_dawn:
            days = count_dawn_cycles(dawn, next_dawn, lat, lon, tzname)
        else:
            days = '--'
        tag_str = f" (secondary: {tag})" if tag != 'astronomical' else ""
        print(f"{i+1}st month begins: {dawn.strftime('%Y-%m-%d %H:%M:%S') if dawn else '--:--'}{tag_str} ({days} days)")
        month_dawns.append((dawn, next_dawn))
    # Find which month today is in
    now_local = datetime.now(local_tz)
    current_month = None
    for i, (start, end) in enumerate(month_dawns):
        if start and end and start <= now_local < end:
            current_month = i+1
            break
    if current_month is None:
        if now_local < month_dawns[0][0]:
            current_month = 1
        else:
            current_month = len(month_dawns)
    print(f"\nCurrent Month in this Year: {current_month}")
    print("--- End Year Events ---\n")
