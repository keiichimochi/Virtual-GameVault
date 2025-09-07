/**
 * WikidataService - Handles queries to Wikidata SPARQL endpoint for video game metadata
 */
class WikidataService {
    constructor() {
        this.endpoint = 'https://query.wikidata.org/sparql';
        this.userAgent = 'GameCollectionApp/1.0 (https://github.com/user/game-collection)';
    }

    /**
     * Search for games by title using Wikidata SPARQL
     * @param {string} title - Game title to search for
     * @returns {Promise<Array>} Array of game objects with metadata
     */
    async searchGameByTitle(title) {
        try {
            const query = this.buildSPARQLQuery(title);
            const response = await this.executeSPARQLQuery(query);
            return this.extractEnhancedMetadata(response);
        } catch (error) {
            console.error('Wikidata search failed:', error);
            throw new Error(`Wikidata search failed: ${error.message}`);
        }
    }

    /**
     * Get detailed metadata for a specific Wikidata game entity
     * @param {string} wikidataId - Wikidata Q-number (e.g., "Q123456")
     * @returns {Promise<Object>} Game metadata object
     */
    async getGameMetadata(wikidataId) {
        try {
            const query = this.buildDetailedSPARQLQuery(wikidataId);
            const response = await this.executeSPARQLQuery(query);
            const results = this.extractEnhancedMetadata(response);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Wikidata metadata fetch failed:', error);
            throw new Error(`Wikidata metadata fetch failed: ${error.message}`);
        }
    }

