// Primitive Roots Analysis for Hebrew Words
// Based on Strong's Hebrew Dictionary and primitive root theory

class PrimitiveRootsAnalyzer {
    constructor() {
        this.strongsData = {};
        this.primitiveRoots = this.initializePrimitiveRoots();
        this.initializeEventListeners();
        this.loadStrongsData();
    }

    async loadStrongsData() {
        console.log('🔍 [MongoDB Test] Starting data loading process...');
        console.log('🌐 [MongoDB Test] Current URL:', window.location.href);
        console.log('📡 [MongoDB Test] API Base URL will be relative to current domain');

        try {
            // First, try to get debug information
            console.log('🔧 [MongoDB Test] Fetching debug information...');
            try {
                const debugResponse = await fetch('/api/debug');
                if (debugResponse.ok) {
                    const debugInfo = await debugResponse.json();
                    console.log('🔧 [MongoDB Test] Debug info retrieved:', {
                        mongodb_available: debugInfo.mongodb_status?.MONGODB_AVAILABLE,
                        pymongo_version: debugInfo.mongodb_status?.pymongo_version,
                        environment: debugInfo.environment_variables,
                        files_exist: {
                            backend_strongs: debugInfo.file_system?.backend_strongs_file,
                            backend_kjv: debugInfo.file_system?.backend_kjv_file,
                            static_strongs: debugInfo.file_system?.static_strongs_file,
                            static_kjv: debugInfo.file_system?.static_kjv_file
                        }
                    });
                } else {
                    console.warn('⚠️  [MongoDB Test] Could not fetch debug info:', debugResponse.status);
                }
            } catch (debugError) {
                console.warn('⚠️  [MongoDB Test] Debug fetch failed:', debugError.message);
            }

            // Try primary routes first (original backend routes)
            console.log('📡 [MongoDB Test] Attempting to load from primary Flask routes...');

            let strongsResponse = await fetch('/backend/data/hebrew_strongs.json');
            let versesResponse = await fetch('/backend/data/kjv_verses.json');

            console.log(`📊 [MongoDB Test] Primary routes status - Strong's: ${strongsResponse.status}, KJV: ${versesResponse.status}`);

            // If primary routes fail (404), try alternative API routes
            if (!strongsResponse.ok || !versesResponse.ok) {
                console.log('🔄 [MongoDB Test] Primary routes failed, trying alternative API routes...');
                strongsResponse = await fetch('/api/strongs-data');
                versesResponse = await fetch('/api/kjv-data');
                console.log(`📊 [MongoDB Test] Alternative routes status - Strong's: ${strongsResponse.status}, KJV: ${versesResponse.status}`);
            }

            if (strongsResponse.ok && versesResponse.ok) {
                console.log('✅ [MongoDB Test] API endpoints responded successfully!');
                console.log(`📊 [MongoDB Test] Strong's response status: ${strongsResponse.status}`);
                console.log(`📊 [MongoDB Test] KJV response status: ${versesResponse.status}`);

                const strongsData = await strongsResponse.json();
                const versesData = await versesResponse.json();

                console.log(`🎯 [MongoDB Test] SUCCESS! Loaded ${strongsData.length} Strong's entries from MongoDB`);
                console.log(`🎯 [MongoDB Test] SUCCESS! Loaded ${versesData.length} KJV verses from MongoDB`);
                console.log('🚀 [MongoDB Test] Data source: MongoDB Atlas via Flask API');

                // Process and store the data
                this.strongsData = this.processStrongsData(strongsData);
                this.versesData = this.processVersesData(versesData);

                console.log(`📈 [MongoDB Test] Processed ${Object.keys(this.strongsData).length} Strong's entries for search`);
                console.log(`📈 [MongoDB Test] Processed ${this.versesData.length} verses for search`);

                // Show sample data to verify
                const sampleKeys = Object.keys(this.strongsData).slice(0, 3);
                console.log('🔍 [MongoDB Test] Sample Strong\'s entries:', sampleKeys.map(key => ({
                    number: key,
                    word: this.strongsData[key].word,
                    language: this.strongsData[key].language
                })));

                if (this.versesData.length > 0) {
                    console.log('🔍 [MongoDB Test] Sample KJV verse:', {
                        reference: `${this.versesData[0].book} ${this.versesData[0].chapter}:${this.versesData[0].verse}`,
                        text: this.versesData[0].text.substring(0, 50) + '...',
                        strongsCount: this.versesData[0].strongsNumbers?.length || 0
                    });
                }

            } else {
                console.error('❌ [MongoDB Test] All API routes failed!');
                console.error(`🚨 [MongoDB Test] Strong's response: ${strongsResponse.status} ${strongsResponse.statusText}`);
                console.error(`🚨 [MongoDB Test] KJV response: ${versesResponse.status} ${versesResponse.statusText}`);

                // Try to get error details from responses
                try {
                    const strongsError = await strongsResponse.json();
                    console.error('🚨 [MongoDB Test] Strong\'s error details:', strongsError);
                } catch (e) {
                    console.error('🚨 [MongoDB Test] Could not parse Strong\'s error response');
                }

                try {
                    const kjvError = await versesResponse.json();
                    console.error('🚨 [MongoDB Test] KJV error details:', kjvError);
                } catch (e) {
                    console.error('🚨 [MongoDB Test] Could not parse KJV error response');
                }

                throw new Error(`All API routes failed: Primary ${strongsResponse.status}, Alternative ${versesResponse.status}`);
            }

        } catch (error) {
            console.error('❌ [MongoDB Test] All API routes failed, falling back to static files:', error.message);
            console.log('🔄 [MongoDB Test] Attempting fallback to static JSON files...');

            try {
                // Fallback to static files
                const strongsResponse = await fetch('/static/data/strongs_complete.json');
                const versesResponse = await fetch('/static/data/kjv_verses.json');

                console.log(`📊 [MongoDB Test] Static files status - Strong's: ${strongsResponse.status}, KJV: ${versesResponse.status}`);

                if (!strongsResponse.ok || !versesResponse.ok) {
                    console.error('❌ [MongoDB Test] Static files also failed!');
                    console.error(`🚨 [MongoDB Test] Static Strong's: ${strongsResponse.status} ${strongsResponse.statusText}`);
                    console.error(`🚨 [MongoDB Test] Static KJV: ${versesResponse.status} ${versesResponse.statusText}`);
                    throw new Error('Static files also failed to load');
                }

                const strongsData = await strongsResponse.json();
                const versesData = await versesResponse.json();

                console.log(`📁 [MongoDB Test] FALLBACK: Loaded ${strongsData.length} Strong's entries from static files`);
                console.log(`📁 [MongoDB Test] FALLBACK: Loaded ${versesData.length} KJV verses from static files`);
                console.log('⚠️ [MongoDB Test] Data source: Static JSON files (MongoDB not available)');

                // Process and store the data
                this.strongsData = this.processStrongsData(strongsData);
                this.versesData = this.processVersesData(versesData);

            } catch (staticError) {
                console.error('❌ [MongoDB Test] CRITICAL: Both MongoDB and static files failed!');
                console.error('💥 [MongoDB Test] Static error details:', staticError.message);

                // Ultimate fallback to sample data
                console.log('🆘 [MongoDB Test] Using emergency sample data');
                this.strongsData = this.getSampleData();
                this.versesData = [];
            }
        }

        console.log('🏁 [MongoDB Test] Data loading process complete');
        console.log('💡 [MongoDB Test] Ready for search queries!');
    }

