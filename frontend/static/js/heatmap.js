// Dynamic heatmap loader with custom calendar month calculation
document.addEventListener('DOMContentLoaded', function() {
    console.log('Heatmap loader starting...');

    let retryCount = 0;
    const maxRetries = 30; // 30 seconds max wait (increased from 20)

    // Track searched locations for map pins
    let searchedLocations = [];

    // Default location (Greenwich) - always show this pin
    const defaultLocation = { lat: 51.4769, lon: 0.0, name: 'Greenwich' };
    searchedLocations.push(defaultLocation);

    // Track current location separately (this persists across navigation)
    let currentLocation = null;

    // Function to find the correct heatmap for current calendar month
    function findHeatmapForCurrentMonth() {
        console.log('=== findHeatmapForCurrentMonth called ===');
        if (!window.navState || !window.navState.yearsData || !window.navState.yearsData.length) {
            console.log('No navState data available for heatmap lookup');
            return null;
        }

        const yearData = window.navState.yearsData[window.navState.currentYearIdx];
        if (!yearData || !yearData.months || !yearData.months.length) {
            console.log('No year/month data available');
            return null;
        }

        const monthData = yearData.months[window.navState.currentMonthIdx];
        if (!monthData || !monthData.start) {
            console.log('No month start date available');
            return null;
        }

        console.log('Raw monthData.start:', monthData.start);
        console.log('Raw monthData.full_moon_utc:', monthData.full_moon_utc);
        console.log('Type of monthData.start:', typeof monthData.start);

        // Try to parse the date, handling different formats
        let monthStart;
        try {
            // Use full_moon_utc for filename generation (original UTC time from CSV)
            // Fall back to start if full_moon_utc is not available
            const dateToUse = monthData.full_moon_utc || monthData.start;
            console.log('Using date for filename:', dateToUse);

            // Parse the date string (handles all formats: ISO, timezone-aware, etc.)
            monthStart = new Date(dateToUse);

            // Check if the date is valid
            if (isNaN(monthStart.getTime())) {
                console.error('Invalid date parsed from:', dateToUse);
                return null;
            }

            console.log('Parsed date:', monthStart);
            console.log('UTC date components:', {
                year: monthStart.getUTCFullYear(),
                month: monthStart.getUTCMonth() + 1,
                day: monthStart.getUTCDate(),
                hour: monthStart.getUTCHours(),
                minute: monthStart.getUTCMinutes(),
                second: monthStart.getUTCSeconds()
            });
        } catch (error) {
            console.error('Error parsing date:', monthData.full_moon_utc || monthData.start, error);
            return null;
        }

        // Always generate filename using UTC components (since heatmap files use UTC times)
        const filename = monthStart.getUTCFullYear() + '-' +
                        String(monthStart.getUTCMonth() + 1).padStart(2, '0') + '-' +
                        String(monthStart.getUTCDate()).padStart(2, '0') + '_' +
                        String(monthStart.getUTCHours()).padStart(2, '0') + ':' +
                        String(monthStart.getUTCMinutes()).padStart(2, '0') + ':' +
                        String(monthStart.getUTCSeconds()).padStart(2, '0') + '.png';

        console.log('Generated UTC filename:', filename);
        return filename;
    }

    // Function to update heatmaps using navState data
    function updateHeatmapsWithData() {
        console.log('=== updateHeatmapsWithData called ===');
        console.log('Current navState:', window.navState);
        console.log('Current mode:', window.CalendarMode?.mode);
        
        if (window.navState) {
            console.log('navState.currentYearIdx:', window.navState.currentYearIdx);
            console.log('navState.currentMonthIdx:', window.navState.currentMonthIdx);
            console.log('navState.yearsData length:', window.navState.yearsData?.length);
        }

        const heatmapFilename = findHeatmapForCurrentMonth();
        console.log('Found heatmap filename:', heatmapFilename);
        
        if (!heatmapFilename) {
            console.log('No heatmap found, showing fallback message');
            showHeatmapFallback();
            return;
        }

        const imagePath = `/static/img/map/${heatmapFilename}`;
        console.log('Trying to load heatmap from:', imagePath);

        // Update current month display
        const currentGregorianDate = document.getElementById('current-gregorian-date');
        if (currentGregorianDate) {
            if (window.navState && window.navState.yearsData && window.navState.yearsData.length) {
                const yearData = window.navState.yearsData[window.navState.currentYearIdx];
                const monthData = yearData.months[window.navState.currentMonthIdx];

                if (monthData && monthData.start) {
                    const monthStart = new Date(monthData.start);
                    const nextMonthData = (window.navState.currentMonthIdx + 1 < yearData.months.length)
                        ? yearData.months[window.navState.currentMonthIdx + 1]
                        : (window.navState.currentYearIdx + 1 < window.navState.yearsData.length &&
                           window.navState.yearsData[window.navState.currentYearIdx + 1].months &&
                           window.navState.yearsData[window.navState.currentYearIdx + 1].months[0])
                        ? window.navState.yearsData[window.navState.currentYearIdx + 1].months[0]
                        : null;
                    const monthEnd = nextMonthData && nextMonthData.start
                        ? new Date(nextMonthData.start)
                        : new Date(monthStart.getTime() + (monthData.days || 29) * 24 * 60 * 60 * 1000);

                    const startDisplay = monthStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
                    const endDisplay = new Date(monthEnd.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
                    const yearDisplay = monthStart.getFullYear();
                    const finalDisplay = `${startDisplay} - ${endDisplay}, ${yearDisplay}`;
                    currentGregorianDate.innerHTML = `(${finalDisplay})<br>(Azimuthal Projection)`;
                    console.log('Updated date display for navigated month:', finalDisplay);
                } else {
                    console.log('No month data available for current navigation position');
                    currentGregorianDate.textContent = 'Date data unavailable';
                }
            } else {
                console.log('No navState data available for date display');
                currentGregorianDate.textContent = 'Loading...';
            }
        }

        // Load the heatmap image
        // First, ensure we have the correct container structure
        let currentContainer = document.getElementById('current-heatmap');
        if (!currentContainer) {
            // Create current-heatmap div inside heatmap-container if it doesn't exist
            const heatmapContainer = document.getElementById('heatmap-container');
            if (heatmapContainer) {
                currentContainer = document.createElement('div');
                currentContainer.id = 'current-heatmap';
                currentContainer.className = 'heatmap-placeholder';
                heatmapContainer.appendChild(currentContainer);
                console.log('Created current-heatmap container');
            } else {
                console.log('heatmap-container not found, will retry in 100ms');
                // Retry after a short delay to allow container creation
                setTimeout(() => {
                    console.log('Retrying heatmap update...');
                    updateHeatmapsWithData();
                }, 100);
                return;
            }
        }

        if (currentContainer) {
            // Check if image exists by trying to load it
            const img = new Image();
            img.onload = function() {
                currentContainer.innerHTML = `<img src="${imagePath}" alt="Lunar month heatmap" style="width: 100%; height: auto; border-radius: 8px;">`;
                console.log('Heatmap loaded successfully:', imagePath);

                // Render location pins after image loads
                setTimeout(renderLocationPins, 100);
            };
            img.onerror = function() {
                console.log('Heatmap not found, showing fallback:', imagePath);
                showHeatmapFallback();
            };
            img.src = imagePath;
        } else {
            console.error('Could not find or create current-heatmap container element');
        }

        console.log('Heatmap update complete');
    }

    // Function to convert lat/lon to pixel coordinates on the heatmap
    // Uses azimuthal equidistant projection centered on North Pole (same as heatmap generation)
    function latLonToPixel(lat, lon, imgWidth = 800, imgHeight = 800) {
        // Azimuthal equidistant projection parameters (matching Python implementation)
        const R = 1.0;
        const centerLonDeg = 0; // Greenwich meridian
        const rhoMax = Math.PI * R;

        // Image center
        const cx = imgWidth / 2;
        const cy = imgHeight / 2;

        // Margin ratio (5% margin as in Python code)
        const marginRatio = 0.05;
        const scale = ((imgWidth / 2) * (1 - marginRatio)) / rhoMax;

        // Convert to radians
        const phi = (lat * Math.PI) / 180; // latitude in radians
        const deltaLambda = ((lon - centerLonDeg) * Math.PI) / 180; // longitude difference in radians

        // Azimuthal equidistant calculation
        const c = (Math.PI / 2.0) - phi;
        const rho = R * c;

        // Convert to pixel coordinates
        const xRel = rho * Math.sin(deltaLambda);
        const yRel = rho * Math.cos(deltaLambda);

        const x = cx + xRel * scale;
        const y = cy + yRel * scale;

        return { x, y };
    }

    // Function to render location pins overlay on heatmap
    function renderLocationPins() {
        // Ensure we have the correct container structure
        let heatmapContainer = document.getElementById('current-heatmap');
        if (!heatmapContainer) {
            // Try to find it inside heatmap-container
            const parentContainer = document.getElementById('heatmap-container');
            if (parentContainer) {
                heatmapContainer = parentContainer.querySelector('#current-heatmap');
            }
        }

        if (!heatmapContainer) {
            console.log('No heatmap container found for location pins');
            return;
        }

        // Remove existing overlay if present
        const existingOverlay = heatmapContainer.querySelector('.location-pins-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Create overlay container
        const overlay = document.createElement('div');
        overlay.className = 'location-pins-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10';

        // Get image dimensions
        const img = heatmapContainer.querySelector('img');
        const imgWidth = img ? img.offsetWidth : 800;
        const imgHeight = img ? img.offsetHeight : 800;

        // Add pins for each searched location
        searchedLocations.forEach((location, index) => {
            const pixel = latLonToPixel(location.lat, location.lon, imgWidth, imgHeight);
            console.log(`Location pin ${index}: ${location.name} (${location.lat}, ${location.lon}) -> pixel (${pixel.x.toFixed(1)}, ${pixel.y.toFixed(1)})`);

            // Check if pin is within reasonable bounds (within the image area)
            const margin = 20; // Allow some margin outside the image
            if (pixel.x < -margin || pixel.x > imgWidth + margin ||
                pixel.y < -margin || pixel.y > imgHeight + margin) {
                console.log(`Location pin for ${location.name} is outside image bounds:`, pixel);
                return; // Skip pins that are too far outside
            }

            const pin = document.createElement('div');
            pin.className = 'location-pin';
            
            // Determine pin type and styling
            const isDefault = location === defaultLocation;
            const isCurrent = location === currentLocation && currentLocation !== null;
            
            if (isDefault && !currentLocation) {
                // Only show default pin when no current location is set
                pin.classList.add('default');
                pin.style.backgroundColor = '#FFD700'; // Gold for Greenwich
            } else if (isCurrent) {
                // Current location pin with pulsing effect
                pin.classList.add('current');
                pin.style.backgroundColor = '#FF4444'; // Red for current location
            } else if (isDefault && currentLocation) {
                // Skip default pin when current location exists
                return;
            }
            
            pin.style.position = 'absolute';
            pin.style.left = `${pixel.x}px`;
            pin.style.top = `${pixel.y}px`;
            pin.style.transform = 'translate(-50%, -100%)';
            pin.style.width = '8px';
            pin.style.height = '8px';
            pin.style.border = '2px solid white';
            pin.style.borderRadius = '50%';
            pin.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            pin.style.cursor = 'pointer';
            pin.style.pointerEvents = 'auto';
            pin.style.zIndex = '15';
            pin.title = location.name || `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`;

            // Add a small dot in the center
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.top = '50%';
            dot.style.left = '50%';
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.width = '3px';
            dot.style.height = '3px';
            dot.style.backgroundColor = 'white';
            dot.style.borderRadius = '50%';
            pin.appendChild(dot);

            // Add location label
            const label = document.createElement('div');
            label.style.position = 'absolute';
            label.style.top = '12px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.backgroundColor = 'rgba(0,0,0,0.8)';
            label.style.color = 'white';
            label.style.padding = '2px 6px';
            label.style.borderRadius = '3px';
            label.style.fontSize = '11px';
            label.style.fontWeight = 'bold';
            label.style.whiteSpace = 'nowrap';
            label.style.pointerEvents = 'none';
            label.style.opacity = '0';
            label.style.transition = 'opacity 0.2s ease';

            // Get current lunar month information
            let monthInfo = '';
            if (window.navState && window.navState.yearsData && window.navState.yearsData.length) {
                const yearData = window.navState.yearsData[window.navState.currentYearIdx];
                if (yearData && yearData.months && yearData.months[window.navState.currentMonthIdx]) {
                    const monthData = yearData.months[window.navState.currentMonthIdx];
                    if (monthData.days) {
                        monthInfo = `${monthData.days} day month`;
                    }
                }
            }

            // Set label content with location name and month info
            const locationName = location.name || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`;
            label.innerHTML = monthInfo ? `${locationName}<br>${monthInfo}` : locationName;
            pin.appendChild(label);

            // Show label on hover
            pin.addEventListener('mouseenter', () => {
                label.style.opacity = '1';
            });
            pin.addEventListener('mouseleave', () => {
                label.style.opacity = '0';
            });

            overlay.appendChild(pin);
        });

        // Position overlay relative to the heatmap image
        if (img) {
            img.style.position = 'relative';
            heatmapContainer.style.position = 'relative';
            heatmapContainer.appendChild(overlay);
        }
    }

    // Function to wait for navState data and then update heatmaps
    function updateHeatmapsWhenReady() {
        retryCount++;

        // Check if navState and yearsData are available
        if (!window.navState || !window.navState.yearsData || !window.navState.yearsData.length) {
            console.log(`Waiting for astronomical data to load... (attempt ${retryCount}/${maxRetries})`);
            console.log('Current navState:', window.navState);

            if (retryCount >= maxRetries) {
                console.log('Max retries reached, showing fallback');
                showHeatmapFallback();
                return;
            }

            // Retry in 1 second (increased from 500ms for better performance)
            setTimeout(updateHeatmapsWhenReady, 1000);
            return;
        }

        console.log('Astronomical data loaded, updating heatmaps...');
        updateHeatmapsWithData();
    }

    // Function to show fallback when heatmap is not available
    function showHeatmapFallback() {
        console.log('Showing heatmap fallback message');

        // Ensure we have the correct container structure
        let currentContainer = document.getElementById('current-heatmap');
        if (!currentContainer) {
            // Create current-heatmap div inside heatmap-container if it doesn't exist
            const heatmapContainer = document.getElementById('heatmap-container');
            if (heatmapContainer) {
                currentContainer = document.createElement('div');
                currentContainer.id = 'current-heatmap';
                heatmapContainer.appendChild(currentContainer);
            }
        }

        if (currentContainer) {
            currentContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666; font-style: italic;">
                    <p>Heatmap not available for this lunar month</p>
                    <p style="font-size: 0.9em;">Heatmaps are generated for specific lunar cycles</p>
                </div>
            `;
        } else {
            console.error('Could not find or create container for heatmap fallback');
        }
    }

    // Listen for calendar navigation events
    document.addEventListener('calendar:navigation', function() {
        console.log('Calendar navigation detected, updating heatmap...');

        // NEW PIN LOGIC: Maintain current pin state during navigation
        // If user has set a custom location, keep only that pin
        // If no custom location, show only Greenwich
        if (currentLocation) {
            searchedLocations = [currentLocation];
        } else {
            searchedLocations = [defaultLocation];
        }

        updateHeatmapsWithData();
    });

    // Listen for calendar data loaded event (for initial load)
    document.addEventListener('calendar:data-loaded', function() {
        console.log('Calendar data loaded, updating heatmap...');
        updateHeatmapsWithData();
    });

    // Also listen for calendar render events
    document.addEventListener('calendar:rendered', function() {
        console.log('=== calendar:rendered event fired ===');
        
        // Add a delay to ensure DOM is fully constructed
        setTimeout(() => {
            console.log('Processing calendar:rendered after delay...');
            console.log('Current navState:', window.navState);

            // NEW PIN LOGIC: Maintain current pin state after rendering
            // If user has set a custom location, keep only that pin
            // If no custom location, show only Greenwich
            if (currentLocation) {
                searchedLocations = [currentLocation];
            } else {
                searchedLocations = [defaultLocation];
            }

            console.log('Calling updateHeatmapsWithData from calendar:rendered...');
            updateHeatmapsWithData();
        }, 200); // Give DOM time to be constructed
    });

    // Listen for Gregorian mode render events
    document.addEventListener('gregorian:rendered', function() {
        console.log('=== gregorian:rendered event fired ===');
        
        // Add a delay to ensure DOM is fully constructed
        setTimeout(() => {
            console.log('Processing gregorian:rendered after delay...');
            console.log('Current navState before sync:', window.navState);

            // When Gregorian mode is rendered, ensure custom calendar state reflects current date
            // for proper heatmap display (since heatmap uses custom calendar indices)
            if (window.navState && window.navState.yearsData && window.navState.yearsData.length) {
                const today = new Date();
                console.log('Finding quantum index for today:', today);
                
                const foundIdx = window.findQuantumIndexForDate ? window.findQuantumIndexForDate(today, window.navState.yearsData) : null;
                console.log('Found quantum index:', foundIdx);
                
                if (foundIdx) {
                    console.log('Updating custom calendar indices for current date:', foundIdx);
                    window.navState.currentYearIdx = foundIdx.yearIdx;
                    window.navState.currentMonthIdx = foundIdx.monthIdx;
                    console.log('Updated navState:', window.navState);
                } else {
                    console.log('Failed to find quantum index for today');
                }
            } else {
                console.log('navState or yearsData not available');
            }

            // NEW PIN LOGIC: Maintain current pin state after gregorian rendering
            // If user has set a custom location, keep only that pin
            // If no custom location, show only Greenwich
            if (currentLocation) {
                searchedLocations = [currentLocation];
            } else {
                searchedLocations = [defaultLocation];
            }

            console.log('Calling updateHeatmapsWithData...');
            updateHeatmapsWithData();
        }, 200); // Give DOM time to be constructed
    });

    // Listen for location changes to add new pins
    window.addEventListener('calendar:update', function(e) {
        if (e.detail && e.detail.lat && e.detail.lon) {
            const newLocation = {
                lat: e.detail.lat,
                lon: e.detail.lon,
                name: e.detail.name || `${e.detail.lat.toFixed(4)}, ${e.detail.lon.toFixed(4)}`
            };

            // Set this as the current location (replaces any previous current location)
            currentLocation = newLocation;

            // NEW PIN LOGIC: When user changes location, show only the current location pin
            // Greenwich is no longer shown when a custom location is selected
            searchedLocations = [currentLocation];

            console.log('Updated current location pin (only showing current location):', newLocation);

            // Re-render pins if heatmap is currently displayed
            let currentContainer = document.getElementById('current-heatmap');
            if (!currentContainer) {
                // Try to find it inside heatmap-container
                const parentContainer = document.getElementById('heatmap-container');
                if (parentContainer) {
                    currentContainer = parentContainer.querySelector('#current-heatmap');
                }
            }

            if (currentContainer && currentContainer.querySelector('img')) {
                setTimeout(renderLocationPins, 100);
            }
        }
    });

    // Automatically load heatmap on page startup
    console.log('Starting automatic heatmap loading on page startup...');
    updateHeatmapsWhenReady();
});

// Debug functions for testing location pins
function clearLocationPins() {
    searchedLocations = [defaultLocation]; // Keep only Greenwich
    currentLocation = null; // Clear current location

    // Find the heatmap container
    let heatmapContainer = document.getElementById('current-heatmap');
    if (!heatmapContainer) {
        // Try to find it inside heatmap-container
        const parentContainer = document.getElementById('heatmap-container');
        if (parentContainer) {
            heatmapContainer = parentContainer.querySelector('#current-heatmap');
        }
    }

    if (heatmapContainer) {
        const existingOverlay = heatmapContainer.querySelector('.location-pins-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
    }
}

function addTestLocation(lat, lon, name) {
    const testLocation = { lat, lon, name };
    currentLocation = testLocation; // Set as current location
    searchedLocations = [testLocation]; // NEW PIN LOGIC: Show only current location
    console.log(`Added test location: ${name} (${lat}, ${lon})`);
    renderLocationPins();
}

// Make functions available globally for debugging
window.heatmapDebug = {
    clearLocationPins,
    addTestLocation,
    renderLocationPins,
    latLonToPixel
};