    /**
     * Build SPARQL query for video game search
     * @param {string} gameTitle - Title to search for
     * @returns {string} SPARQL query string
     */
    buildSPARQLQuery(gameTitle) {
        // Escape quotes in the title for SPARQL
        const escapedTitle = gameTitle.replace(/"/g, '\\"');
        
        return `
SELECT DISTINCT ?game ?gameLabel ?releaseDate ?platformLabel ?developerLabel ?publisherLabel ?genreLabel ?image ?officialWebsite ?wikidataId WHERE {
    ?game wdt:P31 wd:Q7889 .  # Instance of video game
    
    # Search by label (case-insensitive)
    ?game rdfs:label ?label .
    FILTER(CONTAINS(LCASE(?label), LCASE("${escapedTitle}")))
    
    # Optional properties
    OPTIONAL { ?game wdt:P577 ?releaseDate . }
    OPTIONAL { ?game wdt:P400 ?platform . }
    OPTIONAL { ?game wdt:P178 ?developer . }
    OPTIONAL { ?game wdt:P123 ?publisher . }
    OPTIONAL { ?game wdt:P136 ?genre . }
    OPTIONAL { ?game wdt:P18 ?image . }
    OPTIONAL { ?game wdt:P856 ?officialWebsite . }
    
    # Extract Wikidata ID
    BIND(STRAFTER(STR(?game), "http://www.wikidata.org/entity/") AS ?wikidataId)
    
    SERVICE wikibase:label { 
        bd:serviceParam wikibase:language "en,ja" . 
    }
}
ORDER BY ?gameLabel
LIMIT 20
        `.trim();
    }

    /**
     * Build detailed SPARQL query for specific Wikidata entity
     * @param {string} wikidataId - Wikidata Q-number
     * @returns {string} SPARQL query string
     */
    buildDetailedSPARQLQuery(wikidataId) {
        return `
SELECT ?game ?gameLabel ?releaseDate ?platformLabel ?developerLabel ?publisherLabel ?genreLabel ?image ?officialWebsite ?description ?wikidataId WHERE {
    BIND(wd:${wikidataId} AS ?game)
    ?game wdt:P31 wd:Q7889 .  # Verify it's a video game
    
    # Optional properties
    OPTIONAL { ?game wdt:P577 ?releaseDate . }
    OPTIONAL { ?game wdt:P400 ?platform . }
    OPTIONAL { ?game wdt:P178 ?developer . }
    OPTIONAL { ?game wdt:P123 ?publisher . }
    OPTIONAL { ?game wdt:P136 ?genre . }
    OPTIONAL { ?game wdt:P18 ?image . }
    OPTIONAL { ?game wdt:P856 ?officialWebsite . }
    OPTIONAL { ?game schema:description ?description . FILTER(LANG(?description) = "en") }
    
    # Extract Wikidata ID
    BIND("${wikidataId}" AS ?wikidataId)
    
    SERVICE wikibase:label { 
        bd:serviceParam wikibase:language "en,ja" . 
    }
}
        `.trim();
    }

    /**
     * Execute SPARQL query against Wikidata endpoint
     * @param {string} query - SPARQL query string
     * @returns {Promise<Object>} Raw SPARQL response
     */
    async executeSPARQLQuery(query) {
        const url = new URL(this.endpoint);
        url.searchParams.set('query', query);
        url.searchParams.set('format', 'json');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/sparql-results+json',
                'User-Agent': this.userAgent
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }    /**
  
   * Parse Wikidata SPARQL response into game objects
     * @param {Object} response - Raw SPARQL JSON response
     * @returns {Array} Array of parsed game objects
     */
    parseWikidataResponse(response) {
        if (!response.results || !response.results.bindings) {
            return [];
        }

        const bindings = response.results.bindings;
        const gameMap = new Map();

        // Group results by game entity (multiple rows per game due to multiple platforms/genres)
        bindings.forEach(binding => {
            const wikidataId = this.extractValue(binding.wikidataId);
            const gameUri = this.extractValue(binding.game);
            
            if (!wikidataId || !gameUri) return;

            if (!gameMap.has(wikidataId)) {
                gameMap.set(wikidataId, {
                    id: wikidataId,
                    wikidataId: wikidataId,
                    wikidataUri: gameUri,
                    title: this.extractValue(binding.gameLabel) || 'Unknown Title',
                    releaseDate: this.parseDate(this.extractValue(binding.releaseDate)),
                    platforms: new Set(),
                    developers: new Set(),
                    publishers: new Set(),
                    genres: new Set(),
                    coverImage: this.extractValue(binding.image),
                    officialWebsite: this.extractValue(binding.officialWebsite),
                    description: this.extractValue(binding.description),
                    dataSource: {
                        primary: 'wikidata',
                        wikidataId: wikidataId,
                        lastUpdated: new Date().toISOString()
                    }
                });
            }

            const game = gameMap.get(wikidataId);

            // Add platform if present
            const platform = this.extractValue(binding.platformLabel);
            if (platform) {
                game.platforms.add(platform);
            }

            // Add developer if present
            const developer = this.extractValue(binding.developerLabel);
            if (developer) {
                game.developers.add(developer);
            }

            // Add publisher if present
            const publisher = this.extractValue(binding.publisherLabel);
            if (publisher) {
                game.publishers.add(publisher);
            }

            // Add genre if present
            const genre = this.extractValue(binding.genreLabel);
            if (genre) {
                game.genres.add(genre);
            }
        });

        // Convert Sets to Arrays and clean up data
        return Array.from(gameMap.values()).map(game => ({
            ...game,
            platforms: Array.from(game.platforms),
            developers: Array.from(game.developers),
            publishers: Array.from(game.publishers),
            genres: Array.from(game.genres),
            // Take first developer/publisher as primary
            developer: Array.from(game.developers)[0] || null,
            publisher: Array.from(game.publishers)[0] || null
        }));
    }

    /**
     * Extract value from SPARQL binding
     * @param {Object} binding - SPARQL binding object
     * @returns {string|null} Extracted value or null
     */
    extractValue(binding) {
        return binding && binding.value ? binding.value : null;
    }

    /**
     * Parse date string into ISO format
     * @param {string} dateString - Date string from Wikidata
     * @returns {string|null} ISO date string or null
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            // Wikidata dates are typically in format: +1985-01-01T00:00:00Z
            const cleanDate = dateString.replace(/^\+/, '');
            const date = new Date(cleanDate);
            
            if (isNaN(date.getTime())) {
                return null;
            }
            
            return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        } catch (error) {
            console.warn('Failed to parse date:', dateString, error);
            return null;
        }
    }

    /**
     * Validate if response contains video game data
     * @param {Object} gameData - Parsed game data
     * @returns {boolean} True if valid game data
     */
    isValidGameData(gameData) {
        return gameData && 
               gameData.title && 
               gameData.title !== 'Unknown Title' &&
               gameData.wikidataId;
    }

    /**
     * Extract enhanced metadata using the metadata extractor
     * @param {Object} response - SPARQL response
     * @returns {Array} Enhanced game objects
     */
    extractEnhancedMetadata(response) {
        const extractor = new WikidataMetadataExtractor(this);
        const basicResults = this.parseWikidataResponse(response);
        
        return basicResults.map(game => {
            const bindings = response.results.bindings.filter(binding => 
                this.extractValue(binding.wikidataId) === game.wikidataId
            );

            // Extract enhanced metadata
            const releaseInfo = extractor.extractReleaseDate(bindings[0] || {});
            const platformInfo = extractor.extractPlatforms(bindings);
            const developerInfo = extractor.extractDevelopers(bindings);
            const publisherInfo = extractor.extractPublishers(bindings);
            const imageInfo = extractor.extractCoverImage(bindings[0] || {});
            const websiteInfo = extractor.extractOfficialWebsites(bindings);

            // Merge enhanced data
            const enhancedGame = {
                ...game,
                releaseDate: releaseInfo.date,
                releaseYear: releaseInfo.year,
                platforms: platformInfo.platforms,
                developers: developerInfo.developers,
                publishers: publisherInfo.publishers,
                developer: developerInfo.primary,
                publisher: publisherInfo.primary,
                coverImage: imageInfo.url,
                coverImageThumbnail: imageInfo.thumbnailUrl,
                officialStoreLinks: websiteInfo.storeLinks,
                officialWebsites: websiteInfo.websites
            };

            // Add fallback indicators
            return extractor.addFallbackIndicators(enhancedGame);
        });
    }
}/*
*
 * Enhanced metadata extraction methods for specific Wikidata properties
 */
class WikidataMetadataExtractor {
    constructor(wikidataService) {
        this.wikidataService = wikidataService;
    }

