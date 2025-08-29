// Map Gregorian ISO date to Quantum month/day/year
function isoToCustomMonthDay(iso) {
    try {
        // Validate input
        if (!iso || typeof iso !== 'string') {
            console.warn('isoToCustomMonthDay: invalid ISO date input');
            return null;
        }

        // Check if astronomical data is available
        if (!navState || !navState.yearsData || !navState.yearsData.length) {
            console.warn('isoToCustomMonthDay: astronomical data not loaded');
            return null;
        }

        const d = new Date(iso + 'T00:00:00');

        // Validate the date object
        if (isNaN(d.getTime())) {
            console.warn('isoToCustomMonthDay: invalid date created from ISO string');
            return null;
        }

        // Note: The +1 adjustment accounts for the fact that custom calendar days
        // may start at dawn while Gregorian days start at midnight
        // This ensures proper alignment between calendar systems
        d.setDate(d.getDate() + 1);

        const ns = window.navState;
        if (!ns || !ns.yearsData || !ns.yearsData.length) {
            console.warn('isoToCustomMonthDay: navState not properly initialized');
            return null;
        }

        for (let y = 0; y < ns.yearsData.length; y++) {
            const months = ns.yearsData[y].months || [];
            for (let m = 0; m < months.length; m++) {
                const start = months[m].start ? new Date(months[m].start) : null;
                if (!start || isNaN(start.getTime())) continue;

                const nextStart = (m + 1 < months.length)
                    ? (months[m+1].start ? new Date(months[m+1].start) : null)
                    : (ns.yearsData[y+1] && ns.yearsData[y+1].months && ns.yearsData[y+1].months[0] && ns.yearsData[y+1].months[0].start ? new Date(ns.yearsData[y+1].months[0].start) : null);

                if (start <= d && (!nextStart || d < nextStart)) {
                    const dayNum = Math.floor((d - start) / (1000*60*60*24)) + 1;

                    // Validate day number is reasonable
                    if (dayNum < 1 || dayNum > 31) {
                        console.warn('isoToCustomMonthDay: calculated day number out of range:', dayNum);
                        continue;
                    }

                    const monthsInYear = months.map(mo => ({
                        days: mo.days && (mo.days === 29 || mo.days === 30) ? mo.days : 29 // Fallback to 29 if invalid
                    }));

                    return {
                        yearIdx: y,
                        monthNum: m + 1,
                        dayNum,
                        monthsInYear
                    };
                }
            }
        }

        console.warn('isoToCustomMonthDay: no quantum mapping found for Gregorian date:', iso);
        return null;
    } catch (e) {
        console.error('isoToCustomMonthDay error:', e);
        return null;
    }
}

// Hook for Gregorian grid: get special day classes for a Gregorian ISO date
window.getSpecialDayClassesForISO = function(iso) {
    try {
        // Check if data is loaded
        if (!navState || !navState.yearsData || !navState.yearsData.length) {
            console.warn('Special day mapping: astronomical data not loaded yet');
            return []; // Return empty array instead of failing silently
        }

        const mapped = isoToCustomMonthDay(iso);
        if (!mapped || !mapped.monthNum || !mapped.dayNum) {
            console.warn('Special day mapping: failed to map Gregorian date', iso);
            return []; // Return empty array for unmappable dates
        }

        let classes;
        if ('monthNum' in mapped && 'dayNum' in mapped && 'monthsInYear' in mapped) {
            classes = computeCustomSpecialClasses(mapped.monthNum, mapped.dayNum, mapped.monthsInYear);
        } else {
            classes = computeCustomSpecialClasses(mapped.month, mapped.day, mapped.year);
        }

        return classes || [];
    } catch (e) {
        console.error('getSpecialDayClassesForISO error:', e);
        return []; // Always return empty array on error
    }
};
// --- Silver Counter (Independent) ---
    // Always starts at 3rd month, 9th day (n=1) each year, increments for 50 days
    function getSilverCounter(mNum, dayNum, monthsInYear) {
        // Only months 3 and after can have the counter
        if (mNum < 3) return null;

        try {
            // Calculate absolute day in year using monthsInYear array if available (0-based)
            let absDay = 0;
            if (Array.isArray(monthsInYear) && monthsInYear.length > 0) {
                for (let i = 0; i < mNum - 1; i++) {
                    const monthDays = monthsInYear[i] && monthsInYear[i].days;
                    // Validate month days - must be whole number 29 or 30
                    if (monthDays && (monthDays === 29 || monthDays === 30)) {
                        absDay += monthDays;
                    } else {
                        console.warn(`getSilverCounter: Invalid month ${i+1} days: ${monthDays}, skipping calculation`);
                        return null; // Don't proceed with invalid data
                    }
                }
            } else {
                console.warn('getSilverCounter: monthsInYear not available');
                return null;
            }
            absDay += (dayNum - 1); // 0-based

            // 3rd month, 9th day (0-based)
            let silverStartAbsDay = 0;
            if (Array.isArray(monthsInYear) && monthsInYear.length >= 2) {
                for (let i = 0; i < 2; i++) {
                    const monthDays = monthsInYear[i] && monthsInYear[i].days;
                    if (monthDays && (monthDays === 29 || monthDays === 30)) {
                        silverStartAbsDay += monthDays;
                    } else {
                        console.warn(`getSilverCounter: Invalid month ${i+1} days for silver start: ${monthDays}`);
                        return null;
                    }
                }
            } else {
                console.warn('getSilverCounter: Cannot calculate silver start day');
                return null;
            }
            silverStartAbsDay += (9 - 1); // 0-based

            let n = absDay - silverStartAbsDay + 1;
            if (n >= 1 && n <= 50) {
                return n;
            }
            return null;
        } catch (e) {
            console.error('getSilverCounter error:', e);
            return null;
        }
    }
// Precompute holiday map for months 1-13 of a year
// Calendar JS logic
// State for expanded view

// Helper function to get Gregorian date for a custom calendar day
function getGregorianDateForCustomDay(monthNum, dayNum, yearLabel) {
    try {
        if (!navState || !navState.yearsData || !navState.yearsData.length) {
            return '';
        }

        // Find the current year object
        const currentYear = navState.yearsData[navState.currentYearIdx];
        if (!currentYear || !currentYear.months || !currentYear.months[monthNum - 1]) {
            return '';
        }

        const monthObj = currentYear.months[monthNum - 1];
        if (!monthObj.start) {
            return '';
        }

        // Calculate Gregorian date by adding days to the month start
        const startDate = new Date(monthObj.start);
        const gregorianDate = new Date(startDate);
        gregorianDate.setDate(gregorianDate.getDate() + (dayNum - 1));

        const mm = String(gregorianDate.getMonth() + 1).padStart(2, '0');
        const dd = String(gregorianDate.getDate()).padStart(2, '0');

        return `${mm}/${dd}`;
    } catch (e) {
        console.error('Error calculating Gregorian date for custom day:', e);
        return '';
    }
}

