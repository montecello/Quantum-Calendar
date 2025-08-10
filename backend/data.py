
# Data handling module for astronomical CSVs
import os
import pandas as pd

# Paths
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

FULL_MOON_CSV = os.path.join(DATA_DIR, 'full_moon_times.csv')
NEW_YEARS_CSV = os.path.join(DATA_DIR, 'new_years_day.csv')
SPICA_MOON_CSV = os.path.join(DATA_DIR, 'spica_moon_crossings.csv')
SUN_HAMAL_CSV = os.path.join(DATA_DIR, 'sun_hamal_crossings.csv')

# Module-level variables to hold data
full_moon_times = None
new_years_days = None
spica_moon_crossings = None
sun_hamal_crossings = None

def load_full_moon_times():
    global full_moon_times
    print(f"Loading: {FULL_MOON_CSV}")
    full_moon_times = pd.read_csv(FULL_MOON_CSV)
    print(f"Loaded {len(full_moon_times)} rows from full_moon_times.csv")
    return full_moon_times

def load_new_years_days():
    global new_years_days
    print(f"Loading: {NEW_YEARS_CSV}")
    new_years_days = pd.read_csv(NEW_YEARS_CSV)
    print(f"Loaded {len(new_years_days)} rows from new_years_day.csv")
    return new_years_days

def load_spica_moon_crossings():
    global spica_moon_crossings
    print(f"Loading: {SPICA_MOON_CSV}")
    spica_moon_crossings = pd.read_csv(SPICA_MOON_CSV)
    print(f"Loaded {len(spica_moon_crossings)} rows from spica_moon_crossings.csv")
    return spica_moon_crossings

def load_sun_hamal_crossings():
    global sun_hamal_crossings
    print(f"Loading: {SUN_HAMAL_CSV}")
    sun_hamal_crossings = pd.read_csv(SUN_HAMAL_CSV)
    print(f"Loaded {len(sun_hamal_crossings)} rows from sun_hamal_crossings.csv")
    return sun_hamal_crossings

def load_all_data():
    """Load all astronomical data CSVs into memory."""
    print("\n--- Loading astronomical data files ---")
    load_full_moon_times()
    load_new_years_days()
    load_spica_moon_crossings()
    load_sun_hamal_crossings()
    print("--- All data files loaded ---\n")
