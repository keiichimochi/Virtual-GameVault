/**
 * SearchManager - Orchestrates multi-tiered search system for game discovery
 * Implements primary search using WikidataService with automatic Wikipedia fallback
 */
class SearchManager {
    constructor() {
        this.wikidataService = new WikidataService();
        this.wikipediaService = new WikipediaService();
        this.searchCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Search for games using multi-tiered strategy
     * @param {string} query - Game title to search for
     * @returns {Promise<Array>} Array of search results with merged data
     */
    async searchGame(query) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        const normalizedQuery = query.trim();
        
        // Check cache first
        const cachedResult = this.getCachedResult(normalizedQuery);
        if (cachedResult) {
            return cachedResult;
        }

        try {
            // Execute primary search using Wikidata
            const wikidataResults = await this.executeWikidataSearch(normalizedQuery);
            
            // If Wikidata returns good results, use them
            if (wikidataResults.length > 0 && this.hasGoodQualityResults(wikidataResults)) {
                const results = this.rankAndDeduplicateResults(wikidataResults);
                this.cacheResult(normalizedQuery, results);
                return results;
            }

            // Fallback to Wikipedia if Wikidata results are insufficient
            console.log('Wikidata results insufficient, falling back to Wikipedia');
            const wikipediaResults = await this.executeFallbackSearch(normalizedQuery);
            
            // Merge results from both sources
            const mergedResults = this.mergeSearchResults(wikidataResults, wikipediaResults);
            const finalResults = this.rankAndDeduplicateResults(mergedResults);
            
            this.cacheResult(normalizedQuery, finalResults);
            return finalResults;

        } catch (error) {
            console.error('Search failed:', error);
            
            // Try Wikipedia as last resort
            try {
                const wikipediaResults = await this.executeFallbackSearch(normalizedQuery);
                const results = this.rankAndDeduplicateResults(wikipediaResults);
                this.cacheResult(normalizedQuery, results);
                return results;
            } catch (fallbackError) {
                console.error('Fallback search also failed:', fallbackError);
                return [];
            }
        }
    }

    /**
     * Execute primary search using WikidataService
     * @param {string} query - Search query
     * @returns {Promise<Array>} Wikidata search results
     */
    async executeWikidataSearch(query) {
        try {
            const results = await this.wikidataService.searchGameByTitle(query);
            
            // Add search metadata
            return results.map(result => ({
                ...result,
                searchMetadata: {
                    source: 'wikidata',
                    query: query,
                    timestamp: Date.now(),
                    confidence: this.calculateWikidataConfidence(result, query)
                }
            }));
        } catch (error) {
            console.warn('Wikidata search failed:', error);
            return [];
        }
    }

    /**
     * Execute fallback search using WikipediaService
     * @param {string} query - Search query
     * @returns {Promise<Array>} Wikipedia search results
     */
    async executeFallbackSearch(query) {
        try {
            const result = await this.wikipediaService.extractGameMetadata(query);
            
            if (!result) {
                return [];
            }

            // Convert Wikipedia result to standard format
            const standardizedResult = {
                ...result,
                id: this.generateSearchResultId(),
                searchMetadata: {
                    source: 'wikipedia',
                    query: query,
                    timestamp: Date.now(),
                    confidence: this.calculateWikipediaConfidence(result, query)
                }
            };

            return [standardizedResult];
        } catch (error) {
            console.warn('Wikipedia fallback search failed:', error);
            return [];
        }
    }

    /**
     * Merge search results from multiple sources
     * @param {Array} wikidataResults - Results from Wikidata
     * @param {Array} wikipediaResults - Results from Wikipedia
     * @returns {Array} Merged and deduplicated results
     */
    mergeSearchResults(wikidataResults, wikipediaResults) {
        const mergedResults = [...wikidataResults];
        
        // Add Wikipedia results that don't duplicate Wikidata results
        wikipediaResults.forEach(wikipediaResult => {
            const isDuplicate = wikidataResults.some(wikidataResult => 
                this.areResultsSimilar(wikidataResult, wikipediaResult)
            );
            
            if (!isDuplicate) {
                mergedResults.push(wikipediaResult);
            } else {
                // Enhance existing Wikidata result with Wikipedia data
                const matchingResult = wikidataResults.find(wikidataResult => 
                    this.areResultsSimilar(wikidataResult, wikipediaResult)
                );
                
                if (matchingResult) {
                    this.enhanceResultWithWikipediaData(matchingResult, wikipediaResult);
                }
            }
        });

        return mergedResults;
    }

