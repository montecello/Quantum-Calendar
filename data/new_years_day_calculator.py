import pandas as pd
from tqdm import tqdm

# Step 1: Read the CSV files, parsing datetime columns
df_crossings = pd.read_csv('spica_moon_crossings.csv', parse_dates=['Time (UTC)'])
df_full_moons = pd.read_csv('full_moon_times.csv', parse_dates=['Full Moon Time (UTC)'])
df_sun_hamal = pd.read_csv('sun_hamal_crossings.csv', parse_dates=['Time (UTC)'])

# Step 2: Extract year from full moon times for grouping
df_full_moons['Year'] = df_full_moons['Full Moon Time (UTC)'].dt.year

# Step 3: Initialize a list to store selected full moon times
selected_full_moons = []

# Step 4: Get unique years for processing
unique_years = df_full_moons['Year'].unique()

# Step 5: Process each unique year with tqdm progress bar
for year in tqdm(unique_years, desc="Processing years"):
    # Filter full moons, Spica crossings, and Sun-Hamal crossings for the current year
    full_moons = df_full_moons[df_full_moons['Year'] == year]['Full Moon Time (UTC)'].sort_values().tolist()
    crossings = df_crossings[df_crossings['Year'] == year]['Time (UTC)'].tolist()
    sun_hamal = df_sun_hamal[df_sun_hamal['Year'] == year]['Time (UTC)'].tolist()
    
    # Variables to track the full moon with the smallest time difference
    min_diff = None
    selected_fm = None
    
    # Step 6: For each full moon, find the closest preceding Spica crossing
    for fm in full_moons:
        # Get all Spica crossings before this full moon
        crossings_before = [c for c in crossings if c < fm]
        if crossings_before:
            # The closest crossing is the latest one before the full moon
            closest_crossing = max(crossings_before)
            time_diff = fm - closest_crossing
            # Update if this time difference is the smallest so far
            if min_diff is None or time_diff < min_diff:
                min_diff = time_diff
                selected_fm = fm
    
    # Step 7: Check if selected full moon is before Sun-Hamal crossing
    if selected_fm is not None:
        # Get Sun-Hamal crossing time for the year (assume one per year)
        sun_hamal_time = sun_hamal[0] if sun_hamal else None
        if sun_hamal_time and selected_fm >= sun_hamal_time:
            # If full moon is after Sun-Hamal crossing, find the previous full moon
            fm_index = full_moons.index(selected_fm)
            if fm_index > 0:  # Ensure there is a previous full moon
                selected_fm = full_moons[fm_index - 1]
        
        # Verify the new selected full moon is before Sun-Hamal crossing
        if sun_hamal_time and selected_fm < sun_hamal_time:
            selected_full_moons.append(selected_fm)
            # Format the output for terminal (Telegram-friendly)
            print(f"Year: {year}, Full Moon Time (UTC): {selected_fm.strftime('%Y-%m-%d %H:%M:%S.%f')}")
        elif not sun_hamal_time:
            # If no Sun-Hamal crossing for the year, keep the selected full moon
            selected_full_moons.append(selected_fm)
            print(f"Year: {year}, Full Moon Time (UTC): {selected_fm.strftime('%Y-%m-%d %H:%M:%S.%f')} (No Sun-Hamal crossing)")

# Step 8: Create a DataFrame with the selected full moon times
df_selected = pd.DataFrame({'Full Moon Time (UTC)': selected_full_moons})

# Step 9: Save to CSV without index
df_selected.to_csv('new_years_day.csv', index=False)