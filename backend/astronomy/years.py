# Yearly anchor and month cycle logic
from datetime import datetime, timedelta
import pytz
from backend.data import load_new_years_days, load_full_moon_times
from backend.astronomy.moon import count_dawn_cycles, find_first_dawn_after

def get_multi_year_calendar_data(start_year, end_year, lat, lon, tzname):
    """
    Returns a list of years, each with:
      - 'year': year
      - 'months': list of dicts: {'start': datetime, 'days': int, 'dawn_tag': str, 'full_moon_utc': datetime}
    """
    new_years_days = load_new_years_days()
    full_moon_times = load_full_moon_times()
    anchors = new_years_days['Full Moon Time (UTC)'].apply(lambda s: pytz.UTC.localize(datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')))
    anchors = [dt for dt in anchors if start_year <= dt.year <= end_year+1]
    result = []
    for i, anchor in enumerate(anchors[:-1]):
        year = anchor.year
        next_anchor = anchors[i+1]
        # Get all full moons between anchor and next_anchor
        moons = full_moon_times['Full Moon Time (UTC)'].apply(lambda s: pytz.UTC.localize(datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')))
        moons = [m for m in moons if anchor <= m < next_anchor]
        months = []
        for j, moon in enumerate(moons):
            dawn, dawn_tag = find_first_dawn_after(moon, lat, lon, tzname)
            # Next dawn is after next full moon or after next anchor
            if j+1 < len(moons):
                next_dawn, _ = find_first_dawn_after(moons[j+1], lat, lon, tzname)
            else:
                next_dawn, _ = find_first_dawn_after(next_anchor, lat, lon, tzname)
            if dawn and next_dawn:
                days = count_dawn_cycles(dawn, next_dawn, lat, lon, tzname)
            else:
                days = None
            months.append({'start': dawn, 'days': days, 'dawn_tag': dawn_tag, 'full_moon_utc': moon})
        result.append({'year': year, 'months': months})
    return result

def print_multi_year_calendar(start_year, end_year, lat, lon, tzname):
    data = get_multi_year_calendar_data(start_year, end_year, lat, lon, tzname)
    from datetime import datetime
    import pytz
    now = datetime.now(pytz.UTC)
    current_year = now.year
    for year_data in data:
        year = year_data['year']
        next_short = str(year + 1)[-2:]
        # Determine if this is past, current, or future year
        if year < current_year:
            label = "Past Year"
        elif year == current_year:
            label = "Current Year"
        else:
            label = "Future Year"
        print(f"Year: {year}-{next_short} ({label})")
        for i, month in enumerate(year_data['months'], 1):
            start_str = month['start'].strftime('%Y-%m-%d %H:%M:%S') if month['start'] else 'N/A'
            print(f"  Month {i} begins: {start_str} ({month['dawn_tag']}) ({month['days']} days)")
        print()
