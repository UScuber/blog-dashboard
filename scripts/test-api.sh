#!/bin/bash
# blog-dashboard API 動作確認スクリプト
# 使い方: bash scripts/test-api.sh
# 事前準備: .env.local を設定し、npx vercel dev でサーバーを起動しておくこと

BASE_URL="${BASE_URL:-http://localhost:3000}"
DATE=$(date +%Y-%m-%d)

echo "========================================="
echo " blog-dashboard API テスト"
echo " BASE_URL: $BASE_URL"
echo " DATE: $DATE"
echo "========================================="

# 1. 記事一覧（初期状態）
echo ""
echo "--- 1. GET /api/articles（初期状態）---"
curl -s "$BASE_URL/api/articles" | jq .

# 2. 記事作成
echo ""
echo "--- 2. POST /api/create（記事作成）---"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"テスト記事\",
    \"date\": \"$DATE\",
    \"body\": \"これはテスト記事です。\\n\\n段落2です。\\n\\n[image:0]\\n\\n最後の段落です。\",
    \"images\": [
      {
        \"filename\": \"test.txt\",
        \"data\": \"$(echo -n 'テスト画像データ' | base64)\"
      }
    ]
  }")

echo "$CREATE_RESPONSE" | jq .

# レスポンスから PR 番号とブランチ名を抽出
PR_NUMBER=$(echo "$CREATE_RESPONSE" | jq -r '.data.pullNumber')
BRANCH=$(echo "$CREATE_RESPONSE" | jq -r '.data.branch')

echo ""
echo "  PR番号: $PR_NUMBER"
echo "  ブランチ: $BRANCH"

if [ "$PR_NUMBER" = "null" ] || [ -z "$PR_NUMBER" ]; then
  echo "ERROR: 記事作成に失敗しました。テストを中断します。"
  exit 1
fi

# 3. 記事一覧（作成確認）
echo ""
echo "--- 3. GET /api/articles（作成確認）---"
curl -s "$BASE_URL/api/articles" | jq .

# 4. 記事編集
echo ""
echo "--- 4. PUT /api/articles/$PR_NUMBER（編集）---"
curl -s -X PUT "$BASE_URL/api/articles/$PR_NUMBER" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"テスト記事（編集済み）\",
    \"date\": \"$DATE\",
    \"body\": \"これは編集後のテスト記事です。\\n\\n編集した段落です。\",
    \"images\": []
  }" | jq .

# 5. 画像アップロード
echo ""
echo "--- 5. POST /api/images（画像アップロード）---"
curl -s -X POST "$BASE_URL/api/images" \
  -H "Content-Type: application/json" \
  -d "{
    \"branch\": \"$BRANCH\",
    \"date\": \"$DATE\",
    \"filename\": \"extra.txt\",
    \"data\": \"$(echo -n '追加画像データ' | base64)\"
  }" | jq .

# 6. 公開（PRマージ）
echo ""
echo "--- 6. POST /api/publish（公開）---"
curl -s -X POST "$BASE_URL/api/publish" \
  -H "Content-Type: application/json" \
  -d "{\"pullNumber\": $PR_NUMBER}" | jq .

# 7. 記事一覧（マージ後確認）
echo ""
echo "--- 7. GET /api/articles（マージ後確認）---"
curl -s "$BASE_URL/api/articles" | jq .

echo ""
echo "========================================="
echo " テスト完了"
echo "========================================="
