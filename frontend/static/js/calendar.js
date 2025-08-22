// Map Gregorian ISO date to Quantum month/day/year
function isoToCustomMonthDay(iso) {
    try {
        const d = new Date(iso + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        const ns = window.navState;
        if (!ns || !ns.yearsData || !ns.yearsData.length) return null;
        for (let y = 0; y < ns.yearsData.length; y++) {
            const months = ns.yearsData[y].months || [];
            for (let m = 0; m < months.length; m++) {
                const start = months[m].start ? new Date(months[m].start) : null;
                if (!start) continue;
                const nextStart = (m + 1 < months.length)
                    ? (months[m+1].start ? new Date(months[m+1].start) : null)
                    : (ns.yearsData[y+1] && ns.yearsData[y+1].months[0].start ? new Date(ns.yearsData[y+1].months[0].start) : null);
                if (start <= d && (!nextStart || d < nextStart)) {
                    const dayNum = Math.floor((d - start) / (1000*60*60*24)) + 1;
                    const monthsInYear = months.map(mm => ({ days: mm.days }));
                    return { yearIdx: y, monthNum: m + 1, dayNum, monthsInYear };
                }
            }
        }
        console.warn('No quantum mapping found for Gregorian date:', iso);
    } catch (e) {
        console.error('isoToCustomMonthDay error:', e);
    }
    return null;
}

// Hook for Gregorian grid: get special day classes for a Gregorian ISO date
window.getSpecialDayClassesForISO = function(iso) {
    const mapped = isoToCustomMonthDay(iso);
    if (!mapped) return [];
    let classes;
    if ('monthNum' in mapped && 'dayNum' in mapped && 'monthsInYear' in mapped) {
        classes = computeCustomSpecialClasses(mapped.monthNum, mapped.dayNum, mapped.monthsInYear);
    } else {
        classes = computeCustomSpecialClasses(mapped.month, mapped.day, mapped.year);
    }
    if (classes && classes.length) {
        console.log('Special classes for', iso, ':', classes);
    }
    return classes;
};
// --- Silver Counter (Independent) ---
    // Always starts at 3rd month, 9th day (n=1) each year, increments for 50 days
    function getSilverCounter(mNum, dayNum, monthsInYear) {
        // Only months 3 and after can have the counter
        if (mNum < 3) return null;
        // Calculate absolute day in year using monthsInYear array if available (0-based)
        let absDay = 0;
        if (Array.isArray(monthsInYear)) {
            for (let i = 0; i < mNum - 1; i++) {
                absDay += monthsInYear[i].days || 30;
            }
        } else {
            absDay = (mNum - 1) * 30;
        }
        absDay += (dayNum - 1); // 0-based
        // 3rd month, 9th day (0-based)
        let silverStartAbsDay = 0;
        if (Array.isArray(monthsInYear)) {
            for (let i = 0; i < 2; i++) {
                silverStartAbsDay += monthsInYear[i].days || 30;
            }
        } else {
            silverStartAbsDay = 2 * 30;
        }
        silverStartAbsDay += (9 - 1); // 0-based

        // Debug: log for days near the month 3/4 boundary
        if ((mNum === 3 && dayNum >= 27) || (mNum === 4 && dayNum <= 3)) {
            console.log(
                `DEBUG: mNum=${mNum}, dayNum=${dayNum}, absDay=${absDay}, silverStartAbsDay=${silverStartAbsDay}, monthsInYear=`,
                Array.isArray(monthsInYear) ? monthsInYear.map(m => m.days) : monthsInYear
            );
        }

        let n = absDay - silverStartAbsDay + 1;
        if (n >= 1 && n <= 50) {
            return n;
        }
        return null;
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
        if (Array.isArray(monthsInYear)) {
            for (let i = 0; i < monthNum - 1; i++) {
                absDay += monthsInYear[i].days || 30;
            }
        } else {
            absDay = (monthNum - 1) * 30;
        }
        absDay += dayNum;
        // Find the absolute day for the special pink day (day after n=50)
        let pinkStartAbsDay = 0;
        if (Array.isArray(monthsInYear)) {
            for (let i = 0; i < 2; i++) {
                pinkStartAbsDay += monthsInYear[i].days || 30;
            }
        } else {
            pinkStartAbsDay = 2 * 30;
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
                counterHtml = ` <span class=\"bronze-counter\" style=\"color:#cd7f32;font-size:0.9em;\">(${counter})</span>`;
            }
            let silverCounter = getSilverCounter(monthNum, day, monthsInYear);
            let silverHtml = '';
            if (silverCounter !== null) {
                silverHtml = ` <span class=\"silver-counter\">(${silverCounter})</span>`;
                // Debug log for silver counter
                console.log(`Silver Counter: Month ${monthNum}, Day ${day} => n=${silverCounter}`);
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
            html += `<td class="${getDayClass(isCurrent, day)}" data-day="${day}">${emojiHtml}<span class="holiday-daynum">${day}${counterHtml}${silverHtml}</span></td>`;
            day++;
        }

        if (cell % 7 === 6) html += '</tr>';
    }

    html += '</tbody></table>';
    return html;
}

