// Hebrew XML Parser and Autosuggest for Strong's Concordance
// Parses the Hebrew.xml file and provides autosuggest functionality

class HebrewXMLParser {
    constructor() {
        this.entries = new Map(); // Map of entry numbers to entry data
        this.searchIndex = new Map(); // Map of searchable terms to entry numbers
        this.xmlData = null;
        this.isLoaded = false;
        this.progressBar = document.getElementById('progress-bar');
        this.loadingMessage = document.getElementById('loading-message');
    }

    // Load and parse the Hebrew.xml file
    async loadXML() {
        try {
            console.log('🔄 Starting to load Hebrew.xml...');

            // Check if we have a cached version first
            const cacheKey = 'hebrew-xml-cache';
            const cachedData = this.loadFromCache(cacheKey);

            if (cachedData) {
                console.log('📦 Using cached Hebrew XML data');
                this.xmlData = cachedData.xmlData;
                this.entries = cachedData.entries;
                this.searchIndex = cachedData.searchIndex;
                this.isLoaded = true;
                console.log(`✅ Loaded ${this.entries.size} Hebrew entries from cache`);
                return;
            }

            const response = await fetch('/static/data/Hebrew.xml');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }

            const total = response.headers.get('content-length');
            const reader = response.body.getReader();
            const chunks = [];
            let loaded = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                this.updateProgress(loaded, total);
            }

            const blob = new Blob(chunks);
            const xmlText = await blob.text();
            console.log('📄 XML text loaded, length:', xmlText.length);

            if (!xmlText || xmlText.length < 100) {
                throw new Error('XML file appears to be empty or too small');
            }

            // Try to clean up malformed XML
            const cleanedXmlText = this.cleanMalformedXML(xmlText);
            console.log('🧹 XML cleaned, new length:', cleanedXmlText.length);

            // Parse XML with namespace handling
            this.xmlData = new DOMParser().parseFromString(cleanedXmlText, 'text/xml');

            // Check for parse errors
            const parseErrors = this.xmlData.getElementsByTagName('parsererror');
            if (parseErrors.length > 0) {
                console.error('❌ XML parsing errors found:', parseErrors.length);
                for (let i = 0; i < parseErrors.length; i++) {
                    console.error('Parse error:', parseErrors[i].textContent);
                }
                throw new Error('XML parsing failed due to malformed content');
            }

            // Validate that we have a proper document
            if (!this.xmlData || !this.xmlData.documentElement) {
                throw new Error('XML document is invalid or empty');
            }

            console.log('🔧 XML parsed, document element:', this.xmlData.documentElement.tagName);

            // Remove default namespace to make querySelector work
            this.removeDefaultNamespace(this.xmlData.documentElement);
            console.log('🧹 Namespace removed');

            // Parse entries
            this.parseEntries();

            // Validate that we parsed some entries
            if (this.entries.size === 0) {
                throw new Error('No entries were parsed from the XML file');
            }

            // Build search index
            this.buildSearchIndex();

            // Cache the parsed data
            this.saveToCache(cacheKey, {
                xmlData: this.xmlData,
                entries: this.entries,
                searchIndex: this.searchIndex,
                timestamp: Date.now()
            });

            this.isLoaded = true;
            console.log(`✅ Loaded ${this.entries.size} Hebrew entries`);
            console.log('📊 Search index size:', this.searchIndex.size);

            // Debug: Check if entry 226 was parsed (this is the "sign" entry)
            const entry226 = this.entries.get('226');
            if (entry226) {
                console.log('🎯 Entry 226 found:', entry226.hebrewWord, entry226.meanings);
            } else {
                console.log('❌ Entry 226 not found - this may indicate parsing issues');
            }

