/**
 * GameManager - Game collection CRUD management class
 * Handles game data operations, LocalStorage persistence, and collection management
 */
class GameManager {
    constructor() {
        this.collection = {
            games: [],
            metadata: {
                lastUpdated: null,
                totalGames: 0,
                manuallyAdded: 0,
                importedFromWikidata: 0,
                importedFromWikipedia: 0
            }
        };
    }

    /**
     * Initialize and load collection data
     */
    async initialize() {
        // First check LocalStorage
        const savedCollection = localStorage.getItem('gameCollection_data');
        if (savedCollection) {
            try {
                this.collection = JSON.parse(savedCollection);
                // Validate and migrate data if needed
                this.validateAndMigrateData();
                return;
            } catch (error) {
                console.error('LocalStorage loading error (fallback to empty collection):', error);
            }
        }
        
        // Initialize empty collection if no saved data
        this.collection = {
            games: [],
            metadata: {
                lastUpdated: null,
                totalGames: 0,
                manuallyAdded: 0,
                importedFromWikidata: 0,
                importedFromWikipedia: 0
            }
        };
    }

    /**
     * Validate and migrate data structure for compatibility
     */
    validateAndMigrateData() {
        // Ensure all games have required properties
        this.collection.games = this.collection.games.map(game => ({
            // Core identifiers
            id: game.id || this.generateGameId(),
            wikidataId: game.wikidataId || null,
            
            // Basic information
            title: game.title || 'Unknown Title',
            alternativeTitles: game.alternativeTitles || [],
            platforms: Array.isArray(game.platforms) ? game.platforms : [],
            releaseDate: game.releaseDate || null,
            
            // Development information
            developer: game.developer || null,
            publisher: game.publisher || null,
            genre: Array.isArray(game.genre) ? game.genre : [],
            
            // Media
            coverImage: game.coverImage || null,
            screenshots: Array.isArray(game.screenshots) ? game.screenshots : [],
            
            // Content
            description: game.description || null,
            esrbRating: game.esrbRating || null,
            
            // Store links
            officialStoreLinks: game.officialStoreLinks || {},
            
            // User-specific data
            userMetadata: {
                rating: game.userMetadata?.rating || 0,
                notes: game.userMetadata?.notes || '',
                completionStatus: game.userMetadata?.completionStatus || 'not_started',
                dateAdded: game.userMetadata?.dateAdded || Date.now(),
                playTime: game.userMetadata?.playTime || 0,
                tags: Array.isArray(game.userMetadata?.tags) ? game.userMetadata.tags : [],
                favorite: game.userMetadata?.favorite || false
            },
            
            // Data provenance
            dataSource: {
                primary: game.dataSource?.primary || 'manual',
                fallback: game.dataSource?.fallback || null,
                attribution: game.dataSource?.attribution || null,
                lastUpdated: game.dataSource?.lastUpdated || Date.now()
            }
        }));

        // Update metadata
        this.updateMetadata();
    }