function renderYearMonths(months, activeMonth, currentMonth, onMonthClick, yearRange, isCurrentYear) {
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

let realCurrentMonth = null;
let realCurrentDay = null;

function updateCalendar(monthNum, currentDay, daysInMonth, monthsInYear, currentMonth, yearRange) {
    // Track the real current month and day
    if (realCurrentMonth === null || realCurrentDay === null) {
        realCurrentMonth = currentMonth;
        realCurrentDay = currentDay;
    }
    const root = document.getElementById('calendar-grid-root');
    let gridHtml = renderCalendarGrid(monthNum, currentDay, daysInMonth, yearRange, false, monthsInYear);
    let monthsHtml = monthsInYear ? renderYearMonths(monthsInYear, monthNum, currentMonth || monthNum, function(selectedMonth) {
        // When a month is clicked, update grid for that month
        const m = monthsInYear[selectedMonth-1];
        // Only highlight the real current day for the real current month, otherwise no highlight
        let dayToHighlight = (selectedMonth === realCurrentMonth) ? realCurrentDay : null;
        updateCalendar(selectedMonth, dayToHighlight, m.days, monthsInYear, realCurrentMonth, yearRange);
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
let navState = {
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

function fetchMultiYearCalendar(lat, lon, tz, startYear, endYear, cb) {
    fetch(`/api/multiyear-calendar?lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}&start_year=${startYear}&end_year=${endYear}`)
        .then(r => r.json())
        .then(data => {
            if (Array.isArray(data) && data.length > 0) {
                cb(data);
            }
        });
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
    // Find real current month/day for highlight
    let realCurrentMonth = null, realCurrentDay = null, realCurrentYearIdx = null;
    const today = new Date();
    for (let y = 0; y < navState.yearsData.length; ++y) {
        for (let m = 0; m < navState.yearsData[y].months.length; ++m) {
            const mo = navState.yearsData[y].months[m];
            if (mo.start) {
                const start = new Date(mo.start);
                let end = (m+1 < navState.yearsData[y].months.length)
                    ? new Date(navState.yearsData[y].months[m+1].start)
                    : null;
                if (!end && y+1 < navState.yearsData.length) {
                    end = new Date(navState.yearsData[y+1].months[0].start);
                }
                if (start <= today && (!end || today < end)) {
                    realCurrentYearIdx = y;
                    realCurrentMonth = m+1;
                    // Estimate current day in month
                    realCurrentDay = Math.floor((today - start) / (1000*60*60*24)) + 1;
                }
            }
        }
    }
    // Build year label for heading
    let yearLabel = `${yearObj.year}-${String(yearObj.year+1).slice(-2)}`;
    // Only highlight if this is the real current year and month
    let highlight = (navState.currentYearIdx === realCurrentYearIdx && navState.currentMonthIdx+1 === realCurrentMonth);
    // Render grid and months list
    let gridHtml = renderCalendarGrid(
        navState.currentMonthIdx+1,
        realCurrentDay,
        monthObj.days,
        yearLabel,
        highlight,
        months.map(m => ({days: m.days}))
    );
    // Only highlight current month in months list if this is the real current year
    let isCurrentYear = (navState.currentYearIdx === realCurrentYearIdx);
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
            let found = false;
            for (let y = 0; y < navState.yearsData.length; ++y) {
                for (let m = 0; m < navState.yearsData[y].months.length; ++m) {
                    const mo = navState.yearsData[y].months[m];
                    if (!mo.start) continue;
                    const start = new Date(mo.start);
                    let end = (m+1 < navState.yearsData[y].months.length) ? new Date(navState.yearsData[y].months[m+1].start) : null;
                    if (!end && y+1 < navState.yearsData.length) end = new Date(navState.yearsData[y+1].months[0].start);
                    if (start <= today && (!end || today < end)) {
                        navState.currentYearIdx = y;
                        navState.currentMonthIdx = m;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (!found) { navState.currentYearIdx = 0; navState.currentMonthIdx = 0; }
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

// On page load, fetch Greenwich multi-year calendar and show current month
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    let thisYear = today.getFullYear();
    navState.year = thisYear;
    navState.month = null;
    fetchMultiYearCalendar(navState.lat, navState.lon, navState.tz, 2000, 2048, function(data) {
        navState.yearsData = data;
        // Find the year and month index for today
        let found = false;
        for (let y = 0; y < data.length; ++y) {
            for (let m = 0; m < data[y].months.length; ++m) {
                const mo = data[y].months[m];
                if (mo.start) {
                    const start = new Date(mo.start);
                    let end = (m+1 < data[y].months.length)
                        ? new Date(data[y].months[m+1].start)
                        : null;
                    if (!end && y+1 < data.length) {
                        end = new Date(data[y+1].months[0].start);
                    }
                    if (start <= today && (!end || today < end)) {
                        navState.currentYearIdx = y;
                        navState.currentMonthIdx = m;
                        found = true;
                        break;
                    }
                }
            }
            if (found) break;
        }
        if (!found) {
            navState.currentYearIdx = 0;
            navState.currentMonthIdx = 0;
        }
        // Render based on current mode
        renderCalendarForState();
    });
});

// Listen for location selection from backend or search box
window.addEventListener('calendar:update', function(e) {
    if (!e.detail) return;
    const { lat, lon, tz, name } = e.detail;
    // If tz is missing, fetch from backend
    if (!tz) {
        fetch(`/api/timezone?lat=${lat}&lon=${lon}`)
            .then(r => r.json())
            .then(data => {
                const timezone = data.tz || 'UTC';
                // Re-dispatch with tz included
                window.dispatchEvent(new CustomEvent('calendar:update', {
                    detail: { lat, lon, tz: timezone, name }
                }));
            });
        return;
    }
    navState.lat = lat;
    navState.lon = lon;
    navState.tz = tz;
    if (name) {
        navState.locationName = name;
    }
    const today = new Date();
    let thisYear = today.getFullYear();
    fetchMultiYearCalendar(navState.lat, navState.lon, navState.tz, 2000, 2048, function(data) {
        navState.yearsData = data;
        // Find the year and month index for today
        let found = false;
        for (let y = 0; y < data.length; ++y) {
            for (let m = 0; m < data[y].months.length; ++m) {
                const mo = data[y].months[m];
                if (mo.start) {
                    const start = new Date(mo.start);
                    let end = (m+1 < data[y].months.length)
                        ? new Date(data[y].months[m+1].start)
                        : null;
                    if (!end && y+1 < data.length) {
                        end = new Date(data[y+1].months[0].start);
                    }
                    if (start <= today && (!end || today < end)) {
                        navState.currentYearIdx = y;
                        navState.currentMonthIdx = m;
                        found = true;
                        break;
                    }
                }
            }
            if (found) break;
        }
        if (!found) {
            navState.currentYearIdx = 0;
            navState.currentMonthIdx = 0;
        }
        // Render based on current mode
        renderCalendarForState();
    });
});

// Delegate clicks as a fallback (in case bindings are lost after re-renders)
document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('#mode-custom, #mode-gregorian');
  if (!btn) return;
  e.preventDefault();
  if (btn.id === 'mode-custom') {
    window.CalendarMode.mode = 'custom';
    updateModeButtons();
    renderCalendarForState();
  } else if (btn.id === 'mode-gregorian') {
    window.CalendarMode.mode = 'gregorian';
    const now = new Date();
    const cl = clampGregorianYM(now.getFullYear(), now.getMonth());
    window.navState = window.navState || {};
    window.navState.gYear = cl.y;
    window.navState.gMonth = cl.m;
    updateModeButtons();
    renderCalendarForState();
  }
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

// Expose hook for special day classes by ISO date (Gregorian)
// ...existing code...

// Map ISO date to custom month/day using navState.yearsData
// ...existing code...

// Compute special classes for custom calendar using same rules as grid
function computeCustomSpecialClasses(monthNum, dayNum, monthsInYear) {
  const classes = [];
  // Dark pink: day after n=50 on silver counter
  let absDay = 0;
  if (Array.isArray(monthsInYear)) {
    for (let i = 0; i < monthNum - 1; i++) absDay += monthsInYear[i].days || 30;
  } else {
    absDay = (monthNum - 1) * 30;
  }
  absDay += dayNum; // 1-based like original check
  let pinkStartAbsDay = 0;
  if (Array.isArray(monthsInYear)) {
    for (let i = 0; i < 2; i++) pinkStartAbsDay += monthsInYear[i].days || 30;
  } else {
    pinkStartAbsDay = 2 * 30;
  }
  pinkStartAbsDay += 9 + 50; // 3rd month 9th day + 50 days => next day
  const isDarkPink = (absDay === pinkStartAbsDay);
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
                    // After loading, render Gregorian grid
                    const today = new Date();
                    const cl = clampGregorianYM(ns.gYear ?? today.getFullYear(), ns.gMonth ?? today.getMonth());
                    ns.gYear = cl.y; ns.gMonth = cl.m;
                    window.GregorianCalendar.render(target, cl.y, cl.m);
                    rebindNavForGregorian();
                });
                return;
            }
        // Already loaded, render as normal
        const today = new Date();
        const cl = clampGregorianYM(ns.gYear ?? today.getFullYear(), ns.gMonth ?? today.getMonth());
        ns.gYear = cl.y; ns.gMonth = cl.m;
        window.GregorianCalendar.render(target, cl.y, cl.m);
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
  setOnClick(homeBtn, () => { const cl = clampGregorianYM(new Date().getFullYear(), new Date().getMonth()); ns.gYear = cl.y; ns.gMonth = cl.m; renderCalendarForState(); });
}

// After data loads, render according to current mode instead of forcing custom
// On page load, fetch Greenwich multi-year calendar and show current month
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    let thisYear = today.getFullYear();
    navState.year = thisYear;
    navState.month = null;
    fetchMultiYearCalendar(navState.lat, navState.lon, navState.tz, 2000, 2048, function(data) {
        navState.yearsData = data;
        // Find the year and month index for today
        let found = false;
        for (let y = 0; y < data.length; ++y) {
            for (let m = 0; m < data[y].months.length; ++m) {
                const mo = data[y].months[m];
                if (mo.start) {
                    const start = new Date(mo.start);
                    let end = (m+1 < data[y].months.length)
                        ? new Date(data[y].months[m+1].start)
                        : null;
                    if (!end && y+1 < data.length) {
                        end = new Date(data[y+1].months[0].start);
                    }
                    if (start <= today && (!end || today < end)) {
                        navState.currentYearIdx = y;
                        navState.currentMonthIdx = m;
                        found = true;
                        break;
                    }
                }
            }
            if (found) break;
        }
        if (!found) {
            navState.currentYearIdx = 0;
            navState.currentMonthIdx = 0;
        }
        // Render based on current mode
        renderCalendarForState();
    });
});

// Listen for location selection from backend or search box
window.addEventListener('calendar:update', function(e) {
    if (!e.detail) return;
    const { lat, lon, tz, name } = e.detail;
    // If tz is missing, fetch from backend
    if (!tz) {
        fetch(`/api/timezone?lat=${lat}&lon=${lon}`)
            .then(r => r.json())
            .then(data => {
                const timezone = data.tz || 'UTC';
                // Re-dispatch with tz included
                window.dispatchEvent(new CustomEvent('calendar:update', {
                    detail: { lat, lon, tz: timezone, name }
                }));
            });
        return;
    }
    navState.lat = lat;
    navState.lon = lon;
    navState.tz = tz;
    if (name) {
        navState.locationName = name;
    }
    const today = new Date();
    let thisYear = today.getFullYear();
    fetchMultiYearCalendar(navState.lat, navState.lon, navState.tz, 2000, 2048, function(data) {
        navState.yearsData = data;
        // Find the year and month index for today
        let found = false;
        for (let y = 0; y < data.length; ++y) {
            for (let m = 0; m < data[y].months.length; ++m) {
                const mo = data[y].months[m];
                if (mo.start) {
                    const start = new Date(mo.start);
                    let end = (m+1 < data[y].months.length)
                        ? new Date(data[y].months[m+1].start)
                        : null;
                    if (!end && y+1 < data.length) {
                        end = new Date(data[y+1].months[0].start);
                    }
                    if (start <= today && (!end || today < end)) {
                        navState.currentYearIdx = y;
                        navState.currentMonthIdx = m;
                        found = true;
                        break;
                    }
                }
            }
            if (found) break;
        }
        if (!found) {
            navState.currentYearIdx = 0;
            navState.currentMonthIdx = 0;
        }
        // Render based on current mode
        renderCalendarForState();
    });
});

// Delegated click only for Gregorian mode
if (!window.__gregorianClickBound) {
  window.__gregorianClickBound = true;
  document.addEventListener('click', (e) => {
    if (window.CalendarMode.mode !== 'gregorian') return; // let custom handlers work
    const cell = e.target.closest('td.day-cell');
    if (!cell || !cell.dataset) return;
    const iso = cell.dataset.iso;
    if (!iso) return;
    const gregDate = new Date(iso + 'T12:00:00');
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
      const month = (window.navState?.currentMonthIdx ?? 0) + 1;
      const year = window.navState?.yearsData?.[window.navState.currentYearIdx]?.year ?? yyyy;
      panel.innerHTML = `
        <button class="close-btn" aria-label="Close">&times;</button>
        <h3 style="margin-top:0;color:#20639b;">Month ${month}, Day ${gregDate.getDate()}, ${year}-${String(year+1).slice(-2)}</h3>
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
document.addEventListener('DOMContentLoaded', () => { renderCalendarForState(); updateModeButtons(); });
window.addEventListener('calendar:update', function() { if (window.CalendarMode.mode === 'custom') renderCalendarForState(); });

document.addEventListener('gregorian:rendered', () => { if (window.CalendarMode.mode === 'gregorian') rebindNavForGregorian(); });
// Also after custom renders, ensure nav works when switching
document.addEventListener('calendar:rendered', () => { if (window.CalendarMode.mode === 'gregorian') rebindNavForGregorian(); });
