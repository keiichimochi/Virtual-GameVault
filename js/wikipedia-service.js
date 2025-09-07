/**
 * WikipediaService - Fallback service for game metadata using MediaWiki API
 * Provides game information extraction from Wikipedia when Wikidata is incomplete
 */
class WikipediaService {
    constructor() {
        this.baseUrl = 'https://en.wikipedia.org/w/api.php';
        this.userAgent = 'GameCollectionApp/1.0';
    }

    /**
     * Search for game-related Wikipedia articles
     * @param {string} gameTitle - The game title to search for
     * @returns {Promise<Array>} Array of search results
     */
    async searchGamePages(gameTitle) {
        try {
            const searchParams = new URLSearchParams({
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: `${gameTitle} video game`,
                srlimit: 10,
                srnamespace: 0, // Main namespace only
                origin: '*'
            });

            const response = await fetch(`${this.baseUrl}?${searchParams}`);
            
            if (!response.ok) {
                throw new Error(`Wikipedia search failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Wikipedia API error: ${data.error.info}`);
            }

            return data.query?.search || [];
        } catch (error) {
            console.error('Wikipedia search error:', error);
            throw new Error(`Failed to search Wikipedia: ${error.message}`);
        }
    }

    /**
     * Get Wikipedia page content by title
     * @param {string} pageTitle - Wikipedia page title
     * @returns {Promise<Object>} Page content and metadata
     */
    async getPageContent(pageTitle) {
        try {
            const contentParams = new URLSearchParams({
                action: 'query',
                format: 'json',
                titles: pageTitle,
                prop: 'extracts|pageimages|info',
                exintro: true,
                explaintext: false,
                exsectionformat: 'wiki',
                piprop: 'original',
                inprop: 'url',
                origin: '*'
            });

            const response = await fetch(`${this.baseUrl}?${contentParams}`);
            
            if (!response.ok) {
                throw new Error(`Wikipedia content fetch failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Wikipedia API error: ${data.error.info}`);
            }

            const pages = data.query?.pages;
            if (!pages) {
                throw new Error('No page data returned');
            }

            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page.missing) {
                throw new Error(`Page "${pageTitle}" not found`);
            }

            return {
                title: page.title,
                extract: page.extract,
                image: page.original?.source,
                url: page.fullurl,
                pageId: page.pageid
            };
        } catch (error) {
            console.error('Wikipedia content fetch error:', error);
            throw new Error(`Failed to fetch Wikipedia content: ${error.message}`);
        }
    }

    /**
     * Get raw wikitext for InfoBox parsing
     * @param {string} pageTitle - Wikipedia page title
     * @returns {Promise<string>} Raw wikitext content
     */
    async getPageWikitext(pageTitle) {
        try {
            const wikitextParams = new URLSearchParams({
                action: 'query',
                format: 'json',
                titles: pageTitle,
                prop: 'revisions',
                rvprop: 'content',
                rvslots: 'main',
                origin: '*'
            });

            const response = await fetch(`${this.baseUrl}?${wikitextParams}`);
            
            if (!response.ok) {
                throw new Error(`Wikipedia wikitext fetch failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Wikipedia API error: ${data.error.info}`);
            }

            const pages = data.query?.pages;
            if (!pages) {
                throw new Error('No page data returned');
            }

            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page.missing) {
                throw new Error(`Page "${pageTitle}" not found`);
            }

            const revision = page.revisions?.[0];
            const content = revision?.slots?.main?.['*'];

            if (!content) {
                throw new Error('No wikitext content found');
            }

            return content;
        } catch (error) {
            console.error('Wikipedia wikitext fetch error:', error);
            throw new Error(`Failed to fetch Wikipedia wikitext: ${error.message}`);
        }
    }

    /**
     * Find the best matching Wikipedia page for a game
     * @param {string} gameTitle - The game title to search for
     * @returns {Promise<Object|null>} Best matching page or null if not found
     */
    async findGamePage(gameTitle) {
        try {
            const searchResults = await this.searchGamePages(gameTitle);
            
            if (searchResults.length === 0) {
                return null;
            }

            // Score search results based on title similarity and content relevance
            const scoredResults = searchResults.map(result => {
                let score = 0;
                
                // Exact title match gets highest score
                if (result.title.toLowerCase() === gameTitle.toLowerCase()) {
                    score += 100;
                }
                
                // Partial title match
                if (result.title.toLowerCase().includes(gameTitle.toLowerCase())) {
                    score += 50;
                }
                
                // Game-related keywords in snippet
                const gameKeywords = ['video game', 'game', 'developed', 'published', 'platform', 'console'];
                const snippet = result.snippet.toLowerCase();
                gameKeywords.forEach(keyword => {
                    if (snippet.includes(keyword)) {
                        score += 10;
                    }
                });
                
                return { ...result, score };
            });

            // Sort by score and return the best match
            scoredResults.sort((a, b) => b.score - a.score);
            
            return scoredResults[0].score > 0 ? scoredResults[0] : null;
        } catch (error) {
            console.error('Error finding game page:', error);
            return null;
        }
    }

    /**
     * Extract game metadata from Wikipedia page
     * @param {string} gameTitle - The game title to search for
     * @returns {Promise<Object|null>} Extracted game metadata or null if not found
     */
    async extractGameMetadata(gameTitle) {
        try {
            const gamePage = await this.findGamePage(gameTitle);
            
            if (!gamePage) {
                console.log(`No Wikipedia page found for: ${gameTitle}`);
                return null;
            }

            // Get both content and wikitext for comprehensive extraction
            const [pageContent, wikitext] = await Promise.all([
                this.getPageContent(gamePage.title),
                this.getPageWikitext(gamePage.title)
            ]);

            // Parse InfoBox data
            const infoboxData = await this.parseInfoBox(wikitext);

            // Map to our game data model
            const gameData = this.mapToGameDataModel(infoboxData, {
                title: pageContent.title,
                description: pageContent.extract,
                image: pageContent.image,
                wikipediaUrl: pageContent.url
            });

            return gameData;
        } catch (error) {
            console.error('Error extracting game metadata:', error);
            return null;
        }
    }

    /**
     * Parse InfoBox from Wikipedia wikitext to extract game metadata
     * @param {string} wikitext - Raw wikitext content
     * @returns {Promise<Object>} Parsed InfoBox data
     */
    async parseInfoBox(wikitext) {
        try {
            // Find InfoBox in wikitext (common patterns for video games)
            const infoboxPatterns = [
                /\{\{Infobox video game(.*?)\}\}/gis,
                /\{\{Infobox VG(.*?)\}\}/gis,
                /\{\{Video game infobox(.*?)\}\}/gis,
                /\{\{Infobox game(.*?)\}\}/gis
            ];

            let infoboxContent = null;
            
            for (const pattern of infoboxPatterns) {
                const match = wikitext.match(pattern);
                if (match) {
                    infoboxContent = match[1];
                    break;
                }
            }

            if (!infoboxContent) {
                console.log('No InfoBox found in wikitext');
                return {};
            }

            return this.parseInfoBoxFields(infoboxContent);
        } catch (error) {
            console.error('InfoBox parsing error:', error);
            return {};
        }
    }

    /**
     * Parse individual fields from InfoBox content
     * @param {string} infoboxContent - InfoBox wikitext content
     * @returns {Object} Parsed field data
     */
    parseInfoBoxFields(infoboxContent) {
        const fields = {};
        
        // Field mapping from Wikipedia InfoBox to our game data model
        const fieldMappings = {
            // Basic information
            'title': ['title', 'name'],
            'developer': ['developer', 'developers'],
            'publisher': ['publisher', 'publishers'],
            'releaseDate': ['released', 'release', 'release date'],
            'platforms': ['platforms', 'platform'],
            'genre': ['genre', 'genres'],
            'modes': ['modes', 'mode'],
            
            // Additional metadata
            'series': ['series'],
            'engine': ['engine'],
            'director': ['director', 'directors'],
            'producer': ['producer', 'producers'],
            'designer': ['designer', 'designers'],
            'programmer': ['programmer', 'programmers'],
            'artist': ['artist', 'artists'],
            'writer': ['writer', 'writers'],
            'composer': ['composer', 'composers'],
            
            // Media and links
            'image': ['image', 'cover'],
            'website': ['website', 'official website']
        };

        // Split content into lines and parse each field
        const lines = infoboxContent.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('<!--')) continue;

            // Parse field pattern: | field = value
            const fieldMatch = trimmedLine.match(/^\|\s*([^=]+?)\s*=\s*(.*?)$/);
            if (!fieldMatch) continue;

            const fieldName = fieldMatch[1].toLowerCase().trim();
            let fieldValue = fieldMatch[2].trim();

            // Clean up the field value
            fieldValue = this.cleanFieldValue(fieldValue);
            
            if (!fieldValue) continue;

            // Map Wikipedia field names to our data model
            for (const [ourField, wikipediaFields] of Object.entries(fieldMappings)) {
                if (wikipediaFields.some(wf => fieldName.includes(wf))) {
                    fields[ourField] = this.processFieldValue(ourField, fieldValue);
                    break;
                }
            }
        }

        return fields;
    }

    /**
     * Clean and normalize field values from wikitext
     * @param {string} value - Raw field value from wikitext
     * @returns {string} Cleaned field value
     */
    cleanFieldValue(value) {
        if (!value) return '';

        // Remove wikitext markup
        value = value
            // Remove references like {{cite web|...}}
            .replace(/\{\{cite[^}]*\}\}/gi, '')
            // Remove simple templates like {{nowrap|...}}
            .replace(/\{\{[^|}]*\|([^}]*)\}\}/g, '$1')
            // Remove simple templates like {{flag|Country}}
            .replace(/\{\{[^}]*\}\}/g, '')
            // Remove wikilinks [[Link|Display]] -> Display
            .replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2')
            // Remove external links [http://... Display] -> Display
            .replace(/\[https?:\/\/[^\s\]]*\s+([^\]]*)\]/g, '$1')
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Remove references like <ref>...</ref>
            .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
            // Remove reference markers like [1], [2]
            .replace(/\[[0-9]+\]/g, '')
            // Clean up whitespace
            .replace(/\s+/g, ' ')
            .trim();

        return value;
    }

    /**
     * Process and format field values based on field type
     * @param {string} fieldType - The type of field being processed
     * @param {string} value - The cleaned field value
     * @returns {string|Array} Processed field value
     */
    processFieldValue(fieldType, value) {
        switch (fieldType) {
            case 'platforms':
            case 'genre':
            case 'modes':
                // Split comma-separated values and clean each item
                return value.split(/[,;]/)
                    .map(item => item.trim())
                    .filter(item => item.length > 0);

            case 'releaseDate':
                // Try to parse and normalize date formats
                return this.normalizeDate(value);

            case 'developer':
            case 'publisher':
                // Handle multiple developers/publishers
                if (value.includes(',') || value.includes(';')) {
                    return value.split(/[,;]/)
                        .map(item => item.trim())
                        .filter(item => item.length > 0)
                        .join(', ');
                }
                return value;

            default:
                return value;
        }
    }

    /**
     * Normalize date formats from Wikipedia
     * @param {string} dateString - Raw date string from Wikipedia
     * @returns {string} Normalized date in ISO format or original if parsing fails
     */
    normalizeDate(dateString) {
        if (!dateString) return '';

        // Common Wikipedia date patterns
        const datePatterns = [
            // Full dates: "March 15, 2023", "15 March 2023"
            /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
            // Month year: "March 2023"
            /(\w+)\s+(\d{4})/,
            // Year only: "2023"
            /^(\d{4})$/
        ];

        const monthNames = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
        };

        for (const pattern of datePatterns) {
            const match = dateString.toLowerCase().match(pattern);
            if (match) {
                if (match.length === 2) {
                    // Year only
                    return `${match[1]}-01-01`;
                } else if (match.length === 3) {
                    // Month and year
                    const month = monthNames[match[1]] || '01';
                    return `${match[2]}-${month}-01`;
                } else if (match.length === 4) {
                    // Full date
                    const month = monthNames[match[1]] || '01';
                    const day = match[2].padStart(2, '0');
                    return `${match[3]}-${month}-${day}`;
                }
            }
        }

        // If no pattern matches, try JavaScript Date parsing
        try {
            const parsed = new Date(dateString);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        } catch (error) {
            // Ignore parsing errors
        }

        // Return original string if parsing fails
        return dateString;
    }

    /**
     * Map InfoBox data to our game data model
     * @param {Object} infoboxData - Parsed InfoBox fields
     * @param {Object} pageData - Additional page data (title, description, etc.)
     * @returns {Object} Game data in our standard format
     */
    mapToGameDataModel(infoboxData, pageData) {
        return {
            title: infoboxData.title || pageData.title,
            platforms: Array.isArray(infoboxData.platforms) ? infoboxData.platforms : 
                      infoboxData.platforms ? [infoboxData.platforms] : [],
            releaseDate: infoboxData.releaseDate || '',
            developer: infoboxData.developer || '',
            publisher: infoboxData.publisher || '',
            genre: Array.isArray(infoboxData.genre) ? infoboxData.genre :
                   infoboxData.genre ? [infoboxData.genre] : [],
            description: pageData.description || '',
            coverImage: pageData.image || '',
            
            // Additional metadata from InfoBox
            series: infoboxData.series || '',
            engine: infoboxData.engine || '',
            modes: Array.isArray(infoboxData.modes) ? infoboxData.modes :
                   infoboxData.modes ? [infoboxData.modes] : [],
            
            // Development team information
            director: infoboxData.director || '',
            producer: infoboxData.producer || '',
            designer: infoboxData.designer || '',
            programmer: infoboxData.programmer || '',
            artist: infoboxData.artist || '',
            writer: infoboxData.writer || '',
            composer: infoboxData.composer || '',
            
            // Data source and attribution
            dataSource: {
                primary: 'wikipedia',
                attribution: pageData.wikipediaUrl,
                lastUpdated: new Date().toISOString()
            },
            
            // Attribution information for CC BY-SA compliance
            attribution: this.generateAttribution(pageData.wikipediaUrl, pageData.title)
        };
    }

    /**
     * Generate attribution link for CC BY-SA compliance
     * @param {string} wikipediaUrl - URL to the Wikipedia page
     * @param {string} gameTitle - Game title for display
     * @returns {Object} Attribution information
     */
    generateAttribution(wikipediaUrl, gameTitle) {
        return {
            text: `Information about "${gameTitle}" from Wikipedia`,
            url: wikipediaUrl,
            license: 'CC BY-SA 3.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/'
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WikipediaService;
}