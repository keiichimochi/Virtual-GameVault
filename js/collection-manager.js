/**
 * CollectionManager - Game collection management class
 * Handles collection CRUD operations, game assignment, and organization
 */
class CollectionManager {
    constructor() {
        this.collections = [];
        this.defaultCollections = [
            {
                id: 'all',
                name: '全てのゲーム',
                emoji: '🎮',
                description: '全てのゲームを表示',
                isDefault: true,
                games: [],
                gameOrder: [],
                createdDate: Date.now(),
                modifiedDate: Date.now(),
                settings: {
                    sortBy: 'dateAdded',
                    sortDirection: 'desc',
                    viewMode: 'grid'
                }
            },
            {
                id: 'favorites',
                name: 'お気に入り',
                emoji: '⭐',
                description: 'お気に入りのゲーム',
                isDefault: true,
                games: [],
                gameOrder: [],
                createdDate: Date.now(),
                modifiedDate: Date.now(),
                settings: {
                    sortBy: 'dateAdded',
                    sortDirection: 'desc',
                    viewMode: 'grid'
                }
            },
            {
                id: 'playing',
                name: 'プレイ中',
                emoji: '🟡',
                description: '現在プレイ中のゲーム',
                isDefault: true,
                games: [],
                gameOrder: [],
                createdDate: Date.now(),
                modifiedDate: Date.now(),
                settings: {
                    sortBy: 'dateAdded',
                    sortDirection: 'desc',
                    viewMode: 'grid'
                }
            },
            {
                id: 'completed',
                name: 'クリア済み',
                emoji: '✅',
                description: 'クリアしたゲーム',
                isDefault: true,
                games: [],
                gameOrder: [],
                createdDate: Date.now(),
                modifiedDate: Date.now(),
                settings: {
                    sortBy: 'dateAdded',
                    sortDirection: 'desc',
                    viewMode: 'grid'
                }
            }
        ];
    }

    /**
     * Initialize and load collection data
     */
    async initialize() {
        try {
            const savedCollections = localStorage.getItem('gameCollections');
            if (savedCollections) {
                this.collections = JSON.parse(savedCollections);
                this.validateAndMigrateCollections();
            } else {
                // Initialize with default collections
                this.collections = [...this.defaultCollections];
                await this.saveCollections();
            }
        } catch (error) {
            console.error('Failed to load collections, using defaults:', error);
            this.collections = [...this.defaultCollections];
            await this.saveCollections();
        }
    }

    /**
     * Validate and migrate collection data structure
     */
    validateAndMigrateCollections() {
        // Ensure all collections have required properties
        this.collections = this.collections.map(collection => ({
            id: collection.id || this.generateCollectionId(),
            name: collection.name || 'Untitled Collection',
            emoji: collection.emoji || '📁',
            description: collection.description || '',
            isDefault: collection.isDefault || false,
            games: Array.isArray(collection.games) ? collection.games : [],
            gameOrder: Array.isArray(collection.gameOrder) ? collection.gameOrder : [],
            createdDate: collection.createdDate || Date.now(),
            modifiedDate: collection.modifiedDate || Date.now(),
            settings: {
                sortBy: collection.settings?.sortBy || 'dateAdded',
                sortDirection: collection.settings?.sortDirection || 'desc',
                viewMode: collection.settings?.viewMode || 'grid'
            }
        }));

        // Ensure default collections exist
        this.ensureDefaultCollections();
    }

    /**
     * Ensure default collections exist
     */
    ensureDefaultCollections() {
        this.defaultCollections.forEach(defaultCollection => {
            const exists = this.collections.find(c => c.id === defaultCollection.id);
            if (!exists) {
                this.collections.unshift(defaultCollection);
            }
        });
    }

