# Blog Dashboard

ブログ記事の作成・編集・公開を管理するダッシュボードアプリケーションです。

GitHub リポジトリをバックエンドとして利用し、記事を Pull Request ベースで管理します。記事の作成時にブランチと PR が自動生成され、編集内容は GitHub 上に保存されます。PR をマージすることで記事が公開されます。

## 主な機能

- Google アカウントによるログイン（許可されたメールアドレスのみ）
- 記事の作成・編集・公開
- テキストと画像で構成されるブロックエディタ
- Vercel プレビューデプロイによる記事の確認
- 画像のアップロード・圧縮・管理

## 技術スタック

| 領域           | 技術                                   |
| -------------- | -------------------------------------- |
| フロントエンド | React, TypeScript, Vite, TailwindCSS   |
| バックエンド   | Hono (Vercel Serverless Functions)     |
| 認証           | Firebase Authentication (Google OAuth) |
| 記事管理       | GitHub API (Octokit)                   |
| ホスティング   | Vercel                                 |

## セットアップ

### 前提条件

- Node.js
- npm

### 環境変数

`.env.example` を `.env` にコピーし、各値を設定してください。

```bash
cp .env.example .env
```

必要な外部サービス:

- **GitHub**: リポジトリへのアクセス用 Personal Access Token
- **Firebase**: Authentication 用のプロジェクト設定とサービスアカウント
- **Vercel**: プレビューデプロイ取得用のトークンとプロジェクト ID

### インストール

```bash
npm install
```

## 開発

```bash
npm run dev
```

開発サーバーが起動します。`/api/*` へのリクエストはローカルの Serverless Functions にプロキシされます。

## ビルド

```bash
npm run build
```

## その他のコマンド

```bash
npm run lint        # ESLint によるコードチェック
npm run lint:fix    # ESLint による自動修正
npm run format      # Prettier によるコード整形
```

## デプロイ

Vercel にデプロイされます。`main` ブランチへのプッシュで本番環境に自動デプロイされます。