    /**
     * Rank and deduplicate search results
     * @param {Array} results - Raw search results
     * @returns {Array} Ranked and deduplicated results
     */
    rankAndDeduplicateResults(results) {
        // Remove exact duplicates
        const uniqueResults = this.removeDuplicates(results);
        
        // Sort by confidence score and relevance
        uniqueResults.sort((a, b) => {
            // Primary sort by confidence
            const confidenceDiff = (b.searchMetadata?.confidence || 0) - (a.searchMetadata?.confidence || 0);
            if (Math.abs(confidenceDiff) > 0.1) {
                return confidenceDiff;
            }
            
            // Secondary sort by data completeness
            const completenessA = this.calculateDataCompleteness(a);
            const completenessB = this.calculateDataCompleteness(b);
            const completenessDiff = completenessB - completenessA;
            if (Math.abs(completenessDiff) > 0.1) {
                return completenessDiff;
            }
            
            // Tertiary sort by source preference (Wikidata > Wikipedia)
            const sourceScoreA = a.searchMetadata?.source === 'wikidata' ? 1 : 0;
            const sourceScoreB = b.searchMetadata?.source === 'wikidata' ? 1 : 0;
            
            return sourceScoreB - sourceScoreA;
        });

        // Limit results to top 10
        return uniqueResults.slice(0, 10);
    }

    /**
     * Check if search results have good quality
     * @param {Array} results - Search results to evaluate
     * @returns {boolean} True if results are of good quality
     */
    hasGoodQualityResults(results) {
        if (results.length === 0) {
            return false;
        }

        // Check if at least one result has high confidence and good data completeness
        return results.some(result => {
            const confidence = result.searchMetadata?.confidence || 0;
            const completeness = this.calculateDataCompleteness(result);
            
            return confidence > 0.7 && completeness > 0.5;
        });
    }

    /**
     * Calculate confidence score for Wikidata results
     * @param {Object} result - Wikidata result
     * @param {string} query - Original search query
     * @returns {number} Confidence score (0-1)
     */
    calculateWikidataConfidence(result, query) {
        let confidence = 0;
        const queryLower = query.toLowerCase();
        const titleLower = (result.title || '').toLowerCase();

        // Exact title match
        if (titleLower === queryLower) {
            confidence += 0.5;
        } else if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
            confidence += 0.3;
        }

        // Data completeness bonus
        confidence += this.calculateDataCompleteness(result) * 0.3;

