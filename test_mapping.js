#!/usr/bin/env node

// Node.js script to test calendar mapping functions
// This can run in terminal to test the JavaScript logic

console.log('=== TERMINAL CALENDAR MAPPING TEST ===');

// Mock the required global objects
global.window = {
    navState: {
        lat: 51.48,
        lon: 0.0,
        tz: 'Europe/London',
        locationName: 'Greenwich, England',
        yearsData: [
            {
                year: 2025,
                months: [
                    { start: '2025-04-13T04:01:25.000Z', days: 30 },
                    { start: '2025-05-13T02:15:06.000Z', days: 30 },
                    { start: '2025-06-12T02:42:33.000Z', days: 29 },
                    { start: '2025-07-11T03:03:18.000Z', days: 30 },
                    { start: '2025-08-10T03:06:11.000Z', days: 29 },
                    { start: '2025-09-08T04:23:41.000Z', days: 29 }, // Month 6
                    { start: '2025-10-07T05:19:27.000Z', days: 30 },
                    { start: '2025-11-06T05:07:49.000Z', days: 29 },
                    { start: '2025-12-05T05:46:09.000Z', days: 30 },
                    { start: '2026-01-04T06:01:57.000Z', days: 29 },
                    { start: '2026-02-02T05:41:36.000Z', days: 30 },
                    { start: '2026-03-04T04:47:50.000Z', days: 29 }
                ]
            }
        ]
    }
};

// Mock fetchCurrentDawnInfo
global.fetchCurrentDawnInfo = async () => {
    return {
        today_dawn: new Date('2025-09-10T03:28:00.000Z'),
        current_time: new Date('2025-09-10T12:00:00.000Z'),
        is_after_today_dawn: true
    };
};

// Mock getTimezoneOffset
global.getTimezoneOffset = (tz) => {
    // Simple mock for GMT
    return 0;
};

// Load the calendar.js file content
const fs = require('fs');
const path = require('path');

try {
    const calendarPath = path.join(__dirname, 'frontend', 'static', 'js', 'calendar.js');
    const calendarCode = fs.readFileSync(calendarPath, 'utf8');

    // Extract the isoToCustomMonthDay function
    const functionMatch = calendarCode.match(/async function isoToCustomMonthDay\([^}]+\}/s);
    if (functionMatch) {
        // Create a mock version of the function for testing
        global.isoToCustomMonthDay = async function(iso) {
            console.log(`Testing mapping for: ${iso}`);

            // Parse ISO date
            const parts = iso.split('-');
            const isoY = parseInt(parts[0], 10);
            const isoM = parseInt(parts[1], 10);
            const isoD = parseInt(parts[2], 10);

            const locationAdjustedDate = new Date(Date.UTC(isoY, isoM - 1, isoD, 12, 0, 0));
            const d = locationAdjustedDate;

            console.log(`Parsed date: ${d.toISOString()}`);

            // Find matching month
            for (let y = 0; y < global.window.navState.yearsData.length; y++) {
                const months = global.window.navState.yearsData[y].months || [];
                for (let m = 0; m < months.length; m++) {
                    const start = months[m].start ? new Date(months[m].start) : null;
                    if (!start) continue;

                    const nextStart = (m + 1 < months.length)
                        ? (months[m+1].start ? new Date(months[m+1].start) : null)
                        : null;

                    console.log(`Checking month ${m+1}: ${start.toISOString()} to ${nextStart ? nextStart.toISOString() : 'end'}`);

                    if (start <= d && (!nextStart || d < nextStart)) {
                        // Calculate day number
                        const msSinceMonthStart = d - start;
                        const daysSinceMonthStart = Math.floor(msSinceMonthStart / (1000*60*60*24));
                        const dayNum = Math.max(1, daysSinceMonthStart + 1);

                        console.log(`Found match! Month ${m+1}, Day ${dayNum}`);

                        return {
                            yearIdx: y,
                            monthNum: m + 1,
                            dayNum: dayNum,
                            monthsInYear: months.map(mo => ({ days: mo.days }))
                        };
                    }
                }
            }

            console.log('No mapping found');
            return null;
        };

        // Test the mapping
        async function testMapping() {
            console.log('\n--- TESTING DATE MAPPINGS ---');

            const testDates = [
                '2025-09-08', // Start of month 6
                '2025-09-10', // Today (should be day 3)
                '2025-09-15', // Middle of month
                '2025-09-07'  // Previous month
            ];

            for (const date of testDates) {
                console.log(`\nTesting ${date}:`);
                const result = await global.isoToCustomMonthDay(date);
                if (result) {
                    console.log(`  Result: Month ${result.monthNum}, Day ${result.dayNum}`);
                } else {
                    console.log('  Result: No mapping found');
                }
            }
        }

        // Run the test
        testMapping().then(() => {
            console.log('\n=== TEST COMPLETE ===');
        }).catch(error => {
            console.error('Test error:', error);
        });

    } else {
        console.error('Could not find isoToCustomMonthDay function in calendar.js');
    }

} catch (error) {
    console.error('Error loading calendar.js:', error);
}