    // New method to process Strong's data into a searchable object
    processStrongsData(data) {
        const processed = {};
        data.forEach(entry => {
            processed[entry.strongsNumber] = entry;
        });
        return processed;
    }

    // New method to process verses data
    processVersesData(data) {
        // For now, just store as array; you can add indexing later
        return data;
    }

    getSampleData() {
        return {
            1: { hebrew: 'אָב', english: 'father', primitiveRoot: 1 },
            // ... existing sample data ...
        };
    }

    // Initialize Strong's Hebrew Dictionary data
    // This will be loaded from the API
    async initializeStrongsData() {
        // For now, keep sample data; in production, load from API
        return {
            // Sample data - in a real implementation, this would be much more comprehensive
            // Format: strongsNumber: { hebrew: 'word', english: 'translation', primitiveRoot: rootNumber }
            1: { hebrew: 'אָב', english: 'father', primitiveRoot: 1 },
            2: { hebrew: 'אַב', english: 'father', primitiveRoot: 1 },
            3: { hebrew: 'אֵב', english: 'fruit', primitiveRoot: 3 },
            4: { hebrew: 'אָב', english: 'father', primitiveRoot: 1 },
            5: { hebrew: 'אַבָּה', english: 'father', primitiveRoot: 1 },
            6: { hebrew: 'אָבַד', english: 'perish', primitiveRoot: 6 },
            7: { hebrew: 'אָבַד', english: 'destroy', primitiveRoot: 6 },
            8: { hebrew: 'אָבַד', english: 'lost', primitiveRoot: 6 },
            9: { hebrew: 'אֲבַדּוֹה', english: 'destruction', primitiveRoot: 6 },
            10: { hebrew: 'אֲבַדּוֹן', english: 'destruction', primitiveRoot: 6 },
            11: { hebrew: 'אֲבַדּוֹן', english: 'Abaddon', primitiveRoot: 6 },
            12: { hebrew: 'אֲבַדּוֹן', english: 'destruction', primitiveRoot: 6 },
            13: { hebrew: 'אָבַד', english: 'perish', primitiveRoot: 6 },
            14: { hebrew: 'אָבָה', english: 'will', primitiveRoot: 14 },
            15: { hebrew: 'אָבָה', english: 'desire', primitiveRoot: 14 },
            16: { hebrew: 'אֵבֶה', english: 'reed', primitiveRoot: 16 },
            17: { hebrew: 'אֵבֶה', english: 'reed', primitiveRoot: 16 },
            18: { hebrew: 'אֵבוּס', english: 'manger', primitiveRoot: 18 },
            19: { hebrew: 'אִבְחָה', english: 'slaughter', primitiveRoot: 19 },
            20: { hebrew: 'אִבְחָה', english: 'slaughter', primitiveRoot: 19 },
            21: { hebrew: 'אִבְחָה', english: 'slaughter', primitiveRoot: 19 },
            22: { hebrew: 'אֲבִי', english: 'Abihu', primitiveRoot: 1 },
            23: { hebrew: 'אֲבִי', english: 'Abijah', primitiveRoot: 1 },
            24: { hebrew: 'אֲבִי', english: 'Abiah', primitiveRoot: 1 },
            25: { hebrew: 'אֲבִי אָל', english: 'Abialbon', primitiveRoot: 1 },
            26: { hebrew: 'אֲבִי־אַלְבוֹן', english: 'Abialbon', primitiveRoot: 1 },
            27: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            28: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            29: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            30: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            31: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            32: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            33: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            34: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            35: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            36: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            37: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            38: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            39: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            40: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            41: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            42: { hebrew: 'אֲבִי־אָסָף', englishRoot: 27 },
            43: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            44: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            45: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            46: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            47: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            48: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            49: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            50: { hebrew: 'אֲבִי־אָסָף', english: 'Abi-asaph', primitiveRoot: 27 },
            // Add more Strong's numbers as needed...
        };
    }

