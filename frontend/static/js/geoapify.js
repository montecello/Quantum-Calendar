// Location autocomplete using backend proxy (/api/geocode)

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
        if (input.value.length >= 4) {
            try {
                console.log('Fetching suggestions via /api/geocode ...');
                const response = await fetch(`/api/geocode?q=${encodeURIComponent(input.value)}`);
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