// Utility to create the calendar grid HTML
function renderCalendarGrid(monthNum, currentDay, daysInMonth, yearLabel, highlight, monthsInYear) {
    function getDayClass(isCurrentDay, dayNum) {
        let base = 'day-cell';
        let extra = '';
        // --- Special dark pink day: day after n=50 on silver counter ---
        let isDarkPink = false;
        // Find the absolute day for this cell
        let absDay = 0;
        if (Array.isArray(monthsInYear) && monthsInYear.length > 0) {
            for (let i = 0; i < monthNum - 1; i++) {
                const monthDays = monthsInYear[i] && monthsInYear[i].days;
                // Validate month days - must be whole number 29 or 30
                if (monthDays && (monthDays === 29 || monthDays === 30)) {
                    absDay += monthDays;
                } else {
                    console.warn(`renderCalendarGrid: Invalid month ${i+1} days: ${monthDays}, using fallback`);
                    // For display purposes, use 29 as safe fallback but log the issue
                    absDay += 29;
                }
            }
        } else {
            // Fallback calculation - use 29 as safe default for display
            absDay = (monthNum - 1) * 29;
        }
        absDay += dayNum;
        // Find the absolute day for the special pink day (day after n=50)
        let pinkStartAbsDay = 0;
        if (Array.isArray(monthsInYear) && monthsInYear.length >= 2) {
            for (let i = 0; i < 2; i++) {
                const monthDays = monthsInYear[i] && monthsInYear[i].days;
                if (monthDays && (monthDays === 29 || monthDays === 30)) {
                    pinkStartAbsDay += monthDays;
                } else {
                    console.warn(`renderCalendarGrid: Invalid month ${i+1} days for pink day: ${monthDays}`);
                    pinkStartAbsDay += 29; // Safe fallback for display
                }
            }
        } else {
            pinkStartAbsDay = 2 * 29; // Safe fallback
        }
        pinkStartAbsDay += 9 + 50; // day after n=50
        if (absDay === pinkStartAbsDay) {
            isDarkPink = true;
        }
        // --- 7th month special days ---
        if (isDarkPink) {
            extra = ' dark-pink-day';
        } else if (monthNum === 1 && dayNum === 14) {
            extra = ' ruby-red-day';
        } else if (monthNum === 1 && dayNum === 15) {
            extra = ' emerald-green-day';
        } else if (monthNum === 1 && dayNum === 16) {
            extra = ' orange-day';
        } else if (monthNum === 1 && dayNum >= 17 && dayNum <= 21) {
            extra = ' indigo-purple-day';
        } else if (monthNum === 7 && (dayNum === 15 || dayNum === 22)) {
            extra = ' emerald-green-day';
        } else if (monthNum === 7 && dayNum === 1) {
            extra = ' seventh-emerald-green-day seventh-orange-day';
        } else if (monthNum === 7 && (dayNum === 9 || dayNum === 10)) {
            extra = ' seventh-ruby-red-day seventh-orange-day';
        } else if (monthNum === 7 && (dayNum === 15 || dayNum === 22)) {
            extra = ' seventh-ruby-red-day seventh-orange-day seventh-pink-day';
        } else if (monthNum === 7 && dayNum >= 16 && dayNum <= 21) {
            extra = ' seventh-indigo-purple-day';
        } else if (dayNum === 1) {
            extra = ' gold-bronze-day';
        } else if ([8, 15, 22, 29].includes(dayNum)) {
            extra = ' royal-blue-day';
        }
        if (isCurrentDay) {
            return base + ' current-day' + extra;
        }
        return base + extra;
    }

    // --- Special Counter State ---
    // Only applies to 1st month and months after, for every year
    let showCounter = false;
    let counterN = null;
    if (monthNum === 1) {
        // Only start on 22nd day of 1st month
        showCounter = true;
        counterN = 1;
    } else if (monthNum > 1) {
        // For months after 1, counter may continue if n < 7
        showCounter = true;
        counterN = null; // will be set below
    }

    // Helper to get counter value for a given day
    function getCounter(dayNum) {
        if (!showCounter) return null;
        if (monthNum === 1) {
            if (dayNum < 22) return null;
            if (![22,29].includes(dayNum)) return null;
            return dayNum === 22 ? 1 : (dayNum === 29 ? 2 : null);
        } else {
            let nStart = 3 + (monthNum-2)*4;
            if ([8,15,22,29].includes(dayNum)) {
                let idx = [8,15,22,29].indexOf(dayNum);
                let n = nStart + idx;
                if (n > 7) return null;
                return n;
            }
            return null;
        }
    }

    let html = '<table class="calendar-grid">';
    let heading = `${monthNum}th Month`;
    if (yearLabel) heading += ` ${yearLabel}`;
    html += `<thead><tr><th colspan="7" class="month-label">${heading}</th></tr></thead><tbody>`;

    // Calculate the weekday index for the 1st day of the month (0=Sunday, 6=Saturday)
    // If you have a function to get this, use it. Otherwise, default to 6 (as before)
    let firstWeekday = 6; // Default: 1st day in last cell of first row
    let day = 1;
    let totalCells = Math.ceil((daysInMonth + firstWeekday) / 7) * 7;

    for (let cell = 0; cell < totalCells; cell++) {
        if (cell % 7 === 0) html += '<tr>';

        if (cell < firstWeekday || day > daysInMonth) {
            html += '<td class="empty-cell"></td>';
        } else {
            let isCurrent = highlight && currentDay === day;
            let counter = getCounter(day);
            let counterHtml = '';
            if (counter !== null) {
                counterHtml = ` <span class=\"bronze-counter\"> ${counter}</span>`;
            }
            let silverCounter = getSilverCounter(monthNum, day, monthsInYear);
            let silverHtml = '';
                if (silverCounter !== null) {
                    silverHtml = ` <span class="silver-counter">${silverCounter}</span>`;
                }
            // Moon phase emoji logic
            let emoji = '';
            if (day === 1 || day === 29 || day === 30) {
                emoji = '🌕';
            } else if (day === 8) {
                emoji = '🌗';
            } else if (day === 15) {
                emoji = '🌑';
            } else if (day === 22) {
                emoji = '🌓';
            }
            let emojiHtml = '';
            if (emoji) {
                emojiHtml = `<span class="calendar-emoji-bg">${emoji}</span>`;
            }
            html += `<td class="${getDayClass(isCurrent, day)}" data-day="${day}">${emojiHtml}<div class="dual-date-container"><span class="holiday-daynum">${day}</span><div class="gregorian-info">${getGregorianDateForCustomDay(monthNum, day, yearLabel)}</div></div>${counterHtml}${silverHtml}</td>`;
            day++;
        }

        if (cell % 7 === 6) html += '</tr>';
    }

    html += '</tbody></table>';
    return html;
}

function renderYearMonths(months, activeMonth, currentMonth, onMonthClick, yearRange, isCurrentYear) {
    // Debug: log months being rendered and compare to canonical navState months
    // renderYearMonths
    let html = '<div class="year-months-list">';
    html += `<h2 class="year-months-title">Schedule for ${yearRange || ''}</h2>`;
    html += '<h2 class="year-months-title">Days in the month may change if you change location. If average lunation is 29.53 days, then 53% of the world will have 30 days and 47% will have 29 days. That\'s what makes it "quantum"!</h2>';
    html += '<ul class="year-months-ul">';
     // Fix: add missing class
    months.forEach((m, i) => {
        const isActive = (i+1) === activeMonth;
        // Only highlight current month if we're in the current year
        const isCurrent = isCurrentYear && (i+1) === currentMonth;
        html += `<li class="year-months-li">`;
        html += `<a href="#" class="year-months-link${isActive ? ' active' : ''}${isCurrent ? ' current' : ''}" data-month="${i+1}">${i+1}th Month</a> <span class="year-months-days">${m.days} days</span>`;
        html += `</li>`;
    });
    html += '</ul></div>';
    setTimeout(() => {
        document.querySelectorAll('.year-months-link').forEach(link => {
            link.onclick = function(e) {
                e.preventDefault();
                const monthNum = parseInt(this.getAttribute('data-month'));
                if (onMonthClick) onMonthClick(monthNum);
            };
        });
    }, 0);
    return html;
}

// Dynamic current day calculation that accounts for calendar mode and boundaries
function getCurrentDayHighlight() {
    const now = new Date();

    if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
        // Gregorian mode: use Gregorian date
        return {
            month: now.getMonth() + 1, // 1-based
            day: now.getDate(),
            year: now.getFullYear(),
            isCurrent: true
        };
    } else {
        // Custom mode: use quantum calendar date (accounting for dawn boundary)
        if (navState.yearsData && navState.yearsData.length) {
            const found = findQuantumIndexForDate(now, navState.yearsData);
            if (found) {
                return {
                    month: found.monthIdx + 1, // 1-based
                    day: found.dayNum,
                    yearIdx: found.yearIdx,
                    isCurrent: true
                };
            }
        }
    }
    return null;
}

