#!/usr/bin/env node

// Script to fetch and analyze the rendered HTML from the running Flask app
const { exec } = require('child_process');
const fs = require('fs');

console.log('=== FETCH AND ANALYZE RENDERED HTML ===');

function fetchHTML() {
    return new Promise((resolve, reject) => {
        console.log('Fetching HTML from http://localhost:5001...');

        exec('curl -s http://localhost:5001', (error, stdout, stderr) => {
            if (error) {
                console.error('Error fetching HTML:', error);
                reject(error);
                return;
            }

            if (stderr) {
                console.warn('Curl stderr:', stderr);
            }

            resolve(stdout);
        });
    });
}

function analyzeRenderedHTML(html) {
    console.log('\n=== RENDERED HTML ANALYSIS ===');

    // Check for calendar grid
    const hasCalendarGrid = html.includes('calendar-grid');
    console.log(`Calendar grid present: ${hasCalendarGrid ? 'YES' : 'NO'}`);

    // Check for calendar-grid-anim wrapper
    const hasGridAnim = html.includes('calendar-grid-anim');
    console.log(`Calendar grid anim wrapper: ${hasGridAnim ? 'YES' : 'NO'}`);

    // Check for table element
    const hasTable = html.includes('<table');
    console.log(`Table element present: ${hasTable ? 'YES' : 'NO'}`);

    // Check for Gregorian cells
    const gregorianCells = html.match(/data-iso="[^"]*"/g) || [];
    console.log(`Gregorian cells found: ${gregorianCells.length}`);

    // Check for custom calendar info
    const customInfoElements = html.match(/custom-calendar-info/g) || [];
    console.log(`Custom calendar info elements: ${customInfoElements.length}`);

    // Check for dual date containers
    const dualDateContainers = html.match(/dual-date-container/g) || [];
    console.log(`Dual date containers: ${dualDateContainers.length}`);

    // Look for specific date mappings
    console.log('\n--- SAMPLE DATE MAPPINGS ---');
    const cellMatches = html.match(/<td[^>]*data-iso="([^"]*)"[^>]*>(.*?)<\/td>/g) || [];

    cellMatches.slice(0, 10).forEach((match, index) => {
        const isoMatch = match.match(/data-iso="([^"]*)"/);
        const contentMatch = match.match(/<td[^>]*>(.*?)<\/td>/);

        if (isoMatch && contentMatch) {
            const iso = isoMatch[1];
            const content = contentMatch[1].replace(/<[^>]*>/g, '').trim();
            console.log(`${index + 1}. ${iso}: "${content}"`);
        }
    });

    // Check for special day classes
    console.log('\n--- SPECIAL DAY CLASSES ---');
    const specialClasses = [
        'hot-pink-day',
        'atonement-magenta-day',
        'ruby-red-day',
        'emerald-green-day'
    ];

    specialClasses.forEach(cls => {
        const count = (html.match(new RegExp(cls, 'g')) || []).length;
        console.log(`${cls}: ${count} instances`);
    });

    // Check for JavaScript includes
    console.log('\n--- JAVASCRIPT INCLUDES ---');
    const jsIncludes = [
        'calendar.js',
        'gregorian.js'
    ];

    jsIncludes.forEach(js => {
        const included = html.includes(js);
        console.log(`${js}: ${included ? 'INCLUDED' : 'MISSING'}`);
    });

    return {
        hasCalendarGrid,
        gregorianCells: gregorianCells.length,
        customInfoElements: customInfoElements.length,
        dualDateContainers: dualDateContainers.length
    };
}

function saveHTML(html) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `calendar_snapshot_${timestamp}.html`;

    fs.writeFileSync(filename, html);
    console.log(`\nHTML snapshot saved to: ${filename}`);
}

async function main() {
    try {
        const html = await fetchHTML();
        const analysis = analyzeRenderedHTML(html);
        saveHTML(html);

        console.log('\n=== SUMMARY ===');
        console.log(`Calendar grid: ${analysis.hasCalendarGrid ? 'OK' : 'PROBLEM'}`);
        console.log(`Gregorian cells: ${analysis.gregorianCells}`);
        console.log(`Custom info elements: ${analysis.customInfoElements}`);
        console.log(`Dual date containers: ${analysis.dualDateContainers}`);

        if (analysis.gregorianCells > 0 && analysis.customInfoElements === 0) {
            console.log('\n🚨 PROBLEM DETECTED: Gregorian cells exist but no custom calendar info!');
        } else if (analysis.gregorianCells === analysis.customInfoElements) {
            console.log('\n✅ GOOD: All Gregorian cells have custom calendar info');
        } else {
            console.log(`\n⚠️  MISMATCH: ${analysis.gregorianCells} cells vs ${analysis.customInfoElements} custom info elements`);
        }

    } catch (error) {
        console.error('Analysis failed:', error);
        console.log('\nMake sure the Flask app is running on http://localhost:5001');
    }
}

main();
