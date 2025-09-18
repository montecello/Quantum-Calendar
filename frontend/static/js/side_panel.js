// side_panel.js - Handles all side panel functionality

// Constants
const SUN_EVENTS_LOADING_TEXT = 'Loading sun events...';

// Flag to track if side panel has been opened before
let sidePanelOpened = false;

// Special day mapping for side panel display
const SPECIAL_DAY_INFO = {
    'hot-pink-day': {
        text: 'Festival of Weeks',
        colors: ['#ff1493', '#ff69b4']
    },
    'ruby-red-day': {
        text: 'Festival of Wonders',
        colors: ['#e0115f', '#b22234']
    },
    'emerald-green-day': {
        text: 'Festival of Sweet Things + Rest',
        colors: ['#50c878', '#228b22']
    },
    'orange-day': {
        text: 'First Fruits',
        colors: ['#ff9800', '#ffb347']
    },
    'indigo-purple-day': {
        text: 'Festival of Sweet Things',
        colors: ['#6a5acd', '#8e24aa']
    },
    'seventh-emerald-green-day': {
        text: 'Festival of Memories',
        colors: ['#228b22', '#006400']
    },
    'seventh-orange-day': {
        text: 'Festival of Memories',
        colors: ['#ff8c00', '#cc5500']
    },
    'Forgiveness-magenta-day': {
        text: 'Festival of Forgiveness',
        colors: ['#ff00ff', '#cc00cc']
    },
    'seventh-ruby-red-day': {
        text: 'Festival of Covering + Rest',
        colors: ['#e0115f', '#b22234']
    },
    'seventh-pink-day': {
        text: 'Festival of Covering + Rest',
        colors: ['#ffb7c5', '#ff69b4']
    },
    'seventh-indigo-purple-day': {
        text: 'Festival of Covering',
        colors: ['#6a5acd', '#8e24aa']
    },
    'gold-bronze-day': {
        text: 'New Moon Day',
        colors: ['#8b6914', '#654321']
    },
    'royal-blue-day': {
        text: '7th Day Rest',
        colors: ['#4169e1', '#27408b']
    }
};

// Store current context for month-specific logic
let currentPanelContext = { month: null, day: null };

function getCurrentMonthContext() {
    return currentPanelContext.month;
}

// Function to get special day information from a calendar cell
function getSpecialDayInfo(monthNum, dayNum, clickedCell = null) {
    console.log('getSpecialDayInfo called with:', { monthNum, dayNum, clickedCell });
    
    let matchingCell = clickedCell;
    
    // If clicked cell is provided, use it directly
    if (matchingCell) {
        console.log('Using provided clicked cell:', matchingCell);
        console.log('Clicked cell classes:', Array.from(matchingCell.classList));
    }
    
    // If no clicked cell provided, try to find the calendar cell that matches this month and day
    if (!matchingCell) {
        const cells = document.querySelectorAll('.calendar-grid td.day-cell');
        
        // Check if we're in Gregorian mode
        const isGregorianMode = window.CalendarMode && window.CalendarMode.mode === 'gregorian';
        
        console.log(`Looking for day ${dayNum} in mode: ${isGregorianMode ? 'gregorian' : 'custom'}`);
        
        if (isGregorianMode) {
            // For Gregorian mode, find the cell that was actually clicked
            // We'll look for cells with the right day number and check if any have special classes
            const candidateCells = [];
            for (const cell of cells) {
                const daySpan = cell.querySelector('.holiday-daynum');
                if (daySpan && parseInt(daySpan.textContent) == dayNum) {
                    candidateCells.push(cell);
                }
            }
            
            console.log(`Found ${candidateCells.length} candidate cells for day ${dayNum}`);
            
            // If we have multiple candidates, prefer one with special classes or counters
            if (candidateCells.length > 0) {
                // First try to find one with special day classes
                for (const cell of candidateCells) {
                    const hasSpecialClass = Object.keys(SPECIAL_DAY_INFO).some(className => 
                        cell.classList.contains(className));
                    if (hasSpecialClass) {
                        matchingCell = cell;
                        break;
                    }
                }
                // If no special classes found, try to find one with counters
                if (!matchingCell) {
                    for (const cell of candidateCells) {
                        const hasCounters = cell.querySelector('.bronze-counter, .silver-counter');
                        if (hasCounters) {
                            matchingCell = cell;
                            break;
                        }
                    }
                }
                // Otherwise, just use the first candidate
                if (!matchingCell) {
                    matchingCell = candidateCells[0];
                }
            }
        } else {
            // For custom mode, use data-day attribute
            for (const cell of cells) {
                if (cell.getAttribute('data-day') == dayNum) {
                    matchingCell = cell;
                    break;
                }
            }
        }
    }
    
    if (!matchingCell) {
        console.log('No matching cell found for day:', dayNum);
        return null;
    }
    
    console.log('Found matching cell:', matchingCell);
    
    // Check for special day classes
    const specialClasses = [];
    for (const className of Object.keys(SPECIAL_DAY_INFO)) {
        if (matchingCell.classList.contains(className)) {
            specialClasses.push(className);
        }
    }
    
    // Get counter values
    const bronzeCounter = matchingCell.querySelector('.bronze-counter');
    const silverCounter = matchingCell.querySelector('.silver-counter');
    
    const result = {
        classes: specialClasses,
        bronzeCount: bronzeCounter ? parseInt(bronzeCounter.textContent.trim()) : null,
        silverCount: silverCounter ? parseInt(silverCounter.textContent.trim()) : null
    };
    
    console.log(`Day ${dayNum} special info:`, result);
    console.log('All cell classes:', Array.from(matchingCell.classList));
    
    return result;
}