function updateCalendar(monthNum, currentDay, daysInMonth, monthsInYear, currentMonth, yearRange) {
    // Get dynamic current day highlight based on actual current date and calendar mode
    const currentHighlight = getCurrentDayHighlight();

    // Determine if this month should highlight the current day
    let dayToHighlight = null;
    let shouldHighlight = false;

    if (currentHighlight) {
        if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
            // Gregorian mode: highlight if this is the current Gregorian month
            shouldHighlight = (monthNum === currentHighlight.month && yearRange.includes(currentHighlight.year.toString()));
        } else {
            // Custom mode: highlight if this is the current custom month
            shouldHighlight = (monthNum === currentHighlight.month);
        }
        if (shouldHighlight) {
            dayToHighlight = currentHighlight.day;
        }
    }

    const root = document.getElementById('calendar-grid-root');
    let gridHtml = renderCalendarGrid(monthNum, dayToHighlight, daysInMonth, yearRange, shouldHighlight, monthsInYear);
    let monthsHtml = monthsInYear ? renderYearMonths(monthsInYear, monthNum, currentMonth || monthNum, function(selectedMonth) {
        // When a month is clicked, update grid for that month
        const m = monthsInYear[selectedMonth-1];
        // Recalculate highlight for the selected month
        const newHighlight = getCurrentDayHighlight();
        let newDayToHighlight = null;
        let newShouldHighlight = false;

        if (newHighlight) {
            if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
                newShouldHighlight = (selectedMonth === newHighlight.month);
            } else {
                newShouldHighlight = (selectedMonth === newHighlight.month);
            }
            if (newShouldHighlight) {
                newDayToHighlight = newHighlight.day;
            }
        }

        updateCalendar(selectedMonth, newDayToHighlight, m.days, monthsInYear, currentMonth, yearRange);
    }, yearRange) : '';
    root.innerHTML = gridHtml + monthsHtml;
    // Re-trigger pulse animation for current-day
    setTimeout(() => {
        document.querySelectorAll('.current-day').forEach(cell => {
            cell.style.animation = 'none';
            void cell.offsetWidth;
            cell.style.animation = 'current-pulse 1s ease-in-out infinite';
        });
    }, 0);
}


// --- Multi-year/month navigation state ---
// Use a single canonical navState on window so all handlers share the same reference
window.navState = window.navState || {
    lat: 51.48,
    lon: 0.0,
    tz: 'Europe/London',
    locationName: 'Greenwich, England',
    year: null, // e.g. 2025
    month: null, // 1-based
    yearsData: [], // multi-year data from backend
    currentYearIdx: 0, // index in yearsData
    currentMonthIdx: 0 // index in months array
};
let navState = window.navState;

// --- Data Loading Race Condition Prevention ---
// Global state for managing concurrent data loading
window.dataLoadingState = window.dataLoadingState || {
    isLoading: false,
    currentRequest: null,
    abortController: null,
    lastRequestParams: null,
    loadingCallbacks: new Set()
};

