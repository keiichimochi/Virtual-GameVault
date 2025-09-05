// Highlights Management
class HighlightsManager {
    constructor(bookshelf) {
        this.bookshelf = bookshelf;
        this.highlightsCache = new Map();
    }

    async loadHighlightsForBook(book) {
        const cacheKey = book.asin;
        
        if (this.highlightsCache.has(cacheKey)) {
            return this.highlightsCache.get(cacheKey);
        }

        try {
            // Use ASIN-based lookup from highlights index
            const fileName = await this.getHighlightFileByASIN(book.asin);
            
            if (fileName) {
                // ASCIIファイル名フォルダから読み込み（GitHub Pages対応）
                const response = await fetch(`data/HighlightsASCII/${fileName}`);
                if (response.ok) {
                    const markdownText = await response.text();
                    const highlights = this.parseMarkdownHighlights(markdownText);
                    this.highlightsCache.set(cacheKey, highlights);
                    return highlights;
                }
            }
            
            // No highlights found
            this.highlightsCache.set(cacheKey, []);
            return [];
            
        } catch (error) {
            console.error('ハイライト読み込みエラー:', error);
            this.highlightsCache.set(cacheKey, []);
            return [];
        }
    }

    async getAllHighlightFiles() {
        try {
            // GitHub Actionsで生成されたファイル一覧を取得
            const response = await fetch('data/highlights-files.json');
            if (response.ok) {
                const fileList = await response.json();
                console.log(`📁 GitHub Actionsで生成されたファイル一覧: ${fileList.length}件`);
                return fileList;
            } else {
                console.warn('⚠️ highlights-files.json が見つかりません。GitHub Actionsが実行されていない可能性があります。');
                return [];
            }
        } catch (error) {
            console.error('❌ ファイル一覧取得エラー:', error);
            return [];
        }
    }

