// Helper function for fallback day number calculation
function calculateFallbackDayNumber(gregorianDate, monthStart, monthDays) {
    try {
        if (!gregorianDate || !monthStart) {
            console.warn('calculateFallbackDayNumber: missing date parameters');
            return 1;
        }

        const msSinceMonthStart = gregorianDate - monthStart;
        const daysSinceMonthStart = Math.floor(msSinceMonthStart / (1000 * 60 * 60 * 24));

        // Ensure we don't go below 1 or above the maximum days in month
        const maxDays = monthDays || 30; // Default to 30 if not specified
        const dayNum = Math.min(Math.max(1, daysSinceMonthStart + 1), maxDays);

    // calculation complete

        // Additional validation
        if (dayNum < 1 || dayNum > 31) {
            console.warn('calculateFallbackDayNumber: calculated day number out of valid range:', dayNum);
            return 1; // Safe fallback
        }

        return dayNum;
    } catch (e) {
        console.warn('calculateFallbackDayNumber: error in calculation:', e);
        return 1; // Safe fallback
    }
}

// Convert Gregorian ISO date to custom calendar position
async function isoToCustomMonthDay(iso) {
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

        // Parse ISO 'YYYY-MM-DD' timezone-agnostically by constructing a UTC date at noon.
        // Noon avoids accidental day-rollover when converting between zones.
        const parts = iso.split('-');
        if (parts.length < 3) {
            console.warn('isoToCustomMonthDay: invalid ISO format');
            return null;
        }
    const isoY = parseInt(parts[0], 10);
    const isoM = parseInt(parts[1], 10);
    const isoD = parseInt(parts[2], 10);
        if (isNaN(isoY) || isNaN(isoM) || isNaN(isoD)) {
            console.warn('isoToCustomMonthDay: invalid ISO numeric parts');
            return null;
        }
        // Use UTC noon to make the date stable across client timezones
    const locationAdjustedDate = new Date(Date.UTC(isoY, isoM - 1, isoD, 12, 0, 0));

        // Validate the adjusted date object
        if (isNaN(locationAdjustedDate.getTime())) {
            console.warn('isoToCustomMonthDay: invalid date created from adjusted ISO string');
            return null;
        }

        const d = locationAdjustedDate;

        // REMOVED: The +1 adjustment was incorrect and caused wrong day mappings
        // Custom calendar days should be calculated based on actual astronomical events,
        // not arbitrary Gregorian date offsets

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
                    // Use dawn-aware calculation if possible
                    let dayNum;
                    // Prefer dawn-aware calculation when dawn info is available; otherwise fallback
                    let dawnInfo = null;
                    try {
                        if (typeof fetchCurrentDawnInfo === 'function') {
                            dawnInfo = await fetchCurrentDawnInfo().catch(() => null);
                        }
                    } catch (e) { dawnInfo = null; }

                    if (dawnInfo) {
                        dayNum = calculateDawnBasedDayNumber(d, start, nextStart, dawnInfo);
                    } else {
                        dayNum = calculateFallbackDayNumber(d, start, months[m].days);
                    }
                    // Validate day number is reasonable
                    if (dayNum < 1 || dayNum > 31) {
                        console.warn('isoToCustomMonthDay: calculated day number out of range:', dayNum);
                        continue;
                    }

                    const monthsInYear = months.map(mo => ({ days: (mo && mo.days && (mo.days === 29 || mo.days === 30)) ? mo.days : 29 }));
                    return { yearIdx: y, monthNum: m + 1, dayNum, monthsInYear };
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
window.getSpecialDayClassesForISO = async function(iso) {
    try {
        // Check if data is loaded
        if (!navState || !navState.yearsData || !navState.yearsData.length) {
            console.warn('Special day mapping: astronomical data not loaded yet');
            return []; // Return empty array instead of failing silently
        }

        // Validate location data is current
        if (!navState.lat || !navState.lon || !navState.tz) {
            console.warn('Special day mapping: location data incomplete, using defaults');
        }

        const mapped = await isoToCustomMonthDay(iso);
        if (!mapped || !mapped.monthNum || !mapped.dayNum) {
            // Mapping unavailable for this ISO; return empty classes silently.
            // This commonly happens when navState.yearsData hasn't been loaded
            // or the date is outside the available range.
            return [];
        }

        let classes;
        if ('monthNum' in mapped && 'dayNum' in mapped && 'monthsInYear' in mapped) {
            classes = computeCustomSpecialClasses(mapped.monthNum, mapped.dayNum, mapped.monthsInYear);
        } else {
            // Older mapping shape provides month/day/year. Ensure we pass a monthsInYear
            // array (or null) as the third parameter so computeCustomSpecialClasses
            // uses its fallback instead of receiving a numeric year.
            const monthsInYear = mapped.monthsInYear || (Array.isArray(window.navState?.yearsData) ? (window.navState.yearsData.find(y => y.year === mapped.year)?.months?.map(m => m.days) || null) : null);
            classes = computeCustomSpecialClasses(mapped.month, mapped.day, monthsInYear);
        }

        // Log successful mapping for debugging
    // return computed classes (silent success)

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
    let html = '<div class="year-months-list accordion">';
    html += '<div class="accordion-item">';
    html += `<button class="accordion-header year-months-title" type="button" aria-expanded="true">`;
    html += `<span class="accordion-icon">▼</span>`;
    html += `<span>Schedule for ${yearRange || ''}</span>`;
    html += `</button>`;
    html += '<div class="accordion-panel" style="display: block;">';
    html += `<h3 class="year-months-title">${navState.locationName || 'Unknown Location'}</h3>`;
    html += '<h4 class="year-months-title">Days in the month may change by location because current lunation is not exactly 30 days.</h4>';
    html += '<ul class="year-months-ul accordion-content">';
     // Fix: add missing class
    months.forEach((m, i) => {
        const isActive = (i+1) === activeMonth;
        // Only highlight current month if we're in the current year
        const isCurrent = isCurrentYear && (i+1) === currentMonth;
        html += `<li class="year-months-li">`;
        html += `<a href="#" class="year-months-link${isActive ? ' active' : ''}${isCurrent ? ' current' : ''}" data-month="${i+1}">${i+1}th Month</a> <span class="year-months-days">${m.days} days</span>`;
        html += `</li>`;
    });
    html += '</ul></div></div></div>';
    setTimeout(() => {
        // Add accordion toggle functionality
        const header = document.querySelector('.year-months-title.accordion-header');
        const panel = document.querySelector('.accordion-panel');
        const icon = document.querySelector('.accordion-icon');

        if (header && panel && icon) {
            header.addEventListener('click', function() {
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', !isExpanded);
                panel.style.display = isExpanded ? 'none' : 'block';
                icon.textContent = isExpanded ? '▶' : '▼';
            });
        }

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
        // Gregorian mode: use location's current time for consistency
        if (navState.yearsData && navState.yearsData.length) {
            console.log('getCurrentDayHighlight: Gregorian mode using location time');
            return new Promise((resolve) => {
                fetchCurrentDawnInfo().then(dawnInfo => {
                    if (dawnInfo && dawnInfo.current_time) {
                        const locationCurrentDate = new Date(dawnInfo.current_time);
                        console.log('getCurrentDayHighlight: Gregorian using location time:', locationCurrentDate.toISOString());
                        resolve({
                            month: locationCurrentDate.getMonth() + 1, // 1-based
                            day: locationCurrentDate.getDate(),
                            year: locationCurrentDate.getFullYear(),
                            isCurrent: true
                        });
                    } else {
                        console.log('getCurrentDayHighlight: Gregorian fallback to local time');
                        resolve({
                            month: now.getMonth() + 1, // 1-based
                            day: now.getDate(),
                            year: now.getFullYear(),
                            isCurrent: true
                        });
                    }
                }).catch((error) => {
                    console.warn('getCurrentDayHighlight: Gregorian fetch error:', error);
                    resolve({
                        month: now.getMonth() + 1, // 1-based
                        day: now.getDate(),
                        year: now.getFullYear(),
                        isCurrent: true
                    });
                });
            });
        } else {
            // Fallback to local time if no years data
            return {
                month: now.getMonth() + 1, // 1-based
                day: now.getDate(),
                year: now.getFullYear(),
                isCurrent: true
            };
        }
    } else {
        // Custom mode: use quantum calendar date (accounting for dawn boundary)
        if (navState.yearsData && navState.yearsData.length) {
            console.log('getCurrentDayHighlight: starting dawn-based calculation');
            // First, determine if we're before or after today's dawn
            return new Promise((resolve) => {
                fetchCurrentDawnInfo().then(dawnInfo => {
                    console.log('getCurrentDayHighlight: dawn info received:', dawnInfo);
                    if (dawnInfo && dawnInfo.current_time) {
                        // Use location's current time instead of local time
                        const locationCurrentDate = new Date(dawnInfo.current_time);
                        console.log('getCurrentDayHighlight: using location time:', locationCurrentDate.toISOString());
                        const found = findQuantumIndexForDate(locationCurrentDate, navState.yearsData, dawnInfo);
                        console.log('getCurrentDayHighlight: quantum index found:', found);
                        if (found) {
                            const result = {
                                month: found.monthIdx + 1, // 1-based
                                day: found.dayNum,
                                yearIdx: found.yearIdx,
                                isCurrent: true
                            };
                            console.log('getCurrentDayHighlight: resolved with:', result);
                            resolve(result);
                        } else {
                            console.log('getCurrentDayHighlight: no quantum index found, resolving null');
                            resolve(null);
                        }
                    } else {
                        console.log('getCurrentDayHighlight: no dawn info, using fallback with local time');
                        // Fallback to local time if dawn info unavailable
                        const found = findQuantumIndexForDate(now, navState.yearsData);
                        console.log('getCurrentDayHighlight: fallback quantum index found:', found);
                        if (found) {
                            const result = {
                                month: found.monthIdx + 1, // 1-based
                                day: found.dayNum,
                                yearIdx: found.yearIdx,
                                isCurrent: true
                            };
                            console.log('getCurrentDayHighlight: fallback resolved with:', result);
                            resolve(result);
                        } else {
                            console.log('getCurrentDayHighlight: fallback failed, resolving null');
                            resolve(null);
                        }
                    }
                }).catch((error) => {
                    console.warn('getCurrentDayHighlight: fetch error:', error);
                    // Fallback on error
                    const found = findQuantumIndexForDate(now, navState.yearsData);
                    console.log('getCurrentDayHighlight: error fallback quantum index found:', found);
                    if (found) {
                        const result = {
                            month: found.monthIdx + 1, // 1-based
                            day: found.dayNum,
                            yearIdx: found.yearIdx,
                            isCurrent: true
                        };
                        console.log('getCurrentDayHighlight: error fallback resolved with:', result);
                        resolve(result);
                    } else {
                        console.log('getCurrentDayHighlight: error fallback failed, resolving null');
                        resolve(null);
                    }
                });
            });
        }
    }
    console.log('getCurrentDayHighlight: no years data, returning null');
    return null;
}

// Fetch current dawn information from the API
function fetchCurrentDawnInfo() {
    return new Promise((resolve, reject) => {
        // Use default values if navState properties are missing
        const lat = navState?.lat || 51.48;
        const lon = navState?.lon || 0.0;
        const tz = navState?.tz || 'Europe/London';

        if (!lat || !lon || !tz) {
            console.warn('fetchCurrentDawnInfo: missing location data even with defaults');
            resolve(null);
            return;
        }

        // Create a cache key for dawn info to prevent unnecessary requests
        const dawnCacheKey = `dawn_${lat}_${lon}_${tz}_${new Date().toDateString()}`;
        if (window.dawnInfoCache && window.dawnInfoCache.has(dawnCacheKey)) {
            console.log('Using cached dawn info for:', dawnCacheKey);
            resolve(window.dawnInfoCache.get(dawnCacheKey));
            return;
        }

        const url = `/api/current-dawn?lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}`;
        console.log('fetchCurrentDawnInfo: Fetching dawn info from:', url);

        fetch(url)
            .then(r => {
                console.log('fetchCurrentDawnInfo: Response status:', r.status, r.statusText);
                if (!r.ok) {
                    throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                }
                return r.json();
            })
            .then(data => {
                console.log('fetchCurrentDawnInfo: Raw response data:', data);
                if (data.error) {
                    console.warn('fetchCurrentDawnInfo: Dawn info fetch error:', data.error);
                    resolve(null);
                } else {
                    console.log('fetchCurrentDawnInfo: Processing dawn data...');
                    // Parse the ISO strings into Date objects
                    const dawnInfo = {
                        today_dawn: data.today_dawn ? new Date(data.today_dawn) : null,
                        today_tag: data.today_tag,
                        tomorrow_dawn: data.tomorrow_dawn ? new Date(data.tomorrow_dawn) : null,
                        tomorrow_tag: data.tomorrow_tag,
                        current_time: data.current_time ? new Date(data.current_time) : null,
                        is_after_today_dawn: data.is_after_today_dawn
                    };

                    // Validate the parsed dates
                    if (dawnInfo.today_dawn && isNaN(dawnInfo.today_dawn.getTime())) {
                        console.warn('fetchCurrentDawnInfo: Invalid today_dawn date:', data.today_dawn);
                        dawnInfo.today_dawn = null;
                    }
                    if (dawnInfo.current_time && isNaN(dawnInfo.current_time.getTime())) {
                        console.warn('fetchCurrentDawnInfo: Invalid current_time date:', data.current_time);
                        dawnInfo.current_time = null;
                    }

                    // Validate timezone consistency
                    if (dawnInfo.current_time && tz) {
                        const expectedOffset = getTimezoneOffset(tz);
                        const actualOffset = dawnInfo.current_time.getTimezoneOffset();
                        if (Math.abs(expectedOffset - actualOffset) > 60) {
                            console.warn('fetchCurrentDawnInfo: Timezone mismatch detected', {
                                expected: expectedOffset,
                                actual: actualOffset,
                                timezone: tz
                            });
                        }
                    }

                    console.log('fetchCurrentDawnInfo: Final parsed dawn info:', dawnInfo);

                    // Cache the result
                    if (!window.dawnInfoCache) {
                        window.dawnInfoCache = new Map();
                    }
                    window.dawnInfoCache.set(dawnCacheKey, dawnInfo);

                    resolve(dawnInfo);
                }
            })
            .catch(error => {
                console.error('fetchCurrentDawnInfo: Failed to fetch dawn info:', error);
                resolve(null);
            });
    });
}

function updateCalendar(monthNum, currentDay, daysInMonth, monthsInYear, currentMonth, yearRange) {
    // Get dynamic current day highlight based on actual current date and calendar mode
    const currentHighlightPromise = getCurrentDayHighlight();

    // Handle both promise and non-promise returns
    const handleHighlight = (currentHighlight) => {
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
            const newHighlightPromise = getCurrentDayHighlight();
            const handleNewHighlight = (newHighlight) => {
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
            };

            if (newHighlightPromise && typeof newHighlightPromise.then === 'function') {
                newHighlightPromise.then(handleNewHighlight);
            } else {
                handleNewHighlight(newHighlightPromise);
            }
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
    };

    if (currentHighlightPromise && typeof currentHighlightPromise.then === 'function') {
        currentHighlightPromise.then(handleHighlight);
    } else {
        handleHighlight(currentHighlightPromise);
    }
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

// --- Data Caching ---
// Cache for fetched calendar data to prevent unnecessary API calls
window.dataCache = window.dataCache || new Map();

// --- Render State Tracking ---
// Track last render state to prevent redundant renders
window.lastRenderState = window.lastRenderState || {};

function showStartupLoadingBar() {
    const appRoot = document.querySelector('.app-root');
    if (!appRoot) return;

    // Create startup loading overlay
    const startupLoader = document.createElement('div');
    startupLoader.id = 'startup-loader';
    startupLoader.innerHTML = `
        <div class="startup-loading-container">
            <div class="startup-loading-content">
                <div class="startup-loading-icon">⏰</div>
                <h2 class="startup-loading-title">Quantum Clock</h2>
                <p class="startup-loading-subtitle">Loading astronomical data...</p>
                <div class="startup-loading-bar">
                    <div class="startup-loading-progress"></div>
                </div>
                <div class="startup-loading-text">Initializing calendar systems</div>
            </div>
        </div>
    `;
    startupLoader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Pictocrypto-Regular', monospace;
    `;

    // Add styles for the loading components
    const style = document.createElement('style');
    style.textContent = `
        .startup-loading-container {
            text-align: center;
            color: #ffffff;
            max-width: 400px;
            padding: 2rem;
        }
        .startup-loading-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: pulse 2s ease-in-out infinite;
        }
        .startup-loading-title {
            font-size: 2.5rem;
            margin: 0 0 0.5rem 0;
            background: linear-gradient(45deg, #ffd700, #ff6b35);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .startup-loading-subtitle {
            font-size: 1.2rem;
            margin: 0 0 2rem 0;
            opacity: 0.8;
        }
        .startup-loading-bar {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 1rem;
        }
        .startup-loading-progress {
            height: 100%;
            background: linear-gradient(90deg, #ffd700, #ff6b35);
            border-radius: 4px;
            width: 0%;
            animation: loading-progress 3s ease-out forwards;
        }
        .startup-loading-text {
            font-size: 1rem;
            opacity: 0.7;
            animation: fade-in-out 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        @keyframes loading-progress {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
        }
        @keyframes fade-in-out {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(startupLoader);

    return startupLoader;
}

function hideStartupLoadingBar() {
    const startupLoader = document.getElementById('startup-loader');
    if (startupLoader) {
        startupLoader.style.transition = 'opacity 0.5s ease-out';
        startupLoader.style.opacity = '0';
        setTimeout(() => {
            if (startupLoader.parentNode) {
                startupLoader.parentNode.removeChild(startupLoader);
            }
        }, 500);
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
    const cacheKey = `${lat}_${lon}_${tz}_${startYear}_${endYear}`;

    // Check cache first
    if (window.dataCache.has(cacheKey)) {
        console.log('Using cached data for:', cacheKey);
        if (cb && !loadingState.isLoading) {
            // If not currently loading, call callback immediately with existing data
            cb(window.dataCache.get(cacheKey));
        }
        return;
    }

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

            // Clear cache for different locations to prevent stale data
            const currentLocationKey = `${navState.lat}_${navState.lon}_${navState.tz}`;
            const newLocationKey = `${lat}_${lon}_${tz}`;
            if (currentLocationKey !== newLocationKey) {
                console.log('Location changed, clearing location-specific cache entries');
                // Clear all cache entries that don't match the new location
                for (const [key, value] of window.dataCache.entries()) {
                    if (!key.startsWith(`${lat}_${lon}_${tz}_`)) {
                        window.dataCache.delete(key);
                    }
                }
            }

            // Atomic state update
            const oldData = navState.yearsData;
            navState.yearsData = Array.isArray(data) && data.length > 0 ? data : [];

            // Update loading state
            loadingState.isLoading = false;
            loadingState.currentRequest = null;
            loadingState.abortController = null;

            // Cache the new data
            window.dataCache.set(cacheKey, navState.yearsData);

            // Hide loading indicator after a brief delay
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

        // Clear target and prepare for Gregorian render
        target.innerHTML = '';

        // Create wrapper for animation
        const wrapper = document.createElement('div');
        wrapper.id = 'calendar-grid-anim';
        wrapper.style.opacity = '0';
        wrapper.style.transition = 'opacity 0.3s ease-in-out';
        target.appendChild(wrapper);

        // Pass monthsInYear to GregorianCalendar.render if possible
        if (window.GregorianCalendar.render.length >= 4) {
            window.GregorianCalendar.render(wrapper, cl.y, cl.m, monthsInYear);
        } else {
            window.GregorianCalendar.render(wrapper, cl.y, cl.m);
        }
        rebindNavForGregorian();

        // Trigger animation after render completes
        setTimeout(() => {
            wrapper.style.opacity = '1';
        }, 10);
    } else {
        // Custom mode
        if (loadingState.isLoading) {
            showLoadingIndicator();
            return;
        }

        if (typeof updateMultiYearCalendarUI === 'function') {
            updateMultiYearCalendarUI();
            // Animation is handled by updateMultiYearCalendarUI's navigation handlers
        }
    }
}

// Helper: find quantum year/month index and day number for a given JS Date
function findQuantumIndexForDate(date, yearsData, dawnInfo = null) {
    if (!date || !Array.isArray(yearsData) || !yearsData.length) {
        console.log('findQuantumIndexForDate: invalid input');
        return null;
    }

    // searching for date

    for (let y = 0; y < yearsData.length; y++) {
        const months = yearsData[y].months || [];
        for (let m = 0; m < months.length; m++) {
            const mo = months[m];
            if (!mo || !mo.start) {
                console.log('findQuantumIndexForDate: skipping month', y, m, 'no start date');
                continue;
            }
            const start = new Date(mo.start);
            const nextStart = (m + 1 < months.length)
                ? (months[m+1].start ? new Date(months[m+1].start) : null)
                : (yearsData[y+1] && yearsData[y+1].months && yearsData[y+1].months[0] && yearsData[y+1].months[0].start ? new Date(yearsData[y+1].months[0].start) : null);

            // checking month boundaries

            if (start <= date && (!nextStart || date < nextStart)) {

                // Use dawn-aware day calculation if dawn info is available and valid
                let dayNum;
                    if (dawnInfo && dawnInfo.today_dawn && dawnInfo.current_time) {
                    // Validate dawn info is for the correct location
                    if (navState && navState.tz) {
                        const expectedOffset = getTimezoneOffset(navState.tz);
                        const dawnOffset = new Date(dawnInfo.today_dawn).getTimezoneOffset();
                        if (Math.abs(expectedOffset - dawnOffset) <= 60) {
                            // using dawn-aware calculation
                            dayNum = calculateDawnBasedDayNumber(date, start, nextStart, dawnInfo);
                        } else {
                            // dawn info timezone mismatch
                            dayNum = calculateFallbackDayNumber(date, start, mo.days);
                        }
                    } else {
                        // using dawn-aware calculation without timezone validation
                        dayNum = calculateDawnBasedDayNumber(date, start, nextStart, dawnInfo);
                    }
                } else {
                    // using improved fallback calculation
                    dayNum = calculateFallbackDayNumber(date, start, mo.days);
                }

                // calculated dayNum

                // Validate the result
                if (dayNum < 1 || dayNum > 31) {
                    console.warn('findQuantumIndexForDate: invalid day number calculated:', dayNum);
                    continue;
                }

                const result = { yearIdx: y, monthIdx: m, dayNum };
                // returning result
                return result;
            }
        }
    }

    // no matching month found
    return null;
}

// Calculate day number based on dawn transitions rather than 24-hour periods
function calculateDawnBasedDayNumber(currentDate, monthStart, monthEnd, dawnInfo) {
    try {
        if (!dawnInfo || !dawnInfo.today_dawn || !dawnInfo.current_time) {
        // missing dawn info, using improved fallback
            // Use helper function for consistent fallback calculation
            return calculateFallbackDayNumber(currentDate, monthStart, null);
        }

        const todayDawn = new Date(dawnInfo.today_dawn);
        const currentTime = new Date(dawnInfo.current_time);

        // Ensure dawn info is for the correct location by checking timezone consistency
        if (navState && navState.tz) {
            const expectedOffset = getTimezoneOffset(navState.tz);
            const dawnOffset = todayDawn.getTimezoneOffset();
            const timeOffset = currentTime.getTimezoneOffset();

            // If offsets don't match, dawn info might be stale or from wrong location
            if (Math.abs(expectedOffset - dawnOffset) > 60 || Math.abs(expectedOffset - timeOffset) > 60) {
                console.warn('calculateDawnBasedDayNumber: timezone mismatch detected, using fallback', {
                    expected: expectedOffset,
                    dawn: dawnOffset,
                    current: timeOffset
                });
                return calculateFallbackDayNumber(currentDate, monthStart, null);
            }
        }

    // dawn-based calculation inputs validated

        // Calculate which day of the month we're on based on the month start
        const msSinceMonthStart = currentDate - monthStart;
        const daysSinceMonthStart = Math.floor(msSinceMonthStart / (1000*60*60*24));

        // If we're before today's dawn, we're still on the previous day
        if (currentTime < todayDawn) {
            const result = Math.max(1, daysSinceMonthStart + 1);
            // before dawn: computed day
            return result;
        } else {
            // We're after today's dawn, so we're on the current day
            const result = Math.max(1, daysSinceMonthStart + 1);
            // after dawn: computed day
            return result;
        }
    } catch (e) {
        console.warn('Error in dawn-based day calculation:', e);
        // Fallback to simple calculation
        return Math.floor((currentDate - monthStart) / (1000*60*60*24)) + 1;
    }
}

// Helper function to get timezone offset in minutes for a given timezone
function getTimezoneOffset(timezone) {
    try {
        // Create a date and use Intl.DateTimeFormat to get the offset
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short'
        });
        const parts = formatter.formatToParts(now);
        const timeZoneName = parts.find(part => part.type === 'timeZoneName');

        if (timeZoneName) {
            const tzString = timeZoneName.value;
            // Parse timezone string like "GMT-5" or "EST"
            const match = tzString.match(/GMT([+-])(\d+)(?::(\d+))?/);
            if (match) {
                const sign = match[1] === '+' ? 1 : -1;
                const hours = parseInt(match[2], 10);
                const minutes = match[3] ? parseInt(match[3], 10) : 0;
                return sign * (hours * 60 + minutes);
            }
        }

        // Fallback: assume standard timezone offset
        return now.getTimezoneOffset();
    } catch (e) {
        console.warn('Error getting timezone offset:', e);
        return new Date().getTimezoneOffset();
    }
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
        gregorianDate.setUTCDate(gregorianDate.getUTCDate() + (dayNum - 1));

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
        // Use UTC methods to avoid timezone conversion issues
        const startDate = new Date(monthObj.start);
        const gregorianDate = new Date(startDate);
        gregorianDate.setUTCDate(gregorianDate.getUTCDate() + (dayNum - 1));

        // Format as MM/DD using UTC date
        const month = String(gregorianDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(gregorianDate.getUTCDate()).padStart(2, '0');

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
                navState.gYear = gregorianDate.getUTCFullYear();
                navState.gMonth = gregorianDate.getUTCMonth();
                console.log('Synced custom -> Gregorian:', {
                    custom: { yearIdx: navState.currentYearIdx, monthIdx: navState.currentMonthIdx },
                    gregorian: { year: navState.gYear, month: navState.gMonth }
                });
            } else {
                // Fallback: use current date
                const today = new Date();
                navState.gYear = today.getFullYear();
                navState.gMonth = today.getMonth();
                console.log('Synced custom -> Gregorian (fallback):', {
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
            } else {
                // Enhanced fallback: Find closest custom month using the Gregorian date
                const foundIdx = findQuantumIndexForDate(gregorianDate, navState.yearsData);
                if (foundIdx) {
                    navState.currentYearIdx = foundIdx.yearIdx;
                    navState.currentMonthIdx = foundIdx.monthIdx;
                    console.log('Synced Gregorian -> custom (fallback):', {
                        gregorian: { year: navState.gYear, month: navState.gMonth },
                        custom: { yearIdx: navState.currentYearIdx, monthIdx: navState.currentMonthIdx }
                    });
                } else {
                    console.warn('Could not sync Gregorian -> custom: no fallback position found');
                }
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

        // Clear any cached special day mappings to ensure fresh calculations
        if (window.dataCache) {
            console.log('Clearing special day cache for location change');
            // Clear cache entries that might contain stale special day mappings
            for (const [key, value] of window.dataCache.entries()) {
                if (key.includes('special') || key.includes('mapping')) {
                    window.dataCache.delete(key);
                }
            }
        }

        // Force refresh of dawn info cache
        if (window.dawnInfoCache) {
            window.dawnInfoCache.clear();
        }

        // The calculations will be automatically updated when the calendar re-renders
        // because all the functions (getSilverCounter, computeCustomSpecialClasses, etc.)
        // use the current navState.yearsData which has been updated with new location data

        // Force a re-render to update all calculations
        if (window.CalendarMode && window.CalendarMode.mode === 'custom') {
            updateMultiYearCalendarUI();
        } else {
            renderCalendarForState();
        }

        // If in Gregorian mode, force refresh of special day mappings for all visible cells
        if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
            setTimeout(() => {
                const gregorianCells = document.querySelectorAll('td.day-cell[data-iso]');
                gregorianCells.forEach(cell => {
                    const iso = cell.dataset.iso;
                    if (iso) {
                        // Re-apply special day classes with fresh data
                        getSpecialDayClassesForISO(iso).then(classes => {
                            if (classes && classes.length > 0) {
                                // Remove existing special classes
                                cell.classList.forEach(cls => {
                                    if (cls.includes('-day')) {
                                        cell.classList.remove(cls);
                                    }
                                });
                                // Add new classes
                                classes.forEach(cls => cell.classList.add(cls));
                            }
                        }).catch(error => {
                            console.warn('Failed to refresh special day classes for cell:', iso, error);
                        });
                    }
                });
            }, 500); // Delay to ensure render is complete
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
        <button id="home-month-btn" class="home-btn" aria-label="Current month"><span class="icon">NOW</span></button>
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
    const currentHighlightPromise = getCurrentDayHighlight();

    const renderUI = (currentHighlight) => {
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
                                 navState.currentMonthIdx + 1 === currentHighlight.month);
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
        
        // Add initial animation for custom mode
        animateGridTransition();
        
        // Button handlers
        const prevYearBtn = document.getElementById('prev-year-btn');
        const nextYearBtn = document.getElementById('next-year-btn');
        const prevMonthBtn = document.getElementById('prev-month-btn');
        const nextMonthBtn = document.getElementById('next-month-btn');
        const homeBtn = document.getElementById('home-month-btn');

        if (prevYearBtn) prevYearBtn.onclick = function() {
            if (navState.currentYearIdx > 0) {
                showLoadingIndicator();
                navState.currentYearIdx--;
                navState.currentMonthIdx = 0;
                // Sync Gregorian state
                syncNavigationState('custom', 'gregorian');
                animateGridTransition();
                updateMultiYearCalendarUI();
                setTimeout(() => hideLoadingIndicator(), 300);
            }
        };

        if (nextYearBtn) nextYearBtn.onclick = function() {
            if (navState.currentYearIdx < navState.yearsData.length - 1) {
                showLoadingIndicator();
                navState.currentYearIdx++;
                navState.currentMonthIdx = 0;
                // Sync Gregorian state
                syncNavigationState('custom', 'gregorian');
                animateGridTransition();
                updateMultiYearCalendarUI();
                setTimeout(() => hideLoadingIndicator(), 300);
            }
        };

        if (prevMonthBtn) prevMonthBtn.onclick = function() {
            if (navState.currentMonthIdx > 0) {
                showLoadingIndicator();
                navState.currentMonthIdx--;
                // Sync Gregorian state
                syncNavigationState('custom', 'gregorian');
                animateGridTransition();
                updateMultiYearCalendarUI();
                setTimeout(() => hideLoadingIndicator(), 300);
            } else if (navState.currentYearIdx > 0) {
                showLoadingIndicator();
                navState.currentYearIdx--;
                navState.currentMonthIdx = navState.yearsData[navState.currentYearIdx].months.length - 1;
                // Sync Gregorian state
                syncNavigationState('custom', 'gregorian');
                animateGridTransition();
                updateMultiYearCalendarUI();
                setTimeout(() => hideLoadingIndicator(), 300);
            }
        };

        if (nextMonthBtn) nextMonthBtn.onclick = function() {
            if (navState.currentMonthIdx < months.length - 1) {
                showLoadingIndicator();
                navState.currentMonthIdx++;
                // Sync Gregorian state
                syncNavigationState('custom', 'gregorian');
                animateGridTransition();
                updateMultiYearCalendarUI();
                setTimeout(() => hideLoadingIndicator(), 300);
            } else if (navState.currentYearIdx < navState.yearsData.length - 1) {
                showLoadingIndicator();
                navState.currentYearIdx++;
                navState.currentMonthIdx = 0;
                // Sync Gregorian state
                syncNavigationState('custom', 'gregorian');
                animateGridTransition();
                updateMultiYearCalendarUI();
                setTimeout(() => hideLoadingIndicator(), 300);
            }
        };

        if (homeBtn) homeBtn.onclick = function() {
            // Jump to real current month/year if found
            if (navState.yearsData && navState.yearsData.length) {
                showLoadingIndicator();
                const today = new Date();
                fetchCurrentDawnInfo().then(dawnInfo => {
                    const foundIdx = findQuantumIndexForDate(today, navState.yearsData, dawnInfo);
                    if (foundIdx) {
                        navState.currentYearIdx = foundIdx.yearIdx;
                        navState.currentMonthIdx = foundIdx.monthIdx;
                        // Sync Gregorian state
                        syncNavigationState('custom', 'gregorian');
                        animateGridTransition();
                        updateMultiYearCalendarUI();
                        setTimeout(() => hideLoadingIndicator(), 300);
                    } else {
                        navState.currentYearIdx = 0; navState.currentMonthIdx = 0;
                        // Sync Gregorian state
                        syncNavigationState('custom', 'gregorian');
                        animateGridTransition();
                        updateMultiYearCalendarUI();
                        setTimeout(() => hideLoadingIndicator(), 300);
                    }
                }).catch(() => {
                    // Fallback without dawn info
                    const foundIdx = findQuantumIndexForDate(today, navState.yearsData);
                    if (foundIdx) {
                        navState.currentYearIdx = foundIdx.yearIdx;
                        navState.currentMonthIdx = foundIdx.monthIdx;
                        // Sync Gregorian state
                        syncNavigationState('custom', 'gregorian');
                        animateGridTransition();
                        updateMultiYearCalendarUI();
                        setTimeout(() => hideLoadingIndicator(), 300);
                    } else {
                        navState.currentYearIdx = 0; navState.currentMonthIdx = 0;
                        // Sync Gregorian state
                        syncNavigationState('custom', 'gregorian');
                        animateGridTransition();
                        updateMultiYearCalendarUI();
                        setTimeout(() => hideLoadingIndicator(), 300);
                    }
                });
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
                        let gregDate = null;
                        try {
                            const monthObj = navState.yearsData[navState.currentYearIdx].months[navState.currentMonthIdx];
                            if (monthObj && monthObj.start) {
                                // monthObj.start is ISO string for 1st day of month
                                let startDate = new Date(monthObj.start);
                                // Calculate the Gregorian date for the selected day
                                gregDate = new Date(startDate);
                                gregDate.setUTCDate(gregDate.getUTCDate() + (parseInt(day, 10) - 1));
                                const yyyy = gregDate.getUTCFullYear();
                                const mm = String(gregDate.getUTCMonth() + 1).padStart(2, '0');
                                const dd = String(gregDate.getUTCDate()).padStart(2, '0');
                                const weekdayStr = WEEKDAYS[gregDate.getUTCDay()];
                                gregorianStr = `${yyyy}-${mm}-${dd} (${weekdayStr}) - Gregorian`;
                            }
                        } catch (e) {
                            gregorianStr = '';
                        }
                        const yyyy = gregDate ? gregDate.getUTCFullYear() : null;
                        const mm = gregDate ? String(gregDate.getUTCMonth() + 1).padStart(2, '0') : null;
                        const dd = gregDate ? String(gregDate.getUTCDate()).padStart(2, '0') : null;
                        const dateStr = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : null;
                        window.openSidePanel(panel, cols, { month, day, yearRange: `${year}-${String(year+1).slice(-2)}`, gregorianStr, dateStr });
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
    };

    if (currentHighlightPromise && typeof currentHighlightPromise.then === 'function') {
        currentHighlightPromise.then(renderUI);
    } else {
        renderUI(currentHighlightPromise);
    }
}// Helper functions for smooth transitions
function showLoadingIndicator() {
    const root = document.getElementById('calendar-grid-root');
    if (root) {
        let loader = document.getElementById('calendar-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'calendar-loader';
            loader.innerHTML = '<div class="loading-spinner">Loading...</div>';
            loader.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 255, 255, 0.9);
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1000;
            `;
            root.style.position = 'relative';
            root.appendChild(loader);
        }
        loader.style.display = 'block';
    }
}

function hideLoadingIndicator() {
    const loader = document.getElementById('calendar-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function animateGridTransition() {
    const grid = document.getElementById('calendar-grid-anim');
    if (grid) {
        grid.classList.add('fade-out');
        setTimeout(() => {
            grid.classList.remove('fade-out');
            grid.classList.add('fade-in');
            setTimeout(() => {
                grid.classList.remove('fade-in');
            }, 450);
        }, 50);
    }
}

// Reusable weekday names to avoid repeated literals
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];



// Delegate clicks as a fallback (in case bindings are lost after re-renders)
if (!window.__calendarGlobalClickBound) {
    window.__calendarGlobalClickBound = true;
    document.addEventListener('click', (e) => {
        // Mode toggle buttons (#mode-custom, #mode-gregorian)
        const modeBtn = e.target && e.target.closest && e.target.closest('#mode-custom, #mode-gregorian');
        if (modeBtn) {
            e.preventDefault();
            const currentMode = window.CalendarMode.mode;
            const newMode = modeBtn.id === 'mode-custom' ? 'custom' : 'gregorian';
            if (currentMode !== newMode) {
                // Add loading state for smooth transition
                showLoadingIndicator();

                // Sync navigation state
                syncNavigationState(currentMode, newMode);

                // Update mode
                window.CalendarMode.mode = newMode;
                updateModeButtons();

                // Render with delay for smooth transition
                setTimeout(() => {
                    renderCalendarForState();
                    hideLoadingIndicator();
                    animateGridTransition();
                }, 200);
            }
            return;
        }

        // Gregorian-mode day-cell clicks (delegated)
        const cell = e.target && e.target.closest && e.target.closest('td.day-cell');
        if (!cell || !cell.dataset) return;

        // If in Gregorian mode, handle opening side panel for ISO-marked cells
        if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
            const iso = cell.dataset.iso;
            if (!iso) return;
            // Parse ISO in a timezone-agnostic way (UTC at noon)
            const parts = iso.split('-');
            const _y = parseInt(parts[0], 10);
            const _m = parseInt(parts[1], 10);
            const _d = parseInt(parts[2], 10);
            const gregDate = new Date(Date.UTC(_y, _m - 1, _d, 12, 0, 0));

            // Inline fallback behavior (kept consistent with previous implementation)
            const cols = document.getElementById('calendar-columns');
            const panel = document.getElementById('side-panel');
            if (!panel) return;
            if (cols) cols.classList.add('two-col');
            const yyyy = gregDate.getFullYear();
            const mm = String(gregDate.getMonth() + 1).padStart(2, '0');
            const dd = String(gregDate.getDate()).padStart(2, '0');
            const weekdayStr = WEEKDAYS[gregDate.getDay()];
            const gregorianStr = `${yyyy}-${mm}-${dd} (${weekdayStr}) - Gregorian`;
            // For Gregorian mode, map Gregorian date to custom calendar for header
            (async () => {
                try {
                    const customMapping = await isoToCustomMonthDay(iso);
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
                    const dateStr = `${yyyy}-${mm}-${dd}`;
                    window.openSidePanel(panel, cols, { month, day: customMapping?.dayNum || gregDate.getDate(), yearRange, gregorianStr, dateStr });
                } catch (error) {
                    console.error('Error mapping Gregorian date:', error);
                    // Fallback to Gregorian if mapping fails
                    const month = gregDate.getMonth() + 1;
                    const year = gregDate.getFullYear();
                    const yearRange = year;
                    const dateStr = `${yyyy}-${mm}-${dd}`;
                    window.openSidePanel(panel, cols, { month, day: gregDate.getDate(), yearRange, gregorianStr, dateStr });
                }
            })();
        }
    }, true);
}

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

function rebindNavForGregorian() {
  const ns = window.navState || (window.navState = {});
  const prevYearBtn = document.getElementById('prev-year-btn');
  const nextYearBtn = document.getElementById('next-year-btn');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');
  const homeBtn = document.getElementById('home-month-btn');

  function setOnClick(el, fn) { if (el) el.onclick = (e) => { e.preventDefault(); fn(); }; }

  function bumpMonth(delta) {
    showLoadingIndicator();
    const cl = clampGregorianYM((ns.gYear ?? new Date().getFullYear()), (ns.gMonth ?? new Date().getMonth()) + delta);
    ns.gYear = cl.y; ns.gMonth = cl.m;
    // Sync custom state
    syncNavigationState('gregorian', 'custom');
    animateGridTransition();
    renderCalendarForState();
    setTimeout(() => hideLoadingIndicator(), 300);
  }

  function bumpYear(delta) {
    showLoadingIndicator();
    const cl = clampGregorianYM((ns.gYear ?? new Date().getFullYear()) + delta, (ns.gMonth ?? new Date().getMonth()));
    ns.gYear = cl.y; ns.gMonth = cl.m;
    // Sync custom state
    syncNavigationState('gregorian', 'custom');
    animateGridTransition();
    renderCalendarForState();
    setTimeout(() => hideLoadingIndicator(), 300);
  }

  setOnClick(prevYearBtn, () => bumpYear(-1));
  setOnClick(nextYearBtn, () => bumpYear(+1));
  setOnClick(prevMonthBtn, () => bumpMonth(-1));
  setOnClick(nextMonthBtn, () => bumpMonth(+1));
  setOnClick(homeBtn, () => {
    showLoadingIndicator();
    const cl = clampGregorianYM(new Date().getFullYear(), new Date().getMonth());
    ns.gYear = cl.y; ns.gMonth = cl.m;
    // Sync custom state
    syncNavigationState('gregorian', 'custom');
    animateGridTransition();
    renderCalendarForState();
    setTimeout(() => hideLoadingIndicator(), 300);
  });
}

// Re-render on content ready and data updates
document.addEventListener('DOMContentLoaded', function() {
    // Show startup loading bar immediately
    const startupLoader = showStartupLoadingBar();

    // Initialize navState
    const today = new Date();
    navState.year = today.getFullYear();
    navState.month = null;

    // Initial fetch with race condition prevention
    const loadingState = window.dataLoadingState;
    fetchMultiYearCalendar(navState?.lat || 51.48, navState?.lon || 0.0, navState?.tz || 'Europe/London', 2000, 2048, function(data) {
        navState.yearsData = data;

        // Find today's month/year index using helper with dawn info
        fetchCurrentDawnInfo().then(dawnInfo => {
            const foundIdx = findQuantumIndexForDate(today, data, dawnInfo);
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
                // Hide startup loading bar with a slight delay for smooth transition
                setTimeout(() => {
                    hideStartupLoadingBar();
                }, 500);

                renderCalendarForState();
                updateModeButtons();
            }
        }).catch(() => {
            // Fallback without dawn info
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
                // Hide startup loading bar with a slight delay for smooth transition
                setTimeout(() => {
                    hideStartupLoadingBar();
                }, 500);

                renderCalendarForState();
                updateModeButtons();
            }
        });
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

        // Show loading bar for location change
        showStartupLoadingBar();

        // Update navState
        navState.lat = lat;
        navState.lon = lon;
        navState.tz = tz;
        if (name) navState.locationName = name;

        console.log(`Location changed to: ${name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}`);

        // Cancel any existing data loading
        cancelCurrentRequest();

        // Fetch new data with race condition prevention
        const today2 = new Date();
        fetchMultiYearCalendar(navState?.lat || 51.48, navState?.lon || 0.0, navState?.tz || 'Europe/London', 2000, 2048, function(data) {
            navState.yearsData = data;

            // Use dawn info for more accurate positioning
            fetchCurrentDawnInfo().then(dawnInfo => {
                const foundIdx2 = findQuantumIndexForDate(today2, data, dawnInfo);
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
                    // Hide loading bar with delay for smooth transition
                    setTimeout(() => {
                        hideStartupLoadingBar();
                    }, 500);

                    renderCalendarForState();
                    if (window.CalendarMode && window.CalendarMode.mode === 'gregorian') {
                        document.dispatchEvent(new Event('gregorian:rendered'));
                    }

                    // Recalculate all month-dependent calculations for new location
                    recalculateMonthCalculations();
                }
            }).catch(() => {
                // Fallback without dawn info
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
                    // Hide loading bar with delay for smooth transition
                    setTimeout(() => {
                        hideStartupLoadingBar();
                    }, 500);

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
});

document.addEventListener('gregorian:rendered', () => { if (window.CalendarMode.mode === 'gregorian') rebindNavForGregorian(); });
// Also after custom renders, ensure nav works when switching
document.addEventListener('calendar:rendered', () => { if (window.CalendarMode.mode === 'gregorian') rebindNavForGregorian(); });
