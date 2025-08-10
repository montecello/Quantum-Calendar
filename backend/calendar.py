# Calendar grid generation logic for lunar months and years
from datetime import datetime
import pytz
from backend.astronomy.year import find_prev_next_new_year, get_full_moons_in_range
from backend.astronomy.moon import find_first_dawn_after, count_dawn_cycles

import logging

def generate_month_grid(days_in_month, month_label):
    """
    Generate a 6x7 grid for a lunar month.
    - days_in_month: 29 or 30
    - month_label: string for merged header cell
    Returns: dict with label and grid
    """
    try:
        grid = []
        # First row: merged cell for month label, then day 1 in last column
        row1 = [None] * 6 + [1]
        grid.append(row1)
        # Fill days 2–29 (and 30 if needed)
        day = 2
        for r in range(1, 5):
            row = []
            for c in range(7):
                if day <= days_in_month:
                    row.append(day)
                    day += 1
                else:
                    row.append(None)
            grid.append(row)
        # Last row: only day 30 if needed, in first cell
        if days_in_month == 30:
            grid.append([30] + [None]*6)
        else:
            grid.append([None]*7)
        logging.info(f"Generated grid for {month_label} with {days_in_month} days.")
        return {"label": month_label, "grid": grid}
    except Exception as e:
        logging.exception(f"Error generating grid for {month_label}: {e}")
        return {"label": month_label, "grid": []}

def get_calendar_for_year(lat, lon, tzname):
    """
    Generate calendar grid for the current year and location.
    Returns: dict with months: [ {label, grid}, ... ]
    """
    months = []
    try:
        now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
        logging.info(f"Calculating calendar for lat={lat}, lon={lon}, tz={tzname}, date={now_utc}")
        prev_anchor, next_anchor = find_prev_next_new_year(now_utc)
        logging.info(f"Year anchors: prev={prev_anchor}, next={next_anchor}")
        moons = get_full_moons_in_range(prev_anchor, next_anchor)
        logging.info(f"Found {len(moons)} full moons in range.")
        for i, moon in enumerate(moons):
            dawn = find_first_dawn_after(moon, lat, lon, tzname)[0]
            if dawn:
                logging.info(f"Month {i+1} dawn after full moon: {dawn}")
            else:
                logging.warning(f"Month {i+1} dawn not found after full moon: {moon}")
            # Next full moon (or anchor for last month)
            if i+1 < len(moons):
                next_moon = moons[i+1]
            else:
                next_moon = next_anchor
            next_dawn = find_first_dawn_after(next_moon, lat, lon, tzname)[0]
            if dawn and next_dawn:
                days = count_dawn_cycles(dawn, next_dawn, lat, lon, tzname)
                logging.info(f"Month {i+1} has {days} days.")
            else:
                days = 29  # fallback
                logging.warning(f"Month {i+1} fallback to 29 days.")
            # Month label: 1st, 2nd, 3rd, 4th, etc.
            if i == 0:
                label = "1st Month"
            elif i == 1:
                label = "2nd Month"
            elif i == 2:
                label = "3rd Month"
            else:
                label = f"{i+1}th Month"
            months.append(generate_month_grid(days, label))
        logging.info(f"Generated calendar with {len(months)} months.")
        return {"months": months}
    except Exception as e:
        logging.exception(f"Error generating calendar: {e}")
        return {"months": []}