    async getHighlightFileByASIN(asin) {
        try {
            const response = await fetch(`data/highlights-index.json?t=${Date.now()}`);
            if (response.ok) {
                const index = await response.json();
                return index[asin] || null;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    extractASINFromMarkdown(markdownText) {
        // Extract ASIN from YAML frontmatter
        const yamlMatch = markdownText.match(/---\s*\n([\s\S]*?)\n---/);
        if (yamlMatch) {
            const yamlContent = yamlMatch[1];
            const asinMatch = yamlContent.match(/asin:\s*([A-Z0-9]+)/);
            if (asinMatch) {
                return asinMatch[1];
            }
        }
        
        // Also try to extract from markdown content
        const asinInContent = markdownText.match(/ASIN:\s*([A-Z0-9]+)/);
        return asinInContent ? asinInContent[1] : null;
    }

    parseMarkdownHighlights(markdownText) {
        const highlights = [];
        
        // Find the Highlights section
        const highlightsSectionMatch = markdownText.match(/## Highlights\s*\n([\s\S]*?)(?=\n---|\n##|$)/);
        
        if (highlightsSectionMatch) {
            const highlightsContent = highlightsSectionMatch[1];
            
            // Look for highlight patterns: text — location: [number]
            const highlightMatches = highlightsContent.match(/^(.+?)\s*—\s*location:\s*\[(\d+)\]/gm);
            
            if (highlightMatches) {
                for (const match of highlightMatches) {
                    const locationMatch = match.match(/^(.+?)\s*—\s*location:\s*\[(\d+)\]/);
                    if (locationMatch) {
                        const text = locationMatch[1].trim();
                        const location = locationMatch[2];
                        
                        if (text.length > 10) {
                            highlights.push({
                                text: text,
                                location: `Kindle の位置: ${location}`,
                                note: null
                            });
                        }
                    }
                }
            }
        }
        return highlights;
    }

    renderHighlights(highlights, container) {
        if (!highlights || highlights.length === 0) {
            container.innerHTML = '<p class="no-highlights">📖 この本にはハイライトがありません</p>';
            return;
        }

        const highlightCount = highlights.length;
        let highlightsHTML = `
            <div class="highlights-header">
                <span class="highlights-count">🎯 ${highlightCount}個のハイライト</span>
                <button class="btn btn-small toggle-highlights">全て表示</button>
            </div>
        `;

        // Show first 3 highlights by default
        const visibleHighlights = highlights.slice(0, 3);
        const hiddenHighlights = highlights.slice(3);

        highlightsHTML += '<div class="highlights-list visible">';
        visibleHighlights.forEach((highlight, index) => {
            highlightsHTML += `
                <div class="highlight-item" data-index="${index}">
                    <div class="highlight-text">"${this.escapeHtml(highlight.text)}"</div>
                    ${highlight.note ? `<div class="highlight-note">📝 ${this.escapeHtml(highlight.note)}</div>` : ''}
                    ${highlight.location ? `<div class="highlight-location">${this.escapeHtml(highlight.location)}</div>` : ''}
                </div>
            `;
        });
        highlightsHTML += '</div>';

        if (hiddenHighlights.length > 0) {
            highlightsHTML += '<div class="highlights-list hidden" style="display: none;">';
            hiddenHighlights.forEach((highlight, index) => {
                highlightsHTML += `
                    <div class="highlight-item" data-index="${index + 3}">
                        <div class="highlight-text">"${this.escapeHtml(highlight.text)}"</div>
                        ${highlight.note ? `<div class="highlight-note">📝 ${this.escapeHtml(highlight.note)}</div>` : ''}
                        ${highlight.location ? `<div class="highlight-location">${this.escapeHtml(highlight.location)}</div>` : ''}
                    </div>
                `;
            });
            highlightsHTML += '</div>';
        }

        container.innerHTML = highlightsHTML;

        // Setup toggle functionality
        const toggleBtn = container.querySelector('.toggle-highlights');
        if (toggleBtn && hiddenHighlights.length > 0) {
            toggleBtn.addEventListener('click', () => {
                const hiddenList = container.querySelector('.highlights-list.hidden');
                const isVisible = hiddenList.style.display !== 'none';
                
                hiddenList.style.display = isVisible ? 'none' : 'block';
                toggleBtn.textContent = isVisible ? '全て表示' : '一部のみ表示';
            });
        } else if (toggleBtn) {
            toggleBtn.style.display = 'none';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async searchInHighlights(query) {
        const results = [];
        
        for (const book of this.bookshelf.books) {
            const highlights = await this.loadHighlightsForBook(book);
            const matchingHighlights = highlights.filter(highlight => 
                highlight.text.toLowerCase().includes(query.toLowerCase()) ||
                (highlight.note && highlight.note.toLowerCase().includes(query.toLowerCase()))
            );
            
            if (matchingHighlights.length > 0) {
                results.push({
                    book: book,
                    highlights: matchingHighlights
                });
            }
        }
        
        return results;
    }

    exportHighlights() {
        const exportData = {
            exportDate: new Date().toISOString(),
            totalBooks: this.bookshelf.books.length,
            highlightsData: []
        };

        this.bookshelf.books.forEach(async (book) => {
            const highlights = await this.loadHighlightsForBook(book);
            if (highlights.length > 0) {
                exportData.highlightsData.push({
                    book: {
                        title: book.title,
                        authors: book.authors,
                        asin: book.asin
                    },
                    highlightCount: highlights.length,
                    highlights: highlights
                });
            }
        });

        setTimeout(() => {
            this.downloadJSON(exportData, 'virtual-bookshelf-highlights.json');
        }, 1000); // Wait for async operations
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getHighlightStats() {
        return {
            totalHighlights: Array.from(this.highlightsCache.values())
                .reduce((sum, highlights) => sum + highlights.length, 0),
            booksWithHighlights: Array.from(this.highlightsCache.values())
                .filter(highlights => highlights.length > 0).length,
            averageHighlightsPerBook: this.highlightsCache.size > 0 ?
                Array.from(this.highlightsCache.values())
                    .reduce((sum, highlights) => sum + highlights.length, 0) / this.highlightsCache.size : 0
        };
    }

    async generateHighlightsIndex() {
        try {
            console.log('🔄 ハイライトインデックス生成開始...');
            
            // 既存のインデックスを読み込み
            let existingIndex = {};
            try {
                const response = await fetch('data/highlights-index.json');
                if (response.ok) {
                    existingIndex = await response.json();
                    console.log('📖 既存インデックス読み込み:', Object.keys(existingIndex).length + '件');
                }
            } catch (error) {
                console.log('📝 既存インデックスなし、新規作成します');
            }
            
            // KindleHighlightsフォルダ内のファイルを取得
            const highlightFiles = await this.getAllHighlightFiles();
            console.log('📁 発見されたハイライトファイル数:', highlightFiles.length);
            
            if (highlightFiles.length === 0) {
                return {
                    existingCount: Object.keys(existingIndex).length,
                    newSuggestions: 0,
                    completeIndex: existingIndex,
                    message: 'KindleHighlightsフォルダにハイライトファイルが見つかりません。ファイルを配置してから再実行してください。'
                };
            }
            
            const existingASINs = new Set(Object.keys(existingIndex));
            const newIndex = { ...existingIndex };
            let newEntriesCount = 0;
            let processedCount = 0;
            let errorCount = 0;
            
            // 各ハイライトファイルからASINを抽出
            for (const fileName of highlightFiles) {
                try {
                    processedCount++;
                    console.log(`📖 処理中 (${processedCount}/${highlightFiles.length}):`, fileName);
                    
                    // ファイル内容を読み込み
                    const encodedFileName = encodeURIComponent(fileName);
                    const response = await fetch(`data/KindleHighlights/${encodedFileName}`);
                    
                    if (!response.ok) {
                        console.warn('⚠️ ファイル読み込み失敗:', fileName, response.status);
                        errorCount++;
                        continue;
                    }
                    
                    const content = await response.text();
                    const asin = this.extractASINFromMarkdown(content);
                    
                    if (asin) {
                        if (!existingASINs.has(asin)) {
                            newIndex[asin] = fileName;
                            newEntriesCount++;
                            console.log('✅ 新規エントリ追加:', asin, '→', fileName);
                        } else {
                            console.log('💡 既存エントリ確認:', asin, '→', fileName);
                        }
                    } else {
                        console.warn('⚠️ ASINが見つかりません:', fileName);
                        errorCount++;
                    }
                    
                } catch (error) {
                    console.error('❌ ファイル処理エラー:', fileName, error.message);
                    errorCount++;
                }
            }
            
            console.log(`📊 処理完了: 既存${Object.keys(existingIndex).length}件 + 新規${newEntriesCount}件 (エラー${errorCount}件)`);
            
            // 新しいエントリがある場合のみダウンロード
            if (newEntriesCount > 0) {
                this.downloadJSON(newIndex, 'highlights-index.json');
                console.log('💾 更新されたインデックスをダウンロードしました');
            }
            
            return {
                existingCount: Object.keys(existingIndex).length,
                newSuggestions: newEntriesCount,
                completeIndex: newIndex,
                totalProcessed: processedCount,
                errors: errorCount,
                message: newEntriesCount > 0 
                    ? `${newEntriesCount}件の新規エントリを発見し、インデックスを更新しました。(処理済み${processedCount}件、エラー${errorCount}件)`
                    : `新規エントリなし。処理済み${processedCount}件中${errorCount}件でエラーが発生しました。`
            };
            
        } catch (error) {
            console.error('❌ インデックス生成エラー:', error);
            return {
                existingCount: 0,
                newSuggestions: 0,
                completeIndex: {},
                message: 'インデックス生成中にエラーが発生しました: ' + error.message
            };
        }
    }
    
    async scanHighlightFiles() {
        // ブラウザ環境での制限により、既知のファイル名から推測する方法を使用
        const potentialFiles = [];
        
        // 既存のインデックスからファイル名を取得
        try {
            const response = await fetch('data/highlights-index.json');
            if (response.ok) {
                const existingIndex = await response.json();
                potentialFiles.push(...Object.values(existingIndex));
            }
        } catch (error) {
            // 既存インデックスがない場合は無視
        }
        
        // 蔵書データから推測されるファイル名を追加
        for (const book of this.bookshelf.books) {
            const generatedName = this.generateFilename(book);
            if (!potentialFiles.includes(generatedName)) {
                potentialFiles.push(generatedName);
            }
        }
        
        // 既知のテンプレートファイルを追加
        const knownFiles = [
            'カレーちゃん、からあげ-面倒なことはＣｈａｔＧＰＴにやらせよう.md'
        ];
        
        knownFiles.forEach(file => {
            if (!potentialFiles.includes(file)) {
                potentialFiles.push(file);
            }
        });
        
        // 実際に存在するファイルのみを返す
        const existingFiles = [];
        for (const filename of potentialFiles) {
            try {
                const encodedFileName = encodeURIComponent(filename);
                const response = await fetch(`data/KindleHighlights/${encodedFileName}`, { method: 'HEAD' });
                if (response.ok) {
                    existingFiles.push(filename);
                }
            } catch (error) {
                // ファイルが存在しない場合は無視
            }
        }
        
        return existingFiles;
    }
    
    extractASINFromMarkdown(content) {
        // YAMLフロントマターからASINを抽出
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (yamlMatch) {
            const yamlContent = yamlMatch[1];
            const asinMatch = yamlContent.match(/asin:\s*([A-Z0-9]{10})/i);
            if (asinMatch) {
                return asinMatch[1];
            }
        }
        
        // メタデータセクションからASINを抽出（バックアップ）
        const metaMatch = content.match(/\* ASIN:\s*([A-Z0-9]{10})/i);
        if (metaMatch) {
            return metaMatch[1];
        }
        
        return null;
    }
    
    generateFilename(book) {
        // 著者名-タイトル.md の形式でファイル名を生成
        const author = book.authors.split(',')[0].trim(); // 最初の著者のみ
        const title = book.title.replace(/[\/\\:*?"<>|]/g, ''); // 無効な文字を除去
        return `${author}-${title}.md`;
    }
    
    async updateHighlightsIndex(newIndex) {
        try {
            const indexData = JSON.stringify(newIndex, null, 2);
            console.log('💾 highlights-index.json を更新:', Object.keys(newIndex).length + '件');
            
            // ダウンロード形式で保存（実際のファイル更新は手動）
            this.downloadJSON(newIndex, 'highlights-index-updated.json');
            
            return true;
        } catch (error) {
            console.error('❌ インデックス更新エラー:', error);
            return false;
        }
    }
}

// HighlightsManager is now initialized directly in bookshelf.js after bookshelf is ready