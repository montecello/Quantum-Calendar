const puppeteer = require('puppeteer');

async function testGregorianMode() {
    console.log('=== TESTING GREGORIAN MODE SWITCH ===');

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        // Navigate to the app
        await page.goto('http://localhost:5001');

        // Wait for calendar to load
        await page.waitForSelector('#calendar-grid-root', { timeout: 10000 });

        // Check initial mode
        const initialMode = await page.evaluate(() => {
            return window.CalendarMode ? window.CalendarMode.mode : 'unknown';
        });
        console.log('Initial calendar mode:', initialMode);

        // Click Gregorian mode button
        console.log('Clicking Gregorian mode button...');
        await page.click('#mode-gregorian');

        // Wait for mode change
        await page.waitForTimeout(1000);

        // Check new mode
        const newMode = await page.evaluate(() => {
            return window.CalendarMode ? window.CalendarMode.mode : 'unknown';
        });
        console.log('Calendar mode after switch:', newMode);

        // Wait for Gregorian cells to render
        await page.waitForTimeout(2000);

        // Analyze Gregorian cells
        const analysis = await page.evaluate(() => {
            const cells = document.querySelectorAll('td.day-cell[data-iso]');
            const results = {
                gregorianCells: cells.length,
                cellsWithCustomInfo: 0,
                cellsWithDualDate: 0,
                sampleCells: []
            };

            cells.forEach((cell, index) => {
                const iso = cell.dataset.iso;
                const customInfo = cell.querySelector('.custom-calendar-info');
                const dualDate = cell.querySelector('.dual-date-container');

                if (customInfo) results.cellsWithCustomInfo++;
                if (dualDate) results.cellsWithDualDate++;

                if (index < 3) { // Sample first 3 cells
                    results.sampleCells.push({
                        iso: iso,
                        hasCustomInfo: !!customInfo,
                        hasDualDate: !!dualDate,
                        customText: customInfo ? customInfo.textContent : null,
                        html: cell.innerHTML.substring(0, 200) + '...'
                    });
                }
            });

            return results;
        });

        console.log('Analysis results:');
        console.log('- Gregorian cells found:', analysis.gregorianCells);
        console.log('- Cells with custom calendar info:', analysis.cellsWithCustomInfo);
        console.log('- Cells with dual date containers:', analysis.cellsWithDualDate);

        console.log('\nSample cells:');
        analysis.sampleCells.forEach((cell, i) => {
            console.log(`Cell ${i+1}:`);
            console.log(`  ISO: ${cell.iso}`);
            console.log(`  Has custom info: ${cell.hasCustomInfo}`);
            console.log(`  Has dual date: ${cell.hasDualDate}`);
            console.log(`  Custom text: ${cell.customText}`);
            console.log(`  HTML preview: ${cell.html}`);
        });

        // Check if the refresh function ran
        const refreshCheck = await page.evaluate(() => {
            // Check if there are any cells with custom calendar info that should have been added
            const cells = document.querySelectorAll('td.day-cell[data-iso]');
            let cellsWithInfo = 0;
            cells.forEach(cell => {
                if (cell.querySelector('.custom-calendar-info')) cellsWithInfo++;
            });
            return cellsWithInfo;
        });

        console.log('\nRefresh function check - cells with custom info:', refreshCheck);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
}

testGregorianMode();