    /**
     * Generate unique collection ID
     */
    generateCollectionId() {
        return 'collection_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Create a new collection
     */
    async createCollection(name, emoji = '📁', description = '') {
        if (!name || name.trim() === '') {
            throw new Error('Collection name is required');
        }

        // Check for duplicate names
        const existingCollection = this.collections.find(c => 
            c.name.toLowerCase() === name.toLowerCase()
        );

        if (existingCollection) {
            throw new Error('A collection with this name already exists');
        }

        const newCollection = {
            id: this.generateCollectionId(),
            name: name.trim(),
            emoji: emoji || '📁',
            description: description.trim(),
            isDefault: false,
            games: [],
            gameOrder: [],
            createdDate: Date.now(),
            modifiedDate: Date.now(),
            settings: {
                sortBy: 'dateAdded',
                sortDirection: 'desc',
                viewMode: 'grid'
            }
        };

        this.collections.push(newCollection);
        await this.saveCollections();
        
        return newCollection;
    }

    /**
     * Update an existing collection
     */
    async updateCollection(collectionId, updates) {
        const collectionIndex = this.collections.findIndex(c => c.id === collectionId);
        
        if (collectionIndex === -1) {
            throw new Error('Collection not found');
        }

        const collection = this.collections[collectionIndex];

        // Prevent updating default collections' core properties
        if (collection.isDefault && (updates.name || updates.emoji)) {
            throw new Error('Cannot modify name or emoji of default collections');
        }

        // Check for duplicate names if name is being updated
        if (updates.name && updates.name !== collection.name) {
            const existingCollection = this.collections.find(c => 
                c.id !== collectionId && c.name.toLowerCase() === updates.name.toLowerCase()
            );

            if (existingCollection) {
                throw new Error('A collection with this name already exists');
            }
        }

        // Merge updates
        Object.keys(updates).forEach(key => {
            if (key === 'settings') {
                collection.settings = { ...collection.settings, ...updates.settings };
            } else if (key !== 'id' && key !== 'isDefault' && key !== 'createdDate') {
                collection[key] = updates[key];
            }
        });

        collection.modifiedDate = Date.now();
        await this.saveCollections();
        
        return collection;
    }

    /**
     * Delete a collection
     */
    async deleteCollection(collectionId) {
        const collectionIndex = this.collections.findIndex(c => c.id === collectionId);
        
        if (collectionIndex === -1) {
            throw new Error('Collection not found');
        }

        const collection = this.collections[collectionIndex];

        // Prevent deleting default collections
        if (collection.isDefault) {
            throw new Error('Cannot delete default collections');
        }

        this.collections.splice(collectionIndex, 1);
        await this.saveCollections();
        
        return true;
    }

    /**
     * Get all collections
     */
    getAllCollections() {
        return this.collections;
    }

    /**
     * Get a collection by ID
     */
    getCollectionById(collectionId) {
        return this.collections.find(c => c.id === collectionId);
    }

    /**
     * Add a game to a collection
     */
    async addGameToCollection(gameId, collectionId) {
        const collection = this.getCollectionById(collectionId);
        
        if (!collection) {
            throw new Error('Collection not found');
        }

        // Check if game is already in collection
        if (collection.games.includes(gameId)) {
            return collection; // Already exists, no error
        }

        collection.games.push(gameId);
        collection.gameOrder.push(gameId);
        collection.modifiedDate = Date.now();
        
        await this.saveCollections();
        return collection;
    }

    /**
     * Remove a game from a collection
     */
    async removeGameFromCollection(gameId, collectionId) {
        const collection = this.getCollectionById(collectionId);
        
        if (!collection) {
            throw new Error('Collection not found');
        }

        // Remove from games array
        const gameIndex = collection.games.indexOf(gameId);
        if (gameIndex > -1) {
            collection.games.splice(gameIndex, 1);
        }

        // Remove from game order
        const orderIndex = collection.gameOrder.indexOf(gameId);
        if (orderIndex > -1) {
            collection.gameOrder.splice(orderIndex, 1);
        }

        collection.modifiedDate = Date.now();
        
        await this.saveCollections();
        return collection;
    }

    /**
     * Get games in a collection
     */
    getCollectionGames(collectionId, gameManager) {
        const collection = this.getCollectionById(collectionId);
        
        if (!collection) {
            throw new Error('Collection not found');
        }

        // Handle special collections
        if (collectionId === 'all') {
            return gameManager.getAllGames();
        }

        if (collectionId === 'favorites') {
            return gameManager.getAllGames().filter(game => game.userMetadata.favorite);
        }

        if (collectionId === 'playing') {
            return gameManager.getAllGames().filter(game => 
                game.userMetadata.completionStatus === 'in_progress'
            );
        }

        if (collectionId === 'completed') {
            return gameManager.getAllGames().filter(game => 
                game.userMetadata.completionStatus === 'completed'
            );
        }

        // Regular collections
        const allGames = gameManager.getAllGames();
        return collection.games
            .map(gameId => allGames.find(game => game.id === gameId))
            .filter(game => game !== undefined);
    }

    /**
     * Update collection game order
     */
    async updateCollectionOrder(collectionId, gameOrder) {
        const collection = this.getCollectionById(collectionId);
        
        if (!collection) {
            throw new Error('Collection not found');
        }

        // Validate that all games in order exist in collection
        const validGameOrder = gameOrder.filter(gameId => collection.games.includes(gameId));
        
        collection.gameOrder = validGameOrder;
        collection.modifiedDate = Date.now();
        
        await this.saveCollections();
        return collection;
    }

    /**
     * Get collection statistics
     */
    getCollectionStatistics(collectionId, gameManager) {
        const games = this.getCollectionGames(collectionId, gameManager);
        
        if (!games) {
            return null;
        }

        const platforms = [...new Set(games.flatMap(game => game.platforms))];
        const genres = [...new Set(games.flatMap(game => game.genre))];
        
        return {
            totalGames: games.length,
            platforms: platforms.length,
            genres: genres.length,
            completed: games.filter(game => game.userMetadata.completionStatus === 'completed').length,
            inProgress: games.filter(game => game.userMetadata.completionStatus === 'in_progress').length,
            notStarted: games.filter(game => game.userMetadata.completionStatus === 'not_started').length,
            favorites: games.filter(game => game.userMetadata.favorite).length,
            averageRating: games.length > 0 ? 
                games.reduce((sum, game) => sum + game.userMetadata.rating, 0) / games.length : 0,
            totalPlayTime: games.reduce((sum, game) => sum + game.userMetadata.playTime, 0)
        };
    }

    /**
     * Auto-update special collections based on game metadata
     */
    async updateSpecialCollections(gameManager) {
        // This method ensures special collections stay in sync with game metadata
        // It's called whenever games are updated
        
        const allGames = gameManager.getAllGames();
        
        // Update favorites collection
        const favoritesCollection = this.getCollectionById('favorites');
        if (favoritesCollection) {
            const favoriteGameIds = allGames
                .filter(game => game.userMetadata.favorite)
                .map(game => game.id);
            
            favoritesCollection.games = favoriteGameIds;
            favoritesCollection.gameOrder = favoriteGameIds;
            favoritesCollection.modifiedDate = Date.now();
        }

        // Update playing collection
        const playingCollection = this.getCollectionById('playing');
        if (playingCollection) {
            const playingGameIds = allGames
                .filter(game => game.userMetadata.completionStatus === 'in_progress')
                .map(game => game.id);
            
            playingCollection.games = playingGameIds;
            playingCollection.gameOrder = playingGameIds;
            playingCollection.modifiedDate = Date.now();
        }

        // Update completed collection
        const completedCollection = this.getCollectionById('completed');
        if (completedCollection) {
            const completedGameIds = allGames
                .filter(game => game.userMetadata.completionStatus === 'completed')
                .map(game => game.id);
            
            completedCollection.games = completedGameIds;
            completedCollection.gameOrder = completedGameIds;
            completedCollection.modifiedDate = Date.now();
        }

        await this.saveCollections();
    }

    /**
     * Search collections by name
     */
    searchCollections(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.collections.filter(collection => 
            collection.name.toLowerCase().includes(lowercaseQuery) ||
            collection.description.toLowerCase().includes(lowercaseQuery)
        );
    }

    /**
     * Export collections data
     */
    async exportCollections() {
        const exportData = {
            collections: this.collections,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        return exportData;
    }

    /**
     * Import collections data
     */
    async importCollections(collectionsData, mergeMode = 'replace') {
        if (!collectionsData || !Array.isArray(collectionsData.collections)) {
            throw new Error('Invalid collections data format');
        }

        if (mergeMode === 'replace') {
            // Keep default collections, replace others
            const defaultCollections = this.collections.filter(c => c.isDefault);
            const importedCollections = collectionsData.collections.filter(c => !c.isDefault);
            
            this.collections = [...defaultCollections, ...importedCollections];
        } else if (mergeMode === 'merge') {
            // Merge collections, avoiding duplicates
            collectionsData.collections.forEach(importedCollection => {
                if (!importedCollection.isDefault) {
                    const existingIndex = this.collections.findIndex(c => c.id === importedCollection.id);
                    if (existingIndex > -1) {
                        this.collections[existingIndex] = importedCollection;
                    } else {
                        this.collections.push(importedCollection);
                    }
                }
            });
        }

        this.validateAndMigrateCollections();
        await this.saveCollections();
        
        return {
            imported: collectionsData.collections.length,
            total: this.collections.length
        };
    }

    /**
     * Clear all non-default collections
     */
    async clearAllCollections() {
        this.collections = this.collections.filter(c => c.isDefault);
        await this.saveCollections();
        return true;
    }

    /**
     * Save collections to localStorage
     */
    async saveCollections() {
        try {
            localStorage.setItem('gameCollections', JSON.stringify(this.collections));
            return true;
        } catch (error) {
            console.error('Failed to save collections to localStorage:', error);
            throw new Error('Failed to save collections data');
        }
    }

    /**
     * Export collections as JSON file
     */
    exportCollectionsFile() {
        const exportData = {
            collections: this.collections,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `game-collections-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
    }

    /**
     * Validate collection data structure
     */
    validateCollectionData(collectionData) {
        const required = ['name'];
        const missing = required.filter(field => !collectionData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        
        // Validate games array
        if (collectionData.games && !Array.isArray(collectionData.games)) {
            throw new Error('Games must be an array');
        }
        
        // Validate gameOrder array
        if (collectionData.gameOrder && !Array.isArray(collectionData.gameOrder)) {
            throw new Error('Game order must be an array');
        }
        
        return true;
    }
}

// Auto-save manager for CollectionManager
class CollectionAutoSaveManager {
    constructor(collectionManager) {
        this.collectionManager = collectionManager;
        this.setupAutoSave();
    }

    setupAutoSave() {
        // Auto-save every 5 minutes
        setInterval(() => {
            this.collectionManager.saveCollections();
        }, 5 * 60 * 1000);

        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.collectionManager.saveCollections();
        });

        // Save on visibility change (when tab becomes hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.collectionManager.saveCollections();
            }
        });
    }
}