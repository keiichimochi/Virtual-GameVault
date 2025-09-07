/**
 * Game Shelf - ゲームライブラリ管理システム
 * Virtual Bookshelfをゲーム用に改造
 */

class GameShelf {
    constructor() {
        this.games = [];
        this.shelves = [];
        this.currentShelf = 'all';
        this.currentView = 'covers';
        this.currentSort = 'custom';
        this.sortDirection = 'desc';
        this.gamesPerPage = 50;
        this.currentPage = 1;
        this.searchQuery = '';
        this.starFilters = [0, 1, 2, 3, 4, 5];
        this.platformFilters = [];
        this.completionFilters = [];
        this.genreFilters = [];
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.initializeSearchSystem();
        this.initializeCollectionSystem();
        this.renderGames();
        this.updateStats();
        this.updateGenreFilters();
    }

    initializeSearchSystem() {
        // Initialize GameManager for search integration
        this.gameManager = new GameManager();
        this.gameManager.initialize();
        
        // Sync existing games with GameManager
        this.syncGamesWithManager();
        
        // Initialize SearchManager
        this.searchManager = new SearchManager();
        
        // Initialize SearchUI
        this.searchUI = new SearchUI(this.searchManager, this.gameManager);
        
        console.log('Search system initialized');
    }

    initializeCollectionSystem() {
        // Initialize CollectionManager
        this.collectionManager = new CollectionManager();
        this.collectionManager.initialize();
        
        // Initialize CollectionUI
        this.collectionUI = new CollectionUI(this.collectionManager, this.gameManager);
        
        // Set up global reference for collection UI
        window.gameShelf = this;
        
        console.log('Collection system initialized');
    }

    syncGamesWithManager() {
        // Convert existing GameShelf games to GameManager format
        const existingGames = this.gameManager.getAllGames();
        
        // If GameManager is empty but GameShelf has games, migrate them
        if (existingGames.length === 0 && this.games.length > 0) {
            console.log('Migrating existing games to GameManager...');
            
            this.games.forEach(async (game) => {
                try {
                    const gameData = {
                        title: game.title || game.name,
                        platforms: game.platforms || [game.platform].filter(Boolean),
                        releaseDate: game.releaseDate,
                        developer: game.developer,
                        publisher: game.publisher,
                        genre: game.genre || [],
                        coverImage: game.coverImage || game.image,
                        description: game.description,
                        userMetadata: {
                            rating: game.rating || 0,
                            notes: game.notes || '',
                            completionStatus: game.completionStatus || 'not_started',
                            dateAdded: game.acquiredTime || Date.now(),
                            playTime: game.playTime || 0,
                            tags: game.tags || [],
                            favorite: game.favorite || false
                        },
                        dataSource: {
                            primary: 'manual',
                            lastUpdated: Date.now()
                        }
                    };
                    
                    await this.gameManager.addGame(gameData);
                } catch (error) {
                    console.warn('Failed to migrate game:', game.title, error);
                }
            });
        }
    }

    // Method to reload games from GameManager
    loadGames() {
        const managerGames = this.gameManager.getAllGames();
        
        // Convert GameManager format back to GameShelf format for compatibility
        this.games = managerGames.map(game => ({
            id: game.id,
            title: game.title,
            name: game.title, // Compatibility
            platforms: game.platforms,
            platform: game.platforms[0] || '', // Compatibility
            releaseDate: game.releaseDate,
            developer: game.developer,
            publisher: game.publisher,
            genre: game.genre,
            coverImage: game.coverImage,
            image: game.coverImage, // Compatibility
            description: game.description,
            rating: game.userMetadata.rating,
            notes: game.userMetadata.notes,
            completionStatus: game.userMetadata.completionStatus,
            acquiredTime: game.userMetadata.dateAdded,
            playTime: game.userMetadata.playTime,
            tags: game.userMetadata.tags,
            favorite: game.userMetadata.favorite
        }));
        
        this.renderGames();
        this.updateStats();
        this.updateGenreFilters();
    }

    loadData() {
        // Load games from localStorage
        const savedGames = localStorage.getItem('gameShelfGames');
        if (savedGames) {
            this.games = JSON.parse(savedGames);
        }

        // Load shelves from localStorage
        const savedShelves = localStorage.getItem('gameShelfShelves');
        if (savedShelves) {
            this.shelves = JSON.parse(savedShelves);
        } else {
            // Default shelves
            this.shelves = [
                {
                    id: 'favorites',
                    name: 'お気に入り',
                    emoji: '⭐',
                    description: 'お気に入りのゲーム'
                },
                {
                    id: 'playing',
                    name: 'プレイ中',
                    emoji: '🎮',
                    description: '現在プレイ中のゲーム'
                },
                {
                    id: 'completed',
                    name: 'クリア済み',
                    emoji: '✅',
                    description: 'クリアしたゲーム'
                }
            ];
            this.saveShelves();
        }

        this.updateShelfSelector();
    }

    saveData() {
        localStorage.setItem('gameShelfGames', JSON.stringify(this.games));
    }

