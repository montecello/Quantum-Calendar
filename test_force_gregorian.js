#!/usr/bin/env node

// Script to force Gregorian mode and test rendering
const { exec } = require('child_process');
const fs = require('fs');

console.log('=== FORCE GREGORIAN MODE TEST ===');

function testForceGregorianMode() {
    console.log('Testing forced switch to Gregorian mode...');

    // Create a test script that will run in the browser context
    const testScript = `
    <script>
        // Force Gregorian mode
        console.log('Current mode:', window.CalendarMode ? window.CalendarMode.mode : 'undefined');
        if (window.CalendarMode) {
            window.CalendarMode.mode = 'gregorian';
            console.log('Forced mode to Gregorian');

            // Update mode buttons
            if (typeof updateModeButtons === 'function') {
                updateModeButtons();
            }

            // Force re-render
            if (typeof renderCalendarForState === 'function') {
                console.log('Calling renderCalendarForState...');
                renderCalendarForState();
            }

            // Check results after a delay
            setTimeout(() => {
                const cells = document.querySelectorAll('td[data-iso]');
                console.log('Gregorian cells after render:', cells.length);

                cells.forEach((cell, i) => {
                    if (i < 3) {
                        console.log(\`Cell \${i+1}: ISO=\${cell.dataset.iso}, Gregorian=\${cell.dataset.gregorian}\`);
                    }
                });

                // Check for custom calendar info
                const customInfo = document.querySelectorAll('.custom-calendar-info');
                console.log('Custom calendar info elements:', customInfo.length);

            }, 1000);
        } else {
            console.log('CalendarMode not found');
        }
    </script>
    `;

    // Save the test script
    fs.writeFileSync('force_gregorian_test.html', testScript);
    console.log('Created force Gregorian test script');

    // The issue is that we can't easily inject this into the running app
    // Let's try a different approach - check if we can curl with a specific user agent or headers
    // that might force a cache refresh

    console.log('Testing with cache-busting headers...');
}

// Test with cache-busting
async function testWithCacheBust() {
    console.log('\n=== CACHE-BUSTING TEST ===');

    try {
        // Try fetching with cache-busting headers
        const commands = [
            'curl -s -H "Cache-Control: no-cache" -H "Pragma: no-cache" http://localhost:5001',
            'curl -s -H "Cache-Control: no-cache" -H "Pragma: no-cache" -H "User-Agent: Mozilla/5.0 (Test Browser)" http://localhost:5001'
        ];

        for (let i = 0; i < commands.length; i++) {
            console.log(`\nTest ${i + 1}: ${commands[i]}`);

            const result = await new Promise((resolve, reject) => {
                exec(commands[i], (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(stdout);
                });
            });

            // Analyze the result
            const gregorianCells = (result.match(/data-iso/g) || []).length;
            const customInfo = (result.match(/custom-calendar-info/g) || []).length;

            console.log(`  Gregorian cells: ${gregorianCells}`);
            console.log(`  Custom info elements: ${customInfo}`);

            if (gregorianCells > 0) {
                console.log('  ✅ SUCCESS: Gregorian cells found!');
                return true;
            }
        }

        console.log('❌ All cache-busting attempts failed');
        return false;

    } catch (error) {
        console.error('Cache-busting test failed:', error.message);
        return false;
    }
}

// Test by checking if the JavaScript file has been updated
async function checkJavaScriptUpdate() {
    console.log('\n=== JAVASCRIPT UPDATE CHECK ===');

    try {
        // Check the calendar.js file modification time
        const stats = fs.statSync('/Users/m/calendar.heyyou.eth/Quantum-Calendar/frontend/static/js/calendar.js');
        const modTime = stats.mtime;
        console.log('calendar.js last modified:', modTime.toISOString());

        // Check if the fix is present in the file
        const content = fs.readFileSync('/Users/m/calendar.heyyou.eth/Quantum-Calendar/frontend/static/js/calendar.js', 'utf8');
        const hasFix = content.includes("if (window.CalendarMode && window.CalendarMode.mode === 'gregorian')");

        console.log('Fix present in calendar.js:', hasFix ? '✅ YES' : '❌ NO');

        if (hasFix) {
            console.log('✅ The fix has been applied to the JavaScript file');
            console.log('Note: The live app may need to be restarted or the browser cache cleared for changes to take effect');
        } else {
            console.log('❌ The fix was not found in the JavaScript file');
        }

    } catch (error) {
        console.error('JavaScript check failed:', error.message);
    }
}

async function main() {
    testForceGregorianMode();
    const cacheBustSuccess = await testWithCacheBust();
    await checkJavaScriptUpdate();

    console.log('\n=== CONCLUSION ===');
    if (cacheBustSuccess) {
        console.log('✅ Gregorian calendar is now rendering correctly!');
    } else {
        console.log('❌ Gregorian calendar is still not rendering.');
        console.log('The issue may be that:');
        console.log('1. The Flask app needs to be restarted to pick up JavaScript changes');
        console.log('2. The browser cache needs to be cleared');
        console.log('3. There may be additional issues with the Gregorian rendering logic');
    }
}

main();
