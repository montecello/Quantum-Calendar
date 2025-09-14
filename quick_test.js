// Quick test for Hebrew search functionality
// Copy and paste this into the browser console

console.log('🧪 Quick test of Hebrew search...');

// Test if the analyzer is loaded
if (typeof window.currentAnalyzer === 'undefined') {
    console.log('❌ Analyzer not found - page may not be fully loaded');
} else if (!window.currentAnalyzer.xmlParser) {
    console.log('❌ XML Parser not found');
} else if (!window.currentAnalyzer.xmlParser.isLoaded) {
    console.log('⏳ XML Parser not loaded yet - please wait');
} else {
    console.log('✅ Analyzer and parser are ready!');

    // Test basic search
    const testResults = window.currentAnalyzer.xmlParser.search('egypt', 3);
    console.log('Egypt search results:', testResults.length);
    testResults.forEach((result, i) => {
        console.log(`${i+1}. ${result.entryNumber}: ${result.hebrewWord} - ${result.meanings[0]}`);
    });

    // Test if Egypt appears at the top
    if (testResults.length > 0 && testResults[0].entryNumber === '4714') {
        console.log('🎯 SUCCESS: Egypt (H4714) appears at the top!');
    } else {
        console.log('⚠️ Egypt may not be at the top');
    }
}