        // Wikidata ID presence bonus
        if (result.wikidataId) {
            confidence += 0.2;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * Calculate confidence score for Wikipedia results
     * @param {Object} result - Wikipedia result
     * @param {string} query - Original search query
     * @returns {number} Confidence score (0-1)
     */
    calculateWikipediaConfidence(result, query) {
        let confidence = 0;
        const queryLower = query.toLowerCase();
        const titleLower = (result.title || '').toLowerCase();

        // Title matching
        if (titleLower === queryLower) {
            confidence += 0.4; // Slightly lower than Wikidata for exact match
        } else if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
            confidence += 0.25;
        }

        // Data completeness bonus
        confidence += this.calculateDataCompleteness(result) * 0.25;

        // Wikipedia attribution bonus
        if (result.dataSource?.attribution) {
            confidence += 0.15;
        }

        // Description presence bonus
        if (result.description && result.description.length > 50) {
            confidence += 0.2;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * Calculate data completeness score
     * @param {Object} result - Game result object
     * @returns {number} Completeness score (0-1)
     */
    calculateDataCompleteness(result) {
        const fields = [
            result.title,
            result.releaseDate,
            result.developer,
            result.publisher,
            result.platforms && result.platforms.length > 0,
            result.genre && result.genre.length > 0,
            result.coverImage,
            result.description
        ];

        const filledFields = fields.filter(field => !!field).length;
        return filledFields / fields.length;
    }

    /**
     * Check if two results are similar (potential duplicates)
     * @param {Object} result1 - First result
     * @param {Object} result2 - Second result
     * @returns {boolean} True if results are similar
     */
    areResultsSimilar(result1, result2) {
        const title1 = (result1.title || '').toLowerCase().trim();
        const title2 = (result2.title || '').toLowerCase().trim();

        // Exact title match
        if (title1 === title2) {
            return true;
        }

        // Similar titles (Levenshtein distance or substring matching)
        if (title1.includes(title2) || title2.includes(title1)) {
            return true;
        }

        // Check if they have the same release year and similar platforms
        const year1 = this.extractYear(result1.releaseDate);
        const year2 = this.extractYear(result2.releaseDate);
        
        if (year1 && year2 && year1 === year2) {
            const platforms1 = new Set((result1.platforms || []).map(p => p.toLowerCase()));
            const platforms2 = new Set((result2.platforms || []).map(p => p.toLowerCase()));
            
            // Check for platform overlap
            const commonPlatforms = [...platforms1].filter(p => platforms2.has(p));
            if (commonPlatforms.length > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Enhance Wikidata result with Wikipedia data
     * @param {Object} wikidataResult - Wikidata result to enhance
     * @param {Object} wikipediaResult - Wikipedia result with additional data
     */
    enhanceResultWithWikipediaData(wikidataResult, wikipediaResult) {
        // Add missing description from Wikipedia
        if (!wikidataResult.description && wikipediaResult.description) {
            wikidataResult.description = wikipediaResult.description;
        }

        // Add Wikipedia attribution
        if (wikipediaResult.dataSource?.attribution) {
            wikidataResult.dataSource = wikidataResult.dataSource || {};
            wikidataResult.dataSource.fallback = 'wikipedia';
            wikidataResult.dataSource.wikipediaAttribution = wikipediaResult.dataSource.attribution;
        }

        // Enhance with additional Wikipedia metadata
        if (wikipediaResult.series && !wikidataResult.series) {
            wikidataResult.series = wikipediaResult.series;
        }

        if (wikipediaResult.modes && (!wikidataResult.modes || wikidataResult.modes.length === 0)) {
            wikidataResult.modes = wikipediaResult.modes;
        }

        // Mark as enhanced
        wikidataResult.searchMetadata = wikidataResult.searchMetadata || {};
        wikidataResult.searchMetadata.enhancedWithWikipedia = true;
    }

    /**
     * Remove duplicate results
     * @param {Array} results - Results array
     * @returns {Array} Deduplicated results
     */
    removeDuplicates(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = `${result.title?.toLowerCase()}_${result.releaseDate}_${(result.platforms || []).sort().join(',')}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Extract year from date string
     * @param {string} dateString - Date string
     * @returns {number|null} Year or null
     */
    extractYear(dateString) {
        if (!dateString) return null;
        
        const yearMatch = dateString.match(/(\d{4})/);
        return yearMatch ? parseInt(yearMatch[1]) : null;
    }

    /**
     * Generate unique ID for search results
     * @returns {string} Unique ID
     */
    generateSearchResultId() {
        return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Cache search result
     * @param {string} query - Search query
     * @param {Array} results - Search results
     */
    cacheResult(query, results) {
        const cacheKey = query.toLowerCase().trim();
        this.searchCache.set(cacheKey, {
            results: results,
            timestamp: Date.now()
        });

        // Clean old cache entries
        this.cleanCache();
    }

    /**
     * Get cached search result
     * @param {string} query - Search query
     * @returns {Array|null} Cached results or null
     */
    getCachedResult(query) {
        const cacheKey = query.toLowerCase().trim();
        const cached = this.searchCache.get(cacheKey);
        
        if (!cached) {
            return null;
        }

        // Check if cache is still valid
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.searchCache.delete(cacheKey);
            return null;
        }

        return cached.results;
    }

    /**
     * Clean expired cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.searchCache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.searchCache.delete(key);
            }
        }
    }

    /**
     * Clear all cached results
     */
    clearCache() {
        this.searchCache.clear();
    }

    /**
     * Get search statistics
     * @returns {Object} Search statistics
     */
    getSearchStatistics() {
        return {
            cacheSize: this.searchCache.size,
            cacheTimeout: this.cacheTimeout,
            lastCacheClean: Date.now()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchManager;
}