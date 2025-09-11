// Script to inspect and compare Gregorian vs Custom calendar grids
console.log('=== CALENDAR GRID INSPECTION ===');

// Function to get calendar mode
function getCalendarMode() {
    return window.CalendarMode ? window.CalendarMode.mode : 'unknown';
}

// Function to inspect Gregorian grid cells
function inspectGregorianGrid() {
    console.log('\n--- GREGORIAN GRID CELLS ---');
    const gregorianCells = document.querySelectorAll('td.day-cell[data-iso]');
    console.log(`Found ${gregorianCells.length} Gregorian cells`);

    gregorianCells.forEach((cell, index) => {
        const iso = cell.dataset.iso;
        const gregorianDay = cell.querySelector('.holiday-daynum')?.textContent || 'N/A';

        // Look for custom calendar info
        const customInfo = cell.querySelector('.custom-calendar-info');
        const customDate = customInfo ? customInfo.textContent : 'N/A';

        // Look for special day classes
        const specialClasses = Array.from(cell.classList).filter(cls =>
            cls.includes('-day') && !cls.includes('day-cell')
        );

        console.log(`${index + 1}. ISO: ${iso} | Gregorian: ${gregorianDay} | Custom: ${customDate} | Special: [${specialClasses.join(', ')}]`);
    });
}

// Function to inspect Custom grid cells
function inspectCustomGrid() {
    console.log('\n--- CUSTOM GRID CELLS ---');
    const customCells = document.querySelectorAll('.calendar-grid:not(.gregorian) td.day-cell[data-day]');
    console.log(`Found ${customCells.length} Custom cells`);

    customCells.forEach((cell, index) => {
        const dayNum = cell.dataset.day;
        const daySpan = cell.querySelector('.holiday-daynum')?.textContent || 'N/A';

        // Look for special day classes
        const specialClasses = Array.from(cell.classList).filter(cls =>
            cls.includes('-day') && !cls.includes('day-cell')
        );

        console.log(`${index + 1}. Day: ${dayNum} | Display: ${daySpan} | Special: [${specialClasses.join(', ')}]`);
    });
}

// Function to compare mappings
async function compareMappings() {
    console.log('\n--- MAPPING COMPARISON ---');

    const gregorianCells = document.querySelectorAll('td.day-cell[data-iso]');
    const customCells = document.querySelectorAll('.calendar-grid:not(.gregorian) td.day-cell[data-day]');

    console.log(`Gregorian cells: ${gregorianCells.length}`);
    console.log(`Custom cells: ${customCells.length}`);

    // Test a few sample mappings
    for (let i = 0; i < Math.min(5, gregorianCells.length); i++) {
        const gregCell = gregorianCells[i];
        const iso = gregCell.dataset.iso;

        try {
            const customMapping = await window.isoToCustomMonthDay(iso);
            const gregCustomInfo = gregCell.querySelector('.custom-calendar-info')?.textContent || 'N/A';

            console.log(`Sample ${i + 1}: ISO ${iso}`);
            console.log(`  - Expected: ${customMapping ? `${customMapping.monthNum}/${customMapping.dayNum}` : 'null'}`);
            console.log(`  - Displayed: ${gregCustomInfo}`);
            console.log(`  - Match: ${customMapping && gregCustomInfo === `${customMapping.monthNum}/${customMapping.dayNum}` ? 'YES' : 'NO'}`);
        } catch (error) {
            console.error(`Error mapping ${iso}:`, error);
        }
    }
}

// Function to check navState
function checkNavState() {
    console.log('\n--- NAV STATE ---');
    if (window.navState) {
        console.log('navState exists:', {
            lat: window.navState.lat,
            lon: window.navState.lon,
            tz: window.navState.tz,
            locationName: window.navState.locationName,
            yearsDataLength: window.navState.yearsData ? window.navState.yearsData.length : 0,
            currentYearIdx: window.navState.currentYearIdx,
            currentMonthIdx: window.navState.currentMonthIdx,
            gYear: window.navState.gYear,
            gMonth: window.navState.gMonth
        });
    } else {
        console.log('navState is null or undefined');
    }
}

// Main inspection function
function inspectCalendar() {
    console.log('Calendar Mode:', getCalendarMode());
    checkNavState();

    if (getCalendarMode() === 'gregorian') {
        inspectGregorianGrid();
        inspectCustomGrid();
        compareMappings();
    } else {
        inspectCustomGrid();
        inspectGregorianGrid();
        compareMappings();
    }
}

// Run inspection
inspectCalendar();

// Also expose for manual testing
window.inspectCalendar = inspectCalendar;
window.inspectGregorianGrid = inspectGregorianGrid;
window.inspectCustomGrid = inspectCustomGrid;
window.compareMappings = compareMappings;

console.log('\n=== INSPECTION COMPLETE ===');
console.log('You can also run: inspectCalendar(), inspectGregorianGrid(), inspectCustomGrid(), compareMappings()');
