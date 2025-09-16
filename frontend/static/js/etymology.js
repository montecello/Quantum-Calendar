/**
 * Etymology Analysis Module
 * Handles displaying etymological chains for selected words
 */

class EtymologyAnalysis {
    constructor() {
        this.currentChain = null;
        this.isLoading = false;
    }

    /**
     * Display etymology analysis for a selected word
     * @param {string} strongsNumber - Strong's number (e.g., "H4714")
     * @param {string} selectedWord - The word that was selected
     */
    async showAnalysis(strongsNumber, selectedWord) {
        console.log(`🌳 ETYMOLOGY: Starting analysis for ${strongsNumber} (${selectedWord})`);
        
        if (this.isLoading) {
            console.log('🌳 ETYMOLOGY: Already loading, skipping...');
            return;
        }
        
        const container = this.getOrCreateContainer();
        console.log('🌳 ETYMOLOGY: Container created/found:', container);
        
        this.showLoading(container, selectedWord);
        this.isLoading = true;

        try {
            const apiUrl = `/api/etymology-chain?strongs=${strongsNumber}`;
            console.log(`🌳 ETYMOLOGY: Making API call to ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            console.log(`🌳 ETYMOLOGY: API response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`🌳 ETYMOLOGY: API data received:`, data);
            console.log(`🌳 ETYMOLOGY: Chain length: ${data.chain ? data.chain.length : 0}`);
            
            this.currentChain = data;
            this.renderChain(container, data, selectedWord);
            console.log('🌳 ETYMOLOGY: Chain rendered successfully');
            
        } catch (error) {
            console.error('🌳 ETYMOLOGY: Error:', error);
            this.showError(container, error.message);
        } finally {
            this.isLoading = false;
            console.log('🌳 ETYMOLOGY: Analysis complete');
        }
    }

    /**
     * Get or create the etymology container
     */
    getOrCreateContainer() {
        let container = document.getElementById('etymology-container');
        console.log('🌳 ETYMOLOGY: Looking for existing container:', container);
        
        if (!container) {
            console.log('🌳 ETYMOLOGY: Creating new container...');
            container = document.createElement('div');
            container.id = 'etymology-container';
            container.style.display = 'block';
            container.style.visibility = 'visible';
            
            // Insert before the educational section (which comes after results-container)
            const resultsContainer = document.getElementById('results-container');
            const educationalSection = document.querySelector('.educational-section');
            
            console.log('🌳 ETYMOLOGY: Found results container:', !!resultsContainer);
            console.log('🌳 ETYMOLOGY: Found educational section:', !!educationalSection);
            
            if (educationalSection) {
                console.log('🌳 ETYMOLOGY: Inserting before educational section');
                educationalSection.parentNode.insertBefore(container, educationalSection);
            } else if (resultsContainer) {
                console.log('🌳 ETYMOLOGY: Inserting after results container');
                resultsContainer.parentNode.insertBefore(container, resultsContainer.nextSibling);
            } else {
                console.log('🌳 ETYMOLOGY: Appending to document body');
                document.body.appendChild(container);
            }
            
            console.log('🌳 ETYMOLOGY: Container created and inserted:', container);
            console.log('🌳 ETYMOLOGY: Container parent:', container.parentNode);
        }
        return container;
    }