    /**
     * Generate unique game ID
     */
    generateGameId() {
        return 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Add a new game to the collection
     */
    async addGame(gameData) {
        // Validate required fields
        if (!gameData.title) {
            throw new Error('Game title is required');
        }

        // Check for duplicates (by title and platform combination)
        const existingGame = this.collection.games.find(game => 
            game.title.toLowerCase() === gameData.title.toLowerCase() &&
            JSON.stringify(game.platforms.sort()) === JSON.stringify((gameData.platforms || []).sort())
        );

        if (existingGame) {
            throw new Error('This game already exists in your collection');
        }

        const newGame = {
            // Core identifiers
            id: this.generateGameId(),
            wikidataId: gameData.wikidataId || null,
            
            // Basic information
            title: gameData.title,
            alternativeTitles: gameData.alternativeTitles || [],
            platforms: gameData.platforms || [],
            releaseDate: gameData.releaseDate || null,
            
            // Development information
            developer: gameData.developer || null,
            publisher: gameData.publisher || null,
            genre: gameData.genre || [],
            
            // Media
            coverImage: gameData.coverImage || null,
            screenshots: gameData.screenshots || [],
            
            // Content
            description: gameData.description || null,
            esrbRating: gameData.esrbRating || null,
            
            // Store links
            officialStoreLinks: gameData.officialStoreLinks || {},
            
            // User-specific data
            userMetadata: {
                rating: gameData.userMetadata?.rating || 0,
                notes: gameData.userMetadata?.notes || '',
                completionStatus: gameData.userMetadata?.completionStatus || 'not_started',
                dateAdded: Date.now(),
                playTime: gameData.userMetadata?.playTime || 0,
                tags: gameData.userMetadata?.tags || [],
                favorite: gameData.userMetadata?.favorite || false
            },
            
            // Data provenance
            dataSource: {
                primary: gameData.dataSource?.primary || 'manual',
                fallback: gameData.dataSource?.fallback || null,
                attribution: gameData.dataSource?.attribution || null,
                lastUpdated: Date.now()
            }
        };

        this.collection.games.push(newGame);
        this.updateMetadata();
        await this.saveCollection();
        
        return newGame;
    }

    /**
     * Update an existing game
     */
    async updateGame(gameId, updates) {
        const gameIndex = this.collection.games.findIndex(game => game.id === gameId);
        
        if (gameIndex === -1) {
            throw new Error('Game not found');
        }
        
        const game = this.collection.games[gameIndex];
        
        // Merge updates with existing data
        Object.keys(updates).forEach(key => {
            if (key === 'userMetadata') {
                // Merge user metadata
                game.userMetadata = { ...game.userMetadata, ...updates.userMetadata };
            } else if (key === 'dataSource') {
                // Merge data source info
                game.dataSource = { ...game.dataSource, ...updates.dataSource };
                game.dataSource.lastUpdated = Date.now();
            } else {
                // Direct property update
                game[key] = updates[key];
            }
        });
        
        this.updateMetadata();
        await this.saveCollection();
        
        return game;
    }

    /**
     * Delete a game from the collection
     */
    async deleteGame(gameId) {
        const gameIndex = this.collection.games.findIndex(game => game.id === gameId);
        
        if (gameIndex === -1) {
            throw new Error('Game not found');
        }
        
        this.collection.games.splice(gameIndex, 1);
        this.updateMetadata();
        await this.saveCollection();
        
        return true;
    }

    /**
     * Get all games in the collection
     */
    getAllGames() {
        return this.collection.games;
    }

    /**
     * Find a game by ID
     */
    findGameById(gameId) {
        return this.collection.games.find(game => game.id === gameId);
    }

    /**
     * Search games by title, developer, or genre
     */
    searchGames(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.collection.games.filter(game => 
            game.title.toLowerCase().includes(lowercaseQuery) ||
            (game.developer && game.developer.toLowerCase().includes(lowercaseQuery)) ||
            (game.publisher && game.publisher.toLowerCase().includes(lowercaseQuery)) ||
            game.genre.some(g => g.toLowerCase().includes(lowercaseQuery)) ||
            game.platforms.some(p => p.toLowerCase().includes(lowercaseQuery))
        );
    }

    /**
     * Get games by platform
     */
    getGamesByPlatform(platform) {
        return this.collection.games.filter(game => 
            game.platforms.includes(platform)
        );
    }

    /**
     * Get games by completion status
     */
    getGamesByCompletionStatus(status) {
        return this.collection.games.filter(game => 
            game.userMetadata.completionStatus === status
        );
    }

    /**
     * Get games by rating
     */
    getGamesByRating(rating) {
        return this.collection.games.filter(game => 
            game.userMetadata.rating === rating
        );
    }

    /**
     * Get favorite games
     */
    getFavoriteGames() {
        return this.collection.games.filter(game => 
            game.userMetadata.favorite === true
        );
    }

    /**
     * Import multiple games
     */
    async importGames(gameList) {
        const importResults = {
            total: gameList.length,
            added: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        for (const gameData of gameList) {
            try {
                // Check for existing game
                const existingGame = this.collection.games.find(game => 
                    game.title.toLowerCase() === gameData.title.toLowerCase() &&
                    JSON.stringify(game.platforms.sort()) === JSON.stringify((gameData.platforms || []).sort())
                );

                if (existingGame) {
                    // Update existing game if new data is more complete
                    if (this.shouldUpdateGame(existingGame, gameData)) {
                        await this.updateGame(existingGame.id, gameData);
                        importResults.updated++;
                    } else {
                        importResults.skipped++;
                    }
                } else {
                    // Add new game
                    await this.addGame(gameData);
                    importResults.added++;
                }
            } catch (error) {
                console.error(`Error importing game: ${gameData.title}`, error);
                importResults.errors.push({
                    title: gameData.title,
                    error: error.message
                });
            }
        }

        return importResults;
    }

    /**
     * Check if game should be updated with new data
     */
    shouldUpdateGame(existingGame, newGameData) {
        // Update if new data has more complete information
        return (
            (!existingGame.developer && newGameData.developer) ||
            (!existingGame.publisher && newGameData.publisher) ||
            (!existingGame.releaseDate && newGameData.releaseDate) ||
            (!existingGame.coverImage && newGameData.coverImage) ||
            (!existingGame.description && newGameData.description) ||
            (existingGame.genre.length === 0 && newGameData.genre && newGameData.genre.length > 0)
        );
    }

    /**
     * Export collection data
     */
    async exportCollection() {
        const exportData = {
            ...this.collection,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        return exportData;
    }

    /**
     * Clear all games from collection
     */
    async clearAllGames() {
        this.collection.games = [];
        this.updateMetadata();
        await this.saveCollection();
        return true;
    }

    /**
     * Update collection metadata
     */
    updateMetadata() {
        this.collection.metadata = {
            lastUpdated: Date.now(),
            totalGames: this.collection.games.length,
            manuallyAdded: this.collection.games.filter(game => game.dataSource.primary === 'manual').length,
            importedFromWikidata: this.collection.games.filter(game => game.dataSource.primary === 'wikidata').length,
            importedFromWikipedia: this.collection.games.filter(game => game.dataSource.primary === 'wikipedia').length
        };
    }

    /**
     * Save collection to LocalStorage
     */
    async saveCollection() {
        try {
            localStorage.setItem('gameCollection_data', JSON.stringify(this.collection));
            return true;
        } catch (error) {
            console.error('Failed to save collection to LocalStorage:', error);
            throw new Error('Failed to save collection data');
        }
    }

    /**
     * Export collection as JSON file
     */
    exportCollectionFile() {
        const exportData = {
            ...this.collection,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `game-collection-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
    }

    /**
     * Get collection statistics
     */
    getStatistics() {
        const games = this.collection.games;
        const platforms = [...new Set(games.flatMap(game => game.platforms))];
        const genres = [...new Set(games.flatMap(game => game.genre))];
        
        return {
            total: games.length,
            platforms: platforms.length,
            genres: genres.length,
            completed: games.filter(game => game.userMetadata.completionStatus === 'completed').length,
            inProgress: games.filter(game => game.userMetadata.completionStatus === 'in_progress').length,
            notStarted: games.filter(game => game.userMetadata.completionStatus === 'not_started').length,
            favorites: games.filter(game => game.userMetadata.favorite).length,
            averageRating: games.length > 0 ? 
                games.reduce((sum, game) => sum + game.userMetadata.rating, 0) / games.length : 0,
            totalPlayTime: games.reduce((sum, game) => sum + game.userMetadata.playTime, 0),
            lastUpdated: this.collection.metadata.lastUpdated
        };
    }

    /**
     * Validate game data structure
     */
    validateGameData(gameData) {
        const required = ['title'];
        const missing = required.filter(field => !gameData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        
        // Validate platforms array
        if (gameData.platforms && !Array.isArray(gameData.platforms)) {
            throw new Error('Platforms must be an array');
        }
        
        // Validate genre array
        if (gameData.genre && !Array.isArray(gameData.genre)) {
            throw new Error('Genre must be an array');
        }
        
        return true;
    }
}

// Auto-save manager for GameManager
class GameAutoSaveManager {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.setupAutoSave();
    }

    setupAutoSave() {
        // Auto-save every 5 minutes
        setInterval(() => {
            this.gameManager.saveCollection();
        }, 5 * 60 * 1000);

        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.gameManager.saveCollection();
        });

        // Save on visibility change (when tab becomes hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.gameManager.saveCollection();
            }
        });
    }
}