// Function to create special day HTML with gradient background and pulsing effect
function createSpecialDayHtml(specialInfo) {
    // Handle silver-only days (no special day classes but has silver counter)
    if ((!specialInfo || !specialInfo.classes || specialInfo.classes.length === 0) && 
        specialInfo && specialInfo.silverCount !== null) {
        return `
            <div class="special-day-info silver-only" style="background: linear-gradient(135deg, #888a8a 70%, #666666 100%);">
                <span class="special-day-text silver-counter-text">${specialInfo.silverCount} of 50</span>
            </div>
        `;
    }
    
    if (!specialInfo || !specialInfo.classes || specialInfo.classes.length === 0) return '';
    
    const specialClasses = specialInfo.classes;
    
    // Priority order for multiple special classes (most important first)
    const priorityOrder = [
        'Forgiveness-magenta-day',
        'hot-pink-day',
        'seventh-ruby-red-day',      // Moved higher for 7th month days 15/22
        'seventh-pink-day',          // Moved higher for 7th month days 15/22
        'seventh-orange-day',        
        'seventh-emerald-green-day', 
        'seventh-indigo-purple-day',
        'ruby-red-day',
        'emerald-green-day',         // Moved lower so 7th month takes priority
        'orange-day',
        'indigo-purple-day',
        'gold-bronze-day',
        'royal-blue-day'
    ];
    
    // Find the highest priority class
    let primaryClass = null;
    for (const priority of priorityOrder) {
        if (specialClasses.includes(priority)) {
            primaryClass = priority;
            break;
        }
    }
    
    // Fallback to first class if no priority match
    if (!primaryClass) {
        primaryClass = specialClasses[0];
    }
    
    console.log('Selected primary class:', primaryClass);
    console.log('Available special classes:', specialClasses);
    
    const info = SPECIAL_DAY_INFO[primaryClass];
    
    if (!info) {
        console.log('No info found for class:', primaryClass);
        return '';
    }
    
    // Handle special text formatting for royal-blue-day with bronze counter
    let displayText = info.text;
    if (primaryClass === 'royal-blue-day' && specialInfo.bronzeCount !== null) {
        displayText = `7th Day Rest <span class="bronze-counter-text">(${specialInfo.bronzeCount} of 7)</span>`;
    }
    
    // Handle context-specific emerald-green-day text based on month
    if (primaryClass === 'emerald-green-day') {
        // Get month info from the side panel function call context
        const monthFromContext = getCurrentMonthContext();
        if (monthFromContext === 7) {
            displayText = 'Festival of Covering + Rest';
        } else if (monthFromContext === 1) {
            displayText = 'Festival of Sweet Things + Rest';
        }
    }
    
    // Handle special case for 1st day of 1st month
    if (primaryClass === 'gold-bronze-day') {
        const monthFromContext = getCurrentMonthContext();
        const dayFromContext = currentPanelContext.day;
        if (monthFromContext === 1 && dayFromContext === 1) {
            displayText = 'New Year\'s Day';
        }
    }
    
    // Add silver counter for New Moon Day or 7th Day Rest
    if ((primaryClass === 'gold-bronze-day' || primaryClass === 'royal-blue-day') && 
        specialInfo.silverCount !== null) {
        if (primaryClass === 'gold-bronze-day') {
            displayText = `New Moon Day <span class="silver-counter-text">(${specialInfo.silverCount} of 50)</span>`;
        } else if (primaryClass === 'royal-blue-day') {
            // Add silver counter after bronze counter if both exist
            if (specialInfo.bronzeCount !== null) {
                displayText = `7th Day Rest <span class="bronze-counter-text">(${specialInfo.bronzeCount} of 7)</span> <span class="silver-counter-text">(${specialInfo.silverCount} of 50)</span>`;
            } else {
                displayText = `7th Day Rest <span class="silver-counter-text">(${specialInfo.silverCount} of 50)</span>`;
            }
        }
    }
    
    console.log('Using info:', info);
    console.log('Display text:', displayText);
    
    const gradientStyle = `background: linear-gradient(135deg, ${info.colors[0]} 70%, ${info.colors[1]} 100%);`;
    
    return `
        <div class="special-day-info" style="${gradientStyle}">
            <span class="special-day-text">${displayText}</span>
        </div>
    `;
}