    /**
     * Extract and parse release dates (P577) with fallback handling
     * @param {Object} binding - SPARQL binding containing release date
     * @returns {Object} Parsed release date information
     */
    extractReleaseDate(binding) {
        const rawDate = this.wikidataService.extractValue(binding.releaseDate);
        
        if (!rawDate) {
            return {
                date: null,
                year: null,
                precision: 'unknown',
                hasData: false
            };
        }

        try {
            const parsedDate = this.wikidataService.parseDate(rawDate);
            const year = parsedDate ? new Date(parsedDate).getFullYear() : null;
            
            return {
                date: parsedDate,
                year: year,
                precision: parsedDate ? 'day' : 'unknown',
                hasData: true,
                raw: rawDate
            };
        } catch (error) {
            console.warn('Release date parsing failed:', rawDate, error);
            return {
                date: null,
                year: null,
                precision: 'error',
                hasData: false,
                raw: rawDate
            };
        }
    }

    /**
     * Extract and normalize platform information (P400)
     * @param {Array} bindings - Array of SPARQL bindings
     * @returns {Object} Normalized platform data
     */
    extractPlatforms(bindings) {
        const platforms = new Set();
        const platformMappings = {
            // Common platform name normalizations
            'Microsoft Windows': 'PC',
            'Windows': 'PC',
            'PlayStation 4': 'PlayStation 4',
            'PlayStation 5': 'PlayStation 5',
            'Nintendo Switch': 'Nintendo Switch',
            'Xbox One': 'Xbox One',
            'Xbox Series X and Series S': 'Xbox Series X/S',
            'Steam': 'PC',
            'Epic Games Store': 'PC'
        };

        bindings.forEach(binding => {
            const platform = this.wikidataService.extractValue(binding.platformLabel);
            if (platform) {
                const normalized = platformMappings[platform] || platform;
                platforms.add(normalized);
            }
        });

        return {
            platforms: Array.from(platforms),
            hasData: platforms.size > 0,
            count: platforms.size
        };
    }

    /**
     * Extract developer information (P178) with company validation
     * @param {Array} bindings - Array of SPARQL bindings
     * @returns {Object} Developer information
     */
    extractDevelopers(bindings) {
        const developers = new Set();
        
        bindings.forEach(binding => {
            const developer = this.wikidataService.extractValue(binding.developerLabel);
            if (developer && developer.trim()) {
                developers.add(developer.trim());
            }
        });

        const developerArray = Array.from(developers);
        
        return {
            developers: developerArray,
            primary: developerArray[0] || null,
            hasData: developerArray.length > 0,
            count: developerArray.length
        };
    }

    /**
     * Extract publisher information (P123) with company validation
     * @param {Array} bindings - Array of SPARQL bindings
     * @returns {Object} Publisher information
     */
    extractPublishers(bindings) {
        const publishers = new Set();
        
        bindings.forEach(binding => {
            const publisher = this.wikidataService.extractValue(binding.publisherLabel);
            if (publisher && publisher.trim()) {
                publishers.add(publisher.trim());
            }
        });

        const publisherArray = Array.from(publishers);
        
        return {
            publishers: publisherArray,
            primary: publisherArray[0] || null,
            hasData: publisherArray.length > 0,
            count: publisherArray.length
        };
    }

