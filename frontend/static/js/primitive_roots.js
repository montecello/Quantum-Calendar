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
        console.log('🔄 [PRIORITY SYSTEM] Starting data loading with priority system...');

        // PRIMARY SOURCE: MongoDB API
        try {
            console.log('🎯 [PRIMARY] Attempting to load from MongoDB API endpoints...');

            const strongsResponse = await fetch('/api/strongs-data?limit=100');
            const versesResponse = await fetch('/api/kjv-data?limit=100');

            if (strongsResponse.ok && versesResponse.ok) {
                console.log('✅ [PRIMARY] MongoDB API responses successful');

                const strongsData = await strongsResponse.json();
                const versesData = await versesResponse.json();

                console.log(`✅ [PRIMARY] Successfully loaded ${strongsData.length} Strong's entries and ${versesData.length} verses from MongoDB`);

                // Process and store the data
                this.strongsData = this.processStrongsData(strongsData);
                this.versesData = this.processVersesData(versesData);

                console.log('🎉 [SUCCESS] Data loaded from PRIMARY source (MongoDB API)');
                console.log(`📊 [MONGODB SUMMARY] Ready for primitive root analysis with ${Object.keys(this.strongsData).length} Strong's entries and ${this.versesData.length} verses from MongoDB Atlas`);
                return;
            } else {
                console.warn('⚠️ [PRIMARY] MongoDB API responses not OK:', {
                    strongsStatus: strongsResponse.status,
                    versesStatus: versesResponse.status
                });
                throw new Error('MongoDB API returned non-OK responses');
            }

        } catch (error) {
            console.error('❌ [PRIMARY] MongoDB API failed:', error.message);
            console.log('🔄 [FALLBACK] Attempting SECONDARY source (static JSON files)...');

            // SECONDARY SOURCE: Static JSON files
            try {
                console.log('📁 [SECONDARY] Loading from static JSON files...');

                const strongsResponse = await fetch('/static/data/strongs_complete.json');
                const versesResponse = await fetch('/static/data/kjv_verses.json');

                if (strongsResponse.ok && versesResponse.ok) {
                    console.log('✅ [SECONDARY] Static JSON responses successful');

                    const strongsData = await strongsResponse.json();
                    const versesData = await versesResponse.json();

                    console.log(`✅ [SECONDARY] Successfully loaded ${strongsData.length} Strong's entries and ${versesData.length} verses from static files`);

                    // Process and store the data
                    this.strongsData = this.processStrongsData(strongsData);
                    this.versesData = this.processVersesData(versesData);

                    console.log('🎉 [SUCCESS] Data loaded from SECONDARY source (static JSON files)');
                    console.log(`📊 [STATIC SUMMARY] Ready for primitive root analysis with ${Object.keys(this.strongsData).length} Strong's entries and ${this.versesData.length} verses from static files`);
                    return;
                } else {
                    console.warn('⚠️ [SECONDARY] Static JSON responses not OK:', {
                        strongsStatus: strongsResponse.status,
                        versesStatus: versesResponse.status
                    });
                    throw new Error('Static JSON files returned non-OK responses');
                }

            } catch (secondaryError) {
                console.error('❌ [SECONDARY] Static JSON files failed:', secondaryError.message);
                console.log('💀 [ERROR] Both PRIMARY and SECONDARY sources failed');

                // ERROR: Both sources failed
                this.showError('Unable to load data from any source. Please check your internet connection and try again.');
                this.strongsData = {};
                this.versesData = [];
                return;
            }
        }
    }

    // New method to process Strong's data into a searchable object
    processStrongsData(data) {
        console.log(`🔧 [MONGODB PROCESS] Processing ${data.length} Strong's entries from MongoDB`);
        const processed = {};
        data.forEach(entry => {
            // Use strongsNumber as key, but also handle the case where it might be a number
            const key = entry.strongsNumber.toString();
            processed[key] = entry;
            console.log(`📝 [MONGODB PROCESS] Processed Strong's H${entry.strongsNumber} (${entry.word}) from MongoDB`);
        });
        console.log(`✅ [MONGODB PROCESS] Successfully processed ${Object.keys(processed).length} Strong's entries from MongoDB`);
        return processed;
    }

    // New method to process verses data
    processVersesData(data) {
        console.log(`🔧 [MONGODB PROCESS] Processing ${data.length} KJV verses from MongoDB`);
        // For now, just store as array; you can add indexing later
        console.log(`✅ [MONGODB PROCESS] Successfully processed ${data.length} verses from MongoDB`);
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

        if (!query) {
            this.showError('Please enter a Strong\'s number or Hebrew word to search.');
            return;
        }

        // Check if data is loaded
        if (Object.keys(this.strongsData).length === 0) {
            this.showError('Data is still loading. Please wait a moment and try again.');
            return;
        }

        try {
            console.log(`🔍 [SEARCH] Performing search for: "${query}"`);
            console.log(`📊 [SEARCH] Using data source with ${Object.keys(this.strongsData).length} Strong's entries and ${this.versesData.length} verses`);

            const results = this.searchStrongsData(query);
            console.log(`📋 [SEARCH] Found ${results.length} results for "${query}"`);

            this.displayResults(results);
        } catch (error) {
            console.error('❌ [SEARCH] Search error:', error);
            this.showError('Failed to search. Please try again.');
        }
    }

    // Search Strong's data for matches
    searchStrongsData(query) {
        console.log(`🔍 [MONGODB SEARCH] Searching MongoDB data for: "${query}"`);
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // Search Strong's entries from MongoDB
        console.log(`📊 [MONGODB SEARCH] Scanning ${Object.keys(this.strongsData).length} Strong's entries from MongoDB`);
        for (const [num, entry] of Object.entries(this.strongsData)) {
            if (num.includes(query) || 
                (entry.word && entry.word.includes(query)) || 
                (entry.transliteration && entry.transliteration.toLowerCase().includes(lowerQuery)) || 
                (entry.definitions && entry.definitions.some(def => def.toLowerCase().includes(lowerQuery)))) {
                console.log(`✅ [MONGODB SEARCH] Found Strong's match: H${entry.strongsNumber} (${entry.word}) from MongoDB`);
                results.push({
                    type: 'strongs',
                    strongsNumber: entry.strongsNumber,
                    word: entry.word,
                    language: entry.language,
                    transliteration: entry.transliteration,
                    definitions: entry.definitions,
                    partOfSpeech: entry.partOfSpeech,
                    primitiveRoot: entry.primitiveRoot
                });
            }
        }
        
        // Search verses from MongoDB
        console.log(`📖 [MONGODB SEARCH] Scanning ${this.versesData.length} verses from MongoDB`);
        if (this.versesData) {
            this.versesData.forEach(verse => {
                if (verse.text && verse.text.toLowerCase().includes(lowerQuery)) {
                    console.log(`✅ [MONGODB SEARCH] Found verse match: ${verse.book} ${verse.chapter}:${verse.verse} from MongoDB`);
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
        
        console.log(`📋 [MONGODB SEARCH] Total results found: ${results.length} from MongoDB data`);
        return results.slice(0, 50); // Limit results for performance
    }

    // Display search results
    displayResults(results) {
        console.log(`🎨 [MONGODB DISPLAY] Rendering ${results.length} results from MongoDB data`);
        const resultsContainer = document.getElementById('results-container');
        const resultsDiv = document.getElementById('search-results');

        if (!results || results.length === 0) {
            console.log(`❌ [MONGODB DISPLAY] No results to display from MongoDB data`);
            resultsDiv.innerHTML = '<p class="no-results">No matches found for your search.</p>';
            resultsContainer.style.display = 'block';
            return;
        }

        let html = '<div class="results-list">';

        results.forEach(result => {
            if (result.type === 'strongs') {
                console.log(`📝 [MONGODB DISPLAY] Displaying Strong's entry H${result.strongsNumber} (${result.word}) from MongoDB`);
                const primitiveRoot = this.primitiveRoots[result.primitiveRoot];
                if (primitiveRoot) {
                    console.log(`🌳 [MONGODB DISPLAY] Found primitive root #${result.primitiveRoot} (${primitiveRoot.hebrew}) for H${result.strongsNumber} from MongoDB`);
                }
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
                console.log(`📖 [MONGODB DISPLAY] Displaying verse ${result.book} ${result.chapter}:${result.verse} from MongoDB`);
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

        console.log(`✅ [MONGODB DISPLAY] Successfully rendered all ${results.length} results with primitive root analysis from MongoDB`);

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
    new PrimitiveRootsAnalyzer();
});