function showLoadingIndicator() {
    const gridRoot = document.getElementById('calendar-grid-root');
    if (gridRoot && !gridRoot.querySelector('.loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <div class="progress-text" id="progress-text">Loading astronomical data... 0%</div>
            </div>
        `;
        gridRoot.style.position = 'relative';
        gridRoot.appendChild(overlay);

        // Start progress simulation
        startProgressSimulation();
    }
}

function hideLoadingIndicator() {
    const gridRoot = document.getElementById('calendar-grid-root');
    if (gridRoot) {
        const overlay = gridRoot.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    // Clear any running progress interval
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
    }
}

function startProgressSimulation() {
    let progress = 0;
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (!progressFill || !progressText) return;

    // Clear any existing interval
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
    }

    window.progressInterval = setInterval(() => {
        // Simulate realistic loading progress
        if (progress < 30) {
            progress += Math.random() * 5; // Slow start
        } else if (progress < 70) {
            progress += Math.random() * 3; // Medium pace
        } else if (progress < 90) {
            progress += Math.random() * 1; // Slow down near end
        } else {
            progress = Math.min(95, progress + Math.random() * 0.5); // Very slow near completion
        }

        // Update progress bar and text
        const progressPercent = Math.min(95, Math.round(progress));
        progressFill.style.width = `${progressPercent}%`;
        progressText.textContent = `Loading astronomical data... ${progressPercent}%`;

        // Stop if we've reached 95% (will be completed by actual load)
        if (progress >= 95) {
            clearInterval(window.progressInterval);
            window.progressInterval = null;
        }
    }, 200); // Update every 200ms
}

function completeProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressFill && progressText) {
        progressFill.style.width = '100%';
        progressText.textContent = 'Loading astronomical data... 100%';

        // Clear interval if still running
        if (window.progressInterval) {
            clearInterval(window.progressInterval);
            window.progressInterval = null;
        }
    }
}

function cancelCurrentRequest() {
    const loadingState = window.dataLoadingState;
    if (loadingState.abortController) {
        console.log('Cancelling previous data loading request');
        loadingState.abortController.abort();
        loadingState.abortController = null;
        loadingState.currentRequest = null;
    }
    loadingState.isLoading = false;

    // Clear progress interval to prevent memory leaks
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
    }

    hideLoadingIndicator();
}

function isDuplicateRequest(lat, lon, tz, startYear, endYear) {
    const loadingState = window.dataLoadingState;
    const currentParams = { lat, lon, tz, startYear, endYear };

    if (!loadingState.lastRequestParams) return false;

    return (
        loadingState.lastRequestParams.lat === currentParams.lat &&
        loadingState.lastRequestParams.lon === currentParams.lon &&
        loadingState.lastRequestParams.tz === currentParams.tz &&
        loadingState.lastRequestParams.startYear === currentParams.startYear &&
        loadingState.lastRequestParams.endYear === currentParams.endYear
    );
}

function fetchMultiYearCalendar(lat, lon, tz, startYear, endYear, cb) {
    const loadingState = window.dataLoadingState;

    // Check for duplicate request
    if (isDuplicateRequest(lat, lon, tz, startYear, endYear)) {
        console.log('Duplicate request detected, skipping');
        if (cb && !loadingState.isLoading) {
            // If not currently loading, call callback immediately with existing data
            cb(navState.yearsData);
        }
        return;
    }

    // Cancel any existing request
    cancelCurrentRequest();

    // Create new abort controller
    loadingState.abortController = new AbortController();
    loadingState.isLoading = true;
    loadingState.lastRequestParams = { lat, lon, tz, startYear, endYear };

    // Show loading indicator
    showLoadingIndicator();

    console.log(`Fetching calendar data for ${lat}, ${lon}, ${tz} (${startYear}-${endYear})`);

    const url = `/api/multiyear-calendar?lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}&start_year=${startYear}&end_year=${endYear}`;

    loadingState.currentRequest = fetch(url, {
        signal: loadingState.abortController.signal
    })
    .then(r => {
        if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.json();
    })
    .then(data => {
        // Only process if this is still the current request
        if (loadingState.currentRequest && !loadingState.abortController.signal.aborted) {
            console.log(`Calendar data loaded successfully (${data.length} years)`);

            // Atomic state update
            const oldData = navState.yearsData;
            navState.yearsData = Array.isArray(data) && data.length > 0 ? data : [];

            // Update loading state
            loadingState.isLoading = false;
            loadingState.currentRequest = null;
            loadingState.abortController = null;

            // Complete progress bar
            completeProgress();

            // Hide loading indicator after a brief delay to show 100%
            setTimeout(() => {
                hideLoadingIndicator();
            }, 300);

            // Call original callback
            if (cb) {
                cb(navState.yearsData);
            }

            // Notify any waiting callbacks
            loadingState.loadingCallbacks.forEach(callback => {
                try {
                    callback(navState.yearsData);
                } catch (e) {
                    console.error('Error in loading callback:', e);
                }
            });
            loadingState.loadingCallbacks.clear();

            // Trigger calendar re-render if data changed
            if (JSON.stringify(oldData) !== JSON.stringify(navState.yearsData)) {
                console.log('Data changed, triggering calendar re-render');
                if (window.CalendarMode && window.CalendarMode.mode === 'custom') {
                    if (typeof updateMultiYearCalendarUI === 'function') {
                        updateMultiYearCalendarUI();
                    }
                } else {
                    renderCalendarForState();
                }
            }
        }
    })
    .catch(error => {
        // Only handle if this is still the current request
        if (loadingState.currentRequest && !loadingState.abortController.signal.aborted) {
            console.error('Error loading calendar data:', error);

            // Update loading state
            loadingState.isLoading = false;
            loadingState.currentRequest = null;
            loadingState.abortController = null;

            // Clear progress interval
            if (window.progressInterval) {
                clearInterval(window.progressInterval);
                window.progressInterval = null;
            }

            // Hide loading indicator
            hideLoadingIndicator();

            // Show error state
            showErrorState(error);

            // Call callback with empty data to prevent hanging
            if (cb) {
                cb([]);
            }
        } else if (error.name === 'AbortError') {
            console.log('Request was cancelled');
        }
    });
}

function showErrorState(error) {
    const gridRoot = document.getElementById('calendar-grid-root');
    if (gridRoot) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-state';
        errorDiv.innerHTML = `
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <div class="error-message">Failed to load astronomical data</div>
                <div class="error-details">${error.message}</div>
                <button class="retry-btn" onclick="retryDataLoad()">Retry</button>
            </div>
        `;
        errorDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(214, 48, 49, 0.1);
            border: 2px solid #d63031;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        gridRoot.style.position = 'relative';
        gridRoot.appendChild(errorDiv);
    }
}

function retryDataLoad() {
    // Remove error state
    const gridRoot = document.getElementById('calendar-grid-root');
    if (gridRoot) {
        const errorDiv = gridRoot.querySelector('.error-state');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    // Retry with current navState parameters
    const loadingState = window.dataLoadingState;
    if (loadingState.lastRequestParams) {
        fetchMultiYearCalendar(
            loadingState.lastRequestParams.lat,
            loadingState.lastRequestParams.lon,
            loadingState.lastRequestParams.tz,
            loadingState.lastRequestParams.startYear,
            loadingState.lastRequestParams.endYear,
            (data) => {
                // Re-render calendar with loaded data
                if (window.CalendarMode && window.CalendarMode.mode === 'custom') {
                    if (typeof updateMultiYearCalendarUI === 'function') {
                        updateMultiYearCalendarUI();
                    }
                } else {
                    renderCalendarForState();
                }
            }
        );
    }
}

// Enhanced renderCalendarForState with loading state awareness
function renderCalendarForState() {
    const isGreg = window.CalendarMode.mode === 'gregorian' && window.GregorianCalendar;
    const loadingState = window.dataLoadingState;

    if (isGreg) {
        const target = ensureFrameAndGetGridTarget();
        if (!target) return;

        // If data is loading, show loading state
        if (loadingState.isLoading) {
            showLoadingIndicator();
            return;
        }

        target.innerHTML = '';
        const ns = window.navState || (window.navState = {});

        // Ensure yearsData is loaded for mapping
        if (!ns.yearsData || !ns.yearsData.length) {
            // Use navState values or defaults for location and years
            const lat = ns.lat || 51.48;
            const lon = ns.lon || 0.0;
            const tz = ns.tz || 'Europe/London';
            const currentYear = ns.gYear || (new Date().getFullYear());
            // Fetch a wider range: 10 years before and after current year
            const startYear = 2000;
            const endYear = 2048;
            fetchMultiYearCalendar(lat, lon, tz, startYear, endYear, function(data) {
                // After loading, render Gregorian grid using synchronized position
                const today = new Date();
                const cl = clampGregorianYM(ns.gYear ?? today.getFullYear(), ns.gMonth ?? today.getMonth());
                ns.gYear = cl.y; ns.gMonth = cl.m;
                window.GregorianCalendar.render(target, cl.y, cl.m);
                rebindNavForGregorian();
            });
            return;
        }

        // Already loaded, render using synchronized position
        const today = new Date();
        const cl = clampGregorianYM(ns.gYear ?? today.getFullYear(), ns.gMonth ?? today.getMonth());
        ns.gYear = cl.y; ns.gMonth = cl.m;

        // Find quantum calendar months for current Gregorian year
        let monthsInYear = null;
        if (ns.yearsData && ns.yearsData.length) {
            // Find matching quantum year for Gregorian year
            const quantumYearObj = ns.yearsData.find(yobj => yobj.year === cl.y);
            if (quantumYearObj) {
                monthsInYear = quantumYearObj.months.map(m => ({ days: m.days }));
            }
        }

        // Pass monthsInYear to GregorianCalendar.render if possible
        if (window.GregorianCalendar.render.length >= 4) {
            window.GregorianCalendar.render(target, cl.y, cl.m, monthsInYear);
        } else {
            window.GregorianCalendar.render(target, cl.y, cl.m);
        }
        rebindNavForGregorian();
    } else {
        // Custom mode
        if (loadingState.isLoading) {
            showLoadingIndicator();
            return;
        }

        if (typeof updateMultiYearCalendarUI === 'function') {
            updateMultiYearCalendarUI();
        }
    }
}

// Helper: find quantum year/month index and day number for a given JS Date
function findQuantumIndexForDate(date, yearsData) {
    if (!date || !Array.isArray(yearsData) || !yearsData.length) return null;
    for (let y = 0; y < yearsData.length; y++) {
        const months = yearsData[y].months || [];
        for (let m = 0; m < months.length; m++) {
            const mo = months[m];
            if (!mo || !mo.start) continue;
            const start = new Date(mo.start);
            const nextStart = (m + 1 < months.length)
                ? (months[m+1].start ? new Date(months[m+1].start) : null)
                : (yearsData[y+1] && yearsData[y+1].months && yearsData[y+1].months[0] && yearsData[y+1].months[0].start ? new Date(yearsData[y+1].months[0].start) : null);
            if (start <= date && (!nextStart || date < nextStart)) {
                const dayNum = Math.floor((date - start) / (1000*60*60*24)) + 1;
                return { yearIdx: y, monthIdx: m, dayNum };
            }
        }
    }
    return null;
}

// Convert custom calendar position to Gregorian date
function customToGregorianDate(yearIdx, monthIdx, dayNum, yearsData) {
    try {
        if (!yearsData || !yearsData[yearIdx] || !yearsData[yearIdx].months || !yearsData[yearIdx].months[monthIdx]) {
            return null;
        }

        const monthObj = yearsData[yearIdx].months[monthIdx];
        if (!monthObj.start) return null;

        const startDate = new Date(monthObj.start);
        // Calculate Gregorian date by adding days to the month start
        const gregorianDate = new Date(startDate);
        gregorianDate.setDate(gregorianDate.getDate() + (dayNum - 1));

        return gregorianDate;
    } catch (e) {
        console.error('customToGregorianDate error:', e);
        return null;
    }
}

// Convert Gregorian date to custom calendar position
function gregorianToCustomDate(gregorianDate, yearsData) {
    if (!gregorianDate || !yearsData) return null;

    // Use existing findQuantumIndexForDate function
    const result = findQuantumIndexForDate(gregorianDate, yearsData);
    if (result) {
        return {
            yearIdx: result.yearIdx,
            monthIdx: result.monthIdx,
            dayNum: result.dayNum
        };
    }
    return null;
}

// Get Gregorian date string for a custom calendar day
function getGregorianDateForCustomDay(monthNum, dayNum, yearLabel) {
    try {
        if (!navState.yearsData || !navState.yearsData.length) {
            return '';
        }

        // Find the year object that matches the yearLabel
        const yearObj = navState.yearsData.find(y => {
            const yLabel = `${y.year}-${String(y.year+1).slice(-2)}`;
            return yLabel === yearLabel;
        });

        if (!yearObj || !yearObj.months || !yearObj.months[monthNum - 1]) {
            return '';
        }

        const monthObj = yearObj.months[monthNum - 1];
        if (!monthObj.start) {
            return '';
        }

        // Calculate Gregorian date by adding days to month start
        const startDate = new Date(monthObj.start);
        const gregorianDate = new Date(startDate);
        gregorianDate.setDate(gregorianDate.getDate() + (dayNum - 1));

        // Format as MM/DD
        const month = String(gregorianDate.getMonth() + 1).padStart(2, '0');
        const day = String(gregorianDate.getDate()).padStart(2, '0');

        return `${month}/${day}`;
    } catch (e) {
        console.error('getGregorianDateForCustomDay error:', e);
        return '';
    }
}

// Synchronize navigation state between custom and Gregorian modes
function syncNavigationState(fromMode, toMode) {
    if (!navState || !navState.yearsData || !navState.yearsData.length) {
        console.warn('Cannot sync navigation state: missing data');
        return;
    }

    try {
        if (fromMode === 'custom' && toMode === 'gregorian') {
            // Convert custom position to Gregorian
            const gregorianDate = customToGregorianDate(
                navState.currentYearIdx,
                navState.currentMonthIdx,
                1, // Use 1st day of month for navigation
                navState.yearsData
            );

            if (gregorianDate) {
                navState.gYear = gregorianDate.getFullYear();
                navState.gMonth = gregorianDate.getMonth();
                console.log('Synced custom -> Gregorian:', {
                    custom: { yearIdx: navState.currentYearIdx, monthIdx: navState.currentMonthIdx },
                    gregorian: { year: navState.gYear, month: navState.gMonth }
                });
            }
        } else if (fromMode === 'gregorian' && toMode === 'custom') {
            // Convert Gregorian position to custom
            const gregorianDate = new Date(navState.gYear, navState.gMonth, 1);
            const customPos = gregorianToCustomDate(gregorianDate, navState.yearsData);

            if (customPos) {
                navState.currentYearIdx = customPos.yearIdx;
                navState.currentMonthIdx = customPos.monthIdx;
                console.log('Synced Gregorian -> custom:', {
                    gregorian: { year: navState.gYear, month: navState.gMonth },
                    custom: { yearIdx: navState.currentYearIdx, monthIdx: navState.currentMonthIdx }
                });
            }
        }
    } catch (e) {
        console.error('Error syncing navigation state:', e);
    }
}

// Recalculate all month-dependent calculations when location changes
function recalculateMonthCalculations() {
    if (!navState || !navState.yearsData || !navState.yearsData.length) {
        console.warn('Cannot recalculate: missing astronomical data');
        return;
    }

    try {
        console.log('Recalculating month-dependent calculations for new location...');

        // The calculations will be automatically updated when the calendar re-renders
        // because all the functions (getSilverCounter, computeCustomSpecialClasses, etc.)
        // use the current navState.yearsData which has been updated with new location data

        // Force a re-render to update all calculations
        if (window.CalendarMode && window.CalendarMode.mode === 'custom') {
            updateMultiYearCalendarUI();
        } else {
            renderCalendarForState();
        }

        console.log('Month calculations recalculated for new location');
    } catch (e) {
        console.error('Error recalculating month calculations:', e);
    }
}

function renderNavButtons() {
    return `
    <div class="calendar-nav-btns" role="group" aria-label="Calendar navigation">
        <button id="prev-year-btn" aria-label="Previous year"><span class="icon"><<</span> </button>
        <button id="prev-month-btn" aria-label="Previous month"><span class="icon"><</span> </button>
        <button id="home-month-btn" class="home-btn" aria-label="Current month"><span class="icon">🏠</span></button>
        <button id="next-month-btn" aria-label="Next month"><span class="icon">></span> </button>
        <button id="next-year-btn" aria-label="Next year"><span class="icon">>></span> </button>
    </div>
    `;
}

function updateMultiYearCalendarUI() {
    const root = document.getElementById('calendar-grid-root');
    if (!navState.yearsData.length) return;
    const yearObj = navState.yearsData[navState.currentYearIdx];
    const months = yearObj.months;
    const monthObj = months[navState.currentMonthIdx];

    // Get dynamic current day highlight
    const currentHighlight = getCurrentDayHighlight();

    // Determine highlighting for current view
    let dayToHighlight = null;
    let shouldHighlight = false;

    if (currentHighlight) {
        if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
            // Gregorian mode: compare with Gregorian date
            const today = new Date();
            shouldHighlight = (navState.currentYearIdx === currentHighlight.yearIdx &&
                             navState.currentMonthIdx + 1 === currentHighlight.month);
            if (shouldHighlight) {
                dayToHighlight = currentHighlight.day;
            }
        } else {
            // Custom mode: compare with custom calendar position
            shouldHighlight = (navState.currentYearIdx === currentHighlight.yearIdx &&
                             navState.currentMonthIdx === currentHighlight.month - 1);
            if (shouldHighlight) {
                dayToHighlight = currentHighlight.day;
            }
        }
    }

    // Build year label for heading
    let yearLabel = `${yearObj.year}-${String(yearObj.year+1).slice(-2)}`;

    // Render grid and months list
    let gridHtml = renderCalendarGrid(
        navState.currentMonthIdx+1,
        dayToHighlight,
        monthObj.days,
        yearLabel,
        shouldHighlight,
        months.map(m => ({days: m.days}))
    );

    // Determine current month highlighting in months list
    let isCurrentYear = false;
    let realCurrentMonth = null;

    if (currentHighlight) {
        if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
            isCurrentYear = (navState.currentYearIdx === currentHighlight.yearIdx);
            realCurrentMonth = currentHighlight.month;
        } else {
            isCurrentYear = (navState.currentYearIdx === currentHighlight.yearIdx);
            realCurrentMonth = currentHighlight.month;
        }
    }

    let monthsHtml = renderYearMonths(
        months.map(m => ({days: m.days})),
        navState.currentMonthIdx+1,
        realCurrentMonth,
        function(selectedMonth) {
            navState.currentMonthIdx = selectedMonth-1;
            updateMultiYearCalendarUI();
        },
        yearLabel,
        isCurrentYear
    );
    let navBtns = renderNavButtons();
    // Insert side panel between grid and months list
    let sidePanelHtml = `<div id="side-panel" class="side-panel"></div>`;
    root.innerHTML = navBtns + `<div class="calendar-columns" id="calendar-columns"><div id="calendar-grid-anim">${gridHtml}</div>${sidePanelHtml}</div>` + monthsHtml;
    // Button handlers
    function animateGrid() {
        const gridAnim = document.getElementById('calendar-grid-anim');
        if (!gridAnim) return;
        gridAnim.classList.remove('fade-in');
        void gridAnim.offsetWidth; // force reflow
        gridAnim.classList.add('fade-in');
        setTimeout(() => {
            gridAnim.classList.remove('fade-in');
        }, 500);
    }

    // Re-bind navigation buttons after render
    const prevYearBtn = document.getElementById('prev-year-btn');
    const nextYearBtn = document.getElementById('next-year-btn');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const homeBtn = document.getElementById('home-month-btn');

    if (prevYearBtn) prevYearBtn.onclick = function() {
        if (navState.currentYearIdx > 0) {
            navState.currentYearIdx--;
            navState.currentMonthIdx = 0;
            updateMultiYearCalendarUI();
            setTimeout(() => animateGrid(), 0);
        }
    };

    if (nextYearBtn) nextYearBtn.onclick = function() {
        if (navState.currentYearIdx < navState.yearsData.length - 1) {
            navState.currentYearIdx++;
            navState.currentMonthIdx = 0;
            updateMultiYearCalendarUI();
            setTimeout(() => animateGrid(), 0);
        }
    };

    if (prevMonthBtn) prevMonthBtn.onclick = function() {
        if (navState.currentMonthIdx > 0) {
            navState.currentMonthIdx--;
            updateMultiYearCalendarUI();
            setTimeout(() => animateGrid(), 0);
        } else if (navState.currentYearIdx > 0) {
            navState.currentYearIdx--;
            navState.currentMonthIdx = navState.yearsData[navState.currentYearIdx].months.length - 1;
            updateMultiYearCalendarUI();
            setTimeout(() => animateGrid(), 0);
        }
    };

    if (nextMonthBtn) nextMonthBtn.onclick = function() {
        if (navState.currentMonthIdx < months.length - 1) {
            navState.currentMonthIdx++;
            updateMultiYearCalendarUI();
            setTimeout(() => animateGrid(), 0);
        } else if (navState.currentYearIdx < navState.yearsData.length - 1) {
            navState.currentYearIdx++;
            navState.currentMonthIdx = 0;
            updateMultiYearCalendarUI();
            setTimeout(() => animateGrid(), 0);
        }
    };

    if (homeBtn) homeBtn.onclick = function() {
        // Jump to real current month/year if found
        if (navState.yearsData && navState.yearsData.length) {
            const today = new Date();
            const foundIdx = findQuantumIndexForDate(today, navState.yearsData);
            if (foundIdx) {
                navState.currentYearIdx = foundIdx.yearIdx;
                navState.currentMonthIdx = foundIdx.monthIdx;
            } else {
                navState.currentYearIdx = 0; navState.currentMonthIdx = 0;
            }
            updateMultiYearCalendarUI();
            setTimeout(() => animateGrid(), 0);
        }
    };

    // Add click listeners to day cells for side panel
    setTimeout(() => {
        document.querySelectorAll('.calendar-grid td.day-cell').forEach(cell => {
            cell.onclick = function() {
                const cols = document.getElementById('calendar-columns');
                const day = this.getAttribute('data-day');
                const month = navState.currentMonthIdx + 1;
                const year = navState.yearsData[navState.currentYearIdx].year;
                const panel = document.getElementById('side-panel');
                if (panel) {
                    if (cols) cols.classList.add('two-col');
                    // Try to get the start date of the current month
                    let gregorianStr = '';
                    let weekdayStr = '';
                    let gregDate = null;
                    try {
                        const monthObj = navState.yearsData[navState.currentYearIdx].months[navState.currentMonthIdx];
                        if (monthObj && monthObj.start) {
                            // monthObj.start is ISO string for 1st day of month
                            let startDate = new Date(monthObj.start);
                            // Calculate the Gregorian date for the selected day
                            gregDate = new Date(startDate.getTime());
                            gregDate.setDate(gregDate.getDate() + (parseInt(day, 10) - 1));
                            const yyyy = gregDate.getFullYear();
                            const mm = String(gregDate.getMonth() + 1).padStart(2, '0');
                            const dd = String(gregDate.getDate()).padStart(2, '0');
                            const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                            weekdayStr = weekdays[gregDate.getDay()];
                            gregorianStr = `${yyyy}-${mm}-${dd} (${weekdayStr}) - Gregorian`;
                        }
                    } catch (e) {
                        gregorianStr = '';
                    }
                    panel.innerHTML = `
                        <button class="close-btn" aria-label="Close">&times;</button>
                        <h3 style="margin-top:0;color:#20639b;">Month ${month}, Day ${day}, ${year}-${String(year+1).slice(-2)}</h3>
                        <h3 style="margin:0 0 12px 0;color:#20639b;font-weight:normal;">${gregorianStr}</h3>
                        <div id="sun-events-content" style="color:#173f5f;">Loading sun events...</div>
                    `;
                    // Fetch sun events for this date/location
                    if (gregDate) {
                        const yyyy = gregDate.getFullYear();
                        const mm = String(gregDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(gregDate.getDate()).padStart(2, '0');
                        const dateStr = `${yyyy}-${mm}-${dd}`;
                        fetch(`/api/sunevents?lat=${navState.lat}&lon=${navState.lon}&tz=${encodeURIComponent(navState.tz)}&date=${dateStr}&name=${encodeURIComponent(navState.locationName || '')}`)
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
                    panel.classList.add('open');
                    // Close button handler
                    panel.querySelector('.close-btn').onclick = function() {
                        panel.classList.remove('open');
                        if (cols) cols.classList.remove('two-col');
                        setTimeout(() => { panel.innerHTML = ''; }, 350);
                    };
                }
            };
        });
        // Re-trigger pulse animation for current-day
        document.querySelectorAll('.current-day').forEach(cell => {
            cell.style.animation = 'none';
            void cell.offsetWidth;
            cell.style.animation = 'current-pulse 1s ease-in-out infinite';
        });
    }, 0);
}

// Helper to escape HTML and format sun events text with highlighted secondary tags
function formatSunEventsText(text) {
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    const escaped = escapeHtml(text);
    // Highlight (secondary: ...) in orange & bold
    const highlighted = escaped.replace(/\(secondary:\s*[^)]+\)/g, function(match) {
        return `<span class="secondary-tag">${match}</span>`;
    });
    return `<pre class="sun-events-pre">${highlighted}</pre>`;
}

// (initial DOMContentLoaded initializer removed; consolidated initializer will be added later)

// (removed duplicate calendar:update handler; consolidated handler appended at end)

// Delegate clicks as a fallback (in case bindings are lost after re-renders)
document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('#mode-custom, #mode-gregorian');
  if (!btn) return;
  e.preventDefault();

  const currentMode = window.CalendarMode.mode;
  const newMode = btn.id === 'mode-custom' ? 'custom' : 'gregorian';

  // Only proceed if mode is actually changing
  if (currentMode === newMode) return;

  // Sync navigation state before switching modes
  syncNavigationState(currentMode, newMode);

  // Update mode
  window.CalendarMode.mode = newMode;
  updateModeButtons();
  renderCalendarForState();
}, true);

// Global calendar mode
window.CalendarMode = window.CalendarMode || { mode: 'custom' };

function updateModeButtons() {
  const customBtn = document.getElementById('mode-custom');
  const gregBtn = document.getElementById('mode-gregorian');
  if (!customBtn || !gregBtn) return;
  const isGreg = window.CalendarMode.mode === 'gregorian';
  customBtn.setAttribute('aria-pressed', (!isGreg).toString());
  gregBtn.setAttribute('aria-pressed', (isGreg).toString());
  customBtn.classList.toggle('active', !isGreg);
  gregBtn.classList.toggle('active', isGreg);
}

// Expose functions globally for Gregorian calendar access
window.getSilverCounter = getSilverCounter;
window.isoToCustomMonthDay = isoToCustomMonthDay;

// Compute special classes for custom calendar using same rules as grid
function computeCustomSpecialClasses(monthNum, dayNum, monthsInYear) {
    const classes = [];

    // Validate inputs
    if (!monthNum || !dayNum || monthNum < 1 || monthNum > 13 || dayNum < 1 || dayNum > 31) {
        console.warn('computeCustomSpecialClasses: invalid month/day parameters', {monthNum, dayNum});
        return classes;
    }

    try {
        // Dark pink: day after n=50 on silver counter
        let absDay = 0;
        if (Array.isArray(monthsInYear) && monthsInYear.length > 0) {
            for (let i = 0; i < monthNum - 1; i++) {
                // Use actual month days with validation, fallback to 29 if invalid
                const monthDays = monthsInYear[i] && monthsInYear[i].days;
                if (monthDays && (monthDays === 29 || monthDays === 30)) {
                    absDay += monthDays;
                } else {
                    console.warn(`computeCustomSpecialClasses: Invalid month ${i+1} days: ${monthDays}, using fallback`);
                    absDay += 29; // Safe fallback for calculations
                }
            }
        } else {
            // Fallback: assume 29 days per month (safer than fractional)
            absDay = (monthNum - 1) * 29;
        }
        absDay += dayNum; // 1-based to absolute day

        let pinkStartAbsDay = 0;
        if (Array.isArray(monthsInYear) && monthsInYear.length >= 2) {
            for (let i = 0; i < 2; i++) {
                const monthDays = monthsInYear[i] && monthsInYear[i].days;
                if (monthDays && (monthDays === 29 || monthDays === 30)) {
                    pinkStartAbsDay += monthDays;
                } else {
                    console.warn(`computeCustomSpecialClasses: Invalid month ${i+1} days for pink start: ${monthDays}`);
                    pinkStartAbsDay += 29; // Safe fallback
                }
            }
        } else {
            pinkStartAbsDay = 2 * 29; // Safe fallback for first two months
        }
        pinkStartAbsDay += 9 + 50; // 3rd month 9th day + 50 days => next day

        const isDarkPink = (absDay === pinkStartAbsDay); // Exact match, no fractional comparison
        if (isDarkPink) classes.push('dark-pink-day');

        // Month-based specials (copied from renderCalendarGrid logic)
        if (!isDarkPink) {
            if (monthNum === 1 && dayNum === 14) classes.push('ruby-red-day');
            else if (monthNum === 1 && dayNum === 15) classes.push('emerald-green-day');
            else if (monthNum === 1 && dayNum === 16) classes.push('orange-day');
            else if (monthNum === 1 && dayNum >= 17 && dayNum <= 21) classes.push('indigo-purple-day');
            else if (monthNum === 7 && (dayNum === 15 || dayNum === 22)) classes.push('emerald-green-day');
            else if (monthNum === 7 && dayNum === 1) { classes.push('seventh-emerald-green-day','seventh-orange-day'); }
            else if (monthNum === 7 && (dayNum === 9 || dayNum === 10)) { classes.push('seventh-ruby-red-day','seventh-orange-day'); }
            else if (monthNum === 7 && (dayNum === 15 || dayNum === 22)) { classes.push('seventh-ruby-red-day','seventh-orange-day','seventh-pink-day'); }
            else if (monthNum === 7 && dayNum >= 16 && dayNum <= 21) classes.push('seventh-indigo-purple-day');
            else if (dayNum === 1) classes.push('gold-bronze-day');
            else if ([8,15,22,29].includes(dayNum)) classes.push('royal-blue-day');
        }

        return classes;
    } catch (e) {
        console.error('computeCustomSpecialClasses error:', e);
        return classes; // Return empty array on error
    }
}

// Override the placeholder to provide real mapping for Gregorian grid
// ...existing code...

function ensureFrameAndGetGridTarget() {
  // Ensure nav + columns frame exists so we can swap only the grid
  let target = document.getElementById('calendar-grid-anim');
  if (!target) {
    if (typeof updateMultiYearCalendarUI === 'function') {
      updateMultiYearCalendarUI();
      target = document.getElementById('calendar-grid-anim');
    }
  }
  return target || document.getElementById('calendar-grid-root');
}

const GREG_MIN = { y: 2000, m: 2 }; // 0-based month (2 = March)
const GREG_MAX = { y: 2049, m: 3 }; // 0-based month (3 = April)

function clampGregorianYM(y, m) {
  // normalize m first
  y += Math.floor(m / 12);
  m = (m % 12 + 12) % 12;
  // apply bounds
  if (y < GREG_MIN.y || (y === GREG_MIN.y && m < GREG_MIN.m)) {
    return { y: GREG_MIN.y, m: GREG_MIN.m };
  }
  if (y > GREG_MAX.y || (y === GREG_MAX.y && m > GREG_MAX.m)) {
    return { y: GREG_MAX.y, m: GREG_MAX.m };
  }
  return { y, m };
}

function renderCalendarForState() {
    const isGreg = window.CalendarMode.mode === 'gregorian' && window.GregorianCalendar;
    if (isGreg) {
        const target = ensureFrameAndGetGridTarget();
        if (!target) return;
        target.innerHTML = '';
        const ns = window.navState || (window.navState = {});

        // Ensure yearsData is loaded for mapping
        if (!ns.yearsData || !ns.yearsData.length) {
            // Use navState values or defaults for location and years
            const lat = ns.lat || 51.48;
            const lon = ns.lon || 0.0;
            const tz = ns.tz || 'Europe/London';
            const currentYear = ns.gYear || (new Date().getFullYear());
            // Fetch a wider range: 10 years before and after current year
            const startYear = 2000;
            const endYear = 2048;
            fetchMultiYearCalendar(lat, lon, tz, startYear, endYear, function(data) {
                ns.yearsData = data;
                // After loading, render Gregorian grid using synchronized position
                const today = new Date();
                const cl = clampGregorianYM(ns.gYear ?? today.getFullYear(), ns.gMonth ?? today.getMonth());
                ns.gYear = cl.y; ns.gMonth = cl.m;
                window.GregorianCalendar.render(target, cl.y, cl.m);
                rebindNavForGregorian();
            });
            return;
        }

        // Already loaded, render using synchronized position
        const today = new Date();
        const cl = clampGregorianYM(ns.gYear ?? today.getFullYear(), ns.gMonth ?? today.getMonth());
        ns.gYear = cl.y; ns.gMonth = cl.m;

        // Find quantum calendar months for current Gregorian year
        let monthsInYear = null;
        if (ns.yearsData && ns.yearsData.length) {
            // Find matching quantum year for Gregorian year
            const quantumYearObj = ns.yearsData.find(yobj => yobj.year === cl.y);
            if (quantumYearObj) {
                monthsInYear = quantumYearObj.months.map(m => ({ days: m.days }));
            }
        }

        // Pass monthsInYear to GregorianCalendar.render if possible
        if (window.GregorianCalendar.render.length >= 4) {
            window.GregorianCalendar.render(target, cl.y, cl.m, monthsInYear);
        } else {
            window.GregorianCalendar.render(target, cl.y, cl.m);
        }
        rebindNavForGregorian();
    } else {
        if (typeof updateMultiYearCalendarUI === 'function') {
            updateMultiYearCalendarUI();
        }
    }
}

function rebindNavForGregorian() {
  const ns = window.navState || (window.navState = {});
  const prevYearBtn = document.getElementById('prev-year-btn');
  const nextYearBtn = document.getElementById('next-year-btn');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');
  const homeBtn = document.getElementById('home-month-btn');

  function setOnClick(el, fn) { if (el) el.onclick = (e) => { e.preventDefault(); fn(); }; }

  function bumpMonth(delta) {
    const cl = clampGregorianYM((ns.gYear ?? new Date().getFullYear()), (ns.gMonth ?? new Date().getMonth()) + delta);
    ns.gYear = cl.y; ns.gMonth = cl.m;
    renderCalendarForState();
  }

  function bumpYear(delta) {
    const cl = clampGregorianYM((ns.gYear ?? new Date().getFullYear()) + delta, (ns.gMonth ?? new Date().getMonth()));
    ns.gYear = cl.y; ns.gMonth = cl.m;
    renderCalendarForState();
  }

  setOnClick(prevYearBtn, () => bumpYear(-1));
  setOnClick(nextYearBtn, () => bumpYear(+1));
  setOnClick(prevMonthBtn, () => bumpMonth(-1));
  setOnClick(nextMonthBtn, () => bumpMonth(+1));
  setOnClick(homeBtn, () => {
    const cl = clampGregorianYM(new Date().getFullYear(), new Date().getMonth());
    ns.gYear = cl.y; ns.gMonth = cl.m;
    renderCalendarForState();
  });
}

// (removed duplicate initializer and listener; consolidated handler is at the file end)

// Delegated click only for Gregorian mode
if (!window.__gregorianClickBound) {
  window.__gregorianClickBound = true;
  document.addEventListener('click', (e) => {
    if (window.CalendarMode.mode !== 'gregorian') return; // let custom handlers work
    const cell = e.target.closest('td.day-cell');
    if (!cell || !cell.dataset) return;
    const iso = cell.dataset.iso;
    if (!iso) return;
    const gregDate = new Date(iso + 'T00:00:00');
    if (typeof window.openSidePanelForDate === 'function') {
      window.openSidePanelForDate(gregDate, { mode: 'gregorian' });
    } else {
      // Minimal inline fallback: reuse existing pattern
      const cols = document.getElementById('calendar-columns');
      const panel = document.getElementById('side-panel');
      if (!panel) return;
      if (cols) cols.classList.add('two-col');
      const yyyy = gregDate.getFullYear();
      const mm = String(gregDate.getMonth() + 1).padStart(2, '0');
      const dd = String(gregDate.getDate()).padStart(2, '0');
      const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const weekdayStr = weekdays[gregDate.getDay()];
      const gregorianStr = `${yyyy}-${mm}-${dd} (${weekdayStr}) - Gregorian`;
      // For Gregorian mode, map Gregorian date to custom calendar for header
      const customMapping = isoToCustomMonthDay(iso);
      let month, year, yearRange;
      if (customMapping && customMapping.monthNum && customMapping.dayNum) {
        month = customMapping.monthNum;
        year = customMapping.yearIdx !== undefined && navState.yearsData ?
               navState.yearsData[customMapping.yearIdx]?.year : yyyy;
        yearRange = year ? `${year}-${String(year+1).slice(-2)}` : yyyy;
      } else {
        // Fallback to Gregorian if mapping fails
        month = gregDate.getMonth() + 1;
        year = gregDate.getFullYear();
        yearRange = year;
      }
      panel.innerHTML = `
        <button class="close-btn" aria-label="Close">&times;</button>
        <h3 style="margin-top:0;color:#20639b;">Month ${month}, Day ${customMapping?.dayNum || gregDate.getDate()}, ${yearRange}</h3>
        <h3 style="margin:0 0 12px 0;color:#20639b;font-weight:normal;">${gregorianStr}</h3>
        <div id="sun-events-content" style="color:#173f5f;">Loading sun events...</div>
      `;
      const dateStr = `${yyyy}-${mm}-${dd}`;
      fetch(`/api/sunevents?lat=${window.navState?.lat}&lon=${window.navState?.lon}&tz=${encodeURIComponent(window.navState?.tz || 'UTC')}&date=${dateStr}&name=${encodeURIComponent(window.navState?.locationName || '')}`)
        .then(r => r.json())
        .then(data => { const el = document.getElementById('sun-events-content'); if (!el) return; if (data && data.text) el.innerHTML = formatSunEventsText(data.text); else el.textContent = 'No sun event data available.'; })
        .catch(() => { const el = document.getElementById('sun-events-content'); if (el) el.textContent = 'Error loading sun event data.'; });
      panel.classList.add('open');
      panel.querySelector('.close-btn').onclick = function() { panel.classList.remove('open'); if (cols) cols.classList.remove('two-col'); setTimeout(() => { panel.innerHTML = ''; }, 350); };
    }
  });
}

// Re-render on content ready and data updates
// (consolidated init + calendar:update handler appended below)

// Consolidated initializer and calendar:update handler
document.addEventListener('DOMContentLoaded', function() {
    // Initialize navState
    const today = new Date();
    navState.year = today.getFullYear();
    navState.month = null;

    // Initial fetch with race condition prevention
    const loadingState = window.dataLoadingState;
    fetchMultiYearCalendar(navState.lat, navState.lon, navState.tz, 2000, 2048, function(data) {
        navState.yearsData = data;

        // Find today's month/year index using helper
        const foundIdx = findQuantumIndexForDate(today, data);
        if (foundIdx) {
            navState.currentYearIdx = foundIdx.yearIdx;
            navState.currentMonthIdx = foundIdx.monthIdx;
        } else {
            navState.currentYearIdx = 0; navState.currentMonthIdx = 0;
        }

        // Clamp Gregorian pointers
        let gYear = today.getFullYear(); let gMonth = today.getMonth();
        if (navState.yearsData && navState.yearsData.length) {
            const minYear = navState.yearsData[0].year; const maxYear = navState.yearsData[navState.yearsData.length-1].year;
            if (gYear < minYear) gYear = minYear; if (gYear > maxYear) gYear = maxYear;
        }
        navState.gYear = gYear; navState.gMonth = gMonth;

        // Only render if this callback is still relevant (not cancelled)
        if (!loadingState.isLoading) {
            renderCalendarForState();
            updateModeButtons();
        }
    });

    // Single calendar:update handler for location changes with race condition prevention
    window.addEventListener('calendar:update', function(e) {
        if (!e.detail) return;

        const { lat, lon, tz, name } = e.detail;

        // Handle timezone lookup if needed
        if (!tz) {
            fetch(`/api/timezone?lat=${lat}&lon=${lon}`)
                .then(r => r.json())
                .then(data => {
                    const timezone = data.tz || 'UTC';
                    window.dispatchEvent(new CustomEvent('calendar:update', {
                        detail: { lat, lon, tz: timezone, name }
                    }));
                })
                .catch(error => {
                    console.error('Timezone lookup failed:', error);
                    // Use UTC as fallback
                    window.dispatchEvent(new CustomEvent('calendar:update', {
                        detail: { lat, lon, tz: 'UTC', name }
                    }));
                });
            return;
        }

        // Update navState
        navState.lat = lat;
        navState.lon = lon;
        navState.tz = tz;
        if (name) navState.locationName = name;

        console.log(`Location changed to: ${name || `${lat}, ${lon}`}`);

        // Cancel any existing data loading
        cancelCurrentRequest();

        // Fetch new data with race condition prevention
        const today2 = new Date();
        fetchMultiYearCalendar(navState.lat, navState.lon, navState.tz, 2000, 2048, function(data) {
            navState.yearsData = data;

            const foundIdx2 = findQuantumIndexForDate(today2, data);
            if (foundIdx2) {
                navState.currentYearIdx = foundIdx2.yearIdx;
                navState.currentMonthIdx = foundIdx2.monthIdx;
            } else {
                navState.currentYearIdx = 0; navState.currentMonthIdx = 0;
            }

            try {
                navState.gYear = navState.yearsData[navState.currentYearIdx].year;
                navState.gMonth = navState.currentMonthIdx;
            } catch (e) {
                console.warn('Could not set Gregorian pointers:', e);
            }

            // Only render if this callback is still relevant
            const currentLoadingState = window.dataLoadingState;
            if (!currentLoadingState.isLoading) {
                renderCalendarForState();
                if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
                    document.dispatchEvent(new Event('gregorian:rendered'));
                }

                // Recalculate all month-dependent calculations for new location
                recalculateMonthCalculations();
            }
        });
    });
});

document.addEventListener('gregorian:rendered', () => { if (window.CalendarMode.mode === 'gregorian') rebindNavForGregorian(); });
// Also after custom renders, ensure nav works when switching
document.addEventListener('calendar:rendered', () => { if (window.CalendarMode.mode === 'gregorian') rebindNavForGregorian(); });
