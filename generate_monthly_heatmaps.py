#!/usr/bin/env python3
"""
Generate lunar heatmaps for +/- 12 months from current date
"""

import sys
import os
from datetime import datetime, timedelta
import pandas as pd
import pytz

# Add the project root to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.astronomy.map.generate_lunar_heatmaps import generate_heatmap_for_date

def main():
    # Load full moon times
    csv_path = 'backend/data/full_moon_times.csv'
    df = pd.read_csv(csv_path)
    
    # Parse dates
    df['datetime'] = pd.to_datetime(df['Full Moon Time (UTC)'], utc=True)
    
    # Current date: September 8, 2025
    current_date = datetime(2025, 9, 8, tzinfo=pytz.UTC)
    
    # Find the current lunar month start (closest full moon before current date)
    current_full_moon = df[df['datetime'] <= current_date]['datetime'].max()
    
    # Get +/- 12 months
    all_full_moons = df['datetime'].tolist()
    current_index = all_full_moons.index(current_full_moon)
    
    start_index = max(0, current_index - 12)
    end_index = min(len(all_full_moons), current_index + 13)  # +13 to include +12
    
    selected_dates = all_full_moons[start_index:end_index]
    
    print(f"Generating heatmaps for {len(selected_dates)} lunar months")
    
    # Output directory
    output_dir = 'frontend/static/img/map'
    os.makedirs(output_dir, exist_ok=True)
    
    for dt in selected_dates:
        # Format filename: YYYY-MM-DD_HH:MM:SS.png
        date_str = dt.strftime('%Y-%m-%d_%H:%M:%S')
        filename = f"{date_str}.png"
        output_path = os.path.join(output_dir, filename)
        
        print(f"Generating heatmap for {date_str}")
        
        # Generate heatmap
        try:
            generate_heatmap_for_date(dt, output_path)
            print(f"Saved: {output_path}")
        except Exception as e:
            print(f"Error generating {filename}: {e}")

if __name__ == '__main__':
    main()