    /**
     * Show loading state
     */
    showLoading(container, selectedWord) {
        container.innerHTML = `
            <div class="etymology-analysis">
                <div class="etymology-title">
                    🌳 Etymology Analysis: ${selectedWord}
                </div>
                <div class="etymology-loading">
                    <div class="etymology-loading-spinner"></div>
                    <div>Building etymological tree...</div>
                </div>
            </div>
        `;
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Show error state
     */
    showError(container, message) {
        container.innerHTML = `
            <div class="etymology-analysis">
                <div class="etymology-title">
                    ❌ Etymology Analysis Error
                </div>
                <div class="etymology-error">
                    Failed to load etymological data: ${message}
                </div>
            </div>
        `;
    }

    /**
     * Render the complete etymology chain
     */
    renderChain(container, data, selectedWord) {
        console.log('🌳 ETYMOLOGY: Starting to render chain...');
        console.log('🌳 ETYMOLOGY: Data received:', data);
        
        const chain = data.chain || [];
        const isPrimitive = data.reachedPrimitive;
        
        console.log(`🌳 ETYMOLOGY: Chain has ${chain.length} entries`);
        console.log('🌳 ETYMOLOGY: Chain entries:', chain.map(e => `H${e.strongsNumber} - ${e.word}`));
        
        let chainHtml = '';
        
        // Render each entry in the chain
        chain.forEach((entry, index) => {
            const isLast = index === chain.length - 1;
            const isPrimitiveRoot = isLast && isPrimitive;
            
            console.log(`🌳 ETYMOLOGY: Rendering entry ${index + 1}: H${entry.strongsNumber} (${isPrimitiveRoot ? 'PRIMITIVE ROOT' : 'normal'})`);
            
            chainHtml += this.renderEtymologyEntry(entry, index, isPrimitiveRoot);
            
            // Add arrow between entries (except after the last one)
            if (!isLast) {
                chainHtml += '<div class="etymology-arrow">↓</div>';
            }
        });

        console.log('🌳 ETYMOLOGY: Generated chain HTML length:', chainHtml.length);

        // Add summary - REMOVED per user request
        const summaryHtml = ''; // this.renderSummary(data, selectedWord);

        const finalHtml = `
            <div class="etymology-analysis">
                <div class="etymology-title">
                    🌳 Etymology Analysis: ${selectedWord}
                </div>
                <div class="etymology-chain">
                    ${chainHtml}
                </div>
                ${summaryHtml}
            </div>
        `;

        console.log('🌳 ETYMOLOGY: Final HTML to be inserted:');
        console.log(finalHtml.substring(0, 500) + '...');
        console.log('🌳 ETYMOLOGY: Setting container innerHTML...');
        container.innerHTML = finalHtml;
        
        // Hide the regular search results since etymology analysis shows the same info
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
        
        // Force a reflow to ensure the container is visible
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.position = 'relative';
        container.style.zIndex = '999';
        
        console.log('🌳 ETYMOLOGY: Container after setting innerHTML:');
        console.log('Container innerHTML length:', container.innerHTML.length);
        console.log('Container display:', window.getComputedStyle(container).display);
        console.log('Container visibility:', window.getComputedStyle(container).visibility);
        
        console.log('🌳 ETYMOLOGY: Container content set, scrolling into view...');

        // Scroll to view and trigger pulse animation
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Debug: check container positioning
        console.log('🌳 ETYMOLOGY: Container positioning info:');
        const containerRect = container.getBoundingClientRect();
        console.log(`Container position: x=${containerRect.x}, y=${containerRect.y}, width=${containerRect.width}, height=${containerRect.height}`);
        console.log(`Container in viewport: ${containerRect.y >= 0 && containerRect.y <= window.innerHeight}`);
        
        // Also highlight the container temporarily
        container.style.border = '3px solid red';
        setTimeout(() => {
            container.style.border = '';
        }, 2000);
        
        // Re-trigger pulse animation for primitive root
        setTimeout(() => {
            const primitiveElements = container.querySelectorAll('.primitive-root');
            console.log(`🌳 ETYMOLOGY: Found ${primitiveElements.length} primitive root elements for pulsing`);
            
            // Debug: check what elements are actually in the container
            console.log('🌳 ETYMOLOGY: All elements in container:');
            const allElements = container.querySelectorAll('*');
            allElements.forEach((el, index) => {
                console.log(`  ${index + 1}. ${el.tagName}.${el.className} - "${el.textContent.substring(0, 50)}..."`);
            });
            
            // Debug: check primitive root elements specifically
            primitiveElements.forEach((el, index) => {
                console.log(`🌳 ETYMOLOGY: Primitive root ${index + 1}:`, {
                    element: el,
                    classList: Array.from(el.classList),
                    computedStyle: {
                        display: window.getComputedStyle(el).display,
                        visibility: window.getComputedStyle(el).visibility,
                        opacity: window.getComputedStyle(el).opacity,
                        animation: window.getComputedStyle(el).animation
                    }
                });
                
                // Force animation restart
                el.style.animation = 'none';
                void el.offsetWidth; // Force reflow
                el.style.animation = 'etymology-pulse 1s ease-in-out infinite';
                console.log(`🌳 ETYMOLOGY: Applied pulse animation to element ${index + 1}`);
            });
        }, 100);
        
        console.log('🌳 ETYMOLOGY: Render complete!');
    }

    /**
     * Render a single etymology entry
     */
    renderEtymologyEntry(entry, index, isPrimitiveRoot) {
        const etymology = entry.etymology || {};
        const type = etymology.type || 'unknown';
        const description = etymology.description || '';
        const firstDefinition = entry.definitions && entry.definitions.length > 0 ? entry.definitions[0] : '';
        const allDefinitions = entry.definitions || [];
        const morphology = entry.morphology || '';
        const partOfSpeech = entry.partOfSpeech || '';
        const explanation = entry.explanation || '';
        
        const primitiveClass = isPrimitiveRoot ? ' primitive-root' : '';
        
        // Format etymology references if available
        let etymologyRefsHtml = '';
        if (etymology.references && etymology.references.length > 0) {
            etymologyRefsHtml = `
                <div class="etymology-references">
                    <strong>Related:</strong> 
                    ${etymology.references.map(ref => 
                        `H${ref.src} (${ref.transliteration})`
                    ).join(', ')}
                </div>
            `;
        }
        
        // Format multiple definitions
        let definitionsHtml = '';
        if (allDefinitions.length > 1) {
            definitionsHtml = `
                <div class="etymology-definitions">
                    ${allDefinitions.map((def, i) => 
                        `<div class="definition-item ${i === 0 ? 'primary' : 'secondary'}">${def}</div>`
                    ).join('')}
                </div>
            `;
        } else if (firstDefinition) {
            definitionsHtml = `<div class="etymology-meaning">${firstDefinition}</div>`;
        }
        
        return `
            <div class="etymology-entry${primitiveClass}">
                <div class="etymology-header">
                    <div class="etymology-strongs">H${entry.strongsNumber}</div>
                    <div class="etymology-type ${type}">${type}</div>
                    ${morphology ? `<div class="etymology-morphology">${morphology}</div>` : ''}
                </div>
                <div class="etymology-words">
                    <div class="etymology-hebrew">
                        ${entry.word || entry.lemma}${entry.lemma && entry.word !== entry.lemma ? ` / ${entry.lemma}` : ''}
                    </div>
                    <div class="etymology-transliteration">${entry.transliteration}</div>
                    ${partOfSpeech ? `<div class="etymology-pos">[${partOfSpeech}]</div>` : ''}
                </div>
                ${explanation ? `<div class="etymology-explanation">${explanation}</div>` : ''}
                ${description ? `<div class="etymology-description"><strong>Etymology:</strong> ${description}</div>` : ''}
                ${etymologyRefsHtml}
                ${definitionsHtml}
                ${isPrimitiveRoot ? '<div class="etymology-primitive-badge">🌱 Primitive Root</div>' : ''}
            </div>
        `;
    }

    /**
     * Render the etymology summary
     */
    renderSummary(data, selectedWord) {
        const chainLength = data.chainLength || 0;
        const reachedPrimitive = data.reachedPrimitive;
        
        let summaryText = `Traced ${chainLength} step${chainLength !== 1 ? 's' : ''} in the etymological chain`;
        
        if (reachedPrimitive) {
            summaryText += ' and reached the primitive root.';
        } else {
            summaryText += ' but did not reach a primitive root.';
        }

        return `
            <div class="etymology-summary">
                <div class="etymology-summary-text">
                    ${summaryText}
                </div>
                <div class="etymology-count">
                    Chain Length: <strong>${chainLength}</strong> | 
                    Status: <strong>${reachedPrimitive ? 'Complete' : 'Incomplete'}</strong>
                </div>
            </div>
        `;
    }

    /**
     * Hide the etymology analysis
     */
    hide() {
        const container = document.getElementById('etymology-container');
        if (container) {
            container.style.display = 'none';
        }
    }

    /**
     * Show the etymology analysis (if previously hidden)
     */
    show() {
        const container = document.getElementById('etymology-container');
        if (container) {
            container.style.display = 'block';
        }
    }
}

// Global instance
window.EtymologyAnalysis = window.EtymologyAnalysis || new EtymologyAnalysis();

/**
 * Helper function to trigger etymology analysis from autocomplete selections
 * This can be called when a user selects a word from search suggestions
 */
function showEtymologyAnalysis(strongsNumber, selectedWord) {
    window.EtymologyAnalysis.showAnalysis(strongsNumber, selectedWord);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EtymologyAnalysis;
}