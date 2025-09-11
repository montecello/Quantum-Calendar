#!/usr/bin/env node

// Test script to verify custom date mappings in Gregorian cells after location change
const { exec } = require('child_process');
const fs = require('fs');

console.log('=== GREGORIAN CELL MAPPING TEST ===');

function fetchHTML() {
    return new Promise((resolve, reject) => {
        console.log('Fetching current HTML...');
        // Add a delay to allow JavaScript to populate the calendar
        setTimeout(() => {
            exec('curl -s http://localhost:5001', (error, stdout, stderr) => {
                if (error) {
                    console.error('Error fetching HTML:', error);
                    reject(error);
                    return;
                }

                // Check if calendar grid has content
                if (!stdout.includes('calendar-grid-root') || stdout.match(/id="calendar-grid-root"><\/div>/)) {
                    console.log('⚠️  Calendar grid appears to be empty - JavaScript may not have loaded yet');
                    console.log('Try refreshing the page in your browser and running the test again');
                }

                resolve(stdout);
            });
        }, 2000); // Wait 2 seconds for JavaScript to execute
    });
}

function extractCurrentGregorianDate(html) {
    console.log('\n=== EXTRACTING CURRENT GREGORIAN DATE ===');

    // Look for the side panel Gregorian date
    const sidePanelMatch = html.match(/<div[^>]*id="side-panel"[^>]*>([\s\S]*?)<\/div>/);
    if (sidePanelMatch) {
        const sidePanelContent = sidePanelMatch[1];
        const gregorianMatch = sidePanelContent.match(/(\d{4}-\d{2}-\d{2})\s*\([^)]*\)\s*-\s*Gregorian/);
        if (gregorianMatch) {
            console.log('Side panel Gregorian date:', gregorianMatch[1]);
            return gregorianMatch[1];
        }
    }

    console.log('No Gregorian date found in side panel');
    return null;
}

function extractGregorianGridCurrentDay(html) {
    console.log('\n=== EXTRACTING GREGORIAN GRID CURRENT DAY ===');

    // Find Gregorian cells with current-day class
    const currentDayMatch = html.match(/<td[^>]*class="[^"]*\bcurrent-day\b[^"]*"[^>]*data-iso="([^"]*)"[^>]*>([\s\S]*?)<\/td>/);
    if (currentDayMatch) {
        const iso = currentDayMatch[1];
        const cellContent = currentDayMatch[2];

        console.log('Gregorian grid current day ISO:', iso);

        // Extract custom calendar info from the cell
        const customInfoMatch = cellContent.match(/<div[^>]*class="custom-calendar-info"[^>]*>([^<]+)<\/div>/);
        if (customInfoMatch) {
            console.log('Custom calendar info in Gregorian cell:', customInfoMatch[1]);
            return {
                iso: iso,
                customInfo: customInfoMatch[1]
            };
        }
    }

    console.log('No current day found in Gregorian grid');
    return null;
}

