/**
 * CollectionUI - User interface for collection management
 * Handles collection modals, forms, and user interactions
 */
class CollectionUI {
    constructor(collectionManager, gameManager) {
        this.collectionManager = collectionManager;
        this.gameManager = gameManager;
        this.currentEditingCollection = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateCollectionSelector();
    }

    setupEventListeners() {
        // Collection management button
        const manageCollectionsBtn = document.getElementById('manage-collections');
        if (manageCollectionsBtn) {
            manageCollectionsBtn.addEventListener('click', () => {
                this.showCollectionManagement();
            });
        }

        // Collection selector
        const collectionSelector = document.getElementById('collection-selector');
        if (collectionSelector) {
            collectionSelector.addEventListener('change', (e) => {
                this.onCollectionChange(e.target.value);
            });
        }

        // Collection modal close buttons
        this.setupModalCloseHandlers();

        // Collection form handlers
        this.setupCollectionFormHandlers();

        // Collection management handlers
        this.setupCollectionManagementHandlers();
    }

    setupModalCloseHandlers() {
        // Collection management modal
        const collectionModal = document.getElementById('collection-modal');
        const collectionModalClose = document.getElementById('collection-modal-close');
        
        if (collectionModalClose) {
            collectionModalClose.addEventListener('click', () => {
                collectionModal.style.display = 'none';
            });
        }

        if (collectionModal) {
            collectionModal.addEventListener('click', (e) => {
                if (e.target === collectionModal) {
                    collectionModal.style.display = 'none';
                }
            });
        }

        // Collection form modal
        const collectionFormModal = document.getElementById('collection-form-modal');
        const collectionFormModalClose = document.getElementById('collection-form-modal-close');
        
        if (collectionFormModalClose) {
            collectionFormModalClose.addEventListener('click', () => {
                this.closeCollectionForm();
            });
        }

        if (collectionFormModal) {
            collectionFormModal.addEventListener('click', (e) => {
                if (e.target === collectionFormModal) {
                    this.closeCollectionForm();
                }
            });
        }

        // Collection overview modal
        const collectionOverviewModal = document.getElementById('collection-overview-modal');
        const collectionOverviewModalClose = document.getElementById('collection-overview-modal-close');
        
        if (collectionOverviewModalClose) {
            collectionOverviewModalClose.addEventListener('click', () => {
                collectionOverviewModal.style.display = 'none';
            });
        }

        if (collectionOverviewModal) {
            collectionOverviewModal.addEventListener('click', (e) => {
                if (e.target === collectionOverviewModal) {
                    collectionOverviewModal.style.display = 'none';
                }
            });
        }
    }

