// Test script for Hebrew XML integration
// Run this in the browser console on the primitive roots page

console.log('🧪 Testing Hebrew XML Integration...');

// Test 1: Check if the parser class is available
if (typeof HebrewXMLParser !== 'undefined') {
    console.log('✅ HebrewXMLParser class is loaded');
} else {
    console.log('❌ HebrewXMLParser class not found');
}

// Test 2: Check if the autosuggest class is available
if (typeof HebrewAutosuggest !== 'undefined') {
    console.log('✅ HebrewAutosuggest class is loaded');
} else {
    console.log('❌ HebrewAutosuggest class not found');
}

// Test 3: Check if the enhanced analyzer is available
if (typeof EnhancedPrimitiveRootsAnalyzer !== 'undefined') {
    console.log('✅ EnhancedPrimitiveRootsAnalyzer class is loaded');
} else {
    console.log('❌ EnhancedPrimitiveRootsAnalyzer class not found');
}

// Test 4: Check if the analyzer instance is created
if (typeof window.currentAnalyzer !== 'undefined') {
    console.log('✅ Analyzer instance is created');

    // Test 5: Check if XML parser is initialized
    if (window.currentAnalyzer.xmlParser) {
        console.log('✅ XML parser is initialized');

        // Test 6: Check if XML is loaded
        if (window.currentAnalyzer.xmlParser.isLoaded) {
            console.log('✅ Hebrew XML data is loaded');
            console.log(`📊 Loaded ${window.currentAnalyzer.xmlParser.entries.size} entries`);
        } else {
            console.log('⏳ Hebrew XML data is still loading...');
        }
    } else {
        console.log('❌ XML parser not initialized');
    }
} else {
    console.log('❌ Analyzer instance not created');
}

// Test 7: Check DOM elements
const searchInput = document.getElementById('strongs-search');
const searchButton = document.getElementById('search-button');
const clearButton = document.getElementById('clear-button');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');
const loadingMessage = document.getElementById('loading-message');

if (searchInput) console.log('✅ Search input found');
if (searchButton) console.log('✅ Search button found');
if (clearButton) console.log('✅ Clear button found');
if (resultsContainer) console.log('✅ Results container found');
if (errorMessage) console.log('✅ Error message container found');
if (loadingMessage) console.log('✅ Loading message container found');

console.log('🎯 Test complete! Check the results above.');
