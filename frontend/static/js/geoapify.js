// Location autocomplete using backend proxy (/api/geocode)

// Add this function to detect and parse coordinates
function isCoordinates(input) {
    // Simple heuristic: contains numbers and potential coordinate indicators
    return /\d/.test(input) && (/[°'"\s,;-]/.test(input) || /[nsew]/i.test(input));
}

function parseCoordinatesFrontend(input) {
    // Basic client-side validation (full parsing is on backend)
    const parts = input.split(/[,\s;|]+/).filter(p => p.trim());
    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            return { lat, lon };
        }
    }
    return null;
}

document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('location-input');
    let suggestions = document.getElementById('suggestions');
    if (!input || !suggestions) {
        console.error('Geoapify: One or more elements not found:', {input, suggestions});
        return;
    }
    console.log('Geoapify: Elements found, attaching input event listener.');
    input.addEventListener('input', async () => {
        console.log('Input event:', input.value);
        const query = input.value.trim();
        
        if (query.length >= 2) {
            // Check if input looks like coordinates
            if (isCoordinates(query)) {
                console.log('Detected coordinates, attempting to parse...');
                const coords = parseCoordinatesFrontend(query);
                if (coords) {
                    // Use coordinates directly
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
                    return;
                } else {
                    // Parsing failed, show error
                    suggestions.innerHTML = '<div class="suggestion-error">Invalid coordinate format. Try: "40.7128, -74.0060" or "40 42 46 N, 74 0 21 W"</div>';
                    suggestions.classList.add('active');
                    return;
                }
            }
            
            // Not coordinates, proceed with geocoding
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
        } else {
            suggestions.innerHTML = '';
            suggestions.classList.remove('active');
        }
    });
});
