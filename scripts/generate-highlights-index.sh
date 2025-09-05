#!/bin/bash

# ハイライトインデックス生成スクリプト
echo "🔄 ハイライトインデックス生成開始..."

cd "$(dirname "$0")/.."
OUTPUT_FILE="data/highlights-index.json"

echo "{" > "$OUTPUT_FILE"
first=true

for file in data/KindleHighlights/*.md; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        
        # YAMLフロントマターからASINを抽出
        asin=$(head -20 "$file" | grep -E "^asin:" | sed 's/asin: *//' | tr -d ' ')
        
        # ASINが見つからない場合はメタデータから抽出を試行
        if [ -z "$asin" ]; then
            asin=$(grep -E "ASIN: *[A-Z0-9]{10}" "$file" | head -1 | sed 's/.*ASIN: *//' | tr -d ' ')
        fi
        
        if [ -n "$asin" ]; then
            if [ "$first" = false ]; then
                echo "," >> "$OUTPUT_FILE"
            fi
            echo -n "  \"$asin\": \"$filename\"" >> "$OUTPUT_FILE"
            first=false
            echo "✅ $asin → $filename"
        else
            echo "⚠️ ASINが見つかりません: $filename"
        fi
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "}" >> "$OUTPUT_FILE"

echo "🎉 完了: $OUTPUT_FILE を生成しました"