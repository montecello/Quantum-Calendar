# Custom Astronomical Calendar Web App

A lunar-first calendar anchored to real astronomy: dawn, the exact 100% full moon, and Spica-based rules. Enter a location to generate a location-aware calendar where months and years begin from astronomical events, with special days clearly highlighted.

## Quick start
- Requires Python 3.10+ and pip
```bash
pip install -r requirements.txt
python3 app.py
```
Open the URL printed in your terminal (usually http://127.0.0.1:5000).

## How to use the app
- Choose location: Search for a place or allow browser geolocation. All times and events update for that location.
- Navigate time: Use header controls to move between months/years; the grid reflects lunar-month boundaries.
- Read the grid: Special days are highlighted (100% Full Moon, New Moon, and notable crossings like Spica/Hamal when applicable).
- Inspect a day: Click a date to open the side panel with dawn/sun times, moon phase/illumination, and event notes.
- Hints and details: Hover (desktop) or tap (mobile) day cells for quick tips; side-panel sections can expand/collapse.