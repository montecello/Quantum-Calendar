// Primitive Roots Analysis for Hebrew Words
// Based on Strong's Hebrew Dictionary and primitive root theory

class PrimitiveRootsAnalyzer {
    constructor() {
        this.strongsData = {};
        this.versesData = [];
        this.primitiveRoots = this.initializePrimitiveRoots();
        this.initializeEventListeners();
        // No initial data loading - load on demand via API
    }

    async loadStrongsData() {
        // Load sample data first for immediate autosuggest
        console.log('Loading sample data first...');
        this.strongsData = this.getSampleData();
        this.versesData = [];
        console.log(`Sample data loaded: ${Object.keys(this.strongsData).length} entries`);

        try {
            // Load the complete Strong's dataset and KJV verses from backend
            console.log('Attempting to load from API...');
            const strongsResponse = await fetch('/api/strongs-data?limit=100');
            const versesResponse = await fetch('/api/kjv-data?limit=100');
            
            if (strongsResponse.ok) {
                console.log('API response OK for Strong\'s data, processing...');
                const strongsData = await strongsResponse.json();
                console.log(`API returned ${strongsData.length} Strong's entries`);
                this.strongsData = this.processStrongsData(strongsData);
                console.log(`Processed Strong's data into ${Object.keys(this.strongsData).length} entries`);
            } else {
                console.log('API response failed for Strong\'s data:', strongsResponse.status);
            }
            
            if (versesResponse.ok) {
                console.log('API response OK for KJV data, processing...');
                const versesData = await versesResponse.json();
                console.log(`API returned ${versesData.length} KJV entries`);
                this.versesData = this.processVersesData(versesData);
                console.log(`Processed KJV data into ${this.versesData.length} entries`);
            } else {
                console.log('API response failed for KJV data:', versesResponse.status);
            }
            
            console.log(`Final data: ${Object.keys(this.strongsData).length} Strong's entries and ${this.versesData.length} verses`);
        } catch (error) {
            console.error('Error loading data from API:', error);
            // Keep sample data
            console.log(`Using sample data: ${Object.keys(this.strongsData).length} entries`);
        }
    }

