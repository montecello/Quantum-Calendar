// Location autocomplete using backend proxy (/api/geocode)

// Add this function to detect and parse coordinates
function isCoordinates(input) {
    // Simple heuristic: contains numbers and potential coordinate indicators
    return /\d/.test(input) && (/[°'"\s,;-]/.test(input) || /[nsew]/i.test(input));
}

function parseCoordinatesFrontend(input) {
    // Enhanced client-side parsing to handle many DMS format variations
    input = input.trim();
    console.log('parseCoordinatesFrontend input:', input);

    // Split into parts using common separators
    const parts = input.split(/[,\s;|]+/).filter(p => p.trim());
    if (parts.length < 2) return null;

    // Helper to parse a single coordinate (lat or lon)
    function parseSingleCoord(coordStr, isLat) {
        coordStr = coordStr.trim();
        console.log('parseSingleCoord input:', coordStr, 'isLat:', isLat);

        // Check for cardinal direction at the end (case insensitive)
        const directionMatch = coordStr.match(/([nsew])\s*$/i);
        let direction = null;
        if (directionMatch) {
            direction = directionMatch[1].toUpperCase();
            coordStr = coordStr.replace(/\s*[nsew]\s*$/i, '').trim();
        }
        console.log('After direction extraction:', coordStr, 'direction:', direction);

        // Try various DMS formats FIRST (before decimal fallback)
        // Format 1: 31°53'48.5 (with degree, minute, second symbols)
        let dmsMatch = coordStr.match(/^(\d+)°(?:\s*(\d+)'(?:\s*(\d+(?:\.\d+)?)"?\s*)?)?$/);
        console.log('Format 1 match for', coordStr, ':', dmsMatch);
        if (dmsMatch) {
            console.log('Format 1 captured groups:', dmsMatch[1], dmsMatch[2], dmsMatch[3]);
        }
        if (!dmsMatch) {
            // Format 2: 31:53:48.5 (colon separated)
            dmsMatch = coordStr.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
            console.log('Format 2 match for', coordStr, ':', dmsMatch);
        }
        if (!dmsMatch) {
            // Format 3: 31 53 48.5 (space separated)
            dmsMatch = coordStr.match(/^(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/);
            console.log('Format 3 match for', coordStr, ':', dmsMatch);
        }
        if (!dmsMatch) {
            // Format 4: 31°53 (degrees and minutes only)
            dmsMatch = coordStr.match(/^(\d+)°(?:\s*(\d+)'?\s*)?$/);
            console.log('Format 4 match for', coordStr, ':', dmsMatch);
        }
        if (!dmsMatch) {
            // Format 5: 31 53 (space separated, degrees and minutes only)
            dmsMatch = coordStr.match(/^(\d+)\s+(\d+)$/);
            console.log('Format 5 match for', coordStr, ':', dmsMatch);
        }

        if (dmsMatch) {
            const degrees = parseInt(dmsMatch[1]);
            const minutes = dmsMatch[2] ? parseInt(dmsMatch[2]) : 0;
            const seconds = dmsMatch[3] ? parseFloat(dmsMatch[3]) : 0;
            console.log('Parsed DMS components:', { degrees, minutes, seconds });

            if (minutes >= 60 || seconds >= 60) return null;

            let value = degrees + minutes / 60 + seconds / 3600;

            // Apply direction
            if (direction) {
                if (isLat && direction === 'S') value = -value;
                else if (!isLat && direction === 'W') value = -value;
                else if ((isLat && direction === 'N') || (!isLat && direction === 'E')) value = Math.abs(value);
            }

            // Validate range
            if (isLat && (value < -90 || value > 90)) return null;
            if (!isLat && (value < -180 || value > 180)) return null;

            return value;
        }

        // Try decimal ONLY if DMS parsing failed (e.g., 40.7128, -74.0060)
        const decimalVal = parseFloat(coordStr);
        console.log('Decimal parseFloat result for', coordStr, ':', decimalVal);
        if (!isNaN(decimalVal)) {
            let value = decimalVal;
            // Apply direction
            if (direction) {
                if (isLat && direction === 'S') value = -Math.abs(value);
                else if (!isLat && direction === 'W') value = -Math.abs(value);
                else if ((isLat && direction === 'N') || (!isLat && direction === 'E')) value = Math.abs(value);
            }
            // Validate range
            if (isLat && (value < -90 || value > 90)) return null;
            if (!isLat && (value < -180 || value > 180)) return null;
            console.log('Returning decimal value:', value);
            return value;
        }

        console.log('No valid parsing found for', coordStr);
        return null;
    }

    const lat = parseSingleCoord(parts[0], true);
    const lon = parseSingleCoord(parts[1], false);
    console.log('parseCoordinatesFrontend result:', { lat, lon });

    if (lat !== null && lon !== null) {
        return { lat, lon };
    }

    return null;
}

document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('location-input');
    const searchBtn = document.getElementById('search-btn');
    const modePlace = document.getElementById('mode-place');
    const modeCoordinates = document.getElementById('mode-coordinates');
    let suggestions = document.getElementById('suggestions');
    if (!input || !suggestions) {
        console.error('Geoapify: One or more elements not found:', {input, suggestions});
        return;
    }
    console.log('Geoapify: Elements found, attaching event listeners.');

    let isCoordinatesMode = false;

    // Function to perform search
    function performSearch() {
        const query = input.value.trim();
        if (!query) return;

        if (isCoordinatesMode) {
            // Coordinates mode: Parse coordinates and submit
            console.log('Coordinates mode: Parsing coordinates...');
            const coords = parseCoordinatesFrontend(query);
            if (coords) {
                console.log('Parsed coordinates:', coords);
                fetch(`/api/timezone?lat=${coords.lat}&lon=${coords.lon}`)
                    .then(r => r.json())
                    .then(tzdata => {
                        const tz = tzdata.tz || 'UTC';
                        const name = `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`;
                        window.dispatchEvent(new CustomEvent('calendar:update', {
                            detail: { lat: coords.lat, lon: coords.lon, tz, name }
                        }));
                        suggestions.innerHTML = `<div class="suggestion-success">Using coordinates: ${name}</div>`;
                        suggestions.classList.add('active');
                        setTimeout(() => {
                            suggestions.innerHTML = '';
                            suggestions.classList.remove('active');
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Error with coordinates:', err);
                        suggestions.innerHTML = '<div class="suggestion-error">Invalid coordinates or timezone error</div>';
                        suggestions.classList.add('active');
                    });
            } else {
                suggestions.innerHTML = '<div class="suggestion-error">Invalid coordinate format. Try: "40.7128, -74.0060" or "31°53\'48.5 N, 97°53\'02.5 W" or "31 53 48.5 N, 97 53 02.5 W"</div>';
                suggestions.classList.add('active');
            }
        } else {
            // Place mode: Trigger geocoding
            handleGeocoding(query);
        }
    }

    // Handle geocoding for normal mode
    async function handleGeocoding(query) {
        try {
            console.log('Fetching suggestions via /api/geocode ...');
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                console.error('Geocode API error:', response.status, response.statusText);
                suggestions.innerHTML = '<div class="suggestion-error">API error</div>';
                suggestions.classList.add('active');
                return;
            }
            const data = await response.json();
            console.log('Geocode API response:', data);
            if (data.results && data.results.length > 0) {
                suggestions.innerHTML = data.results.map(r => `<div class="suggestion-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${r.name}">${r.name}</div>`).join('');
                suggestions.classList.add('active');
                // Add click listeners to suggestion items
                document.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', function() {
                        const lat = this.getAttribute('data-lat');
                        const lon = this.getAttribute('data-lon');
                        const name = this.getAttribute('data-name');
                        // POST to /select-location so backend prints events, then fetch timezone and update calendar
                        fetch('/select-location', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({lat, lon, name})
                        })
                        .then(() => {
                            // Now fetch timezone and update calendar
                            fetch(`/api/timezone?lat=${lat}&lon=${lon}`)
                                .then(r => r.json())
                                .then(tzdata => {
                                    const tz = tzdata.tz || 'UTC';
                                    window.dispatchEvent(new CustomEvent('calendar:update', {
                                        detail: { lat: parseFloat(lat), lon: parseFloat(lon), tz, name }
                                    }));
                                    suggestions.innerHTML = '';
                                    suggestions.classList.remove('active');
                                    input.value = this.textContent;
                                })
                                .catch(err => {
                                    console.error('Error fetching timezone:', err);
                                    suggestions.innerHTML = '<div class="suggestion-error">Timezone fetch error</div>';
                                    suggestions.classList.add('active');
                                });
                        })
                        .catch(err => {
                            console.error('Error posting to /select-location:', err);
                            suggestions.innerHTML = '<div class="suggestion-error">Location select error</div>';
                            suggestions.classList.add('active');
                        });
                    });
                });
            } else {
                suggestions.innerHTML = '<div class="suggestion-empty">No suggestions found</div>';
                suggestions.classList.add('active');
            }
        } catch (err) {
            console.error('Geocode fetch error:', err);
            suggestions.innerHTML = '<div class="suggestion-error">Fetch error</div>';
            suggestions.classList.add('active');
        }
    }

    // Input event: Only for place mode
    input.addEventListener('input', () => {
        if (isCoordinatesMode) return; // Skip in coordinates mode
        console.log('Input event:', input.value);
        const query = input.value.trim();
        
        if (query.length >= 2) {
            handleGeocoding(query);
        } else {
            suggestions.innerHTML = '';
            suggestions.classList.remove('active');
        }
    });

    input.addEventListener('keyup', () => {
        if (isCoordinatesMode) return; // Skip in coordinates mode
        console.log('Keyup event:', input.value);
        const query = input.value.trim();
        
        if (query.length >= 2) {
            handleGeocoding(query);
        } else {
            suggestions.innerHTML = '';
            suggestions.classList.remove('active');
        }
    });

    // Enter key: Submit in both modes
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Search button: Submit in both modes
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    // Mode toggle buttons
    if (modePlace) {
        modePlace.addEventListener('click', () => {
            isCoordinatesMode = false;
            modePlace.setAttribute('aria-pressed', 'true');
            modeCoordinates.setAttribute('aria-pressed', 'false');
            input.placeholder = 'Enter location...(\'Greenwich, England\')';
            suggestions.innerHTML = '';
            suggestions.classList.remove('active');
            if (searchBtn) searchBtn.style.display = 'none';
        });
    }

    if (modeCoordinates) {
        modeCoordinates.addEventListener('click', () => {
            isCoordinatesMode = true;
            modePlace.setAttribute('aria-pressed', 'false');
            modeCoordinates.setAttribute('aria-pressed', 'true');
            input.placeholder = 'Enter coordinates (e.g., 40.7128, -74.0060 or 31°53\'48.5 N, 97°53\'02.5 W)...';
            suggestions.innerHTML = '';
            suggestions.classList.remove('active');
            if (searchBtn) searchBtn.style.display = 'flex';
        });
    }
});