    // Initialize primitive root mappings
    // These represent the fundamental meanings of the root words
    initializePrimitiveRoots() {
        return {
            1: {
                hebrew: 'אָב',
                english: 'father',
                meaning: 'source, origin, beginning',
                verbMeaning: 'to be father, to originate, to create'
            },
            6: {
                hebrew: 'אָבַד',
                english: 'perish',
                meaning: 'destruction, loss, separation',
                verbMeaning: 'to be lost, to destroy, to wander'
            },
            14: {
                hebrew: 'אָבָה',
                english: 'desire',
                meaning: 'will, wish, longing',
                verbMeaning: 'to desire, to wish, to long for'
            },
            16: {
                hebrew: 'אֵבֶה',
                english: 'reed',
                meaning: 'fragile, weak, easily broken',
                verbMeaning: 'to be fragile, to break easily'
            },
            18: {
                hebrew: 'אֵבוּס',
                english: 'manger',
                meaning: 'feeding trough, nourishment',
                verbMeaning: 'to feed, to nourish'
            },
            19: {
                hebrew: 'אִבְחָה',
                english: 'slaughter',
                meaning: 'sacrifice, offering, killing',
                verbMeaning: 'to slaughter, to sacrifice'
            },
            27: {
                hebrew: 'אֲבִי־אָסָף',
                english: 'gathering',
                meaning: 'collection, assembly, congregation',
                verbMeaning: 'to gather, to assemble, to collect'
            }
            // Add more primitive roots as needed...
        };
    }

    // Initialize event listeners for the search functionality
    initializeEventListeners() {
        const searchInput = document.getElementById('strongs-search');
        const searchButton = document.getElementById('search-button');
        const clearButton = document.getElementById('clear-button');

        if (searchInput && searchButton) {
            searchButton.addEventListener('click', () => this.performSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearResults());
        }
    }

    // Perform search for Strong's number or Hebrew word
    async performSearch() {
        const searchInput = document.getElementById('strongs-search');
        const query = searchInput.value.trim();

        console.log(`🔎 [MongoDB Test] Starting search for: "${query}"`);

        if (!query) {
            console.log('⚠️ [MongoDB Test] Empty search query, showing error');
            this.showError('Please enter a Strong\'s number or Hebrew word to search.');
            return;
        }

        try {
            console.log('🔍 [MongoDB Test] Executing search against loaded data...');
            const results = this.searchStrongsData(query);

            console.log(`📊 [MongoDB Test] Search completed: ${results.length} results found`);
            console.log(`📋 [MongoDB Test] Result breakdown:`, {
                strongs: results.filter(r => r.type === 'strongs').length,
                verses: results.filter(r => r.type === 'verse').length
            });

            if (results.length > 0) {
                console.log('🎯 [MongoDB Test] Sample results:');
                results.slice(0, 3).forEach((result, index) => {
                    if (result.type === 'strongs') {
                        console.log(`   ${index + 1}. Strong's H${result.strongsNumber}: ${result.word} (${result.language})`);
                    } else if (result.type === 'verse') {
                        console.log(`   ${index + 1}. Verse: ${result.book} ${result.chapter}:${result.verse}`);
                    }
                });
            }

            this.displayResults(results);
            console.log('✅ [MongoDB Test] Search results displayed successfully');
        } catch (error) {
            console.error('❌ [MongoDB Test] Search error:', error);
            this.showError('Failed to search. Please try again.');
        }
    }