    // New method to process Strong's data into a searchable object
    processStrongsData(data) {
        const processed = {};
        data.forEach(entry => {
            // Use strongsNumber as key, but also handle the case where it might be a number
            const key = entry.strongsNumber.toString();
            processed[key] = entry;
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
            },
            // Add H4714 (Egypt) primitive root data
            4714: {
                hebrew: 'מָצוֹר',
                english: 'siege',
                meaning: 'narrowness, constriction, tightness',
                verbMeaning: 'to besiege, to confine, to restrict'
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
            this.searchInput = searchInput;
            searchButton.addEventListener('click', () => this.performSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
            // Autosuggest listeners
            searchInput.addEventListener('input', async (e) => {
                const query = e.target.value.trim();
                if (query.length < 2) {
                    this.hideAutosuggest();
                    return;
                }
                const suggestions = await this.getSuggestions(query);
                this.showAutosuggest(suggestions);
            });
            searchInput.addEventListener('focus', async () => {
                const query = searchInput.value.trim();
                if (query.length >= 2) {
                    const suggestions = await this.getSuggestions(query);
                    this.showAutosuggest(suggestions);
                }
            });
            searchInput.addEventListener('blur', () => {
                setTimeout(() => this.hideAutosuggest(), 200);
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
            console.log('Search query is empty');
            this.showError('Please enter a Strong\'s number or Hebrew word to search.');
            return;
        }

        console.log(`Performing search for: "${query}"`);
        this.showLoading();

        try {
            const response = await fetch(`/api/strongs-data?query=${encodeURIComponent(query)}&limit=50`);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            console.log(`API returned ${data.length} results for "${query}"`);
            
            const results = data.map(entry => ({
                type: 'strongs',
                strongsNumber: entry.strongsNumber.toString(),
                word: entry.word || entry.lemma,
                language: 'Hebrew',
                transliteration: entry.transliteration,
                definitions: entry.definitions || [],
                partOfSpeech: entry.partOfSpeech || 'N/A',
                primitiveRoot: entry.notes?.etymology?.type === 'primitive'
            }));
            
            this.displayResults(results);
            
            // Trigger etymology analysis for the first result if available
            if (results.length > 0) {
                const firstResult = results[0];
                const strongsNumber = `H${firstResult.strongsNumber}`;
                const selectedWord = firstResult.word || query;
                console.log('Triggering etymology analysis from search for:', strongsNumber, selectedWord);
                if (window.EtymologyAnalysis) {
                    window.EtymologyAnalysis.showAnalysis(strongsNumber, selectedWord);
                }
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Failed to search. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    // Perform search for a specific Strong's number (used when clicking autocomplete suggestions)
    async performSearchForStrongs(strongsNumber) {
        console.log(`Performing search for Strong's number: ${strongsNumber}`);
        this.showLoading();

        try {
            const response = await fetch(`/api/strongs-data?query=H${strongsNumber}&limit=1`);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            console.log(`API returned ${data.length} results for "H${strongsNumber}"`);
            
            if (data.length > 0) {
                // Don't display regular search results since etymology analysis will show the same info
                // Just hide the loading state and let etymology analysis handle the display
                console.log(`Found Strong's data for H${strongsNumber}, etymology analysis will handle display`);
            } else {
                this.showError(`No results found for Strong's number H${strongsNumber}`);
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Failed to search. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    // Search Strong's data for matches
    searchStrongsData(query) {
        console.log(`Searching Strong's data for: "${query}"`);
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // Search Strong's entries
        for (const [num, entry] of Object.entries(this.strongsData)) {
            if (num.includes(query) || 
                (entry.hebrew && entry.hebrew.toLowerCase().includes(lowerQuery)) || 
                (entry.english && entry.english.toLowerCase().includes(lowerQuery)) || 
                (entry.transliteration && entry.transliteration.toLowerCase().includes(lowerQuery)) || 
                (entry.definitions && entry.definitions.some(def => def.toLowerCase().includes(lowerQuery)))) {
                results.push({
                    type: 'strongs',
                    strongsNumber: num,
                    word: entry.hebrew,
                    language: entry.language || 'Hebrew',
                    transliteration: entry.transliteration || entry.hebrew,
                    definitions: entry.definitions || [entry.english],
                    partOfSpeech: entry.partOfSpeech || 'N/A',
                    primitiveRoot: entry.primitiveRoot
                });
            }
        }
        
        console.log(`Found ${results.length} Strong's matches`);
        
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
        
        console.log(`Total results: ${results.length}`);
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
        this.hideAutosuggest();
        this.hideError();
    }

    // Get suggestions for autosuggest
    async getSuggestions(query) {
        console.log(`=== GETTING SUGGESTIONS FOR: "${query}" ===`);
        
        if (!query || query.length < 1) {  // Allow single Hebrew characters
            console.log(`Query too short: "${query}" (length: ${query ? query.length : 0})`);
            return [];
        }
        
        // Check if query contains Hebrew characters
        const isHebrewQuery = this.containsHebrew(query);
        console.log(`Hebrew characters detected: ${isHebrewQuery}`);
        
        if (isHebrewQuery) {
            return await this.getHebrewSuggestions(query);
        } else {
            return await this.getEnglishSuggestions(query);
        }
    }
    
    // Check if text contains Hebrew characters
    containsHebrew(text) {
        // Hebrew Unicode range: U+0590 to U+05FF
        const hebrewRegex = /[\u0590-\u05FF]/;
        return hebrewRegex.test(text);
    }
    
    // Get suggestions for Hebrew word search
    async getHebrewSuggestions(query) {
        console.log(`=== HEBREW WORD SEARCH FOR: "${query}" ===`);
        
        try {
            console.log(`Step 1: Searching Hebrew words for query: "${query}"`);
            
            // First try the Hebrew search API
            const hebrewUrl = `/api/hebrew-search?query=${encodeURIComponent(query)}&limit=20`;
            console.log(`Making Hebrew search request to: ${hebrewUrl}`);
            
            const response = await fetch(hebrewUrl);
            console.log(`Hebrew search API response status: ${response.status}`);
            
            if (response.ok) {
                const results = await response.json();
                console.log(`✓ HEBREW DATA SOURCE: Successfully received from MongoDB Atlas`);
                console.log(`Step 2: Hebrew search found ${results.length} matches`);
                
                if (results.length > 0) {
                    console.log(`First 3 Hebrew matches:`, results.slice(0, 3).map(r => ({
                        strongsNumber: r.strongsNumber,
                        word: r.word,
                        transliteration: r.transliteration
                    })));
                    
                    // Format results for autosuggest
                    const suggestions = results.map(entry => ({
                        num: entry.strongsNumber.toString(),
                        entry: entry,
                        frequency: 0  // Hebrew search doesn't use frequency
                    }));
                    
                    console.log(`=== RETURNING ${suggestions.length} HEBREW SUGGESTIONS FOR "${query}" ===`);
                    return suggestions;
                }
            }
            
            // Fallback: search by transliteration in Strong's database
            console.log(`Step 3: Hebrew API search failed, trying transliteration search...`);
            const strongsUrl = `/api/strongs-data?search=${encodeURIComponent(query)}&limit=20`;
            console.log(`Making Strong's transliteration search to: ${strongsUrl}`);
            
            const strongsResponse = await fetch(strongsUrl);
            console.log(`Strong's transliteration search response status: ${strongsResponse.status}`);
            
            if (strongsResponse.ok) {
                const strongsResults = await strongsResponse.json();
                console.log(`Strong's transliteration search found ${strongsResults.length} matches`);
                
                // Filter for entries that might match Hebrew characters in their word field
                const hebrewResults = strongsResults.filter(entry => {
                    const hasHebrewChars = entry.word && /[\u0590-\u05FF]/.test(entry.word);
                    const matchesQuery = entry.transliteration && entry.transliteration.toLowerCase().includes(query.toLowerCase());
                    return hasHebrewChars || matchesQuery;
                });
                
                console.log(`Filtered to ${hebrewResults.length} Hebrew-related results`);
                
                if (hebrewResults.length > 0) {
                    const suggestions = hebrewResults.map(entry => ({
                        num: entry.strongsNumber.toString(),
                        entry: entry,
                        frequency: 0
                    }));
                    
                    console.log(`=== RETURNING ${suggestions.length} TRANSLITERATION-BASED HEBREW SUGGESTIONS FOR "${query}" ===`);
                    return suggestions;
                }
            }
            
            console.log(`=== NO HEBREW MATCHES FOUND FOR "${query}" ===`);
            return [];
            
        } catch (error) {
            console.error(`Hebrew search error for "${query}":`, error);
            return [];
        }
    }
    
    // Get suggestions for English word search (original functionality)
    async getEnglishSuggestions(query) {
        console.log(`=== ENGLISH WORD SEARCH FOR: "${query}" ===`);
        
        if (query.length < 2) {
            console.log(`English query too short: "${query}" (length: ${query.length})`);
            return [];
        }
        
        // First, try to search verses for English words
        try {
            console.log(`Step 1: Searching verses for query: "${query}"`);
            const versesUrl = `/api/kjv-data?query=${encodeURIComponent(query)}&limit=20`;
            console.log(`Making request to: ${versesUrl}`);
            
            const versesResponse = await fetch(versesUrl);
            console.log(`Verses API response status: ${versesResponse.status}`);
            
            if (versesResponse.ok) {
                const data = await versesResponse.json();
                console.log(`✓ DATA SOURCE: Successfully received data from MongoDB Atlas (PRIMARY)`);
                console.log(`Step 2: Verses API response received:`, {
                    totalVerses: data.totalVerses,
                    versesCount: data.verses ? data.verses.length : 'no verses field',
                    strongsFrequencyExists: !!data.strongsFrequency,
                    strongsFrequencyLength: data.strongsFrequency ? data.strongsFrequency.length : 'no field'
                });
                
                // Log first few verses to see what we got
                if (data.verses && data.verses.length > 0) {
                    console.log(`First 3 verses found:`, data.verses.slice(0, 3).map(v => ({
                        book: v.book,
                        chapter: v.chapter,
                        verse: v.verse,
                        text: v.text.substring(0, 80) + '...'
                    })));
                }
                
                if (data.strongsFrequency && data.strongsFrequency.length > 0) {
                    console.log(`Step 3: Found ${data.strongsFrequency.length} Strong's numbers with frequencies`);
                    console.log(`Top 5 Strong's by frequency:`, data.strongsFrequency.slice(0, 5));
                    
                    // Use the frequency-sorted Strong's numbers from backend
                    const topStrongs = data.strongsFrequency.slice(0, 10); // Get top 10 by frequency
                    console.log(`Step 4: Processing top ${topStrongs.length} Strong's numbers...`);
                    
                    const strongsPromises = topStrongs.map(async ([strongsNum, frequency]) => {
                        try {
                            // Remove 'H' prefix if present for the API call
                            const cleanNum = strongsNum.toString().replace(/^H/, '');
                            console.log(`  Looking up Strong's H${cleanNum} (frequency: ${frequency})`);
                            
                            const strongsUrl = `/api/strongs-data?query=H${cleanNum}&limit=1`;
                            const response = await fetch(strongsUrl);
                            console.log(`  Strong's API response for H${cleanNum}: ${response.status}`);
                            
                            if (response.ok) {
                                const strongsData = await response.json();
                                console.log(`✓ STRONG'S DATA SOURCE: Successfully received from MongoDB Atlas`);
                                console.log(`  Strong's data response for H${cleanNum}:`, strongsData);
                                
                                if (strongsData.length > 0) {
                                    console.log(`  ✓ Found Strong's data for H${cleanNum}:`, {
                                        strongsNumber: strongsData[0].strongsNumber,
                                        transliteration: strongsData[0].transliteration,
                                        definition: strongsData[0].definition?.substring(0, 50) + '...'
                                    });
                                    return {
                                        entry: strongsData[0],
                                        frequency: frequency
                                    };
                                } else {
                                    console.log(`  ✗ No Strong's data found for H${cleanNum}`);
                                }
                            } else {
                                console.log(`  ✗ Strong's API error for H${cleanNum}: ${response.status}`);
                            }
                        } catch (error) {
                            console.error(`  ✗ Error fetching Strong's ${strongsNum}:`, error);
                        }
                        return null;
                    });
                    
                    console.log(`Step 5: Waiting for all Strong's lookups to complete...`);
                    const strongsResults = await Promise.all(strongsPromises);
                    const validResults = strongsResults.filter(r => r !== null);
                    
                    console.log(`Step 6: Got ${validResults.length} valid Strong's entries out of ${strongsResults.length} attempts`);
                    
                    if (validResults.length > 0) {
                        const finalSuggestions = validResults.map(result => ({
                            num: result.entry.strongsNumber.toString(),
                            entry: result.entry,
                            frequency: result.frequency
                        }));
                        console.log(`Final suggestions:`, finalSuggestions.map(s => `H${s.num} (freq: ${s.frequency})`));
                        console.log(`=== RETURNING ${finalSuggestions.length} ENGLISH SUGGESTIONS FOR "${query}" ===`);
                        return finalSuggestions;
                    } else {
                        console.log(`=== RETURNING 0 SUGGESTIONS FOR "${query}" (no valid Strong's lookups) ===`);
                        return [];
                    }
                } else {
                    console.log(`Step 3: No strongsFrequency data available`);
                    if (!data.strongsFrequency) {
                        console.log(`- strongsFrequency field is missing from API response`);
                    } else if (data.strongsFrequency.length === 0) {
                        console.log(`- strongsFrequency array is empty (no verses found containing "${query}")`);
                    }
                    console.log(`=== RETURNING 0 SUGGESTIONS FOR "${query}" (no frequency data) ===`);
                    return [];
                }
            } else {
                console.log(`Step 2: Verses API response not ok: ${versesResponse.status}`);
                const errorText = await versesResponse.text();
                console.log(`Error response text:`, errorText);
            }
        } catch (error) {
            console.error(`Step 2: Error searching verses for "${query}":`, error);
        }
        
        // Only fallback to direct Strong's search if the query looks like a Strong's number
        console.log(`Step 7: Checking if "${query}" looks like a Strong's number...`);
        if (query.match(/^H?\d+$/)) {
            console.log(`✓ Query "${query}" looks like Strong's number, searching directly`);
            try {
                const strongsUrl = `/api/strongs-data?query=${encodeURIComponent(query)}&limit=10`;
                console.log(`Making direct Strong's request to: ${strongsUrl}`);
                const response = await fetch(strongsUrl);
                console.log(`Direct Strong's API response status: ${response.status}`);
                
                if (!response.ok) throw new Error(`API error: ${response.status}`);
                const data = await response.json();
                console.log(`Direct Strong's API response:`, data);
                
                const suggestions = data.map(entry => ({
                    num: entry.strongsNumber.toString(),
                    entry: entry,
                    frequency: 0
                }));
                console.log(`Direct Strong's search returned ${suggestions.length} suggestions for "${query}"`);
                console.log(`=== RETURNING ${suggestions.length} DIRECT STRONG'S SUGGESTIONS FOR "${query}" ===`);
                return suggestions;
            } catch (error) {
                console.error(`Error in direct Strong's search for "${query}":`, error);
            }
        } else {
            console.log(`✗ Query "${query}" doesn't look like Strong's number and no verse frequency data available`);
            console.log(`Query regex test result: ${!!query.match(/^H?\d+$/)}`);
        }
        
        console.log(`=== RETURNING 0 SUGGESTIONS FOR "${query}" (all English methods failed) ===`);
        return [];
    }

    // Show autosuggest dropdown
    showAutosuggest(suggestions) {
        console.log('Showing autosuggest with', suggestions.length, 'items');
        let html = '';
        suggestions.forEach(sugg => {
            const entry = sugg.entry;
            const hebrewWord = entry.word || '';
            const englishMeaning = entry.definitions && entry.definitions.length > 0 ? entry.definitions[0] : '';
            const primitiveRoot = this.primitiveRoots[entry.primitiveRoot];
            
            html += `<div class="autosuggest-item" data-num="${sugg.num}">
                <div class="autosuggest-main">
                    <span class="autosuggest-number">H${sugg.num}</span>
                    <span class="autosuggest-english">${englishMeaning}</span>
                    <span class="autosuggest-dash"> - </span>
                    <span class="autosuggest-hebrew">${hebrewWord}</span>
                </div>`;
            
            // Add primitive root information if available
            if (primitiveRoot) {
                html += `
                <div class="autosuggest-primitive">
                    <div class="primitive-chain">
                        <span class="chain-level-1">${hebrewWord}</span>
                        <span class="chain-arrow">→</span>
                        <span class="chain-level-2">${primitiveRoot.hebrew}</span>
                    </div>
                    <div class="primitive-meaning">${primitiveRoot.meaning}</div>
                </div>`;
            }
            
            html += `</div>`;
        });
        
        let container = document.getElementById('autosuggest-container');
        if (!container) {
            console.log('Creating autosuggest container');
            container = document.createElement('div');
            container.id = 'autosuggest-container';
            container.className = 'autosuggest-container';
            this.searchInput.parentNode.appendChild(container);
        }
        
        container.innerHTML = html;
        container.style.display = 'block';
        console.log('Autosuggest container displayed');
        
        // Add click listeners
        container.querySelectorAll('.autosuggest-item').forEach(item => {
            item.addEventListener('click', () => {
                console.log('Clicked suggestion:', item.dataset.num);
                
                // Clear the search box instead of setting it to the Strong's number
                this.searchInput.value = '';
                this.hideAutosuggest();
                
                // Perform search with the selected Strong's number
                this.performSearchForStrongs(item.dataset.num);
                
                // Trigger etymology analysis for the selected word
                const strongsNumber = `H${item.dataset.num}`;
                const selectedWord = item.textContent.trim().split(' - ')[1] || item.textContent.trim();
                console.log('Triggering etymology analysis for:', strongsNumber, selectedWord);
                if (window.EtymologyAnalysis) {
                    window.EtymologyAnalysis.showAnalysis(strongsNumber, selectedWord);
                }
            });
        });
    }

    // Hide autosuggest dropdown
    hideAutosuggest() {
        const container = document.getElementById('autosuggest-container');
        if (container) {
            container.style.display = 'none';
        }
    }

    // Show error message
    showError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    // Show loading message
    showLoading() {
        const loadingDiv = document.getElementById('loading-message');
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
        }
    }

    // Hide loading message
    hideLoading() {
        const loadingDiv = document.getElementById('loading-message');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
    }
}

// Initialize the analyzer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PrimitiveRootsAnalyzer();
});