    saveShelves() {
        localStorage.setItem('gameShelfShelves', JSON.stringify(this.shelves));
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderGames();
            });
        }

        // View toggle
        const viewCoversBtn = document.getElementById('view-covers');
        const viewListBtn = document.getElementById('view-list');
        
        if (viewCoversBtn) {
            viewCoversBtn.addEventListener('click', () => {
                this.currentView = 'covers';
                viewCoversBtn.classList.add('active');
                viewListBtn.classList.remove('active');
                this.renderGames();
            });
        }

        if (viewListBtn) {
            viewListBtn.addEventListener('click', () => {
                this.currentView = 'list';
                viewListBtn.classList.add('active');
                viewCoversBtn.classList.remove('active');
                this.renderGames();
            });
        }

        // Sort controls
        const sortOrder = document.getElementById('sort-order');
        const sortDirection = document.getElementById('sort-direction');

        if (sortOrder) {
            sortOrder.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.renderGames();
            });
        }

        if (sortDirection) {
            sortDirection.addEventListener('click', () => {
                this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
                sortDirection.textContent = this.sortDirection === 'desc' ? '↓ 新しい順' : '↑ 古い順';
                this.renderGames();
            });
        }

        // Games per page
        const gamesPerPageSelect = document.getElementById('games-per-page');
        if (gamesPerPageSelect) {
            gamesPerPageSelect.addEventListener('change', (e) => {
                this.gamesPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
                this.currentPage = 1;
                this.renderGames();
            });
        }

        // Star filters
        for (let i = 0; i <= 5; i++) {
            const checkbox = document.getElementById(`star-${i}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        if (!this.starFilters.includes(i)) {
                            this.starFilters.push(i);
                        }
                    } else {
                        this.starFilters = this.starFilters.filter(star => star !== i);
                    }
                    this.renderGames();
                });
            }
        }

        // Platform filters
        const platformCheckboxes = ['pc', 'playstation', 'xbox', 'nintendo', 'steam'];
        platformCheckboxes.forEach(platform => {
            const checkbox = document.getElementById(`platform-${platform}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        if (!this.platformFilters.includes(platform)) {
                            this.platformFilters.push(platform);
                        }
                    } else {
                        this.platformFilters = this.platformFilters.filter(p => p !== platform);
                    }
                    this.renderGames();
                });
                // Initialize as checked
                checkbox.checked = true;
                this.platformFilters.push(platform);
            }
        });

        // Completion status filters
        const completionStatuses = ['not_started', 'in_progress', 'completed', 'abandoned'];
        completionStatuses.forEach(status => {
            const checkbox = document.getElementById(`completion-${status}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        if (!this.completionFilters.includes(status)) {
                            this.completionFilters.push(status);
                        }
                    } else {
                        this.completionFilters = this.completionFilters.filter(s => s !== status);
                    }
                    this.renderGames();
                });
                // Initialize as checked
                checkbox.checked = true;
                this.completionFilters.push(status);
            }
        });

        // Collection selector (updated from shelf selector)
        const collectionSelector = document.getElementById('collection-selector');
        if (collectionSelector) {
            collectionSelector.addEventListener('change', (e) => {
                this.currentShelf = e.target.value;
                this.renderGames();
            });
        }

        // Management buttons
        const addGameBtn = document.getElementById('add-game-manually');
        if (addGameBtn) {
            addGameBtn.addEventListener('click', () => {
                document.getElementById('add-game-modal').style.display = 'block';
            });
        }

        const clearLibraryBtn = document.getElementById('clear-library');
        if (clearLibraryBtn) {
            clearLibraryBtn.addEventListener('click', () => {
                if (confirm('本当にライブラリをクリアしますか？この操作は取り消せません。')) {
                    this.games = [];
                    this.saveData();
                    this.renderGames();
                    this.updateStats();
                }
            });
        }

        // Modal close handlers
        this.setupModalHandlers();
    }

    setupModalHandlers() {
        // Close modals when clicking outside or on close button
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    updateShelfSelector() {
        // This method is now handled by CollectionUI
        if (this.collectionUI) {
            this.collectionUI.updateCollectionSelector();
        }
    }

    filterGames() {
        let filteredGames;

        // Get games from current collection
        if (this.collectionManager && this.currentShelf) {
            try {
                filteredGames = this.collectionManager.getCollectionGames(this.currentShelf, this.gameManager);
                // Convert to GameShelf format for compatibility
                filteredGames = filteredGames.map(game => this.convertGameManagerToShelfFormat(game));
            } catch (error) {
                console.warn('Failed to get collection games, falling back to all games:', error);
                filteredGames = [...this.games];
            }
        } else {
            filteredGames = [...this.games];
        }

        // Apply search filter
        if (this.searchQuery) {
            filteredGames = filteredGames.filter(game => 
                game.title?.toLowerCase().includes(this.searchQuery) ||
                game.developer?.toLowerCase().includes(this.searchQuery) ||
                game.publisher?.toLowerCase().includes(this.searchQuery)
            );
        }

        // Apply star rating filter
        filteredGames = filteredGames.filter(game => 
            this.starFilters.includes(game.rating || 0)
        );

        // Apply platform filter
        if (this.platformFilters.length > 0) {
            filteredGames = filteredGames.filter(game => {
                if (!game.platforms || game.platforms.length === 0) return false;
                
                return game.platforms.some(platform => 
                    this.platformFilters.some(filter => 
                        platform.toLowerCase().includes(filter.toLowerCase()) ||
                        filter.toLowerCase().includes(platform.toLowerCase())
                    )
                );
            });
        }

        // Apply completion status filter
        if (this.completionFilters.length > 0) {
            filteredGames = filteredGames.filter(game => 
                this.completionFilters.includes(game.completionStatus || 'not_started')
            );
        }

        // Apply genre filter
        if (this.genreFilters.length > 0) {
            filteredGames = filteredGames.filter(game => {
                if (!game.genre || game.genre.length === 0) return false;
                
                return game.genre.some(genre => 
                    this.genreFilters.includes(genre)
                );
            });
        }

        return filteredGames;
    }

    convertGameManagerToShelfFormat(game) {
        return {
            id: game.id,
            title: game.title,
            name: game.title, // Compatibility
            platforms: game.platforms,
            platform: game.platforms[0] || '', // Compatibility
            releaseDate: game.releaseDate,
            developer: game.developer,
            publisher: game.publisher,
            genre: game.genre,
            coverImage: game.coverImage,
            image: game.coverImage, // Compatibility
            description: game.description,
            rating: game.userMetadata.rating,
            notes: game.userMetadata.notes,
            completionStatus: game.userMetadata.completionStatus,
            acquiredTime: game.userMetadata.dateAdded,
            playTime: game.userMetadata.playTime,
            tags: game.userMetadata.tags,
            favorite: game.userMetadata.favorite,
            officialStoreLinks: game.officialStoreLinks,
            attribution: game.dataSource.attribution ? {
                url: game.dataSource.attribution,
                text: 'Wikipedia',
                license: 'CC BY-SA',
                licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/'
            } : null
        };
    }

    onCollectionChange(collectionId) {
        this.currentShelf = collectionId;
        this.renderGames();
    }

    sortGames(games) {
        const sortedGames = [...games];

        // For custom collections with custom order, respect the collection order
        if (this.currentSort === 'custom' && this.collectionManager && this.currentShelf !== 'all') {
            const collection = this.collectionManager.getCollectionById(this.currentShelf);
            if (collection && collection.gameOrder.length > 0) {
                // Sort by collection order
                sortedGames.sort((a, b) => {
                    const aIndex = collection.gameOrder.indexOf(a.id || a.title);
                    const bIndex = collection.gameOrder.indexOf(b.id || b.title);
                    
                    // If both games are in the order, sort by their position
                    if (aIndex !== -1 && bIndex !== -1) {
                        return aIndex - bIndex;
                    }
                    // If only one is in the order, prioritize it
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    // If neither is in the order, maintain original order
                    return 0;
                });
                
                return this.sortDirection === 'desc' ? sortedGames.reverse() : sortedGames;
            }
        }

        sortedGames.sort((a, b) => {
            let comparison = 0;

            switch (this.currentSort) {
                case 'title':
                    comparison = (a.title || '').localeCompare(b.title || '');
                    break;
                case 'developer':
                    comparison = (a.developer || '').localeCompare(b.developer || '');
                    break;
                case 'publisher':
                    comparison = (a.publisher || '').localeCompare(b.publisher || '');
                    break;
                case 'releaseDate':
                    comparison = new Date(a.releaseDate || 0) - new Date(b.releaseDate || 0);
                    break;
                case 'acquiredTime':
                    comparison = new Date(a.acquiredTime || 0) - new Date(b.acquiredTime || 0);
                    break;
                case 'rating':
                    comparison = (a.rating || 0) - (b.rating || 0);
                    break;
                case 'completionStatus':
                    const statusOrder = { 'not_started': 0, 'in_progress': 1, 'completed': 2, 'abandoned': 3 };
                    comparison = (statusOrder[a.completionStatus] || 0) - (statusOrder[b.completionStatus] || 0);
                    break;
                case 'platform':
                    const aPlatform = Array.isArray(a.platforms) ? a.platforms[0] || '' : (a.platform || '');
                    const bPlatform = Array.isArray(b.platforms) ? b.platforms[0] || '' : (b.platform || '');
                    comparison = aPlatform.localeCompare(bPlatform);
                    break;
                default: // custom
                    comparison = (a.customOrder || 0) - (b.customOrder || 0);
            }

            return this.sortDirection === 'desc' ? -comparison : comparison;
        });

        return sortedGames;
    }

    renderGames() {
        const container = document.getElementById('bookshelf');
        const loading = document.getElementById('loading');
        
        if (!container) return;

        // Show loading
        if (loading) loading.style.display = 'block';

        // Filter and sort games
        const filteredGames = this.filterGames();
        const sortedGames = this.sortGames(filteredGames);

        // Pagination
        let gamesToShow = sortedGames;
        if (this.gamesPerPage !== 'all') {
            const startIndex = (this.currentPage - 1) * this.gamesPerPage;
            const endIndex = startIndex + this.gamesPerPage;
            gamesToShow = sortedGames.slice(startIndex, endIndex);
        }

        // Render games
        if (this.currentView === 'covers') {
            this.renderCoversView(gamesToShow, container);
        } else {
            this.renderListView(gamesToShow, container);
        }

        // Update pagination
        this.renderPagination(sortedGames.length);

        // Hide loading
        if (loading) loading.style.display = 'none';
    }

    renderCoversView(games, container) {
        container.className = 'bookshelf covers-view';
        
        if (games.length === 0) {
            container.innerHTML = '<div class="no-games">🎮 ゲームが見つかりません</div>';
            return;
        }

        container.innerHTML = games.map(game => `
            <div class="game-item" data-game-id="${game.id || game.title}">
                <div class="game-cover">
                    <img src="${game.coverImage || 'https://via.placeholder.com/160x240?text=No+Cover'}" 
                         alt="${game.title}" 
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/160x240?text=No+Cover'">
                    <div class="game-overlay">
                        <div class="game-rating">
                            ${this.renderStars(game.rating || 0)}
                        </div>
                        <div class="game-platforms">
                            ${Array.isArray(game.platforms) ? game.platforms.slice(0, 2).join(', ') : (game.platforms || '')}
                        </div>
                    </div>
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <p class="game-developer">${game.developer || ''}</p>
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.game-item').forEach(item => {
            item.addEventListener('click', () => {
                const gameId = item.dataset.gameId;
                this.showGameDetails(gameId);
            });
        });

        // Add drag and drop functionality for custom collections
        if (this.currentShelf !== 'all' && this.collectionManager) {
            const collection = this.collectionManager.getCollectionById(this.currentShelf);
            if (collection && !collection.isDefault) {
                this.setupDragAndDrop(container);
            }
        }
    }

    renderListView(games, container) {
        container.className = 'bookshelf list-view';
        
        if (games.length === 0) {
            container.innerHTML = '<div class="no-games">🎮 ゲームが見つかりません</div>';
            return;
        }

        container.innerHTML = `
            <table class="games-table">
                <thead>
                    <tr>
                        <th>カバー</th>
                        <th>タイトル</th>
                        <th>開発者</th>
                        <th>プラットフォーム</th>
                        <th>発売日</th>
                        <th>評価</th>
                    </tr>
                </thead>
                <tbody>
                    ${games.map(game => `
                        <tr class="game-row" data-game-id="${game.id || game.title}">
                            <td class="game-cover-cell">
                                <img src="${game.coverImage || 'https://via.placeholder.com/40x60?text=No+Cover'}" 
                                     alt="${game.title}" 
                                     class="game-cover-small"
                                     onerror="this.src='https://via.placeholder.com/40x60?text=No+Cover'">
                            </td>
                            <td class="game-title-cell">${game.title}</td>
                            <td class="game-developer-cell">${game.developer || ''}</td>
                            <td class="game-platforms-cell">${Array.isArray(game.platforms) ? game.platforms.join(', ') : (game.platforms || '')}</td>
                            <td class="game-release-cell">${game.releaseDate || ''}</td>
                            <td class="game-rating-cell">${this.renderStars(game.rating || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Add click handlers
        container.querySelectorAll('.game-row').forEach(row => {
            row.addEventListener('click', () => {
                const gameId = row.dataset.gameId;
                this.showGameDetails(gameId);
            });
        });
    }

    renderStars(rating) {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars.push('⭐');
            } else {
                stars.push('☆');
            }
        }
        return stars.join('');
    }

    renderPagination(totalGames) {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer || this.gamesPerPage === 'all') {
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalGames / this.gamesPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination-controls">';
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage - 1}">前へ</button>`;
        }

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                paginationHTML += `<button class="pagination-btn active">${i}</button>`;
            } else if (i === 1 || i === totalPages || Math.abs(i - this.currentPage) <= 2) {
                paginationHTML += `<button class="pagination-btn" data-page="${i}">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage + 1}">次へ</button>`;
        }

        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;

        // Add click handlers
        paginationContainer.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderGames();
            });
        });
    }

    showGameDetails(gameId) {
        const game = this.games.find(g => (g.id || g.title) === gameId);
        if (!game) return;

        const modal = document.getElementById('game-modal');
        const modalBody = document.getElementById('modal-body');
        
        if (!modal || !modalBody) return;

        // Ensure user metadata exists
        if (!game.userMetadata) {
            game.userMetadata = {
                rating: game.rating || 0,
                notes: game.notes || '',
                completionStatus: game.completionStatus || 'not_started',
                tags: game.tags || []
            };
        }

        modalBody.innerHTML = `
            <div class="game-details">
                <div class="game-header">
                    <img src="${game.coverImage || 'https://via.placeholder.com/200x300?text=No+Cover'}" 
                         alt="${game.title}" 
                         class="game-cover-large"
                         onerror="this.src='https://via.placeholder.com/200x300?text=No+Cover'">
                    <div class="game-info-detailed">
                        <h2>${game.title}</h2>
                        <div class="game-metadata-grid">
                            <div class="metadata-item">
                                <span class="metadata-label">開発者</span>
                                <span class="metadata-value">${game.developer || '不明'}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">発売元</span>
                                <span class="metadata-value">${game.publisher || '不明'}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">発売日</span>
                                <span class="metadata-value">${game.releaseDate || '不明'}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">ジャンル</span>
                                <span class="metadata-value">${Array.isArray(game.genre) ? game.genre.join(', ') : (game.genre || '不明')}</span>
                            </div>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">プラットフォーム</span>
                            <div class="platform-badges">
                                ${this.renderPlatformBadges(game.platforms)}
                            </div>
                        </div>
                    </div>
                </div>

                ${this.renderStoreLinks(game)}

                ${game.description ? `
                    <div class="game-description">
                        <h3>📖 ゲーム説明</h3>
                        <p>${game.description}</p>
                    </div>
                ` : ''}

                <div class="user-metadata-section">
                    <h3>👤 あなたの記録</h3>
                    <div class="user-metadata-grid">
                        <div class="rating-section">
                            <label class="metadata-label">評価</label>
                            <div class="star-rating" data-game-id="${game.id || game.title}">
                                ${this.renderInteractiveStars(game.userMetadata.rating)}
                            </div>
                        </div>
                        
                        <div class="completion-status-section">
                            <label class="metadata-label">完了状況</label>
                            <select class="completion-select" data-game-id="${game.id || game.title}">
                                <option value="not_started" ${game.userMetadata.completionStatus === 'not_started' ? 'selected' : ''}>⚪ 未プレイ</option>
                                <option value="in_progress" ${game.userMetadata.completionStatus === 'in_progress' ? 'selected' : ''}>🟡 プレイ中</option>
                                <option value="completed" ${game.userMetadata.completionStatus === 'completed' ? 'selected' : ''}>🟢 完了</option>
                                <option value="abandoned" ${game.userMetadata.completionStatus === 'abandoned' ? 'selected' : ''}>🔴 中断</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="notes-section">
                        <label class="metadata-label">メモ・感想</label>
                        <textarea class="notes-textarea" 
                                  data-game-id="${game.id || game.title}"
                                  placeholder="このゲームについてのメモや感想を入力してください...">${game.userMetadata.notes}</textarea>
                    </div>
                    
                    <div class="tags-section">
                        <label class="metadata-label">タグ</label>
                        <input type="text" 
                               class="tags-input" 
                               data-game-id="${game.id || game.title}"
                               placeholder="タグを入力してEnterキーで追加">
                        <div class="tags-display">
                            ${this.renderTags(game.userMetadata.tags, game.id || game.title)}
                        </div>
                    </div>
                    
                    <div class="collections-section">
                        <label class="metadata-label">コレクション</label>
                        <div class="collection-assignment">
                            <select class="collection-select" data-game-id="${game.id || game.title}">
                                <option value="">コレクションを選択...</option>
                                ${this.renderCollectionOptions(game.id || game.title)}
                            </select>
                            <button class="btn btn-small add-to-collection" data-game-id="${game.id || game.title}">
                                追加
                            </button>
                        </div>
                        <div class="current-collections" id="current-collections-${game.id || game.title}">
                            ${this.renderCurrentCollections(game.id || game.title)}
                        </div>
                    </div>
                </div>

                ${game.attribution ? `
                    <div class="game-attribution">
                        <h4>📊 データソース</h4>
                        <p><a href="${game.attribution.url}" target="_blank" rel="noopener">${game.attribution.text}</a></p>
                        <p><small>ライセンス: <a href="${game.attribution.licenseUrl}" target="_blank" rel="noopener">${game.attribution.license}</a></small></p>
                    </div>
                ` : ''}
            </div>
        `;

        // Set up event listeners for interactive elements
        this.setupGameDetailEventListeners(game);

        modal.style.display = 'block';
    }

    renderPlatformBadges(platforms) {
        if (!platforms) return '<span class="metadata-value">不明</span>';
        
        const platformArray = Array.isArray(platforms) ? platforms : [platforms];
        return platformArray.map(platform => 
            `<span class="platform-badge">${platform}</span>`
        ).join('');
    }

    renderStoreLinks(game) {
        if (!game.officialStoreLinks && !game.platforms) return '';
        
        const storeLinks = [];
        const platforms = Array.isArray(game.platforms) ? game.platforms : [game.platforms].filter(Boolean);
        
        // Enhanced platform detection for store links
        const stores = {
            steam: { 
                name: 'Steam', 
                icon: '🚂', 
                condition: this.isPlatformAvailable(platforms, ['pc', 'steam', 'windows', 'mac', 'linux']) 
            },
            playstation: { 
                name: 'PlayStation Store', 
                icon: '🎮', 
                condition: this.isPlatformAvailable(platforms, ['playstation', 'ps4', 'ps5', 'psx', 'ps1', 'ps2', 'ps3']) 
            },
            nintendo: { 
                name: 'Nintendo eShop', 
                icon: '🎮', 
                condition: this.isPlatformAvailable(platforms, ['nintendo', 'switch', 'wii', '3ds', 'ds', 'nes', 'snes', 'n64', 'gamecube']) 
            },
            xbox: { 
                name: 'Xbox Store', 
                icon: '🎮', 
                condition: this.isPlatformAvailable(platforms, ['xbox', 'xbox one', 'xbox 360', 'xbox series']) 
            },
            epic: {
                name: 'Epic Games Store',
                icon: '🎯',
                condition: this.isPlatformAvailable(platforms, ['pc', 'epic', 'windows', 'mac'])
            },
            gog: {
                name: 'GOG',
                icon: '🏛️',
                condition: this.isPlatformAvailable(platforms, ['pc', 'gog', 'windows', 'mac', 'linux'])
            }
        };

        Object.entries(stores).forEach(([key, store]) => {
            if (store.condition) {
                const url = game.officialStoreLinks?.[key] || this.generateStoreSearchUrl(key, game.title);
                storeLinks.push(`
                    <a href="${url}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="store-link ${key}"
                       title="${store.name}で${game.title}を検索">
                        ${store.icon} ${store.name}
                    </a>
                `);
            }
        });

        return storeLinks.length > 0 ? `
            <div class="store-links">
                <h3>🛒 ストアで確認・購入</h3>
                <p class="store-links-description">以下のストアで価格や詳細情報を確認できます：</p>
                ${storeLinks.join('')}
            </div>
        ` : '';
    }

    isPlatformAvailable(gamePlatforms, storePlatforms) {
        if (!gamePlatforms || gamePlatforms.length === 0) return false;
        
        return gamePlatforms.some(platform => 
            storePlatforms.some(storePlatform => 
                platform.toLowerCase().includes(storePlatform.toLowerCase())
            )
        );
    }

    generateStoreSearchUrl(store, gameTitle) {
        const encodedTitle = encodeURIComponent(gameTitle);
        const cleanTitle = gameTitle.replace(/[^\w\s]/g, '').trim();
        const encodedCleanTitle = encodeURIComponent(cleanTitle);
        
        const storeUrls = {
            steam: `https://store.steampowered.com/search/?term=${encodedTitle}`,
            playstation: `https://store.playstation.com/ja-jp/search/${encodedTitle}`,
            nintendo: `https://www.nintendo.co.jp/software/search.html?q=${encodedTitle}`,
            xbox: `https://www.microsoft.com/ja-jp/search/shop/games?q=${encodedTitle}`,
            epic: `https://store.epicgames.com/ja/browse?q=${encodedTitle}&sortBy=relevancy&sortDir=DESC&count=40`,
            gog: `https://www.gog.com/games?search=${encodedCleanTitle}`
        };
        
        return storeUrls[store] || '#';
    }

    renderCollectionOptions(gameId) {
        if (!this.collectionUI) return '';
        
        const collections = this.collectionUI.getCollectionsForGameAssignment();
        return collections.map(collection => 
            `<option value="${collection.id}">${collection.emoji} ${collection.name}</option>`
        ).join('');
    }

    renderCurrentCollections(gameId) {
        if (!this.collectionManager) return '';
        
        const collections = this.collectionManager.getAllCollections();
        const gameCollections = collections.filter(collection => 
            collection.games.includes(gameId)
        );
        
        if (gameCollections.length === 0) {
            return '<p class="no-collections">このゲームはどのコレクションにも追加されていません</p>';
        }
        
        return gameCollections.map(collection => `
            <div class="collection-badge" data-collection-id="${collection.id}">
                <span class="collection-info">${collection.emoji} ${collection.name}</span>
                ${!collection.isDefault ? `
                    <button class="remove-from-collection" 
                            data-game-id="${gameId}" 
                            data-collection-id="${collection.id}"
                            title="コレクションから削除">×</button>
                ` : ''}
            </div>
        `).join('');
    }

    renderInteractiveStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            const filled = i <= rating ? 'filled' : '';
            stars += `<span class="star ${filled}" data-rating="${i}">★</span>`;
        }
        return stars;
    }

    renderTags(tags, gameId) {
        if (!tags || tags.length === 0) return '';
        
        return tags.map(tag => `
            <span class="tag-item">
                ${tag}
                <button class="tag-remove" data-game-id="${gameId}" data-tag="${tag}">×</button>
            </span>
        `).join('');
    }

    setupGameDetailEventListeners(game) {
        const gameId = game.id || game.title;
        
        // Store link click tracking and security
        const storeLinks = document.querySelectorAll('.store-link');
        storeLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Track store link clicks for analytics (optional)
                this.trackStoreLinkClick(link.classList[1], game.title);
                
                // Ensure proper security attributes
                link.setAttribute('rel', 'noopener noreferrer');
                
                // Optional: Show loading indicator or confirmation
                console.log(`Opening ${link.textContent.trim()} for ${game.title}`);
            });
        });
        
        // Enhanced star rating interaction
        const starRating = document.querySelector(`.star-rating[data-game-id="${gameId}"]`);
        if (starRating) {
            const stars = starRating.querySelectorAll('.star');
            let currentRating = game.userMetadata?.rating || 0;
            
            stars.forEach((star, index) => {
                star.addEventListener('mouseenter', () => {
                    stars.forEach((s, i) => {
                        s.classList.toggle('hover', i <= index);
                    });
                });
                
                star.addEventListener('mouseleave', () => {
                    stars.forEach(s => s.classList.remove('hover'));
                });
                
                star.addEventListener('click', () => {
                    const rating = parseInt(star.dataset.rating);
                    
                    // Allow clicking the same star to remove rating
                    const newRating = (rating === currentRating) ? 0 : rating;
                    
                    this.updateGameRating(gameId, newRating);
                    currentRating = newRating;
                    
                    stars.forEach((s, i) => {
                        s.classList.toggle('filled', i < newRating);
                    });
                    
                    // Visual feedback
                    star.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        star.style.transform = '';
                    }, 150);
                });
                
                // Add keyboard support
                star.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        star.click();
                    }
                });
                
                // Make stars focusable for accessibility
                star.setAttribute('tabindex', '0');
                star.setAttribute('role', 'button');
                star.setAttribute('aria-label', `${index + 1}つ星の評価`);
            });
        }
        
        // Completion status change with visual feedback
        const completionSelect = document.querySelector(`.completion-select[data-game-id="${gameId}"]`);
        if (completionSelect) {
            completionSelect.addEventListener('change', (e) => {
                this.updateGameCompletionStatus(gameId, e.target.value);
                
                // Visual feedback
                completionSelect.style.backgroundColor = '#e8f5e8';
                setTimeout(() => {
                    completionSelect.style.backgroundColor = '';
                }, 500);
            });
        }
        
        // Notes auto-save with visual feedback
        const notesTextarea = document.querySelector(`.notes-textarea[data-game-id="${gameId}"]`);
        if (notesTextarea) {
            let saveTimeout;
            let saveIndicatorTimeout;
            
            notesTextarea.addEventListener('input', (e) => {
                clearTimeout(saveTimeout);
                clearTimeout(saveIndicatorTimeout);
                
                // Show typing indicator
                notesTextarea.style.borderColor = '#ffa500';
                
                saveTimeout = setTimeout(() => {
                    this.updateGameNotes(gameId, e.target.value);
                    
                    // Show saved indicator
                    notesTextarea.style.borderColor = '#28a745';
                    
                    saveIndicatorTimeout = setTimeout(() => {
                        notesTextarea.style.borderColor = '';
                    }, 1000);
                }, 1000); // Auto-save after 1 second of inactivity
            });
            
            // Character count for notes
            const charCountDiv = document.createElement('div');
            charCountDiv.className = 'char-count';
            notesTextarea.parentNode.appendChild(charCountDiv);
            
            const updateCharCount = () => {
                const length = notesTextarea.value.length;
                charCountDiv.textContent = `${length}/1000文字`;
                charCountDiv.style.color = length > 1000 ? '#e74c3c' : '#666';
            };
            
            notesTextarea.addEventListener('input', updateCharCount);
            updateCharCount(); // Initial count
            
            // Limit notes length
            notesTextarea.addEventListener('input', (e) => {
                if (e.target.value.length > 1000) {
                    e.target.value = e.target.value.substring(0, 1000);
                    updateCharCount();
                }
            });
        }
        
        // Tags input with enhanced validation
        const tagsInput = document.querySelector(`.tags-input[data-game-id="${gameId}"]`);
        if (tagsInput) {
            tagsInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    const tagValue = e.target.value.trim();
                    
                    // Validate tag
                    if (this.validateTag(tagValue)) {
                        this.addGameTag(gameId, tagValue);
                        e.target.value = '';
                        
                        // Refresh the modal to show new tag
                        setTimeout(() => this.showGameDetails(gameId), 100);
                    } else {
                        this.showTagError('タグは20文字以内で入力してください');
                        e.target.focus();
                    }
                }
            });
            
            // Real-time character count and validation
            tagsInput.addEventListener('input', (e) => {
                const value = e.target.value;
                const isValid = this.validateTag(value);
                
                e.target.style.borderColor = isValid ? '' : '#e74c3c';
                
                // Show character count
                let charCount = tagsInput.parentNode.querySelector('.char-count');
                if (!charCount) {
                    charCount = document.createElement('small');
                    charCount.className = 'char-count';
                    tagsInput.parentNode.appendChild(charCount);
                }
                charCount.textContent = `${value.length}/20文字`;
                charCount.style.color = isValid ? '#666' : '#e74c3c';
            });
        }
        
        // Tag removal
        const tagRemoveButtons = document.querySelectorAll(`.tag-remove[data-game-id="${gameId}"]`);
        tagRemoveButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tag = e.target.dataset.tag;
                this.removeGameTag(gameId, tag);
                
                // Refresh the modal to remove tag
                setTimeout(() => this.showGameDetails(gameId), 100);
            });
        });

        // Collection assignment
        const addToCollectionBtn = document.querySelector(`.add-to-collection[data-game-id="${gameId}"]`);
        const collectionSelect = document.querySelector(`.collection-select[data-game-id="${gameId}"]`);
        
        if (addToCollectionBtn && collectionSelect) {
            addToCollectionBtn.addEventListener('click', async () => {
                const collectionId = collectionSelect.value;
                
                if (!collectionId) {
                    alert('コレクションを選択してください');
                    return;
                }
                
                addToCollectionBtn.disabled = true;
                addToCollectionBtn.textContent = '追加中...';
                
                try {
                    if (this.collectionUI) {
                        await this.collectionUI.addGameToCollection(gameId, collectionId);
                        
                        // Refresh current collections display
                        const currentCollectionsDiv = document.getElementById(`current-collections-${gameId}`);
                        if (currentCollectionsDiv) {
                            currentCollectionsDiv.innerHTML = this.renderCurrentCollections(gameId);
                            this.setupCollectionRemovalHandlers(gameId);
                        }
                        
                        // Reset selection
                        collectionSelect.value = '';
                    }
                } catch (error) {
                    console.error('Failed to add game to collection:', error);
                } finally {
                    addToCollectionBtn.disabled = false;
                    addToCollectionBtn.textContent = '追加';
                }
            });
        }

        // Collection removal handlers
        this.setupCollectionRemovalHandlers(gameId);
    }

    setupCollectionRemovalHandlers(gameId) {
        const removeButtons = document.querySelectorAll(`.remove-from-collection[data-game-id="${gameId}"]`);
        removeButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const collectionId = e.target.dataset.collectionId;
                
                button.disabled = true;
                
                try {
                    if (this.collectionUI) {
                        await this.collectionUI.removeGameFromCollection(gameId, collectionId);
                        
                        // Refresh current collections display
                        const currentCollectionsDiv = document.getElementById(`current-collections-${gameId}`);
                        if (currentCollectionsDiv) {
                            currentCollectionsDiv.innerHTML = this.renderCurrentCollections(gameId);
                            this.setupCollectionRemovalHandlers(gameId);
                        }
                    }
                } catch (error) {
                    console.error('Failed to remove game from collection:', error);
                } finally {
                    button.disabled = false;
                }
            });
        });
    }

    setupDragAndDrop(container) {
        const gameItems = container.querySelectorAll('.game-item');
        
        gameItems.forEach(item => {
            item.draggable = true;
            item.style.cursor = 'move';
            
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.gameId);
                item.classList.add('dragging');
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = container.querySelector('.dragging');
                if (draggingItem && draggingItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;
                    
                    if (e.clientX < midpoint) {
                        item.parentNode.insertBefore(draggingItem, item);
                    } else {
                        item.parentNode.insertBefore(draggingItem, item.nextSibling);
                    }
                }
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                this.updateCollectionOrder();
            });
        });
        
        // Add visual feedback for drag and drop
        const style = document.createElement('style');
        style.textContent = `
            .game-item.dragging {
                opacity: 0.5;
                transform: rotate(5deg);
            }
            .game-item[draggable="true"]:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
        `;
        document.head.appendChild(style);
    }

    async updateCollectionOrder() {
        if (!this.collectionManager || this.currentShelf === 'all') return;
        
        const collection = this.collectionManager.getCollectionById(this.currentShelf);
        if (!collection || collection.isDefault) return;
        
        const container = document.getElementById('bookshelf');
        const gameItems = container.querySelectorAll('.game-item');
        const newOrder = Array.from(gameItems).map(item => item.dataset.gameId);
        
        try {
            await this.collectionManager.updateCollectionOrder(this.currentShelf, newOrder);
            this.showSaveIndicator('ゲームの順序を更新しました');
        } catch (error) {
            console.error('Failed to update collection order:', error);
        }
    }

    updateGenreFilters() {
        const genreContainer = document.getElementById('genre-filter-checkboxes');
        if (!genreContainer) return;

        // Get all unique genres from games
        const allGenres = new Set();
        this.games.forEach(game => {
            if (game.genre && Array.isArray(game.genre)) {
                game.genre.forEach(g => allGenres.add(g));
            }
        });

        // Sort genres alphabetically
        const sortedGenres = Array.from(allGenres).sort();

        // Create checkboxes for each genre
        genreContainer.innerHTML = sortedGenres.map(genre => `
            <label class="checkbox-label">
                <input type="checkbox" id="genre-${genre.replace(/\s+/g, '-').toLowerCase()}" value="${genre}" checked>
                🎯 ${genre}
            </label>
        `).join('');

        // Initialize genre filters array
        this.genreFilters = [...sortedGenres];

        // Add event listeners
        sortedGenres.forEach(genre => {
            const checkbox = document.getElementById(`genre-${genre.replace(/\s+/g, '-').toLowerCase()}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        if (!this.genreFilters.includes(genre)) {
                            this.genreFilters.push(genre);
                        }
                    } else {
                        this.genreFilters = this.genreFilters.filter(g => g !== genre);
                    }
                    this.renderGames();
                });
            }
        });
    }

    updateGameRating(gameId, rating) {
        const game = this.games.find(g => (g.id || g.title) === gameId);
        if (game) {
            if (!game.userMetadata) game.userMetadata = {};
            game.userMetadata.rating = rating;
            game.rating = rating; // Backward compatibility
            this.saveData();
            this.showSaveIndicator();
        }
    }

    updateGameCompletionStatus(gameId, status) {
        const game = this.games.find(g => (g.id || g.title) === gameId);
        if (game) {
            if (!game.userMetadata) game.userMetadata = {};
            game.userMetadata.completionStatus = status;
            game.completionStatus = status; // Backward compatibility
            this.saveData();
            this.showSaveIndicator();
        }
    }

    updateGameNotes(gameId, notes) {
        const game = this.games.find(g => (g.id || g.title) === gameId);
        if (game) {
            if (!game.userMetadata) game.userMetadata = {};
            game.userMetadata.notes = notes;
            game.notes = notes; // Backward compatibility
            this.saveData();
            this.showSaveIndicator();
        }
    }

    addGameTag(gameId, tag) {
        const game = this.games.find(g => (g.id || g.title) === gameId);
        if (game) {
            if (!game.userMetadata) game.userMetadata = {};
            if (!game.userMetadata.tags) game.userMetadata.tags = [];
            
            // Check for duplicates
            if (game.userMetadata.tags.includes(tag)) {
                this.showTagError('このタグは既に追加されています');
                return false;
            }
            
            // Check tag limit
            if (game.userMetadata.tags.length >= 10) {
                this.showTagError('タグは最大10個まで追加できます');
                return false;
            }
            
            game.userMetadata.tags.push(tag);
            if (!game.tags) game.tags = []; // Backward compatibility
            if (!game.tags.includes(tag)) game.tags.push(tag);
            this.saveData();
            this.showSaveIndicator();
            return true;
        }
        return false;
    }

    validateTag(tag) {
        return tag && tag.length > 0 && tag.length <= 20 && !/[<>\"'&]/.test(tag);
    }

    showTagError(message) {
        // Create or update error message
        let errorDiv = document.querySelector('.tag-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'tag-error';
            const tagsSection = document.querySelector('.tags-section');
            if (tagsSection) {
                tagsSection.appendChild(errorDiv);
            }
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide error after 3 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }

    removeGameTag(gameId, tag) {
        const game = this.games.find(g => (g.id || g.title) === gameId);
        if (game) {
            if (game.userMetadata && game.userMetadata.tags) {
                game.userMetadata.tags = game.userMetadata.tags.filter(t => t !== tag);
            }
            if (game.tags) {
                game.tags = game.tags.filter(t => t !== tag); // Backward compatibility
            }
            this.saveData();
            this.showSaveIndicator();
        }
    }

    showSaveIndicator() {
        let indicator = document.querySelector('.save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'save-indicator';
            indicator.textContent = '💾 保存しました';
            document.body.appendChild(indicator);
        }
        
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    trackStoreLinkClick(store, gameTitle) {
        // Optional analytics tracking for store link clicks
        // This can be extended to integrate with analytics services
        console.log(`Store link clicked: ${store} for game: ${gameTitle}`);
        
        // Example: Send to analytics service
        // if (window.gtag) {
        //     gtag('event', 'store_link_click', {
        //         store_name: store,
        //         game_title: gameTitle
        //     });
        // }
    }

    updateStats() {
        const totalGamesElement = document.getElementById('total-games');
        const totalPlatformsElement = document.getElementById('total-platforms');

        if (totalGamesElement) {
            totalGamesElement.textContent = this.games.length;
        }

        if (totalPlatformsElement) {
            const platforms = new Set();
            this.games.forEach(game => {
                if (Array.isArray(game.platforms)) {
                    game.platforms.forEach(platform => platforms.add(platform));
                } else if (game.platforms) {
                    platforms.add(game.platforms);
                }
            });
            totalPlatformsElement.textContent = platforms.size;
        }
    }

    addGame(gameData) {
        const game = {
            id: gameData.id || Date.now().toString(),
            title: gameData.title,
            developer: gameData.developer,
            publisher: gameData.publisher,
            releaseDate: gameData.releaseDate,
            platforms: gameData.platforms,
            genre: gameData.genre,
            description: gameData.description,
            coverImage: gameData.coverImage,
            rating: gameData.rating || 0,
            acquiredTime: new Date().toISOString(),
            shelves: gameData.shelves || [],
            attribution: gameData.attribution
        };

        this.games.push(game);
        this.saveData();
        this.renderGames();
        this.updateStats();

        return game;
    }
}

// Initialize Game Shelf when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.gameShelf = new GameShelf();
});