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
                // 日本語ファイル名を適切にURLエンコード
                const encodedFileName = encodeURIComponent(fileName);
                const response = await fetch(`data/KindleHighlights/${encodedFileName}`);
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
            const response = await fetch('data/highlights-index.json');
            if (response.ok) {
                const index = await response.json();
                return Object.values(index); // Return all filenames
            }
            return [];
        } catch (error) {
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
            const newIndex = {};
            
            // data/KindleHighlights/ フォルダ内の .md ファイルを検索する
            // ブラウザ環境では直接ファイルリストを取得できないため、
            // 一般的なファイル名パターンを試行してASINを抽出する方法を使用
            
            const possibleFiles = await this.scanHighlightFiles();
            
            for (const filename of possibleFiles) {
                try {
                    const encodedFileName = encodeURIComponent(filename);
                    const response = await fetch(`data/KindleHighlights/${encodedFileName}`);
                    
                    if (response.ok) {
                        const content = await response.text();
                        const asin = this.extractASINFromMarkdown(content);
                        
                        if (asin) {
                            newIndex[asin] = filename;
                        }
                    }
                } catch (error) {
                    // ファイル読み込みエラーは無視
                }
            }
            
            // 新しいインデックスをダウンロード
            this.downloadJSON(newIndex, 'highlights-index.json');
            
            return {
                scannedFiles: possibleFiles.length,
                validFiles: Object.keys(newIndex).length,
                newIndex: newIndex,
                message: `${possibleFiles.length}個のファイルをスキャンし、${Object.keys(newIndex).length}個の有効なハイライトファイルを発見しました。`
            };
            
        } catch (error) {
            console.error('インデックス生成エラー:', error);
            throw error;
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