    /**
     * Extract and validate cover images (P18)
     * @param {Object} binding - SPARQL binding containing image URL
     * @returns {Object} Image information with validation
     */
    extractCoverImage(binding) {
        const imageUrl = this.wikidataService.extractValue(binding.image);
        
        if (!imageUrl) {
            return {
                url: null,
                hasData: false,
                isValid: false
            };
        }

        // Basic URL validation
        const isValidUrl = this.isValidImageUrl(imageUrl);
        
        return {
            url: imageUrl,
            hasData: true,
            isValid: isValidUrl,
            thumbnailUrl: this.generateThumbnailUrl(imageUrl)
        };
    }

    /**
     * Extract official website links (P856) for store deep-linking
     * @param {Array} bindings - Array of SPARQL bindings
     * @returns {Object} Official website and store link information
     */
    extractOfficialWebsites(bindings) {
        const websites = new Set();
        const storeLinks = {
            steam: null,
            playstation: null,
            nintendo: null,
            xbox: null,
            epic: null,
            gog: null
        };

        bindings.forEach(binding => {
            const website = this.wikidataService.extractValue(binding.officialWebsite);
            if (website) {
                websites.add(website);
                
                // Detect store links for deep-linking
                const storeType = this.detectStoreType(website);
                if (storeType && !storeLinks[storeType]) {
                    storeLinks[storeType] = website;
                }
            }
        });

        return {
            websites: Array.from(websites),
            storeLinks: storeLinks,
            hasStoreLinks: Object.values(storeLinks).some(link => link !== null),
            hasData: websites.size > 0
        };
    }   
 /**
     * Handle missing data gracefully with appropriate fallback indicators
     * @param {Object} gameData - Parsed game data
     * @returns {Object} Game data with fallback indicators
     */
    addFallbackIndicators(gameData) {
        return {
            ...gameData,
            dataCompleteness: {
                hasTitle: !!gameData.title,
                hasReleaseDate: !!gameData.releaseDate,
                hasPlatforms: gameData.platforms && gameData.platforms.length > 0,
                hasDeveloper: !!gameData.developer,
                hasPublisher: !!gameData.publisher,
                hasCoverImage: !!gameData.coverImage,
                hasStoreLinks: gameData.officialStoreLinks && 
                              Object.values(gameData.officialStoreLinks).some(link => link),
                completenessScore: this.calculateCompletenessScore(gameData)
            },
            fallbackNeeded: {
                releaseDate: !gameData.releaseDate,
                platforms: !gameData.platforms || gameData.platforms.length === 0,
                developer: !gameData.developer,
                publisher: !gameData.publisher,
                coverImage: !gameData.coverImage,
                description: !gameData.description
            }
        };
    }

    /**
     * Validate image URL format
     * @param {string} url - Image URL to validate
     * @returns {boolean} True if valid image URL
     */
    isValidImageUrl(url) {
        try {
            const urlObj = new URL(url);
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
            const hasValidExtension = validExtensions.some(ext => 
                urlObj.pathname.toLowerCase().includes(ext)
            );
            
            return urlObj.protocol === 'https:' && hasValidExtension;
        } catch {
            return false;
        }
    }

    /**
     * Generate thumbnail URL for Wikimedia Commons images
     * @param {string} imageUrl - Original image URL
     * @returns {string} Thumbnail URL
     */
    generateThumbnailUrl(imageUrl) {
        if (imageUrl && imageUrl.includes('commons.wikimedia.org')) {
            // Convert to thumbnail URL (300px width)
            return imageUrl.replace('/commons/', '/commons/thumb/') + '/300px-' + 
                   imageUrl.split('/').pop();
        }
        return imageUrl;
    }

    /**
     * Detect store type from website URL for deep-linking
     * @param {string} url - Website URL
     * @returns {string|null} Store type identifier
     */
    detectStoreType(url) {
        const storePatterns = {
            steam: /store\.steampowered\.com/i,
            playstation: /store\.playstation\.com/i,
            nintendo: /(nintendo\.com|nintendo\.co\.jp)/i,
            xbox: /microsoft\.com.*xbox/i,
            epic: /store\.epicgames\.com/i,
            gog: /gog\.com/i
        };

        for (const [store, pattern] of Object.entries(storePatterns)) {
            if (pattern.test(url)) {
                return store;
            }
        }
        
        return null;
    }

    /**
     * Calculate data completeness score (0-100)
     * @param {Object} gameData - Game data object
     * @returns {number} Completeness score
     */
    calculateCompletenessScore(gameData) {
        const fields = [
            gameData.title,
            gameData.releaseDate,
            gameData.platforms && gameData.platforms.length > 0,
            gameData.developer,
            gameData.publisher,
            gameData.coverImage,
            gameData.description,
            gameData.genres && gameData.genres.length > 0
        ];

        const filledFields = fields.filter(field => !!field).length;
        return Math.round((filledFields / fields.length) * 100);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WikidataService;
}