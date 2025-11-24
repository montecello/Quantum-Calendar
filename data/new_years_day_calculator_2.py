import pandas as pd
from tqdm import tqdm

# Step 1: Read the CSV files, parsing datetime columns
df_crossings = pd.read_csv('spica_moon_crossings.csv', parse_dates=['Time (UTC)'])
df_full_moons = pd.read_csv('full_moon_times.csv', parse_dates=['Full Moon Time (UTC)'])

# Step 2: Extract year from full moon times for grouping
df_full_moons['Year'] = df_full_moons['Full Moon Time (UTC)'].dt.year

# Step 3: Initialize a list to store selected full moon times
selected_full_moons = []

# Step 4: Get unique years for processing
unique_years = df_full_moons['Year'].unique()

# Step 5: Process each unique year with tqdm progress bar
for year in tqdm(unique_years, desc="Processing years"):
    # Filter full moons and Spica crossings for the current year
    full_moons = df_full_moons[df_full_moons['Year'] == year]['Full Moon Time (UTC)'].sort_values().tolist()
    crossings = df_crossings[df_crossings['Year'] == year]['Time (UTC)'].tolist()
    
    # Variables to track the full moon with the smallest time difference
    min_diff = None
    selected_fm = None
    
    # Step 6: For each full moon, find the closest Spica crossing (before or shortly after)
    for fm in full_moons:
        # Get all Spica crossings before this full moon
        crossings_before = [c for c in crossings if c < fm]
        
        # Also check if there's a Spica crossing within 12 hours after the full moon
        # (allowing for overnight crossings where moon is still essentially full)
        crossings_shortly_after = [c for c in crossings if c >= fm and (c - fm).total_seconds() <= 12 * 3600]
        
        # Combine both: crossings before OR shortly after (within 12 hours)
        relevant_crossings = crossings_before + crossings_shortly_after
        
        if relevant_crossings:
            # Find the crossing closest in time to the full moon
            closest_crossing = min(relevant_crossings, key=lambda c: abs((fm - c).total_seconds()))
            time_diff = abs(fm - closest_crossing)
            
            # Update if this time difference is the smallest so far
            if min_diff is None or time_diff < min_diff:
                min_diff = time_diff
                selected_fm = fm
    
    # Step 7: Add selected full moon (no Hamal constraint)
    if selected_fm is not None:
        selected_full_moons.append(selected_fm)
        # Format the output for terminal (Telegram-friendly)
        print(f"Year: {year}, Full Moon Time (UTC): {selected_fm.strftime('%Y-%m-%d %H:%M:%S.%f')}")

# Step 8: Create a DataFrame with the selected full moon times
df_selected = pd.DataFrame({'Full Moon Time (UTC)': selected_full_moons})

# Step 9: Save to CSV without index
df_selected.to_csv('new_years_day_2.csv', index=False)