            // Debug: Check search for "sign"
            const signResults = this.search('sign');
            console.log('🔍 Search for "sign" results:', signResults.length, signResults);

        } catch (error) {
            console.error('❌ Error loading Hebrew.xml:', error);
            console.error('Stack trace:', error.stack);
            throw error; // Re-throw to let caller handle it
        }
    }

    // Clean up malformed XML
    cleanMalformedXML(xmlText) {
        let cleaned = xmlText;

        // Fix malformed tags where closing tag is split: </tag\n>
        const splitTags = ['w', 'note', 'item', 'list', 'div', 'foreign', 'ref', 'hi', 'p', 'q'];
        splitTags.forEach(tag => {
            const regex = new RegExp(`</${tag}\\n>`, 'gm');
            cleaned = cleaned.replace(regex, `</${tag}>`);
        });

        // Fix any other malformed closing tags
        cleaned = cleaned.replace(/<\/(\w+)\n>/gm, '</$1>');

        // Fix unclosed tags that might be split
        cleaned = cleaned.replace(/<(\w+)([^>]*)>\n/gm, '<$1$2>');

        // Remove any remaining XML declarations that might cause issues
        cleaned = cleaned.replace(/<\?xml[^>]*\?>/gi, '');

        // Fix common encoding issues
        cleaned = cleaned.replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;');

        // Remove any DOCTYPE declarations that might interfere
        cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

        // Clean up excessive whitespace
        cleaned = cleaned.replace(/\n\s*\n/g, '\n');

        console.log('🧹 XML cleaning completed. Original length:', xmlText.length, 'Cleaned length:', cleaned.length);
        return cleaned;
    }

    // Remove default namespace from XML document to make querySelector work
    removeDefaultNamespace(element) {
        if (element.nodeType === Node.ELEMENT_NODE) {
            // Remove default namespace
            element.removeAttribute('xmlns');

            // Also remove any namespace prefixes that might cause issues
            const attributes = element.attributes;
            for (let i = attributes.length - 1; i >= 0; i--) {
                const attr = attributes[i];
                if (attr.name.startsWith('xmlns:')) {
                    element.removeAttribute(attr.name);
                }
            }
        }

        // Recursively process child elements
        const children = element.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === Node.ELEMENT_NODE) {
                this.removeDefaultNamespace(child);
            }
        }
    }

    // Parse all entries from the XML
    parseEntries() {
        // Try different methods to find entries
        let entries;

        // First try querySelector (after namespace removal)
        try {
            entries = this.xmlData.querySelectorAll('div[type="entry"]');
            console.log('🔍 Found entries with querySelector:', entries.length);
        } catch (e) {
            console.warn('QuerySelector failed, trying getElementsByTagName');
            entries = this.xmlData.getElementsByTagName('div');
            // Filter for entries with type="entry"
            const entryArray = [];
            for (let i = 0; i < entries.length; i++) {
                if (entries[i].getAttribute('type') === 'entry') {
                    entryArray.push(entries[i]);
                }
            }
            entries = entryArray;
            console.log('🔍 Found entries with getElementsByTagName:', entries.length);
        }

        console.log('🔍 Total entries found:', entries.length);

        if (entries.length === 0) {
            console.log('❌ No entries found! XML structure issue.');
            console.log('XML document:', this.xmlData);
            console.log('Document element:', this.xmlData.documentElement);
            console.log('Document element children:', this.xmlData.documentElement.children);
            return;
        }

        let parsedCount = 0;
        let skippedCount = 0;

        entries.forEach(entry => {
            const entryData = this.parseEntry(entry);
            if (entryData) {
                this.entries.set(entryData.entryNumber, entryData);
                parsedCount++;
            } else {
                skippedCount++;
            }
        });

        console.log(`📝 Parsed ${parsedCount} entries, skipped ${skippedCount} invalid entries`);
    }

    // Parse a single entry
    parseEntry(entryElement) {
        const entryNumber = entryElement.getAttribute('n');
        if (!entryNumber) {
            console.warn('⚠️ Entry found without number attribute, skipping');
            return null;
        }

        // Try different methods to find child elements
        let wordElement, listElement, exegesisNote, explanationNote, translationNote;

        try {
            wordElement = entryElement.querySelector('w');
            listElement = entryElement.querySelector('list');
            exegesisNote = entryElement.querySelector('note[type="exegesis"]');
            explanationNote = entryElement.querySelector('note[type="explanation"]');
            translationNote = entryElement.querySelector('note[type="translation"]');
        } catch (e) {
            console.warn('QuerySelector failed for entry', entryNumber, 'trying getElementsByTagName');
            // Fallback to getElementsByTagName
            const wordElements = entryElement.getElementsByTagName('w');
            wordElement = wordElements.length > 0 ? wordElements[0] : null;

            const listElements = entryElement.getElementsByTagName('list');
            listElement = listElements.length > 0 ? listElements[0] : null;

            const noteElements = entryElement.getElementsByTagName('note');
            for (let i = 0; i < noteElements.length; i++) {
                const note = noteElements[i];
                const type = note.getAttribute('type');
                if (type === 'exegesis') exegesisNote = note;
                else if (type === 'explanation') explanationNote = note;
                else if (type === 'translation') translationNote = note;
            }
        }

        // Extract Hebrew word
        const hebrewWord = wordElement ? wordElement.textContent.trim() : '';

        // Extract Strong's number
        const strongsNumber = wordElement ? wordElement.getAttribute('ID') : '';

        // Extract lemma
        const lemma = wordElement ? wordElement.getAttribute('lemma') : '';

        // Extract transliteration
        const transliteration = wordElement ? wordElement.getAttribute('xlit') : '';

        // Extract meanings
        const meanings = [];
        if (listElement) {
            let items;
            try {
                items = listElement.querySelectorAll('item');
            } catch (e) {
                console.warn('QuerySelector failed for items in entry', entryNumber, 'trying getElementsByTagName');
                items = listElement.getElementsByTagName('item');
            }
            for (let i = 0; i < items.length; i++) {
                const text = items[i].textContent.trim();
                if (text && text.length > 1) { // Filter out empty or single character items
                    meanings.push(text);
                }
            }
        }

        // Extract exegesis (contains "from" references)
        let exegesis = '';
        let fromReferences = [];
        if (exegesisNote) {
            exegesis = exegesisNote.textContent.trim();
            // Extract "from" references - look for src attributes in w tags within exegesis
            const wTags = exegesisNote.querySelectorAll('w[src]');
            wTags.forEach(wTag => {
                const src = wTag.getAttribute('src');
                if (src && /^\d+$/.test(src)) {
                    fromReferences.push(src);
                }
            });

            // Also check for src="123" pattern in text content as fallback
            if (fromReferences.length === 0) {
                const srcMatches = exegesis.match(/src="(\d+)"/g);
                if (srcMatches) {
                    fromReferences = srcMatches.map(match => {
                        const srcMatch = match.match(/src="(\d+)"/);
                        return srcMatch ? srcMatch[1] : null;
                    }).filter(ref => ref !== null);
                }
            }
        }

        // Extract explanation
        const explanation = explanationNote ? explanationNote.textContent.trim() : '';

        // Extract translation
        const translation = translationNote ? translationNote.textContent.trim() : '';

        // Validate that we have at least some useful data
        if (!hebrewWord && !strongsNumber && meanings.length === 0) {
            console.warn(`⚠️ Entry ${entryNumber} has no useful data, skipping`);
            return null;
        }

        const entryData = {
            entryNumber,
            hebrewWord,
            strongsNumber,
            lemma,
            transliteration,
            meanings,
            exegesis,
            fromReferences,
            explanation,
            translation,
            isPrimitive: exegesis.toLowerCase().includes('primitive') || fromReferences.length === 0
        };

        // Debug: Check if this is entry 226
        if (entryNumber === '226') {
            console.log('🎯 Parsing entry 226:', {
                hebrewWord,
                strongsNumber,
                meanings: meanings.slice(0, 3) // Show first 3 meanings
            });
        }

        return entryData;
    }

    // Build search index for autosuggest
    buildSearchIndex() {
        console.log('🔍 Building search index...');
        this.searchIndex.clear();

        let totalTerms = 0;

        this.entries.forEach((entry, entryNumber) => {
            const searchableTerms = new Set(); // Use Set to avoid duplicates

            // Add basic terms
            if (entry.hebrewWord) searchableTerms.add(entry.hebrewWord.toLowerCase());
            if (entry.lemma) searchableTerms.add(entry.lemma.toLowerCase());
            if (entry.transliteration) searchableTerms.add(entry.transliteration.toLowerCase());
            if (entry.strongsNumber) searchableTerms.add(entry.strongsNumber.toLowerCase());

            // Add meanings with better parsing for proper names
            if (entry.meanings && entry.meanings.length > 0) {
                entry.meanings.forEach(meaning => {
                    if (meaning) {
                        // Split meanings by common separators
                        const parts = meaning.split(/[;,()[\]]+/);
                        parts.forEach(part => {
                            const cleanPart = part.trim().toLowerCase();
                            if (cleanPart.length > 1) { // Only add meaningful terms
                                searchableTerms.add(cleanPart);

                                // For proper names, also add individual words
                                if (cleanPart.includes('=')) {
                                    const [name, description] = cleanPart.split('=').map(s => s.trim());
                                    if (name && name.length > 1) {
                                        searchableTerms.add(name);
                                    }
                                    if (description && description.length > 1) {
                                        searchableTerms.add(description);
                                    }
                                }

                                // Add individual words from multi-word terms
                                const words = cleanPart.split(/\s+/);
                                if (words.length > 1) {
                                    words.forEach(word => {
                                        if (word.length > 2) { // Filter out very short words
                                            searchableTerms.add(word);
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
            }

            // Add explanation and translation terms with better word extraction
            if (entry.explanation) {
                const words = entry.explanation.toLowerCase().split(/\s+/);
                words.forEach(word => {
                    if (word.length > 2) { // Filter out very short words
                        searchableTerms.add(word);
                    }
                });
            }

            if (entry.translation) {
                const words = entry.translation.toLowerCase().split(/\s+/);
                words.forEach(word => {
                    if (word.length > 2) {
                        searchableTerms.add(word);
                    }
                });
            }

            // Add terms to index
            searchableTerms.forEach(term => {
                if (!this.searchIndex.has(term)) {
                    this.searchIndex.set(term, []);
                }
                this.searchIndex.get(term).push(entryNumber);
                totalTerms++;
            });
        });

        console.log(`📊 Search index built with ${this.searchIndex.size} unique terms and ${totalTerms} total term-entry mappings`);
    }

    // Search for entries matching a query
    search(query, maxResults = 10) {
        if (!this.isLoaded) {
            console.log('❌ Search called but parser not loaded');
            return [];
        }

        const cleanQuery = query.toLowerCase().trim();
        console.log('🔍 Searching for:', `"${cleanQuery}"`);
        if (!cleanQuery) return [];

        const results = new Set();
        const scoredResults = new Map(); // entryNumber -> score

        // Direct Strong's number search (highest priority)
        if (/^h?\d+$/i.test(cleanQuery)) {
            const strongsNum = cleanQuery.replace(/^h/i, '');
            if (this.entries.has(strongsNum)) {
                results.add(strongsNum);
                scoredResults.set(strongsNum, 100); // Perfect match score
                console.log('✅ Found Strong\'s number:', strongsNum);
            }
        }

        // Exact word matches (very high priority for English terms)
        this.searchIndex.forEach((entryNumbers, term) => {
            if (term === cleanQuery) {
                entryNumbers.forEach(num => {
                    results.add(num);
                    scoredResults.set(num, Math.max(scoredResults.get(num) || 0, 95));
                });
            }
        });

        // Word boundary matches (e.g., "Egypt" in "Egypt = land of the Copts")
        this.searchIndex.forEach((entryNumbers, term) => {
            const termWords = term.split(/\s+/);
            const queryWords = cleanQuery.split(/\s+/);

            // Check if query matches any word in the term
            const hasExactWordMatch = queryWords.some(qWord =>
                termWords.some(tWord => tWord === qWord)
            );

            if (hasExactWordMatch) {
                entryNumbers.forEach(num => {
                    results.add(num);
                    // Boost score significantly if the term starts with the query (proper name priority)
                    let score = 85;
                    if (term.startsWith(cleanQuery)) {
                        score = 90; // Higher score for terms that start with the query
                    }
                    scoredResults.set(num, Math.max(scoredResults.get(num) || 0, score));
                });
            }
        });

        // Enhanced proper name matching - prioritize entries where query is the first word in meaning
        this.entries.forEach((entry, entryNumber) => {
            if (entry.meanings && entry.meanings.length > 0) {
                entry.meanings.forEach((meaning, meaningIndex) => {
                    if (meaning) {
                        const cleanMeaning = meaning.toLowerCase().trim();

                        // Strip common prefixes like "1) ", "2) ", etc. to find the actual first word
                        const strippedMeaning = cleanMeaning.replace(/^\d+\)\s*/, '').trim();

                        // Check if stripped meaning starts with the query (highest priority for proper names)
                        if (strippedMeaning.startsWith(cleanQuery + ' ') ||
                            strippedMeaning.startsWith(cleanQuery + '=') ||
                            strippedMeaning.startsWith(cleanQuery + ',') ||
                            strippedMeaning === cleanQuery) {
                            results.add(entryNumber);
                            scoredResults.set(entryNumber, Math.max(scoredResults.get(entryNumber) || 0, 92));
                            console.log(`🎯 Found proper name match: ${entryNumber} - "${meaning}" (stripped: "${strippedMeaning}")`);
                        }

                        // Also check for "query =" pattern (proper name definitions)
                        if (cleanMeaning.includes(cleanQuery + ' =')) {
                            results.add(entryNumber);
                            scoredResults.set(entryNumber, Math.max(scoredResults.get(entryNumber) || 0, 88));
                            console.log(`🎯 Found "query =" pattern: ${entryNumber} - "${meaning}"`);
                        }

                        // Additional check: if the first meaning starts with query after stripping prefix, give highest priority
                        if (meaningIndex === 0 && (
                            strippedMeaning.startsWith(cleanQuery + ' ') ||
                            strippedMeaning.startsWith(cleanQuery + '=') ||
                            strippedMeaning.startsWith(cleanQuery + ',') ||
                            strippedMeaning === cleanQuery
                        )) {
                            scoredResults.set(entryNumber, Math.max(scoredResults.get(entryNumber) || 0, 100));
                            console.log(`🌟 FIRST MEANING MATCH (AFTER STRIPPING): ${entryNumber} - "${meaning}" (stripped: "${strippedMeaning}")`);
                        }
                    }
                });
            }
        });

        // Partial matches with better scoring
        let matchesFound = 0;
        this.searchIndex.forEach((entryNumbers, term) => {
            let score = 0;

            // Exact substring match
            if (term.includes(cleanQuery)) {
                score = 60;
                // Boost score if it's a proper name match
                if (term.includes('=') || term.length > cleanQuery.length + 5) {
                    score = 75;
                }
                // Extra boost if term starts with query
                if (term.startsWith(cleanQuery)) {
                    score = 80;
                }
            }
            // Query is substring of term
            else if (cleanQuery.includes(term)) {
                score = 50;
            }
            // Fuzzy matching for similar words
            else if (this.fuzzyMatch(cleanQuery, term)) {
                score = 30;
            }

            if (score > 0) {
                entryNumbers.forEach(num => {
                    results.add(num);
                    scoredResults.set(num, Math.max(scoredResults.get(num) || 0, score));
                });
                matchesFound++;
            }
        });

        console.log(`📊 Found ${results.size} total results from ${matchesFound} term matches`);

        // Convert to array and sort by relevance score, then by entry number
        const resultArray = Array.from(results);
        const finalResults = resultArray
            .map(num => ({
                entry: this.entries.get(num),
                score: scoredResults.get(num) || 0,
                entryNumber: parseInt(num)
            }))
            .filter(item => item.entry !== undefined)
            .sort((a, b) => {
                // Sort by score descending, then by entry number ascending
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                return a.entryNumber - b.entryNumber;
            })
            .map(item => item.entry)
            .slice(0, maxResults);

        console.log('🎯 Final results:', finalResults.length, finalResults.map(r => `${r.entryNumber}: ${r.hebrewWord} (score: ${scoredResults.get(r.entryNumber) || 0})`));
        return finalResults;
    }

    // Fuzzy matching for similar words
    fuzzyMatch(query, term) {
        if (Math.abs(query.length - term.length) > 2) return false;

        // Simple Levenshtein distance approximation
        let distance = 0;
        const maxLength = Math.max(query.length, term.length);

        for (let i = 0; i < maxLength; i++) {
            if (query[i] !== term[i]) {
                distance++;
                if (distance > 2) return false;
            }
        }

        return distance <= 2;
    }

    // Get primitive root chain for an entry (simplified recursive version)
    getPrimitiveRootChain(entryNumber, maxDepth = 10, visited = new Set()) {
        console.log(`🌱 Getting primitive root chain for entry ${entryNumber}`);

        // Prevent infinite recursion
        if (visited.has(entryNumber)) {
            console.log(`🔄 Cycle detected at entry ${entryNumber}`);
            return [];
        }

        if (maxDepth <= 0) {
            console.log(`⏹️ Max depth reached at entry ${entryNumber}`);
            return [];
        }

        const entry = this.entries.get(entryNumber);
        if (!entry) {
            console.log(`❌ Entry ${entryNumber} not found`);
            return [];
        }

        // Mark as visited for this path
        visited.add(entryNumber);

        // Check if this entry is a primitive root
        const isPrimitive = this.isPrimitiveRoot(entry);
        console.log(`📖 Entry ${entryNumber}: ${entry.hebrewWord} - Primitive: ${isPrimitive}`);

        // If this is a primitive root, return just this entry
        if (isPrimitive) {
            console.log(`✅ Found primitive root: ${entryNumber}`);
            visited.delete(entryNumber); // Remove from visited for other paths
            return [{
                ...entry,
                isPrimitive: true,
                depth: 0
            }];
        }

        // If no references, this is a dead end
        if (!entry.fromReferences || entry.fromReferences.length === 0) {
            console.log(`🏁 Entry ${entryNumber} has no references`);
            visited.delete(entryNumber);
            return [{
                ...entry,
                isPrimitive: false,
                depth: 0
            }];
        }

        // Follow the first reference (most direct path)
        const reference = entry.fromReferences[0];
        console.log(`🔗 Following reference from ${entryNumber} to ${reference}`);

        const subChain = this.getPrimitiveRootChain(reference, maxDepth - 1, visited);

        // Remove from visited after recursion
        visited.delete(entryNumber);

        // If we found a chain, prepend this entry
        if (subChain.length > 0) {
            return [{
                ...entry,
                isPrimitive: false,
                depth: 0
            }, ...subChain.map(item => ({ ...item, depth: item.depth + 1 }))];
        }

        // If no chain found, return just this entry
        return [{
            ...entry,
            isPrimitive: false,
            depth: 0
        }];
    }

    // Check if an entry is a primitive root
    isPrimitiveRoot(entry) {
        if (!entry) return false;

        // Check for explicit "primitive root" in exegesis
        if (entry.exegesis && entry.exegesis.toLowerCase().includes('primitive root')) {
            return true;
        }

        // Check for "primitive" in exegesis
        if (entry.exegesis && entry.exegesis.toLowerCase().includes('primitive')) {
            return true;
        }

        // Check if entry has no "from" references (indicates it's a root)
        if (!entry.fromReferences || entry.fromReferences.length === 0) {
            return true;
        }

        return false;
    }

    // Test search functionality for debugging
    testSearch(query) {
        console.log(`🧪 Testing search for: "${query}"`);
        const results = this.search(query, 5);
        console.log('🧪 Test results:', results.map(r => ({
            number: r.entryNumber,
            hebrew: r.hebrewWord,
            meanings: r.meanings.slice(0, 2)
        })));
        return results;
    }

    // Cache management methods
    loadFromCache(cacheKey) {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;

            const data = JSON.parse(cached);

            // Check if cache is still valid (24 hours)
            const cacheAge = Date.now() - data.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            if (cacheAge > maxAge) {
                console.log('📦 Cache expired, will reload from server');
                localStorage.removeItem(cacheKey);
                return null;
            }

            console.log('📦 Cache hit, loading from localStorage');

            // Convert plain objects back to Maps
            const restoredData = {
                ...data,
                entries: new Map(Object.entries(data.entries)),
                searchIndex: new Map(Object.entries(data.searchIndex))
            };

            return restoredData;
        } catch (error) {
            console.warn('⚠️ Error loading from cache:', error);
            return null;
        }
    }

    saveToCache(cacheKey, data) {
        try {
            // Convert Map objects to plain objects for JSON serialization
            const serializableData = {
                ...data,
                entries: Object.fromEntries(data.entries),
                searchIndex: Object.fromEntries(data.searchIndex)
            };

            localStorage.setItem(cacheKey, JSON.stringify(serializableData));
            console.log('💾 Data cached to localStorage');
        } catch (error) {
            console.warn('⚠️ Error saving to cache:', error);
            // If localStorage is full, try to clear old data
            try {
                localStorage.clear();
                localStorage.setItem(cacheKey, JSON.stringify(serializableData));
            } catch (retryError) {
                console.warn('⚠️ Could not save to cache even after clearing');
            }
        }
    }

    showLoading() {
        if (this.loadingMessage) this.loadingMessage.style.display = 'block';
    }

    hideLoading() {
        if (this.loadingMessage) this.loadingMessage.style.display = 'none';
    }

    updateProgress(loaded, total) {
        if (this.progressBar && total) {
            const percent = (loaded / total) * 100;
            this.progressBar.style.width = `${percent}%`;
        }
    }
}

// Combined Autosuggest for both Hebrew XML and KJV+ data
class CombinedAutosuggest {
    constructor(inputElement, xmlParser, kjvParser) {
        this.input = inputElement;
        this.xmlParser = xmlParser;
        this.kjvParser = kjvParser;
        this.suggestions = [];
        this.selectedIndex = -1;
        this.maxSuggestions = 10;

        this.createSuggestionsContainer();
        this.bindEvents();
    }

    createSuggestionsContainer() {
        this.container = document.createElement('div');
        this.container.className = 'autosuggest-container';
        this.container.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.95);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 0 0 8px 8px;
            max-height: 400px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;

        this.input.parentNode.style.position = 'relative';
        this.input.parentNode.appendChild(this.container);
    }

    bindEvents() {
        this.input.addEventListener('input', (e) => this.onInput(e));
        this.input.addEventListener('keydown', (e) => this.onKeydown(e));
        this.input.addEventListener('blur', () => setTimeout(() => this.hideSuggestions(), 150));
        this.input.addEventListener('focus', () => this.showSuggestions());
    }

    onInput(e) {
        const query = e.target.value.trim();
        console.log('⌨️ Combined autosuggest input:', `"${query}"`);
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }

        // Search both datasets
        this.suggestions = this.combinedSearch(query);
        console.log('💡 Combined autosuggest suggestions:', this.suggestions.length);
        this.selectedIndex = -1;
        this.renderSuggestions();
    }

    combinedSearch(query) {
        const results = [];
        const isStrongsQuery = /^H?\d+$/i.test(query);
        const isHebrewQuery = /[\u0590-\u05FF]/.test(query);

        if (isStrongsQuery) {
            // Search for Strong's number in Hebrew data
            const cleanStrongs = query.replace(/^H/i, '');
            const hebrewResults = this.xmlParser.search(cleanStrongs);
            results.push(...hebrewResults.map(entry => ({
                ...entry,
                source: 'hebrew',
                displayText: `${entry.strongsNumber} - ${entry.hebrewWord}`
            })));
        } else if (isHebrewQuery) {
            // Search Hebrew text
            const hebrewResults = this.xmlParser.search(query);
            results.push(...hebrewResults.map(entry => ({
                ...entry,
                source: 'hebrew',
                displayText: `${entry.hebrewWord} (${entry.strongsNumber})`
            })));
        } else {
            // Search English word in KJV+ data
            const kjvResults = this.kjvParser.searchStrongsByWord(query);
            results.push(...kjvResults.map(result => ({
                strongsNumber: result.strongsNumber,
                word: result.word,
                source: 'kjv',
                matchType: result.matchType,
                displayText: `${result.strongsNumber} → "${result.word}"`
            })));

            // Also search Hebrew data for partial matches
            const hebrewResults = this.xmlParser.search(query);
            results.push(...hebrewResults.map(entry => ({
                ...entry,
                source: 'hebrew',
                displayText: `${entry.hebrewWord} (${entry.strongsNumber})`
            })));
        }

        // Remove duplicates and limit results
        const uniqueResults = [];
        const seen = new Set();

        for (const result of results) {
            const key = result.source === 'hebrew' ? result.entryNumber : `${result.strongsNumber}-${result.word}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueResults.push(result);
            }
        }

        return uniqueResults.slice(0, this.maxSuggestions);
    }

    onKeydown(e) {
        if (this.suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
                this.updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0) {
                    this.selectSuggestion(this.suggestions[this.selectedIndex]);
                }
                break;
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    renderSuggestions() {
        if (this.suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.container.innerHTML = '';

        this.suggestions.forEach((suggestion, index) => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'autosuggest-item';
            suggestionDiv.style.cssText = `
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                transition: background-color 0.2s;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;

            const sourceColor = suggestion.source === 'hebrew' ? '#ffd700' : '#40e0d0';
            const sourceIcon = suggestion.source === 'hebrew' ? '📖' : '📚';

            suggestionDiv.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-size: 1.1rem; color: #e0e6ed; margin-bottom: 4px;">${suggestion.displayText}</div>
                    <div style="color: ${sourceColor}; font-size: 0.8rem;">
                        ${sourceIcon} ${suggestion.source === 'hebrew' ? 'Hebrew Concordance' : 'KJV+ Bible'}
                        ${suggestion.matchType ? ` • ${suggestion.matchType} match` : ''}
                    </div>
                    ${suggestion.source === 'hebrew' && suggestion.meanings && suggestion.meanings[0] ?
                        `<div style="color: #888; font-size: 0.7rem; margin-top: 2px;">${suggestion.meanings[0].substring(0, 60)}...</div>` : ''}
                </div>
                <div style="color: #888; font-size: 0.8rem;">→</div>
            `;

            suggestionDiv.addEventListener('click', () => this.selectSuggestion(suggestion));
            suggestionDiv.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            this.container.appendChild(suggestionDiv);
        });

        this.showSuggestions();
    }

    updateSelection() {
        const items = this.container.querySelectorAll('.autosuggest-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.style.backgroundColor = 'rgba(64, 224, 208, 0.2)';
            } else {
                item.style.backgroundColor = 'transparent';
            }
        });
    }

    selectSuggestion(suggestion) {
        if (suggestion.source === 'hebrew') {
            this.input.value = `${suggestion.strongsNumber} - ${suggestion.hebrewWord}`;
        } else {
            this.input.value = `${suggestion.strongsNumber} - ${suggestion.word}`;
        }
        this.hideSuggestions();

        // Trigger search
        const event = new Event('autosuggest-select');
        event.entry = suggestion;
        this.input.dispatchEvent(event);
    }

    showSuggestions() {
        if (this.suggestions.length > 0) {
            this.container.style.display = 'block';
        }
    }

    hideSuggestions() {
        this.container.style.display = 'none';
        this.selectedIndex = -1;
    }
}

// KJV+ Parser for Strong's number integration
// Parses the kjv_strongs.txt file and provides bidirectional search

class KJVParser {
    constructor() {
        this.kjvData = null;
        this.wordToStrongsMap = new Map(); // English word -> Set of Strong's numbers
        this.strongsToWordsMap = new Map(); // Strong's number -> Set of English words
        this.strongsToVersesMap = new Map(); // Strong's number -> Array of verse references
        this.isLoaded = false;
        this.progressBar = document.getElementById('progress-bar');
        this.loadingMessage = document.getElementById('loading-message');
    }

    // Load and parse the KJV+ file
    async loadKJV() {
        try {
            console.log('🔄 Starting to load KJV+ data...');

            // Check if we have a cached version first
            const cacheKey = 'kjv-plus-cache-v2'; // Updated cache key to force reload with fixed parsing
            const cachedData = this.loadFromCache(cacheKey);

            if (cachedData) {
                console.log('📦 Using cached KJV+ data');
                this.kjvData = cachedData.kjvData;
                this.wordToStrongsMap = cachedData.wordToStrongsMap;
                this.strongsToWordsMap = cachedData.strongsToWordsMap;
                this.strongsToVersesMap = cachedData.strongsToVersesMap;
                this.isLoaded = true;
                console.log(`✅ Loaded KJV+ data from cache`);
                return;
            }

            const response = await fetch('/static/data/kjv_strongs.txt');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }

            const text = await response.text();
            console.log('📄 KJV+ text loaded, length:', text.length);

            if (!text || text.length < 100) {
                throw new Error('KJV+ file appears to be empty or too small');
            }

            // Parse the KJV+ data
            this.parseKJVData(text);

            // Validate that parsing was successful
            if (!this.kjvData || Object.keys(this.kjvData).length === 0) {
                throw new Error('KJV+ data parsing failed - no books were parsed');
            }

            // Build search indexes
            this.buildSearchIndexes();

            // Validate that indexes were built
            if (this.wordToStrongsMap.size === 0 && this.strongsToWordsMap.size === 0) {
                throw new Error('KJV+ search indexes are empty - no Strong\'s numbers were found');
            }

            // Cache the parsed data
            this.saveToCache(cacheKey, {
                kjvData: this.kjvData,
                wordToStrongsMap: this.wordToStrongsMap,
                strongsToWordsMap: this.strongsToWordsMap,
                strongsToVersesMap: this.strongsToVersesMap,
                timestamp: Date.now()
            });

            this.isLoaded = true;
            console.log(`✅ Loaded KJV+ data with ${this.wordToStrongsMap.size} word mappings and ${this.strongsToWordsMap.size} Strong's mappings`);

            // Log parsing summary
            const bookCount = Object.keys(this.kjvData).length;
            let totalVerses = 0;
            let totalChapters = 0;
            Object.values(this.kjvData).forEach(chapters => {
                totalChapters += Object.keys(chapters).length;
                Object.values(chapters).forEach(verses => {
                    totalVerses += Object.keys(verses).length;
                });
            });
            console.log(`📊 KJV+ parsing summary: ${bookCount} books, ${totalChapters} chapters, ${totalVerses} verses`);

        } catch (error) {
            console.error('❌ Error loading KJV+ data:', error);
            throw error;
        }
    }

    // Parse the KJV+ text data
    parseKJVData(text) {
        console.log('🔧 Parsing KJV+ data...');
        this.kjvData = {};
        const lines = text.split('\n');
        let currentBook = '';
        let currentChapter = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === '') continue;

            // Check for book headers
            if (!line.includes('Chapter') && !line.includes('{') && line.length < 50) {
                currentBook = line;
                this.kjvData[currentBook] = {};
                console.log(`📖 Processing book: ${currentBook}`);
                continue;
            }

            // Check for chapter headers
            if (line.startsWith('Chapter')) {
                const chapterMatch = line.match(/Chapter (\d+)/);
                if (chapterMatch) {
                    currentChapter = chapterMatch[1];
                    // Ensure the book exists before adding chapter
                    if (!this.kjvData[currentBook]) {
                        this.kjvData[currentBook] = {};
                    }
                    this.kjvData[currentBook][currentChapter] = {};
                    console.log(`📄 Processing chapter: ${currentChapter}`);
                }
                continue;
            }

            // Parse verse lines - more robust parsing
            if (currentBook && currentChapter && /^\d+/.test(line)) {
                const verseMatch = line.match(/^(\d+)\s+(.+)$/);
                if (verseMatch) {
                    const verseNum = verseMatch[1];
                    const verseText = verseMatch[2];

                    // Ensure the chapter structure exists
                    if (!this.kjvData[currentBook]) {
                        console.warn(`⚠️ Book ${currentBook} not found, creating it`);
                        this.kjvData[currentBook] = {};
                    }
                    if (!this.kjvData[currentBook][currentChapter]) {
                        console.warn(`⚠️ Chapter ${currentChapter} not found in book ${currentBook}, creating it`);
                        this.kjvData[currentBook][currentChapter] = {};
                    }

                    this.kjvData[currentBook][currentChapter][verseNum] = verseText;

                    // Debug: Log every 100th verse to track progress
                    if (parseInt(verseNum) % 100 === 0) {
                        console.log(`📄 Parsed verse ${verseNum} in ${currentBook} ${currentChapter}`);
                    }
                } else {
                    // Log lines that look like verses but don't match the pattern
                    console.warn(`⚠️ Line ${i} looks like a verse but doesn't match pattern: "${line.substring(0, 50)}..."`);
                }
            }
        }

        console.log(`📊 Parsed ${Object.keys(this.kjvData).length} books`);
    }

    // Build search indexes for bidirectional lookup
    buildSearchIndexes() {
        console.log('🔍 Building KJV+ search indexes...');

        try {
            Object.entries(this.kjvData).forEach(([book, chapters]) => {
                // Validate book structure
                if (!chapters || typeof chapters !== 'object') {
                    console.warn(`⚠️ Invalid chapters structure for book "${book}"`);
                    return;
                }

                Object.entries(chapters).forEach(([chapter, verses]) => {
                    // Validate chapter structure
                    if (!verses || typeof verses !== 'object') {
                        console.warn(`⚠️ Invalid verses structure for ${book} ${chapter}`);
                        return;
                    }

                    Object.entries(verses).forEach(([verse, text]) => {
                        // Validate verse text
                        if (!text || typeof text !== 'string') {
                            console.warn(`⚠️ Invalid verse text for ${book} ${chapter}:${verse}`);
                            return;
                        }

                        const verseRef = `${book} ${chapter}:${verse}`;

                        // Extract Strong's numbers and their associated words
                        const strongsPattern = /([^{]*?)\{([HG]\d+)\}/g;
                        let match;

                        while ((match = strongsPattern.exec(text)) !== null) {
                            const wordsBeforeStrongs = match[1].trim();
                            const strongsNumber = match[2];

                            // Extract individual words before the Strong's number
                            const words = wordsBeforeStrongs.split(/\s+/).filter(word =>
                                word.length > 0 &&
                                !/^\d+$/.test(word) && // Skip pure numbers
                                !/^[\(\)\[\]\{\}]+$/.test(word) // Skip punctuation
                            );

                            // Map Strong's number to words
                            if (!this.strongsToWordsMap.has(strongsNumber)) {
                                this.strongsToWordsMap.set(strongsNumber, new Set());
                            }
                            words.forEach(word => {
                                const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                                if (cleanWord.length > 1) {
                                    this.strongsToWordsMap.get(strongsNumber).add(cleanWord);
                                }
                            });

                            // Map words to Strong's numbers
                            words.forEach(word => {
                                const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                                if (cleanWord.length > 1) {
                                    if (!this.wordToStrongsMap.has(cleanWord)) {
                                        this.wordToStrongsMap.set(cleanWord, new Set());
                                    }
                                    this.wordToStrongsMap.get(cleanWord).add(strongsNumber);
                                }
                            });

                            // Map Strong's number to verse references
                            if (!this.strongsToVersesMap.has(strongsNumber)) {
                                this.strongsToVersesMap.set(strongsNumber, []);
                            }
                            this.strongsToVersesMap.get(strongsNumber).push({
                                reference: verseRef,
                                context: text.replace(/\{[HG]\d+\}/g, '').trim() // Remove all Strong's markers for context
                            });
                        }
                    });
                });
            });

            console.log(`📊 Built indexes: ${this.wordToStrongsMap.size} words -> Strong's, ${this.strongsToWordsMap.size} Strong's -> words`);
        } catch (error) {
            console.error('❌ Error building KJV+ search indexes:', error);
            throw error;
        }
    }

    // Search for Strong's numbers by English word
    searchStrongsByWord(word, maxResults = 10) {
        if (!this.isLoaded) return [];

        const cleanWord = word.toLowerCase().trim();
        console.log(`🔍 Searching KJV+ for word: "${cleanWord}"`);

        if (!this.wordToStrongsMap.has(cleanWord)) {
            // Try partial matches
            const partialMatches = [];
            this.wordToStrongsMap.forEach((strongsSet, mapWord) => {
                if (mapWord.includes(cleanWord) || cleanWord.includes(mapWord)) {
                    strongsSet.forEach(strongsNum => {
                        partialMatches.push({
                            word: mapWord,
                            strongsNumber: strongsNum,
                            matchType: 'partial'
                        });
                    });
                }
            });
            return partialMatches.slice(0, maxResults);
        }

        const strongsNumbers = Array.from(this.wordToStrongsMap.get(cleanWord));
        return strongsNumbers.map(strongsNum => ({
            word: cleanWord,
            strongsNumber: strongsNum,
            matchType: 'exact'
        })).slice(0, maxResults);
    }

    // Search for English words by Strong's number
    searchWordsByStrongs(strongsNumber, maxResults = 10) {
        if (!this.isLoaded) return [];

        const cleanStrongs = strongsNumber.replace(/^H/, '').toUpperCase();
        const fullStrongs = `H${cleanStrongs}`;
        console.log(`🔍 Searching KJV+ for Strong's: "${fullStrongs}"`);

        if (!this.strongsToWordsMap.has(fullStrongs)) {
            return [];
        }

        const words = Array.from(this.strongsToWordsMap.get(fullStrongs));
        const verses = this.strongsToVersesMap.get(fullStrongs) || [];

        return words.map(word => ({
            strongsNumber: fullStrongs,
            word: word,
            verses: verses.slice(0, 5) // Include up to 5 verse references
        })).slice(0, maxResults);
    }

    // Get verse context for a Strong's number
    getVerseContext(strongsNumber, maxVerses = 5) {
        if (!this.isLoaded) return [];

        const cleanStrongs = strongsNumber.replace(/^H/, '').toUpperCase();
        const fullStrongs = `H${cleanStrongs}`;

        const verses = this.strongsToVersesMap.get(fullStrongs) || [];
        return verses.slice(0, maxVerses);
    }

    // Get full verse text
    getVerse(book, chapter, verse) {
        try {
            // Validate inputs
            if (!book || !chapter || !verse) {
                console.warn(`⚠️ Invalid verse reference: ${book} ${chapter}:${verse}`);
                return null;
            }

            // Check if book exists
            if (!this.kjvData[book]) {
                console.warn(`⚠️ Book "${book}" not found in KJV data`);
                return null;
            }

            // Check if chapter exists
            if (!this.kjvData[book][chapter]) {
                console.warn(`⚠️ Chapter "${chapter}" not found in book "${book}"`);
                return null;
            }

            // Check if verse exists
            if (!this.kjvData[book][chapter][verse]) {
                console.warn(`⚠️ Verse "${verse}" not found in ${book} ${chapter}`);
                return null;
            }

            return this.kjvData[book][chapter][verse];
        } catch (error) {
            console.error(`❌ Error getting verse ${book} ${chapter}:${verse}:`, error);
            return null;
        }
    }

    // Cache management methods
    loadFromCache(cacheKey) {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;

            const data = JSON.parse(cached);

            // Check if cache is still valid (24 hours)
            const cacheAge = Date.now() - data.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            if (cacheAge > maxAge) {
                console.log('📦 KJV+ cache expired, will reload from server');
                localStorage.removeItem(cacheKey);
                return null;
            }

            console.log('📦 KJV+ cache hit, loading from localStorage');

            // Convert plain objects back to Maps
            const restoredData = {
                ...data,
                wordToStrongsMap: new Map(Object.entries(data.wordToStrongsMap).map(([k, v]) => [k, new Set(v)])),
                strongsToWordsMap: new Map(Object.entries(data.strongsToWordsMap).map(([k, v]) => [k, new Set(v)])),
                strongsToVersesMap: new Map(Object.entries(data.strongsToVersesMap))
            };

            return restoredData;
        } catch (error) {
            console.warn('⚠️ Error loading KJV+ from cache:', error);
            return null;
        }
    }

    saveToCache(cacheKey, data) {
        try {
            // Convert Map objects to plain objects for JSON serialization
            const serializableData = {
                ...data,
                wordToStrongsMap: Object.fromEntries(
                    Array.from(data.wordToStrongsMap.entries()).map(([k, v]) => [k, Array.from(v)])
                ),
                strongsToWordsMap: Object.fromEntries(
                    Array.from(data.strongsToWordsMap.entries()).map(([k, v]) => [k, Array.from(v)])
                )
            };

            localStorage.setItem(cacheKey, JSON.stringify(serializableData));
            console.log('💾 KJV+ data cached to localStorage');
        } catch (error) {
            console.warn('⚠️ Error saving KJV+ to cache:', error);
            // If localStorage is full, try to clear old data
            try {
                localStorage.clear();
                localStorage.setItem(cacheKey, JSON.stringify(serializableData));
            } catch (retryError) {
                console.warn('⚠️ Could not save KJV+ to cache even after clearing');
            }
        }
    }

    showLoading() {
        if (this.loadingMessage) {
            const loadingMsg = document.querySelector('#loading-message p');
            if (loadingMsg) {
                loadingMsg.textContent = '🔄 Loading KJV+ concordance database...';
            }
            this.loadingMessage.style.display = 'block';
        }
    }

    hideLoading() {
        if (this.loadingMessage) this.loadingMessage.style.display = 'none';
    }

    updateProgress(loaded, total) {
        if (this.progressBar && total) {
            const percent = (loaded / total) * 100;
            this.progressBar.style.width = `${percent}%`;
        }
    }
}

// Enhanced Primitive Roots Analyzer with XML and KJV+ integration
class EnhancedPrimitiveRootsAnalyzer {
    constructor() {
        this.xmlParser = new HebrewXMLParser();
        this.kjvParser = new KJVParser();
        this.autosuggest = null;
        this.initializeData();
    }

    async initializeData() {
        const errorMessage = document.getElementById('error-message');

        try {
            // Show loading for both datasets
            this.xmlParser.showLoading();
            const loadingMsg = document.querySelector('#loading-message p');
            if (loadingMsg) {
                loadingMsg.textContent = '🔄 Loading Hebrew and KJV+ databases...';
            }
            if (errorMessage) errorMessage.style.display = 'none';

            // Load both datasets in parallel
            await Promise.all([
                this.xmlParser.loadXML(),
                this.kjvParser.loadKJV()
            ]);

            this.xmlParser.hideLoading();
            this.initializeAutosuggest();
            console.log('✅ Hebrew XML and KJV+ databases loaded successfully');

        } catch (error) {
            console.error('❌ Failed to load databases:', error);
            this.xmlParser.hideLoading();
            if (errorMessage) {
                errorMessage.textContent = `❌ Failed to load databases: ${error.message}`;
                errorMessage.style.display = 'block';
            }
        }
    }

    initializeAutosuggest() {
        const searchInput = document.getElementById('strongs-search');
        console.log('🎛️ Initializing combined autosuggest, search input found:', !!searchInput);
        if (searchInput) {
            this.autosuggest = new CombinedAutosuggest(searchInput, this.xmlParser, this.kjvParser);
            console.log('✅ Combined autosuggest initialized');

            // Listen for autosuggest selection
            searchInput.addEventListener('autosuggest-select', (e) => {
                console.log('🎯 Autosuggest selection:', e.entry);
                this.handleAutosuggestSelection(e.entry);
            });
        } else {
            console.log('❌ Search input not found');
        }
    }

    handleAutosuggestSelection(entry) {
        if (entry.source === 'hebrew') {
            // Handle Hebrew XML entry
            const chain = this.xmlParser.getPrimitiveRootChain(entry.entryNumber);
            this.displayXMLResults(entry, chain);
        } else if (entry.source === 'kjv') {
            // Handle KJV+ entry - search for the Strong's number in Hebrew data
            const cleanStrongs = entry.strongsNumber.replace(/^H/, '');
            const hebrewResults = this.xmlParser.search(cleanStrongs);

            if (hebrewResults.length > 0) {
                const chain = this.xmlParser.getPrimitiveRootChain(hebrewResults[0].entryNumber);
                this.displayXMLResults(hebrewResults[0], chain);
            } else {
                // No Hebrew data found, show KJV+ context
                this.displayKJVResults(entry);
            }
        }
    }

    displayKJVResults(kjvEntry) {
        const resultsContainer = document.getElementById('results-container');
        const resultsDiv = document.getElementById('search-results');

        const verses = this.kjvParser.getVerseContext(kjvEntry.strongsNumber);

        let html = '<div class="kjv-results">';

        html += `
            <div class="kjv-entry-header" style="background: rgba(64, 224, 208, 0.1); border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #40e0d0;">
                <h3 style="color: #40e0d0; margin-bottom: 15px;">📚 KJV+ Bible Reference</h3>
                <div style="font-size: 1.5rem; color: #ffd700; margin-bottom: 10px;">${kjvEntry.strongsNumber}</div>
                <div style="color: #e0e6ed; font-size: 1.2rem;">English word: "${kjvEntry.word}"</div>
            </div>
        `;

        if (verses.length > 0) {
            html += `
                <div class="verse-list" style="background: rgba(255,255,255,0.02); border-radius: 8px; padding: 20px;">
                    <h4 style="color: #ffd700; margin-bottom: 15px;">📖 Bible Verses</h4>
            `;

            verses.forEach((verse, index) => {
                html += `
                    <div class="verse-item" style="background: rgba(255,255,255,0.01); border-radius: 6px; padding: 15px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="color: #40e0d0; font-weight: bold; margin-bottom: 8px;">${verse.reference}</div>
                        <div style="color: #e0e6ed; line-height: 1.5;">${verse.context}</div>
                    </div>
                `;
            });

            html += '</div>';
        }

        html += '</div>';

        resultsDiv.innerHTML = html;
        resultsContainer.style.display = 'block';

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    displayXMLResults(selectedEntry, chain) {
        const resultsContainer = document.getElementById('results-container');
        const resultsDiv = document.getElementById('search-results');

        let html = '<div class="xml-results">';

        // Selected entry header
        html += `
            <div class="selected-entry" style="background: rgba(255, 215, 0, 0.1); border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #ffd700;">
                <h3 style="color: #ffd700; margin-bottom: 15px;">📖 Selected Entry</h3>
                <div class="entry-header" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <div style="font-size: 2rem; color: #40e0d0; margin-bottom: 10px;">${selectedEntry.hebrewWord}</div>
                        <div style="color: #ffd700; font-weight: bold;">${selectedEntry.strongsNumber}</div>
                        <div style="color: #e0e6ed;">${selectedEntry.transliteration}</div>
                    </div>
                    <div>
                        <div style="color: #e0e6ed; margin-bottom: 10px;"><strong>Lemma:</strong> ${selectedEntry.lemma}</div>
                        <div style="color: #e0e6ed;"><strong>Entry:</strong> ${selectedEntry.entryNumber}</div>
                    </div>
                </div>
            </div>
        `;

        // Meanings
        if (selectedEntry.meanings.length > 0) {
            html += `
                <div class="meanings-section" style="background: rgba(255,255,255,0.02); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h4 style="color: #40e0d0; margin-bottom: 15px;">📝 Meanings</h4>
                    <ul style="color: #e0e6ed; padding-left: 20px;">
                        ${selectedEntry.meanings.map(meaning => `<li>${meaning}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Primitive Root Chain
        if (chain.length > 1) {
            html += `
                <div class="primitive-chain" style="background: rgba(255,255,255,0.02); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h4 style="color: #40e0d0; margin-bottom: 15px;">🌱 Primitive Root Chain</h4>
                    <div class="chain-timeline" style="position: relative;">
                        <div class="timeline-line" style="position: absolute; left: 20px; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, #ffd700, #40e0d0, #ff69b4);"></div>
            `;

            chain.forEach((entry, index) => {
                const isSelected = entry.entryNumber === selectedEntry.entryNumber;
                const isPrimitive = entry.isPrimitive;
                const colors = ['#ffd700', '#40e0d0', '#ff69b4', '#9370db'];
                const color = colors[index % colors.length];

                // Special styling for primitive roots
                const primitiveClass = isPrimitive ? 'primitive-root-entry' : '';
                const primitiveGlow = isPrimitive ? 'box-shadow: 0 0 20px 4px rgba(255, 215, 0, 0.6);' : '';
                const primitiveAnimation = isPrimitive ? 'animation: primitive-pulse 2s ease-in-out infinite;' : '';

                html += `
                    <div class="chain-item ${primitiveClass}" style="margin-left: 50px; margin-bottom: 20px; position: relative; ${primitiveGlow} ${primitiveAnimation}">
                        <div class="timeline-dot" style="position: absolute; left: -35px; top: 5px; width: 12px; height: 12px; background: ${color}; border-radius: 50%; border: 2px solid rgba(0,0,0,0.8);"></div>
                        <div style="background: rgba(${color === '#ffd700' ? '255,215,0' : color === '#40e0d0' ? '64,224,208' : color === '#ff69b4' ? '255,105,180' : '147,112,219'}, 0.1); border: 1px solid ${color}; border-radius: 6px; padding: 15px;">
                            <h5 style="color: ${color}; margin-bottom: 10px; margin-top: 0;">
                                ${isSelected ? '🎯 ' : ''}${isPrimitive ? '🌟 ' : ''}${entry.strongsNumber} - ${entry.hebrewWord}
                                ${isSelected ? '(Selected)' : ''}
                                ${isPrimitive ? '(Primitive Root)' : `(Depth: ${entry.depth})`}
                            </h5>
                            <div style="color: #e0e6ed; font-size: 0.9rem;">
                                <div><strong>Transliteration:</strong> ${entry.transliteration}</div>
                                <div><strong>Meaning:</strong> ${entry.meanings[0] || 'N/A'}</div>
                                ${entry.exegesis ? `<div><strong>Exegesis:</strong> ${entry.exegesis}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Additional information
        if (selectedEntry.explanation || selectedEntry.translation) {
            html += `
                <div class="additional-info" style="background: rgba(255,255,255,0.02); border-radius: 8px; padding: 20px;">
                    <h4 style="color: #40e0d0; margin-bottom: 15px;">📚 Additional Information</h4>
                    ${selectedEntry.explanation ? `<div style="color: #e0e6ed; margin-bottom: 10px;"><strong>Explanation:</strong> ${selectedEntry.explanation}</div>` : ''}
                    ${selectedEntry.translation ? `<div style="color: #e0e6ed;"><strong>Translation:</strong> ${selectedEntry.translation}</div>` : ''}
                </div>
            `;
        }

        html += '</div>';

        resultsDiv.innerHTML = html;
        resultsContainer.style.display = 'block';

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    clearResults() {
        const resultsContainer = document.getElementById('results-container');
        const resultsDiv = document.getElementById('search-results');
        const searchInput = document.getElementById('strongs-search');
        const errorMessage = document.getElementById('error-message');

        if (resultsDiv) resultsDiv.innerHTML = '';
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (searchInput) searchInput.value = '';
        if (errorMessage) errorMessage.style.display = 'none';

        // Reset autosuggest
        if (this.autosuggest) {
            this.autosuggest.hideSuggestions();
        }
    }

    showError(message) {
        const errorMessage = document.getElementById('error-message');
        const resultsContainer = document.getElementById('results-container');

        if (errorMessage) {
            errorMessage.textContent = `⚠️ ${message}`;
            errorMessage.style.display = 'block';
        }

        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }

    // Enhanced search that works with both Hebrew XML and KJV+ data
    performSearch() {
        const searchInput = document.getElementById('strongs-search');
        const query = searchInput.value.trim();
        console.log('🔍 Perform search called with query:', `"${query}"`);

        if (!query) {
            this.showError('Please enter a search term.');
            return;
        }

        if (!this.xmlParser.isLoaded || !this.kjvParser.isLoaded) {
            console.log('⏳ Parsers not loaded yet');
            this.showError('Databases are still loading. Please try again in a moment.');
            return;
        }

        // Determine query type and search both datasets
        const isStrongsQuery = /^H?\d+$/i.test(query);
        const isHebrewQuery = /[\u0590-\u05FF]/.test(query); // Hebrew characters

        console.log('🔍 Query analysis:', {
            query,
            isStrongsQuery,
            isHebrewQuery
        });

        let hebrewResults = [];
        let kjvResults = [];

        try {
            if (isStrongsQuery) {
                // Search for Strong's number in both datasets
                const cleanStrongs = query.replace(/^H/i, '');
                hebrewResults = this.xmlParser.search(cleanStrongs);
                kjvResults = this.kjvParser.searchWordsByStrongs(cleanStrongs);
                console.log(`🔍 Found ${hebrewResults.length} Hebrew results and ${kjvResults.length} KJV results for Strong's ${cleanStrongs}`);
            } else if (isHebrewQuery) {
                // Search Hebrew text in XML data
                hebrewResults = this.xmlParser.search(query);
                console.log(`🔍 Found ${hebrewResults.length} Hebrew results for Hebrew query`);
            } else {
                // Search English word in KJV+ data and then cross-reference with Hebrew
                kjvResults = this.kjvParser.searchStrongsByWord(query);
                if (kjvResults.length > 0) {
                    // Get Hebrew data for the found Strong's numbers
                    const strongsNumbers = [...new Set(kjvResults.map(r => r.strongsNumber.replace(/^H/, '')))];
                    hebrewResults = strongsNumbers.flatMap(num => this.xmlParser.search(num));
                }
                console.log(`🔍 Found ${kjvResults.length} KJV results and ${hebrewResults.length} Hebrew results for English word`);
            }

            // Display combined results
            this.displayCombinedResults(hebrewResults, kjvResults, query);

        } catch (error) {
            console.error('❌ Search error:', error);
            this.showError('Search failed: ' + error.message);
        }
    }

    // Display combined results from both Hebrew XML and KJV+ datasets
    displayCombinedResults(hebrewResults, kjvResults, originalQuery) {
        const resultsContainer = document.getElementById('results-container');
        const resultsDiv = document.getElementById('search-results');

        let html = '<div class="combined-results">';

        // Query summary
        html += `
            <div class="query-summary" style="background: rgba(64, 224, 208, 0.1); border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #40e0d0;">
                <h4 style="color: #40e0d0; margin-bottom: 10px;">🔍 Search Results for "${originalQuery}"</h4>
                <div style="display: flex; gap: 20px; color: #e0e6ed;">
                    <span>Hebrew Results: ${hebrewResults.length}</span>
                    <span>KJV+ Results: ${kjvResults.length}</span>
                </div>
            </div>
        `;

        // Hebrew Results Section
        if (hebrewResults.length > 0) {
            html += `
                <div class="hebrew-results-section" style="background: rgba(255,255,255,0.02); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h4 style="color: #ffd700; margin-bottom: 15px;">📖 Hebrew Concordance Results</h4>
            `;

            hebrewResults.forEach((entry, index) => {
                html += `
                    <div class="hebrew-result-item" style="background: rgba(255,215,0,0.05); border-radius: 6px; padding: 15px; margin-bottom: 10px; border: 1px solid rgba(255,215,0,0.3); cursor: pointer;" data-hebrew-index="${index}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <div style="font-size: 1.3rem; color: #40e0d0; margin-bottom: 5px;">${entry.hebrewWord}</div>
                                <div style="color: #ffd700; font-size: 0.9rem; margin-bottom: 5px;">${entry.strongsNumber} • Entry ${entry.entryNumber}</div>
                                <div style="color: #e0e6ed; font-size: 0.8rem;">${entry.meanings[0] ? entry.meanings[0].substring(0, 100) + '...' : 'No description available'}</div>
                            </div>
                            <div style="color: #888; font-size: 1.2rem;">→</div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        // KJV+ Results Section
        if (kjvResults.length > 0) {
            html += `
                <div class="kjv-results-section" style="background: rgba(255,255,255,0.02); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h4 style="color: #40e0d0; margin-bottom: 15px;">📚 KJV+ Bible References</h4>
            `;

            kjvResults.forEach((result, index) => {
                const verses = result.verses || [];
                html += `
                    <div class="kjv-result-item" style="background: rgba(64,224,208,0.05); border-radius: 6px; padding: 15px; margin-bottom: 10px; border: 1px solid rgba(64,224,208,0.3);">
                        <div style="margin-bottom: 10px;">
                            <span style="color: #ffd700; font-weight: bold;">${result.strongsNumber}</span>
                            <span style="color: #40e0d0;"> → </span>
                            <span style="color: #e0e6ed; font-style: italic;">"${result.word}"</span>
                        </div>
                        ${verses.length > 0 ? `
                            <div class="verse-references" style="color: #e0e6ed; font-size: 0.9rem;">
                                <strong>Found in:</strong> ${verses.slice(0, 3).map(v => v.reference).join(', ')}
                                ${verses.length > 3 ? ` (+${verses.length - 3} more)` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            });

            html += '</div>';
        }

        if (hebrewResults.length === 0 && kjvResults.length === 0) {
            html += `
                <div class="no-results" style="text-align: center; color: #888; padding: 40px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <h4>No results found for "${originalQuery}"</h4>
                    <p>Try searching for:</p>
                    <ul style="list-style: none; padding: 0;">
                        <li>• A Strong's number (e.g., H430, 7225)</li>
                        <li>• An English word (e.g., "god", "heaven")</li>
                        <li>• A Hebrew word (אָב, מֶלֶךְ)</li>
                    </ul>
                </div>
            `;
        }

        html += '</div>';

        resultsDiv.innerHTML = html;
        resultsContainer.style.display = 'block';

        // Add click event listeners for Hebrew results
        const hebrewItems = resultsDiv.querySelectorAll('.hebrew-result-item');
        hebrewItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.handleAutosuggestSelection(hebrewResults[index]);
            });
        });

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Initialize the enhanced analyzer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Enhanced Primitive Roots Analyzer');
    window.currentAnalyzer = new EnhancedPrimitiveRootsAnalyzer();
    console.log('✅ Analyzer created');

    // Set up event listeners for the search interface
    const searchButton = document.getElementById('search-button');
    const clearButton = document.getElementById('clear-button');
    const searchInput = document.getElementById('strongs-search');

    console.log('🔧 Setting up event listeners:', {
        searchButton: !!searchButton,
        clearButton: !!clearButton,
        searchInput: !!searchInput
    });

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            console.log('🖱️ Search button clicked');
            window.currentAnalyzer.performSearch();
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            window.currentAnalyzer.clearResults();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('⏎ Enter key pressed');
                window.currentAnalyzer.performSearch();
            }
        });
    }

    // Add global test functions for debugging
    window.testSearch = (query) => {
        if (window.currentAnalyzer && window.currentAnalyzer.xmlParser) {
            return window.currentAnalyzer.xmlParser.testSearch(query);
        } else {
            console.log('❌ Hebrew parser not ready yet');
            return null;
        }
    };

    window.testKJVSearch = (query) => {
        if (window.currentAnalyzer && window.currentAnalyzer.kjvParser) {
            console.log('� Testing KJV search for:', query);
            const isStrongs = /^H?\d+$/i.test(query);
            if (isStrongs) {
                const results = window.currentAnalyzer.kjvParser.searchWordsByStrongs(query);
                console.log('📚 KJV Strong\'s results:', results);
                return results;
            } else {
                const results = window.currentAnalyzer.kjvParser.searchStrongsByWord(query);
                console.log('📚 KJV word results:', results);
                return results;
            }
        } else {
            console.log('❌ KJV parser not ready yet');
            return null;
        }
    };

    window.testCombinedSearch = (query) => {
        if (window.currentAnalyzer) {
            console.log('🔍 Testing combined search for:', query);
            window.currentAnalyzer.performSearch();
            return 'Search initiated - check results above';
        } else {
            console.log('❌ Analyzer not ready yet');
            return null;
        }
    };

    console.log('🔧 Added global test functions:');
    console.log('  • testSearch("egypt") - Test Hebrew XML search');
    console.log('  • testKJVSearch("god") - Test KJV+ search');
    console.log('  • testKJVSearch("H430") - Test KJV+ Strong\'s lookup');
    console.log('  • testCombinedSearch("god") - Test full combined search');
});