    // Search Strong's data for matches
    searchStrongsData(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // Search Strong's entries
        for (const [num, entry] of Object.entries(this.strongsData)) {
            if (num.includes(query) || 
                (entry.word && entry.word.includes(query)) || 
                (entry.transliteration && entry.transliteration.toLowerCase().includes(lowerQuery)) || 
                (entry.definitions && entry.definitions.some(def => def.toLowerCase().includes(lowerQuery)))) {
                results.push({
                    type: 'strongs',
                    strongsNumber: num,
                    word: entry.word,
                    language: entry.language,
                    transliteration: entry.transliteration,
                    definitions: entry.definitions,
                    partOfSpeech: entry.partOfSpeech
                });
            }
        }
        
        // Search verses (basic text search)
        if (this.versesData) {
            this.versesData.forEach(verse => {
                if (verse.text && verse.text.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        type: 'verse',
                        book: verse.book,
                        chapter: verse.chapter,
                        verse: verse.verse,
                        text: verse.text,
                        strongsNumbers: verse.strongsNumbers
                    });
                }
            });
        }
        
        return results.slice(0, 50); // Limit results for performance
    }

    // Display search results
    displayResults(results) {
        const resultsContainer = document.getElementById('results-container');
        const resultsDiv = document.getElementById('search-results');

        if (!results || results.length === 0) {
            resultsDiv.innerHTML = '<p class="no-results">No matches found for your search.</p>';
            resultsContainer.style.display = 'block';
            return;
        }

        let html = '<div class="results-list">';

        results.forEach(result => {
            if (result.type === 'strongs') {
                const primitiveRoot = this.primitiveRoots[result.primitiveRoot];
                html += `
                    <div class="result-item">
                        <div class="strongs-header">
                            <h3>Strong's #${result.strongsNumber}</h3>
                            <div class="hebrew-word">${result.word || 'N/A'}</div>
                            <div class="english-translation">${result.transliteration || 'N/A'}</div>
                        </div>
                        <div class="definitions">
                            ${result.definitions ? result.definitions.map(def => `<p>${def}</p>`).join('') : ''}
                        </div>
                        <div class="primitive-root-section">
                            <h4>Primitive Root Analysis</h4>
                            <div class="primitive-root-info">
                                <div class="root-number">Root #${result.primitiveRoot || 'N/A'}</div>
                                ${primitiveRoot ? `
                                    <div class="root-details">
                                        <div class="root-hebrew">${primitiveRoot.hebrew}</div>
                                        <div class="root-english">${primitiveRoot.english}</div>
                                        <div class="root-meaning">
                                            <strong>True Meaning:</strong> ${primitiveRoot.meaning}
                                        </div>
                                        <div class="verb-meaning">
                                            <strong>Verb Meaning:</strong> ${primitiveRoot.verbMeaning}
                                        </div>
                                    </div>
                                ` : '<div class="root-details">Primitive root data not available</div>'}
                            </div>
                        </div>
                    </div>
                `;
            } else if (result.type === 'verse') {
                html += `
                    <div class="result-item verse-result">
                        <div class="verse-header">
                            <h3>${result.book} ${result.chapter}:${result.verse}</h3>
                        </div>
                        <div class="verse-text">${result.text}</div>
                        <div class="strongs-numbers">
                            Strong's: ${result.strongsNumbers ? result.strongsNumbers.join(', ') : 'None'}
                        </div>
                    </div>
                `;
            }
        });

        html += '</div>';
        resultsDiv.innerHTML = html;
        resultsContainer.style.display = 'block';

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Clear search results
    clearResults() {
        const searchInput = document.getElementById('strongs-search');
        const resultsContainer = document.getElementById('results-container');
        const resultsDiv = document.getElementById('search-results');

        searchInput.value = '';
        resultsDiv.innerHTML = '';
        resultsContainer.style.display = 'none';
        this.hideError();
    }

    // Show error message
    showError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    // Hide error message
    hideError() {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
}

// Initialize the analyzer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 [MongoDB Test] Primitive Roots Analyzer initializing...');
    console.log('🔗 [MongoDB Test] Page: primitive_roots.html');
    console.log('📡 [MongoDB Test] Will attempt to connect to MongoDB Atlas via Flask API');

    new PrimitiveRootsAnalyzer();
});
