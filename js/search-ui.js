/**
 * SearchUI - User interface components for game search functionality
 * Provides real-time search suggestions, results display, and "Add to Collection" functionality
 */
class SearchUI {
    constructor(searchManager, gameManager) {
        this.searchManager = searchManager;
        this.gameManager = gameManager;
        this.searchTimeout = null;
        this.currentResults = [];
        this.isSearching = false;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // Create search modal if it doesn't exist
        this.createSearchModal();
        
        // Get existing elements
        this.searchInput = document.getElementById('search-input');
        this.searchModal = document.getElementById('game-search-modal');
        this.searchModalClose = document.getElementById('game-search-modal-close');
        this.gameSearchInput = document.getElementById('game-search-input');
        this.searchResults = document.getElementById('search-results');
        this.searchStatus = document.getElementById('search-status');
        this.addGameButton = document.getElementById('add-game-manually');
    }

    /**
     * Create search modal HTML structure
     */
    createSearchModal() {
        const modalHTML = `
            <div id="game-search-modal" class="modal">
                <div class="modal-content search-modal-content">
                    <button class="modal-close" id="game-search-modal-close">×</button>
                    <div class="modal-header">
                        <h2>🔍 ゲーム検索・追加</h2>
                        <p class="search-subtitle">ゲームタイトルを検索してコレクションに追加</p>
                    </div>
                    <div class="modal-body">
                        <div class="search-input-container">
                            <input type="text" 
                                   id="game-search-input" 
                                   class="search-input-large" 
                                   placeholder="ゲームタイトルを入力してください（例: The Legend of Zelda）"
                                   autocomplete="off">
                            <div class="search-input-icon">🔍</div>
                        </div>
                        
                        <div id="search-status" class="search-status">
                            <p class="search-hint">💡 ゲームタイトルを入力すると、WikidataとWikipediaから自動的に情報を取得します</p>
                        </div>
                        
                        <div id="search-results" class="search-results">
                            <!-- Search results will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert modal into document
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Open search modal when "Add Game Manually" button is clicked
        if (this.addGameButton) {
            this.addGameButton.addEventListener('click', () => {
                this.openSearchModal();
            });
        }

        // Close search modal
        if (this.searchModalClose) {
            this.searchModalClose.addEventListener('click', () => {
                this.closeSearchModal();
            });
        }

        // Close modal when clicking outside
        if (this.searchModal) {
            this.searchModal.addEventListener('click', (e) => {
                if (e.target === this.searchModal) {
                    this.closeSearchModal();
                }
            });
        }

        // Real-time search on input
        if (this.gameSearchInput) {
            this.gameSearchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });

            // Handle Enter key
            this.gameSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performSearch(e.target.value);
                }
            });
        }

        // Existing search input (for filtering current collection)
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.handleCollectionSearch(e.target.value);
            });
        }
    }

    /**
     * Open search modal
     */
    openSearchModal() {
        if (this.searchModal) {
            this.searchModal.style.display = 'block';
            this.gameSearchInput.focus();
            this.clearSearchResults();
        }
    }

    /**
     * Close search modal
     */
    closeSearchModal() {
        if (this.searchModal) {
            this.searchModal.style.display = 'none';
            this.gameSearchInput.value = '';
            this.clearSearchResults();
        }
    }

    /**
     * Handle search input with debouncing
     * @param {string} query - Search query
     */
    handleSearchInput(query) {
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Debounce search to avoid too many API calls
        this.searchTimeout = setTimeout(() => {
            if (query.trim().length >= 2) {
                this.performSearch(query.trim());
            } else if (query.trim().length === 0) {
                this.clearSearchResults();
            }
        }, 500); // 500ms delay
    }

    /**
     * Perform game search
     * @param {string} query - Search query
     */
    async performSearch(query) {
        if (this.isSearching) {
            return; // Prevent multiple simultaneous searches
        }

        this.isSearching = true;
        this.showSearchStatus('🔍 検索中...', 'searching');

        try {
            const results = await this.searchManager.searchGame(query);
            this.currentResults = results;
            this.displaySearchResults(results, query);
        } catch (error) {
            console.error('Search error:', error);
            this.showSearchStatus('❌ 検索中にエラーが発生しました', 'error');
        } finally {
            this.isSearching = false;
        }
    }

    /**
     * Display search results
     * @param {Array} results - Search results
     * @param {string} query - Original search query
     */
    displaySearchResults(results, query) {
        if (results.length === 0) {
            this.showSearchStatus('😔 該当するゲームが見つかりませんでした', 'no-results');
            this.searchResults.innerHTML = `
                <div class="no-results">
                    <p>「${query}」に該当するゲームが見つかりませんでした</p>
                    <p class="no-results-hint">
                        💡 ヒント: 英語のタイトルで検索してみてください<br>
                        例: "ゼルダ" → "The Legend of Zelda"
                    </p>
                </div>
            `;
            return;
        }

        this.showSearchStatus(`✅ ${results.length}件のゲームが見つかりました`, 'success');
        
        const resultsHTML = results.map(game => this.createGameResultCard(game)).join('');
        this.searchResults.innerHTML = `
            <div class="search-results-grid">
                ${resultsHTML}
            </div>
        `;

        // Setup add to collection buttons
        this.setupAddToCollectionButtons();
    }

    /**
     * Create game result card HTML
     * @param {Object} game - Game data
     * @returns {string} HTML string
     */
    createGameResultCard(game) {
        const platforms = Array.isArray(game.platforms) ? game.platforms.slice(0, 3) : [];
        const genres = Array.isArray(game.genre) ? game.genre.slice(0, 2) : [];
        const releaseYear = game.releaseDate ? new Date(game.releaseDate).getFullYear() : null;
        
        // Check if game already exists in collection
        const existsInCollection = this.gameManager.getAllGames().some(existingGame => 
            existingGame.title.toLowerCase() === game.title.toLowerCase()
        );

        return `
            <div class="game-result-card" data-game-id="${game.id}">
                <div class="game-result-image">
                    ${game.coverImage ? 
                        `<img src="${game.coverImage}" alt="${game.title}" loading="lazy" onerror="this.style.display='none'">` :
                        `<div class="game-placeholder">🎮</div>`
                    }
                </div>
                
                <div class="game-result-info">
                    <h3 class="game-result-title">${game.title}</h3>
                    
                    <div class="game-result-metadata">
                        ${game.developer ? `<div class="metadata-item">👨‍💻 ${game.developer}</div>` : ''}
                        ${releaseYear ? `<div class="metadata-item">📅 ${releaseYear}</div>` : ''}
                        ${platforms.length > 0 ? `<div class="metadata-item">🎮 ${platforms.join(', ')}</div>` : ''}
                        ${genres.length > 0 ? `<div class="metadata-item">🏷️ ${genres.join(', ')}</div>` : ''}
                    </div>
                    
                    ${game.description ? 
                        `<p class="game-result-description">${game.description.substring(0, 150)}${game.description.length > 150 ? '...' : ''}</p>` :
                        ''
                    }
                    
                    <div class="game-result-source">
                        ${this.createDataSourceBadge(game)}
                    </div>
                </div>
                
                <div class="game-result-actions">
                    ${existsInCollection ? 
                        `<button class="btn btn-disabled" disabled>✅ 追加済み</button>` :
                        `<button class="btn btn-primary add-to-collection-btn" data-game-id="${game.id}">
                            ➕ コレクションに追加
                        </button>`
                    }
                </div>
            </div>
        `;
    }

    /**
     * Create data source attribution badge
     * @param {Object} game - Game data
     * @returns {string} HTML string for source badge
     */
    createDataSourceBadge(game) {
        const source = game.searchMetadata?.source || game.dataSource?.primary || 'unknown';
        const confidence = game.searchMetadata?.confidence || 0;
        
        let sourceIcon, sourceText, sourceClass;
        
        switch (source) {
            case 'wikidata':
                sourceIcon = '🌐';
                sourceText = 'Wikidata';
                sourceClass = 'source-wikidata';
                break;
            case 'wikipedia':
                sourceIcon = '📖';
                sourceText = 'Wikipedia';
                sourceClass = 'source-wikipedia';
                break;
            default:
                sourceIcon = '❓';
                sourceText = 'Unknown';
                sourceClass = 'source-unknown';
        }

        const confidenceText = confidence > 0.8 ? '高精度' : confidence > 0.5 ? '中精度' : '低精度';
        
        return `
            <div class="data-source-badge ${sourceClass}">
                <span class="source-icon">${sourceIcon}</span>
                <span class="source-text">${sourceText}</span>
                <span class="confidence-text">${confidenceText}</span>
            </div>
        `;
    }

    /**
     * Setup add to collection button event listeners
     */
    setupAddToCollectionButtons() {
        const addButtons = this.searchResults.querySelectorAll('.add-to-collection-btn');
        
        addButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const gameId = e.target.dataset.gameId;
                await this.addGameToCollection(gameId, e.target);
            });
        });
    }

    /**
     * Add game to collection
     * @param {string} gameId - Game ID from search results
     * @param {HTMLElement} button - Button element that was clicked
     */
    async addGameToCollection(gameId, button) {
        const game = this.currentResults.find(g => g.id === gameId);
        
        if (!game) {
            alert('ゲームデータが見つかりません');
            return;
        }

        // Disable button and show loading state
        button.disabled = true;
        button.innerHTML = '⏳ 追加中...';

        try {
            await this.gameManager.addGame(game);
            
            // Update button to show success
            button.innerHTML = '✅ 追加済み';
            button.classList.remove('btn-primary');
            button.classList.add('btn-disabled');
            
            // Show success message
            this.showTemporaryMessage('✅ ゲームをコレクションに追加しました！', 'success');
            
            // Refresh the main game display if it exists
            if (window.gameShelf && typeof window.gameShelf.loadGames === 'function') {
                window.gameShelf.loadGames();
            }
            
        } catch (error) {
            console.error('Error adding game to collection:', error);
            
            // Reset button and show error
            button.disabled = false;
            button.innerHTML = '➕ コレクションに追加';
            
            if (error.message.includes('already exists')) {
                this.showTemporaryMessage('⚠️ このゲームは既にコレクションに存在します', 'warning');
            } else {
                this.showTemporaryMessage('❌ ゲームの追加に失敗しました', 'error');
            }
        }
    }

    /**
     * Show search status message
     * @param {string} message - Status message
     * @param {string} type - Status type (searching, success, error, no-results)
     */
    showSearchStatus(message, type) {
        if (this.searchStatus) {
            this.searchStatus.innerHTML = `<p class="search-status-${type}">${message}</p>`;
        }
    }

    /**
     * Show temporary message
     * @param {string} message - Message to show
     * @param {string} type - Message type (success, error, warning)
     */
    showTemporaryMessage(message, type) {
        // Create temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `temporary-message message-${type}`;
        messageEl.innerHTML = message;
        
        // Insert at top of modal body
        const modalBody = this.searchModal.querySelector('.modal-body');
        modalBody.insertBefore(messageEl, modalBody.firstChild);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }

    /**
     * Clear search results
     */
    clearSearchResults() {
        if (this.searchResults) {
            this.searchResults.innerHTML = '';
        }
        
        if (this.searchStatus) {
            this.searchStatus.innerHTML = `
                <p class="search-hint">💡 ゲームタイトルを入力すると、WikidataとWikipediaから自動的に情報を取得します</p>
            `;
        }
        
        this.currentResults = [];
    }

    /**
     * Handle collection search (existing functionality)
     * @param {string} query - Search query for filtering existing collection
     */
    handleCollectionSearch(query) {
        // This would integrate with existing collection filtering
        if (window.gameShelf && typeof window.gameShelf.filterGames === 'function') {
            window.gameShelf.filterGames(query);
        }
    }

    /**
     * Get search statistics
     * @returns {Object} Search statistics
     */
    getSearchStatistics() {
        return {
            currentResultsCount: this.currentResults.length,
            isSearching: this.isSearching,
            cacheStats: this.searchManager.getSearchStatistics()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchUI;
}