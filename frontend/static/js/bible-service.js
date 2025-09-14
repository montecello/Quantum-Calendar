// Bible SDK Service for Hebrew Word Analysis
// Integrates with biblesdk to provide Hebrew concordance data

// Dynamic import for Bible SDK (works in browser)
let biblesdk = null;

async function loadBibleSDK() {
    if (biblesdk) return biblesdk;

    try {
        // Try different import methods for browser compatibility
        if (typeof window !== 'undefined') {
            // Browser environment - use dynamic import
            biblesdk = await import('/biblesdk/dist/index.mjs');
        } else {
            // Node.js environment
            biblesdk = await import('biblesdk');
        }
        console.log('✅ Bible SDK loaded successfully');
        return biblesdk;
    } catch (error) {
        console.error('❌ Failed to load Bible SDK:', error);
        throw error;
    }
}

class BibleSDKService {
    constructor() {
        this.isInitialized = false;
        this.biblesdk = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.biblesdk = await loadBibleSDK();
            this.isInitialized = true;
            console.log('✅ Bible SDK Service initialized');
        } catch (error) {
            console.error('❌ Bible SDK Service initialization failed:', error);
            throw error;
        }
    }

    async searchHebrewWord(word, options = {}) {
        await this.initialize();

        try {
            console.log(`🔍 Searching Hebrew word: "${word}"`);

            const searchOptions = {
                language: 'hebrew',
                caseSensitive: false,
                wholeWord: false,
                ...options
            };

            const results = await this.biblesdk.getSearchResults(word, searchOptions);
            console.log(`✅ Found ${results.length} results for "${word}"`);

            return results;
        } catch (error) {
            console.error('❌ Hebrew word search failed:', error);
            throw error;
        }
    }

    async getStrongsConcordance(strongsNumber) {
        await this.initialize();

        try {
            console.log(`📚 Getting Strong's concordance for: ${strongsNumber}`);

            // Use the search functionality to get concordance data
            const results = await this.searchHebrewWord(strongsNumber, {
                language: 'hebrew',
                strongs: true
            });

            return results;
        } catch (error) {
            console.error('❌ Strong\'s concordance lookup failed:', error);
            throw error;
        }
    }

    async analyzeHebrewWord(word) {
        await this.initialize();

        try {
            console.log(`� Analyzing Hebrew word: "${word}"`);

            // Get basic search results
            const searchResults = await this.searchHebrewWord(word);

            // Extract analysis data
            const analysis = {
                word: word,
                totalOccurrences: searchResults.length,
                books: [...new Set(searchResults.map(r => r.book))],
                verses: searchResults.map(r => ({
                    book: r.book,
                    chapter: r.chapter,
                    verse: r.verse,
                    text: r.text
                }))
            };

            console.log(`✅ Analysis complete for "${word}": ${analysis.totalOccurrences} occurrences`);
            return analysis;
        } catch (error) {
            console.error('❌ Hebrew word analysis failed:', error);
            throw error;
        }
    }

    async listAvailableBooks() {
        await this.initialize();

        try {
            const books = await this.biblesdk.listBooks();
            console.log(`📖 Available books: ${books.length}`);
            return books;
        } catch (error) {
            console.error('❌ Failed to list books:', error);
            throw error;
        }
    }
}

// Enhanced Hebrew XML Parser with Bible SDK integration
class EnhancedHebrewXMLParser {
    constructor() {
        this.bibleService = new BibleSDKService();
        this.isLoaded = false;
        this.entries = new Map();
    }

    // Override the loadXML method to use Bible SDK as fallback
    async loadXML() {
        try {
            console.log('🔄 Loading Hebrew XML with Bible SDK fallback...');

            // Try to load the local XML first
            // This would normally load the Hebrew.xml file
            // For now, we'll just initialize Bible SDK
            await this.bibleService.initialize();
            this.isLoaded = true;
            console.log('✅ Enhanced parser initialized with Bible SDK');

        } catch (error) {
            console.error('❌ Failed to initialize enhanced parser:', error);
            throw error;
        }
    }

    // Enhanced search that combines local XML and Bible SDK
    async search(query, maxResults = 10) {
        if (!this.isLoaded) {
            console.log('❌ Search called but parser not loaded');
            return [];
        }

        const cleanQuery = query.toLowerCase().trim();
        console.log('🔍 Enhanced search for:', `"${cleanQuery}"`);

        // Try Bible SDK search
        try {
            const results = await this.bibleService.searchHebrewWord(cleanQuery);
            console.log(`📊 Bible SDK found ${results.length} results`);

            // Format results for display
            return results.slice(0, maxResults).map(result => ({
                word: result.word || cleanQuery,
                strongs: result.strongs,
                definition: result.definition || '',
                occurrences: result.occurrences || 1,
                verses: result.verses || []
            }));
        } catch (error) {
            console.error('❌ Bible SDK search failed:', error);
            return [];
        }
    }

    // Get Bible SDK analysis for a word
    async getBibleSDKAnalysis(word) {
        return await this.bibleService.analyzeHebrewWord(word);
    }
}

// Export for use in other modules
export { BibleSDKService, EnhancedHebrewXMLParser };
