// side_panel.js - Handles all side panel functionality

// Constants
const SUN_EVENTS_LOADING_TEXT = 'Loading sun events...';

// Flag to track if side panel has been opened before
let sidePanelOpened = false;

// Format sun events text for display in the side panel
function formatSunEventsText(text) {
    if (!text) return '';

    // Split into lines and process each line
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
        // Highlight secondary tags (nautical, civil, etc.) in orange
        if (line.includes('(secondary:')) {
            return line.replace(/\(secondary: ([^)]+)\)/, '<span class="secondary-tag">(secondary: $1)</span>');
        }
        return line;
    });

    // Join lines back and wrap in pre tag
    return `<pre class="sun-events-pre">${formattedLines.join('\n')}</pre>`;
}

// Helper to open side panel and load sun events. Centralizes duplicated HTML + fetch logic.
function openSidePanel(panel, cols, opts) {
    if (!panel) return;
    if (cols) cols.classList.add('two-col');

    // Remove any existing closing class
    panel.classList.remove('closing');

    // Determine animation type based on whether panel has been opened before
    if (sidePanelOpened) {
        panel.classList.add('page-turn');
    } else {
        panel.classList.remove('page-turn');
    }

    const month = opts.month || '';
    const day = opts.day || '';
    const yearRange = opts.yearRange || '';
    const gregorianStr = opts.gregorianStr || '';

    panel.innerHTML = `
        <button class="close-btn" aria-label="Close">&times;</button>
        <h3 style="margin-top:0;color:#20639b;">Month ${month}, Day ${day}, ${yearRange}</h3>
        <h3 style="margin:0 0 12px 0;color:#20639b;font-weight:normal;">${gregorianStr}</h3>
    <div id="sun-events-content" style="color:#173f5f;">${SUN_EVENTS_LOADING_TEXT}</div>
    `;

    // Start the animation
    setTimeout(() => {
        panel.classList.add('open');
        sidePanelOpened = true; // Mark as opened after first animation starts
    }, 50);

    if (opts.dateStr) {
        fetch(`/api/sunevents?lat=${navState?.lat || 51.48}&lon=${navState?.lon || 0.0}&tz=${encodeURIComponent(navState?.tz || 'Europe/London')}&date=${opts.dateStr}&name=${encodeURIComponent(navState?.locationName || '')}`)
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('sun-events-content');
                if (!el) return;
                if (data && data.text) el.innerHTML = formatSunEventsText(data.text);
                else el.textContent = 'No sun event data available.';
            })
            .catch(() => {
                const el = document.getElementById('sun-events-content');
                if (el) el.textContent = 'Error loading sun event data.';
            });
    } else {
        const el = document.getElementById('sun-events-content'); if (el) el.textContent = 'Invalid date.';
    }

    const closeBtn = panel.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = function() {
            // Start the closing animation
            panel.classList.remove('open');
            panel.classList.add('closing');

            // Wait for animation to complete before removing content
            setTimeout(() => {
                panel.classList.remove('closing');
                panel.classList.remove('open');
                if (cols) cols.classList.remove('two-col');
                setTimeout(() => {
                    panel.innerHTML = '';
                }, 50);
            }, 500);
        };
    }
}

// Make functions globally available
window.formatSunEventsText = formatSunEventsText;
window.openSidePanel = openSidePanel;
window.SUN_EVENTS_LOADING_TEXT = SUN_EVENTS_LOADING_TEXT;
