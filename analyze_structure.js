#!/usr/bin/env node

// Script to analyze HTML structure and check for custom calendar info
const fs = require('fs');
const path = require('path');

console.log('=== HTML STRUCTURE ANALYSIS ===');

function analyzeHTML() {
    try {
        // Read the main template file
        const templatePath = path.join(__dirname, 'frontend', 'templates', 'index.html');
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        console.log('Template structure:');
        console.log('- Calendar grid root:', templateContent.includes('calendar-grid-root') ? 'PRESENT' : 'MISSING');
        console.log('- Calendar columns:', templateContent.includes('calendar-columns') ? 'PRESENT' : 'MISSING');
        console.log('- Side panel:', templateContent.includes('side-panel') ? 'PRESENT' : 'MISSING');

        // Check for JavaScript includes
        console.log('\nJavaScript includes:');
        const jsFiles = [
            'calendar.js',
            'gregorian.js',
            'calendar_grid.css'
        ];

        jsFiles.forEach(file => {
            const included = templateContent.includes(file);
            console.log(`- ${file}: ${included ? 'INCLUDED' : 'MISSING'}`);
        });

        // Check for key HTML elements
        console.log('\nKey HTML elements:');
        const elements = [
            'calendar-grid-anim',
            'calendar-grid-root',
            'calendar-columns',
            'side-panel'
        ];

        elements.forEach(element => {
            const present = templateContent.includes(`id="${element}"`) || templateContent.includes(`class="${element}"`);
            console.log(`- ${element}: ${present ? 'PRESENT' : 'MISSING'}`);
        });

    } catch (error) {
        console.error('Error reading template:', error);
    }
}

function analyzeCSS() {
    try {
        const cssPath = path.join(__dirname, 'frontend', 'static', 'css', 'calendar_grid.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        console.log('\n=== CSS ANALYSIS ===');
        console.log('Custom calendar info styles:');
        console.log('- .custom-calendar-info:', cssContent.includes('custom-calendar-info') ? 'PRESENT' : 'MISSING');
        console.log('- .dual-date-container:', cssContent.includes('dual-date-container') ? 'PRESENT' : 'MISSING');
        console.log('- .gregorian-info:', cssContent.includes('gregorian-info') ? 'PRESENT' : 'MISSING');

        // Check for special day colors
        console.log('\nSpecial day colors:');
        const colors = [
            'hot-pink-day',
            'atonement-magenta-day',
            'ruby-red-day',
            'emerald-green-day'
        ];

        colors.forEach(color => {
            const present = cssContent.includes(color);
            console.log(`- ${color}: ${present ? 'PRESENT' : 'MISSING'}`);
        });

    } catch (error) {
        console.error('Error reading CSS:', error);
    }
}

function analyzeJavaScript() {
    try {
        const jsPath = path.join(__dirname, 'frontend', 'static', 'js', 'calendar.js');
        const jsContent = fs.readFileSync(jsPath, 'utf8');

        console.log('\n=== JAVASCRIPT ANALYSIS ===');
        console.log('Key functions:');
        console.log('- isoToCustomMonthDay:', jsContent.includes('function isoToCustomMonthDay') ? 'PRESENT' : 'MISSING');
        console.log('- recalculateMonthCalculations:', jsContent.includes('function recalculateMonthCalculations') ? 'PRESENT' : 'MISSING');
        console.log('- getSpecialDayClassesForISO:', jsContent.includes('getSpecialDayClassesForISO') ? 'PRESENT' : 'MISSING');

        // Check for recent changes
        console.log('\nRecent modifications:');
        console.log('- Gregorian cell refresh:', jsContent.includes('Re-apply custom calendar info') ? 'PRESENT' : 'MISSING');
        console.log('- getSilverCounter global:', jsContent.includes('window.getSilverCounter') ? 'PRESENT' : 'MISSING');

    } catch (error) {
        console.error('Error reading JavaScript:', error);
    }
}

function checkFileStructure() {
    console.log('\n=== FILE STRUCTURE CHECK ===');

    const requiredFiles = [
        'frontend/templates/index.html',
        'frontend/static/js/calendar.js',
        'frontend/static/js/gregorian.js',
        'frontend/static/css/calendar_grid.css'
    ];

    requiredFiles.forEach(file => {
        const fullPath = path.join(__dirname, file);
        const exists = fs.existsSync(fullPath);
        console.log(`${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
}

// Run all analyses
analyzeHTML();
analyzeCSS();
analyzeJavaScript();
checkFileStructure();

console.log('\n=== ANALYSIS COMPLETE ===');
