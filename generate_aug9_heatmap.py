#!/usr/bin/env python3
"""
Generate heatmap for August 9, 2025
"""

import sys
import os
from datetime import datetime

# Add the project root to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from backend.astronomy.map.generate_lunar_heatmaps import generate_heatmap_for_date

# Generate heatmap for August 9, 2025
target_date = datetime(2025, 8, 9, 12, 0, 0)  # Noon on August 9
output_path = os.path.join('frontend', 'static', 'img', 'heatmap_2025-08-09_start.png')

print(f'Generating heatmap for {target_date.date()}...')
result = generate_heatmap_for_date(target_date, output_path)
print(f'Generated: {result}')
