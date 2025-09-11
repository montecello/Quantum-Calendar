// Quick inspection script for browser console
// Copy and paste this into the browser console when on the calendar page

console.log('=== QUICK CALENDAR INSPECTION ===');

// Check current mode
console.log('Mode:', window.CalendarMode?.mode || 'unknown');

// Check navState
console.log('navState:', window.navState);

// Test today's mapping
(async () => {
    const today = '2025-09-10';
    console.log(`\nTesting mapping for ${today}...`);

    try {
        const mapping = await window.isoToCustomMonthDay(today);
        console.log('Mapping result:', mapping);

        if (mapping) {
            console.log(`Expected: Month ${mapping.monthNum}, Day ${mapping.dayNum}`);
        }
    } catch (error) {
        console.error('Mapping error:', error);
    }

    // Check Gregorian cells
    console.log('\n--- GREGORIAN CELLS ---');
    const gregCells = document.querySelectorAll('td.day-cell[data-iso]');
    gregCells.forEach((cell, i) => {
        if (i < 10) { // Only show first 10
            const iso = cell.dataset.iso;
            const customInfo = cell.querySelector('.custom-calendar-info');
            const customText = customInfo ? customInfo.textContent : 'NO CUSTOM INFO';
            console.log(`${iso}: ${customText}`);
        }
    });

    // Check if we're in Gregorian mode
    if (window.CalendarMode?.mode === 'gregorian') {
        console.log('\n--- CHECKING FOR MISSING CUSTOM INFO ---');
        const cellsWithoutCustom = document.querySelectorAll('td.day-cell[data-iso]:not(:has(.custom-calendar-info))');
        console.log(`Cells missing custom info: ${cellsWithoutCustom.length}`);

        cellsWithoutCustom.forEach((cell, i) => {
            if (i < 5) {
                console.log(`Missing: ${cell.dataset.iso}`);
            }
        });
    }
})();
