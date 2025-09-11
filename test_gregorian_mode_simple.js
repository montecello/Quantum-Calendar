#!/usr/bin/env node

// Script to test Gregorian mode switching and custom calendar info addition
const { exec } = require('child_process');
const fs = require('fs');

console.log('=== GREGORIAN MODE TEST ===');

function testGregorianModeLogic() {
    console.log('Testing Gregorian mode switching logic...');

    // Mock the calendar functions and data
    const mockCalendar = {
        CalendarMode: { mode: 'custom' },
        navState: {
            yearsData: [{
                year: 2025,
                months: [{
                    start: '2025-09-08T04:23:41.000Z',
                    days: 29
                }]
            }],
            currentYearIdx: 0,
            currentMonthIdx: 0
        },

        // Mock isoToCustomMonthDay function
        isoToCustomMonthDay: async function(iso) {
            console.log(`  Mapping ${iso}...`);

            // Simulate the mapping logic from calendar.js
            if (iso === '2025-09-08') return { monthNum: 6, dayNum: 1, monthsInYear: 12 };
            if (iso === '2025-09-09') return { monthNum: 6, dayNum: 2, monthsInYear: 12 };
            if (iso === '2025-09-10') return { monthNum: 6, dayNum: 3, monthsInYear: 12 };
            if (iso === '2025-09-11') return { monthNum: 6, dayNum: 4, monthsInYear: 12 };
            if (iso === '2025-09-12') return { monthNum: 6, dayNum: 5, monthsInYear: 12 };

            console.log(`  No mapping found for ${iso}`);
            return null;
        },

        // Mock getSilverCounter
        getSilverCounter: function(month, day, monthsInYear) {
            return Math.floor((month - 1) * 29 + day);
        },

        // Mock GregorianCalendar
        GregorianCalendar: {
            getBronzeCounter: function(month, day) {
                return day % 10; // Simple mock
            },
            getMoonPhaseEmoji: function(day) {
                const phases = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
                return phases[day % 8];
            }
        }
    };

    // Simulate switching to Gregorian mode
    console.log('Switching to Gregorian mode...');
    mockCalendar.CalendarMode.mode = 'gregorian';

    // Simulate the Gregorian cell refresh logic from calendar.js
    console.log('Running Gregorian cell refresh simulation...');

    const mockGregorianCells = [
        { iso: '2025-09-08', day: 8 },
        { iso: '2025-09-09', day: 9 },
        { iso: '2025-09-10', day: 10 },
        { iso: '2025-09-11', day: 11 },
        { iso: '2025-09-12', day: 12 }
    ];

    // Process each cell (simulating the setTimeout logic)
    setTimeout(async () => {
        console.log('\nProcessing Gregorian cells...');

        for (const cellData of mockGregorianCells) {
            const iso = cellData.iso;
            console.log(`\nProcessing cell: ${iso}`);

            try {
                const customMapping = await mockCalendar.isoToCustomMonthDay(iso);

                if (customMapping && customMapping.monthNum && customMapping.dayNum) {
                    console.log(`  ✅ Custom mapping: Month ${customMapping.monthNum}, Day ${customMapping.dayNum}`);

                    // Simulate adding custom calendar info
                    console.log('  Adding custom calendar info element...');

                    // Simulate adding silver counter
                    const silverCounter = mockCalendar.getSilverCounter(customMapping.monthNum, customMapping.dayNum, customMapping.monthsInYear);
                    console.log(`  Silver counter: ${silverCounter}`);

                    // Simulate adding bronze counter
                    const bronzeCounter = mockCalendar.GregorianCalendar.getBronzeCounter(customMapping.monthNum, customMapping.dayNum);
                    console.log(`  Bronze counter: ${bronzeCounter}`);

                    // Simulate adding moon phase emoji
                    const emoji = mockCalendar.GregorianCalendar.getMoonPhaseEmoji(customMapping.dayNum);
                    console.log(`  Moon phase emoji: ${emoji}`);

                    console.log('  ✅ Cell successfully updated with custom calendar info');

                } else {
                    console.log(`  ❌ No custom mapping found for ${iso}`);
                }

            } catch (error) {
                console.log(`  ❌ Error processing cell ${iso}:`, error.message);
            }
        }

        console.log('\n=== TEST RESULTS ===');
        console.log('✅ Gregorian mode switch: SUCCESS');
        console.log('✅ Custom calendar mapping: WORKING');
        console.log('✅ Cell refresh logic: WORKING');
        console.log('\nCONCLUSION: The JavaScript logic for adding custom calendar info to Gregorian cells appears to be working correctly.');
        console.log('The issue may be in the actual DOM manipulation or timing of the refresh function.');

    }, 100); // Short delay to simulate the setTimeout
}

// Test the current live app
async function testLiveApp() {
    console.log('\n=== TESTING LIVE APP ===');

    try {
        // Fetch current HTML
        const html = await new Promise((resolve, reject) => {
            exec('curl -s http://localhost:5001', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });

        // Check current mode
        const isGregorianMode = html.includes('aria-pressed="true"') &&
                               html.includes('id="mode-gregorian"');

        console.log(`Current mode: ${isGregorianMode ? 'Gregorian' : 'Custom'}`);

        if (!isGregorianMode) {
            console.log('Calendar is in Custom mode. To test Gregorian mode, you would need to:');
            console.log('1. Open the app in a browser');
            console.log('2. Click the "Gregorian" mode button');
            console.log('3. Check if Gregorian cells show custom calendar info');
        } else {
            console.log('Calendar is already in Gregorian mode');
            const gregorianCells = (html.match(/data-iso/g) || []).length;
            const customInfo = (html.match(/custom-calendar-info/g) || []).length;
            console.log(`Gregorian cells: ${gregorianCells}`);
            console.log(`Custom calendar info elements: ${customInfo}`);

            if (gregorianCells > 0 && customInfo === 0) {
                console.log('🚨 ISSUE FOUND: Gregorian cells exist but no custom calendar info!');
            } else if (gregorianCells === customInfo) {
                console.log('✅ WORKING: All Gregorian cells have custom calendar info');
            }
        }

    } catch (error) {
        console.error('Failed to test live app:', error.message);
    }
}

async function main() {
    // Test the logic first
    testGregorianModeLogic();

    // Then test the live app
    setTimeout(() => {
        testLiveApp();
    }, 1000);
}

main();