function extractCustomGridCurrentDay(html) {
    console.log('\n=== EXTRACTING CUSTOM GRID CURRENT DAY ===');

    // Find custom calendar cells with current-day class (not in Gregorian mode)
    const customCurrentMatch = html.match(/<td[^>]*class="[^"]*day-cell[^"]*\bcurrent-day\b[^"]*"[^>]*data-day="([^"]*)"[^>]*>([\s\S]*?)<\/td>/);
    if (customCurrentMatch) {
        const dayNum = customCurrentMatch[1];
        console.log('Custom grid current day number:', dayNum);
        return dayNum;
    }

    console.log('No current day found in custom grid');
    return null;
}

function checkMode(html) {
    // Check if we're in Gregorian or Custom mode
    if (html.includes('aria-pressed="true"') && html.includes('id="mode-gregorian"')) {
        return 'gregorian';
    } else if (html.includes('aria-pressed="true"') && html.includes('id="mode-custom"')) {
        return 'custom';
    } else {
        return 'unknown';
    }
}

function main() {
    console.log('\n=== TERMINAL-BASED LOCATION CHANGE TEST ===');
    console.log('This test will help verify that custom date mappings update correctly when location changes.');
    console.log('You will need to manually change location and mode in the browser during the test.');

    console.log('\n--- STEP 1: INITIAL STATE ---');
    fetchHTML().then(initialHTML => {
        const initialMode = checkMode(initialHTML);
        console.log('Initial mode:', initialMode);

        if (initialMode !== 'custom') {
            console.log('❌ Please switch to Custom mode first, then run this test');
            console.log('   1. Open http://localhost:5001 in your browser');
            console.log('   2. Click the "Quantum" button to switch to Custom mode');
            console.log('   3. Run this test again');
            return;
        }

        console.log('✅ Starting in Custom mode');

        console.log('\n--- STEP 2: CHANGE LOCATION ---');
        console.log('⚠️  MANUAL STEP REQUIRED: Change location to Los Angeles in the browser');
        console.log('   1. Click the location button (globe icon)');
        console.log('   2. Select "Los Angeles, California"');
        console.log('   3. Wait for calendar to reload');
        console.log('   4. Press Enter to continue this test...');

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();

            console.log('\n--- STEP 3: VERIFY LOCATION CHANGE ---');
            fetchHTML().then(afterHTML => {
                const afterMode = checkMode(afterHTML);
                const afterCustomDay = extractCustomGridCurrentDay(afterHTML);
                console.log('Mode after location change:', afterMode);
                console.log('Custom current day after location change:', afterCustomDay);

                console.log('\n--- STEP 4: SWITCH TO GREGORIAN MODE ---');
                console.log('⚠️  MANUAL STEP REQUIRED: Switch to Gregorian mode in the browser');
                console.log('   1. Click the "Gregorian" button');
                console.log('   2. Wait for calendar to load');
                console.log('   3. Press Enter to continue...');

                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.on('data', () => {
                    process.stdin.setRawMode(false);
                    process.stdin.pause();

                    console.log('\n--- STEP 5: ANALYZE GREGORIAN GRID ---');
                    fetchHTML().then(gregorianHTML => {
                        const gregorianMode = checkMode(gregorianHTML);
                        console.log('Mode in Gregorian view:', gregorianMode);

                        if (gregorianMode !== 'gregorian') {
                            console.log('❌ Not in Gregorian mode');
                            return;
                        }

                        const gregorianCurrent = extractGregorianGridCurrentDay(gregorianHTML);
                        const sidePanelGregorian = extractCurrentGregorianDate(gregorianHTML);

                        console.log('\n=== FINAL COMPARISON ===');
                        console.log('Side panel Gregorian date:', sidePanelGregorian);
                        console.log('Gregorian grid current ISO:', gregorianCurrent ? gregorianCurrent.iso : 'N/A');
                        console.log('Gregorian grid custom info:', gregorianCurrent ? gregorianCurrent.customInfo : 'N/A');
                        console.log('Custom grid current day:', afterCustomDay);

                        if (gregorianCurrent && gregorianCurrent.customInfo && afterCustomDay) {
                            const [month, day] = gregorianCurrent.customInfo.split('/');
                            const matches = day === afterCustomDay;
                            console.log('\n🎯 RESULT:', matches ? '✅ MAPPINGS MATCH!' : '❌ MAPPINGS DO NOT MATCH!');
                            console.log('   Gregorian grid shows custom day:', day);
                            console.log('   Custom grid shows current day:', afterCustomDay);
                        } else {
                            console.log('\n❌ Could not complete comparison - missing data');
                        }

                        console.log('\n=== TEST COMPLETE ===');
                        process.exit(0);
                    }).catch(error => {
                        console.error('Error fetching Gregorian HTML:', error);
                    });
                });
            }).catch(error => {
                console.error('Error fetching HTML after location change:', error);
            });
        });
    }).catch(error => {
        console.error('Error fetching initial HTML:', error);
        console.log('\nMake sure the Flask app is running on http://localhost:5001');
    });
}

main();