    setupCollectionFormHandlers() {
        // Add collection button
        const addCollectionBtn = document.getElementById('add-collection');
        if (addCollectionBtn) {
            addCollectionBtn.addEventListener('click', () => {
                this.showCollectionForm();
            });
        }

        // Save collection form
        const saveCollectionFormBtn = document.getElementById('save-collection-form');
        if (saveCollectionFormBtn) {
            saveCollectionFormBtn.addEventListener('click', () => {
                this.saveCollectionForm();
            });
        }

        // Cancel collection form
        const cancelCollectionFormBtn = document.getElementById('cancel-collection-form');
        if (cancelCollectionFormBtn) {
            cancelCollectionFormBtn.addEventListener('click', () => {
                this.closeCollectionForm();
            });
        }

        // Enter key support for collection name
        const collectionNameInput = document.getElementById('collection-name');
        if (collectionNameInput) {
            collectionNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveCollectionForm();
                }
            });
        }
    }

    setupCollectionManagementHandlers() {
        // Edit collection button
        const editCollectionBtn = document.getElementById('edit-collection');
        if (editCollectionBtn) {
            editCollectionBtn.addEventListener('click', () => {
                if (this.currentEditingCollection) {
                    this.showCollectionForm(this.currentEditingCollection);
                }
            });
        }

        // Delete collection button
        const deleteCollectionBtn = document.getElementById('delete-collection');
        if (deleteCollectionBtn) {
            deleteCollectionBtn.addEventListener('click', () => {
                if (this.currentEditingCollection) {
                    this.deleteCollection(this.currentEditingCollection.id);
                }
            });
        }
    }

    /**
     * Show collection management modal
     */
    showCollectionManagement() {
        const modal = document.getElementById('collection-modal');
        const collectionsList = document.getElementById('collections-list');
        
        if (!modal || !collectionsList) return;

        // Render collections list
        this.renderCollectionsList(collectionsList);
        
        modal.style.display = 'block';
    }

    /**
     * Render collections list in management modal
     */
    renderCollectionsList(container) {
        const collections = this.collectionManager.getAllCollections();
        
        if (collections.length === 0) {
            container.innerHTML = '<div class="no-collections">📚 コレクションがありません</div>';
            return;
        }

        container.innerHTML = collections.map(collection => {
            const stats = this.collectionManager.getCollectionStatistics(collection.id, this.gameManager);
            
            return `
                <div class="collection-item" data-collection-id="${collection.id}">
                    <div class="collection-header">
                        <div class="collection-info">
                            <span class="collection-emoji">${collection.emoji}</span>
                            <div class="collection-details">
                                <h3 class="collection-name">${collection.name}</h3>
                                <p class="collection-description">${collection.description || 'No description'}</p>
                            </div>
                        </div>
                        <div class="collection-stats">
                            <span class="stat-badge">${stats ? stats.totalGames : 0} ゲーム</span>
                            ${collection.isDefault ? '<span class="default-badge">デフォルト</span>' : ''}
                        </div>
                    </div>
                    <div class="collection-actions">
                        <button class="btn btn-small btn-secondary view-collection" data-collection-id="${collection.id}">
                            👁️ 詳細表示
                        </button>
                        ${!collection.isDefault ? `
                            <button class="btn btn-small btn-secondary edit-collection" data-collection-id="${collection.id}">
                                ✏️ 編集
                            </button>
                            <button class="btn btn-small btn-danger delete-collection" data-collection-id="${collection.id}">
                                🗑️ 削除
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for collection actions
        this.setupCollectionItemHandlers(container);
    }

    /**
     * Setup event handlers for collection items
     */
    setupCollectionItemHandlers(container) {
        // View collection buttons
        container.querySelectorAll('.view-collection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const collectionId = e.target.dataset.collectionId;
                this.showCollectionOverview(collectionId);
            });
        });

        // Edit collection buttons
        container.querySelectorAll('.edit-collection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const collectionId = e.target.dataset.collectionId;
                const collection = this.collectionManager.getCollectionById(collectionId);
                this.showCollectionForm(collection);
            });
        });

        // Delete collection buttons
        container.querySelectorAll('.delete-collection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const collectionId = e.target.dataset.collectionId;
                this.deleteCollection(collectionId);
            });
        });
    }

    /**
     * Show collection form modal
     */
    showCollectionForm(collection = null) {
        const modal = document.getElementById('collection-form-modal');
        const title = document.getElementById('collection-form-title');
        const nameInput = document.getElementById('collection-name');
        const emojiInput = document.getElementById('collection-emoji');
        const descriptionInput = document.getElementById('collection-description');
        
        if (!modal) return;

        this.currentEditingCollection = collection;

        if (collection) {
            // Edit mode
            title.textContent = '✏️ コレクション編集';
            nameInput.value = collection.name;
            emojiInput.value = collection.emoji;
            descriptionInput.value = collection.description;
        } else {
            // Create mode
            title.textContent = '📚 新しいコレクション';
            nameInput.value = '';
            emojiInput.value = '📁';
            descriptionInput.value = '';
        }

        modal.style.display = 'block';
        nameInput.focus();
    }

    /**
     * Close collection form modal
     */
    closeCollectionForm() {
        const modal = document.getElementById('collection-form-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentEditingCollection = null;
    }

    /**
     * Save collection form
     */
    async saveCollectionForm() {
        const nameInput = document.getElementById('collection-name');
        const emojiInput = document.getElementById('collection-emoji');
        const descriptionInput = document.getElementById('collection-description');
        const saveBtn = document.getElementById('save-collection-form');
        
        if (!nameInput || !emojiInput || !descriptionInput) return;

        const name = nameInput.value.trim();
        const emoji = emojiInput.value.trim() || '📁';
        const description = descriptionInput.value.trim();

        if (!name) {
            alert('コレクション名を入力してください');
            nameInput.focus();
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        try {
            if (this.currentEditingCollection) {
                // Update existing collection
                await this.collectionManager.updateCollection(this.currentEditingCollection.id, {
                    name,
                    emoji,
                    description
                });
                this.showSaveIndicator('コレクションを更新しました');
            } else {
                // Create new collection
                await this.collectionManager.createCollection(name, emoji, description);
                this.showSaveIndicator('コレクションを作成しました');
            }

            this.closeCollectionForm();
            this.updateCollectionSelector();
            
            // Refresh collections list if management modal is open
            const collectionsList = document.getElementById('collections-list');
            if (collectionsList && document.getElementById('collection-modal').style.display === 'block') {
                this.renderCollectionsList(collectionsList);
            }

        } catch (error) {
            alert(`エラー: ${error.message}`);
            console.error('Collection save error:', error);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存';
        }
    }

    /**
     * Delete collection
     */
    async deleteCollection(collectionId) {
        const collection = this.collectionManager.getCollectionById(collectionId);
        
        if (!collection) {
            alert('コレクションが見つかりません');
            return;
        }

        if (collection.isDefault) {
            alert('デフォルトコレクションは削除できません');
            return;
        }

        const confirmMessage = `コレクション「${collection.name}」を削除しますか？\n\nこの操作は取り消せません。`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            await this.collectionManager.deleteCollection(collectionId);
            this.showSaveIndicator('コレクションを削除しました');
            this.updateCollectionSelector();
            
            // Refresh collections list
            const collectionsList = document.getElementById('collections-list');
            if (collectionsList) {
                this.renderCollectionsList(collectionsList);
            }

            // Close overview modal if it was showing the deleted collection
            if (this.currentEditingCollection && this.currentEditingCollection.id === collectionId) {
                document.getElementById('collection-overview-modal').style.display = 'none';
                this.currentEditingCollection = null;
            }

        } catch (error) {
            alert(`削除エラー: ${error.message}`);
            console.error('Collection delete error:', error);
        }
    }

    /**
     * Show collection overview modal
     */
    showCollectionOverview(collectionId) {
        const collection = this.collectionManager.getCollectionById(collectionId);
        
        if (!collection) {
            alert('コレクションが見つかりません');
            return;
        }

        const modal = document.getElementById('collection-overview-modal');
        const title = document.getElementById('collection-overview-title');
        const content = document.getElementById('collection-overview-content');
        const editBtn = document.getElementById('edit-collection');
        const deleteBtn = document.getElementById('delete-collection');
        
        if (!modal || !title || !content) return;

        this.currentEditingCollection = collection;

        // Update modal title
        title.innerHTML = `${collection.emoji} ${collection.name}`;

        // Show/hide action buttons for default collections
        if (editBtn) editBtn.style.display = collection.isDefault ? 'none' : 'inline-block';
        if (deleteBtn) deleteBtn.style.display = collection.isDefault ? 'none' : 'inline-block';

        // Render collection overview content
        this.renderCollectionOverview(content, collection);

        modal.style.display = 'block';
    }

    /**
     * Render collection overview content
     */
    renderCollectionOverview(container, collection) {
        const stats = this.collectionManager.getCollectionStatistics(collection.id, this.gameManager);
        const games = this.collectionManager.getCollectionGames(collection.id, this.gameManager);
        
        container.innerHTML = `
            <div class="collection-overview">
                <div class="collection-info-section">
                    <div class="collection-metadata">
                        <div class="metadata-item">
                            <span class="metadata-label">説明</span>
                            <span class="metadata-value">${collection.description || 'No description'}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">作成日</span>
                            <span class="metadata-value">${new Date(collection.createdDate).toLocaleDateString('ja-JP')}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">更新日</span>
                            <span class="metadata-value">${new Date(collection.modifiedDate).toLocaleDateString('ja-JP')}</span>
                        </div>
                        ${collection.isDefault ? '<div class="metadata-item"><span class="default-badge">デフォルトコレクション</span></div>' : ''}
                    </div>
                </div>

                <div class="collection-stats-section">
                    <h3>📊 統計情報</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-value">${stats ? stats.totalGames : 0}</span>
                            <span class="stat-label">総ゲーム数</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${stats ? stats.platforms : 0}</span>
                            <span class="stat-label">プラットフォーム数</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${stats ? stats.completed : 0}</span>
                            <span class="stat-label">完了済み</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${stats ? stats.inProgress : 0}</span>
                            <span class="stat-label">プレイ中</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${stats ? stats.favorites : 0}</span>
                            <span class="stat-label">お気に入り</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${stats ? stats.averageRating.toFixed(1) : 0}</span>
                            <span class="stat-label">平均評価</span>
                        </div>
                    </div>
                </div>

                <div class="collection-games-section">
                    <h3>🎮 ゲーム一覧 (${games.length}本)</h3>
                    <div class="collection-games-grid">
                        ${games.length > 0 ? games.slice(0, 12).map(game => `
                            <div class="collection-game-item" data-game-id="${game.id}">
                                <img src="${game.coverImage || 'https://via.placeholder.com/80x120?text=No+Cover'}" 
                                     alt="${game.title}" 
                                     class="collection-game-cover"
                                     onerror="this.src='https://via.placeholder.com/80x120?text=No+Cover'">
                                <div class="collection-game-info">
                                    <h4 class="collection-game-title">${game.title}</h4>
                                    <p class="collection-game-platform">${Array.isArray(game.platforms) ? game.platforms.slice(0, 2).join(', ') : ''}</p>
                                </div>
                            </div>
                        `).join('') : '<p class="no-games">このコレクションにはゲームがありません</p>'}
                    </div>
                    ${games.length > 12 ? `<p class="more-games">他 ${games.length - 12} 本のゲーム...</p>` : ''}
                </div>
            </div>
        `;

        // Add click handlers for game items
        container.querySelectorAll('.collection-game-item').forEach(item => {
            item.addEventListener('click', () => {
                const gameId = item.dataset.gameId;
                // Close collection overview and show game details
                document.getElementById('collection-overview-modal').style.display = 'none';
                if (window.gameShelf && window.gameShelf.showGameDetails) {
                    window.gameShelf.showGameDetails(gameId);
                }
            });
        });
    }

    /**
     * Update collection selector dropdown
     */
    updateCollectionSelector() {
        const selector = document.getElementById('collection-selector');
        if (!selector) return;

        const collections = this.collectionManager.getAllCollections();
        const currentValue = selector.value;

        selector.innerHTML = '';
        
        collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = `${collection.emoji} ${collection.name}`;
            selector.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && collections.find(c => c.id === currentValue)) {
            selector.value = currentValue;
        }
    }

    /**
     * Handle collection change event
     */
    onCollectionChange(collectionId) {
        // Notify the main application about collection change
        if (window.gameShelf && window.gameShelf.onCollectionChange) {
            window.gameShelf.onCollectionChange(collectionId);
        }
    }

    /**
     * Show save indicator
     */
    showSaveIndicator(message) {
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.textContent = message;
            indicator.style.display = 'block';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Add game to collection (called from game details modal)
     */
    async addGameToCollection(gameId, collectionId) {
        try {
            await this.collectionManager.addGameToCollection(gameId, collectionId);
            this.showSaveIndicator('ゲームをコレクションに追加しました');
            return true;
        } catch (error) {
            console.error('Failed to add game to collection:', error);
            alert(`エラー: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove game from collection
     */
    async removeGameFromCollection(gameId, collectionId) {
        try {
            await this.collectionManager.removeGameFromCollection(gameId, collectionId);
            this.showSaveIndicator('ゲームをコレクションから削除しました');
            return true;
        } catch (error) {
            console.error('Failed to remove game from collection:', error);
            alert(`エラー: ${error.message}`);
            return false;
        }
    }

    /**
     * Get collections for game assignment dropdown
     */
    getCollectionsForGameAssignment() {
        return this.collectionManager.getAllCollections()
            .filter(collection => !collection.isDefault || collection.id === 'favorites');
    }
}