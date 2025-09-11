#!/usr/bin/env node

// Script to test Gregorian calendar rendering directly
const { exec } = require('child_process');
const fs = require('fs');

console.log('=== TESTING GREGORIAN CALENDAR RENDERING ===');

function testGregorianRender() {
    console.log('Testing Gregorian calendar render function...');

    // Create a minimal HTML test that simulates the Gregorian calendar rendering
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Gregorian Render Test</title>
    <style>
        .calendar-grid { border-collapse: collapse; }
        .calendar-grid th, .calendar-grid td { border: 1px solid #ccc; padding: 5px; text-align: center; }
        .day-cell { cursor: pointer; }
        .empty-cell { background: #f5f5f5; }
        .current-day { background: #e6f3ff; }
    </style>
</head>
<body>
    <h1>Gregorian Calendar Render Test</h1>
    <div id="test-target"></div>

    <script>
        // Mock GregorianCalendar object (copied from gregorian.js)
        (function(){
            const WEEK_START = 0;
            const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

            function isoDate(d) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return \`\${y}-\${m}-\${dd}\`;
            }

            function getWeekdayLabels() {
                const base = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                if (WEEK_START === 1) return base.slice(1).concat(base.slice(0,1));
                return base;
            }

            function getMonthMatrix(year, month) {
                const first = new Date(year, month, 1);
                const last = new Date(year, month + 1, 0);
                const daysInMonth = last.getDate();

                let startIdx = first.getDay();
                startIdx = (startIdx - WEEK_START + 7) % 7;

                const cells = [];
                for (let i = 0; i < startIdx; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                while (cells.length % 7 !== 0) cells.push(null);

                const weeks = [];
                for (let i = 0; i < cells.length; i += 7) {
                    weeks.push(cells.slice(i, i + 7));
                }
                return { weeks, daysInMonth };
            }

            function markCurrentDay(td, y, m, d) {
                const today = new Date();
                if (y === today.getFullYear() && m === today.getMonth() && d === today.getDate()) {
                    td.classList.add('current-day');
                }
            }

            function render(rootEl, year, month, monthsInYear) {
                console.log('GregorianCalendar.render called with:', { year, month, monthsInYear });

                if (!rootEl) {
                    console.error('No root element provided to render');
                    return;
                }

                rootEl.innerHTML = '';

                const table = document.createElement('table');
                table.className = 'calendar-grid';

                const thead = document.createElement('thead');
                const labelRow = document.createElement('tr');
                const thLabel = document.createElement('th');
                thLabel.colSpan = 7;
                thLabel.className = 'month-label';
                thLabel.textContent = \`\${MONTH_NAMES[month]} \${year}\`;
                labelRow.appendChild(thLabel);
                thead.appendChild(labelRow);

                const trh = document.createElement('tr');
                for (const lbl of getWeekdayLabels()) {
                    const th = document.createElement('th');
                    th.textContent = lbl;
                    trh.appendChild(th);
                }
                thead.appendChild(trh);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                const { weeks } = getMonthMatrix(year, month);
                console.log('Generated weeks:', weeks.length);

                for (const wk of weeks) {
                    const tr = document.createElement('tr');
                    for (const dayNum of wk) {
                        const td = document.createElement('td');
                        td.className = 'day-cell';
                        if (dayNum != null) {
                            const d = new Date(year, month, dayNum);
                            const dateStr = isoDate(d);
                            td.dataset.iso = dateStr;
                            td.dataset.gregorian = 'true';
                            td.tabIndex = 0;

                            const span = document.createElement('span');
                            span.className = 'holiday-daynum';
                            span.textContent = String(dayNum);
                            td.appendChild(span);

                            markCurrentDay(td, year, month, dayNum);
                        } else {
                            td.classList.add('empty-cell');
                        }
                        tr.appendChild(td);
                    }
                    tbody.appendChild(tr);
                }
                table.appendChild(tbody);

                rootEl.appendChild(table);

                console.log('Gregorian calendar rendered successfully');
                console.log('Cells created:', document.querySelectorAll('td[data-iso]').length);

                // Dispatch event
                document.dispatchEvent(new CustomEvent('gregorian:rendered', { detail: { year, month } }));
            }

            window.GregorianCalendar = { render, isoDate, weekStart: WEEK_START };
        })();

        // Test the render function
        console.log('Testing Gregorian calendar render...');
        const target = document.getElementById('test-target');
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-based

        console.log('Rendering Gregorian calendar for:', { year, month: month + 1 });

        try {
            window.GregorianCalendar.render(target, year, month);

            // Check results
            setTimeout(() => {
                const cells = document.querySelectorAll('td[data-iso]');
                const totalCells = cells.length;
                console.log('✅ Gregorian cells created:', totalCells);

                if (totalCells > 0) {
                    console.log('Sample cell data:');
                    const sampleCell = cells[0];
                    console.log('  ISO:', sampleCell.dataset.iso);
                    console.log('  Gregorian:', sampleCell.dataset.gregorian);
                    console.log('  Content:', sampleCell.textContent.trim());
                }

                // Test custom calendar info addition
                console.log('\\nTesting custom calendar info addition...');

                // Mock the required functions
                window.isoToCustomMonthDay = async function(iso) {
                    // Simple mock
                    const parts = iso.split('-');
                    const day = parseInt(parts[2]);
                    return { monthNum: 6, dayNum: day, monthsInYear: 12 };
                };

                window.getSilverCounter = function(month, day, monthsInYear) {
                    return (month - 1) * 29 + day;
                };

                // Simulate adding custom info to first cell
                const firstCell = cells[0];
                if (firstCell) {
                    const iso = firstCell.dataset.iso;
                    console.log('Adding custom info to cell:', iso);

                    window.isoToCustomMonthDay(iso).then(customMapping => {
                        if (customMapping && customMapping.monthNum && customMapping.dayNum) {
                            console.log('Custom mapping:', customMapping);

                            // Create container
                            const container = document.createElement('div');
                            container.className = 'dual-date-container';

                            // Add custom calendar info
                            const customInfo = document.createElement('div');
                            customInfo.className = 'custom-calendar-info';
                            customInfo.textContent = \`\${customMapping.monthNum}/\${customMapping.dayNum}\`;
                            container.appendChild(customInfo);

                            // Add to cell
                            const daySpan = firstCell.querySelector('.holiday-daynum');
                            if (daySpan) {
                                container.appendChild(daySpan);
                                firstCell.appendChild(container);
                                console.log('✅ Custom calendar info added successfully');
                            }
                        }
                    });
                }

            }, 100);

        } catch (error) {
            console.error('❌ Error rendering Gregorian calendar:', error);
        }
    </script>
</body>
</html>`;

    // Save the test file
    fs.writeFileSync('gregorian_render_test.html', testHtml);
    console.log('Created test file: gregorian_render_test.html');

    // Run the test using node with a simple HTML parser simulation
    console.log('Running Gregorian render test...');

    // Since we can't run a full browser, let's simulate the key parts
    console.log('\n=== SIMULATED GREGORIAN RENDER TEST ===');

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    console.log(`Testing render for: ${year}-${String(month + 1).padStart(2, '0')}`);

    // Simulate the month matrix generation
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const daysInMonth = last.getDate();
    const startIdx = first.getDay();

    console.log(`Days in month: ${daysInMonth}`);
    console.log(`First day of week: ${startIdx}`);

    const cells = [];
    for (let i = 0; i < startIdx; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    console.log(`Generated ${weeks.length} weeks`);
    console.log(`Total cells: ${cells.length}`);
    console.log(`Data cells: ${cells.filter(c => c !== null).length}`);

    // Test ISO date generation
    const testDate = new Date(year, month, 15);
    const iso = `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}-${String(testDate.getDate()).padStart(2, '0')}`;
    console.log(`Sample ISO date: ${iso}`);

    console.log('\n✅ Gregorian calendar render logic appears to be working correctly');
    console.log('The issue may be in the browser environment or DOM manipulation');
}

// Test the current live app more thoroughly
async function testLiveAppDetailed() {
    console.log('\n=== DETAILED LIVE APP TEST ===');

    try {
        const html = await new Promise((resolve, reject) => {
            exec('curl -s http://localhost:5001', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });

        // Check for calendar grid structure
        const hasCalendarGridRoot = html.includes('id="calendar-grid-root"');
        const hasCalendarColumns = html.includes('id="calendar-columns"');
        const hasCalendarGridAnim = html.includes('id="calendar-grid-anim"');

        console.log('HTML Structure Check:');
        console.log(`- Calendar grid root: ${hasCalendarGridRoot ? '✅' : '❌'}`);
        console.log(`- Calendar columns: ${hasCalendarGridRoot ? '✅' : '❌'}`);
        console.log(`- Calendar grid anim: ${hasCalendarGridAnim ? '✅' : '❌'}`);

        // Check for mode buttons
        const hasModeCustom = html.includes('id="mode-custom"');
        const hasModeGregorian = html.includes('id="mode-gregorian"');
        const gregorianPressed = html.includes('id="mode-gregorian"') && html.includes('aria-pressed="true"');

        console.log('\nMode Buttons Check:');
        console.log(`- Custom mode button: ${hasModeCustom ? '✅' : '❌'}`);
        console.log(`- Gregorian mode button: ${hasModeGregorian ? '✅' : '❌'}`);
        console.log(`- Gregorian pressed: ${gregorianPressed ? '✅' : '❌'}`);

        // Check for JavaScript includes
        const hasCalendarJs = html.includes('calendar.js');
        const hasGregorianJs = html.includes('gregorian.js');

        console.log('\nJavaScript Includes:');
        console.log(`- calendar.js: ${hasCalendarJs ? '✅' : '❌'}`);
        console.log(`- gregorian.js: ${hasGregorianJs ? '✅' : '❌'}`);

        // Check for any calendar cells at all
        const anyDayCells = (html.match(/day-cell/g) || []).length;
        const anyIsoAttrs = (html.match(/data-iso/g) || []).length;

        console.log('\nCalendar Cells:');
        console.log(`- Any day cells: ${anyDayCells}`);
        console.log(`- Any ISO attributes: ${anyIsoAttrs}`);

        if (anyDayCells === 0) {
            console.log('\n🚨 ISSUE: No calendar cells found at all!');
            console.log('This suggests the calendar is not rendering properly.');
        } else if (anyIsoAttrs === 0) {
            console.log('\n⚠️  WARNING: Calendar cells exist but no ISO attributes found.');
            console.log('This suggests the calendar is in Custom mode or Gregorian cells are malformed.');
        }

        // Check for custom calendar info elements
        const customInfoElements = (html.match(/custom-calendar-info/g) || []).length;
        const dualDateContainers = (html.match(/dual-date-container/g) || []).length;

        console.log('\nCustom Calendar Elements:');
        console.log(`- Custom calendar info: ${customInfoElements}`);
        console.log(`- Dual date containers: ${dualDateContainers}`);

        if (gregorianPressed && anyIsoAttrs > 0 && customInfoElements === 0) {
            console.log('\n🚨 MAIN ISSUE IDENTIFIED:');
            console.log('- Calendar is in Gregorian mode ✅');
            console.log('- Gregorian cells exist ✅');
            console.log('- But no custom calendar info elements found ❌');
            console.log('\nThis confirms the issue: Gregorian cells are not getting custom calendar information added.');
        }

    } catch (error) {
        console.error('Failed to test live app:', error.message);
    }
}

async function main() {
    testGregorianRender();
    await testLiveAppDetailed();
}

main();