// Format sun events text for display in the side panel
function formatSunEventsText(text) {
    if (!text) return '';

    // Split into lines and process each line
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
        // Replace -> with right arrow emoji
        line = line.replace(/->/g, '→');
        
        // Highlight secondary tags (nautical, civil, etc.) in orange
        if (line.includes('(secondary:')) {
            return line.replace(/\(secondary: ([^)]+)\)/, '<span class="secondary-tag">(secondary: $1)</span>');
        }
        return line;
    });

    // Join lines back and wrap in pre tag
    return `<pre class="sun-events-pre">${formattedLines.join('\n')}</pre>`;
}

// Helper to open day info popup and load sun events. Replaces the old side panel.
function openSidePanel(panel, cols, opts) {
    // Redirect to the new popup function
    openDayInfoPopup(opts);
}

// New popup-based day info function
function openDayInfoPopup(opts) {
    const overlay = document.getElementById('day-info-popup-overlay');
    const popup = document.querySelector('.day-info-popup');
    const title = document.getElementById('day-info-title');
    const subtitle = document.getElementById('day-info-subtitle');
    const content = document.getElementById('day-info-content');
    
    if (!overlay || !popup || !title || !subtitle || !content) return;

    
    const month = opts.month || '';
    const day = opts.day || '';
    const yearRange = opts.yearRange || '';
    const gregorianStr = opts.gregorianStr || '';
    const clickedCell = opts.clickedCell || null;

    // Set context for month-specific logic
    currentPanelContext = { month: parseInt(month), day: parseInt(day) };

    // Update popup content
    title.textContent = `Month ${month}, Day ${day}, ${yearRange}`;
    subtitle.textContent = gregorianStr;
    content.innerHTML = SUN_EVENTS_LOADING_TEXT;

    // Get special day information
    const specialInfo = getSpecialDayInfo(month, day, clickedCell);
    const specialDayHtml = createSpecialDayHtml(specialInfo);
    
    if (specialDayHtml) {
        content.innerHTML = specialDayHtml + '<div id="sun-events-content" style="margin-top: 20px;">' + SUN_EVENTS_LOADING_TEXT + '</div>';
    } else {
        content.innerHTML = '<div id="sun-events-content">' + SUN_EVENTS_LOADING_TEXT + '</div>';
    }

    // Show the popup
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Handle special day info for Gregorian mode
    const isGregorianMode = window.CalendarMode && window.CalendarMode.mode === 'gregorian';
    if (isGregorianMode && clickedCell) {
        setTimeout(() => {
            const updatedSpecialInfo = getSpecialDayInfo(month, day, clickedCell);
            const updatedSpecialDayHtml = createSpecialDayHtml(updatedSpecialInfo);
            
            if (updatedSpecialDayHtml) {
                const sunEventsDiv = document.getElementById('sun-events-content');
                if (sunEventsDiv) {
                    content.innerHTML = updatedSpecialDayHtml + '<div id="sun-events-content" style="margin-top: 20px;">' + SUN_EVENTS_LOADING_TEXT + '</div>';
                }
            }
        }, 100);
    }
    
    // Load sun events data

    if (opts.dateStr) {
        fetch(`/api/sunevents?lat=${navState?.lat || 51.48}&lon=${navState?.lon || 0.0}&tz=${encodeURIComponent(navState?.tz || 'Europe/London')}&date=${opts.dateStr}&name=${encodeURIComponent(navState?.locationName || '')}`)
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('sun-events-content');
                if (!el) return;
                if (data && data.text) {
                    el.innerHTML = formatSunEventsText(data.text);
                } else {
                    el.textContent = 'No sun event data available.';
                }
            })
            .catch(() => {
                const el = document.getElementById('sun-events-content');
                if (el) el.textContent = 'Error loading sun event data.';
            });
    } else {
        const el = document.getElementById('sun-events-content'); 
        if (el) el.textContent = 'Invalid date.';
    }
}

// Make functions globally available
window.formatSunEventsText = formatSunEventsText;
window.openSidePanel = openSidePanel;
window.SUN_EVENTS_LOADING_TEXT = SUN_EVENTS_LOADING_TEXT;
