# 評価制度システム v2.0 (hyoka-system)

イケメングループの人事評価をWebで一元管理するシステム。
四半期OKR x 半期査定のハイブリッド評価制度に対応。

## 技術スタック

- Next.js 15 (App Router) + TypeScript
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS v4
- Netlify

## セットアップ

```bash
cp .env.local.example .env.local  # 環境変数を設定
npm install
npm run dev
```

詳細は [SETUP_GUIDE.md](./SETUP_GUIDE.md) を参照。

## 設計書

[ARCHITECTURE.txt](./ARCHITECTURE.txt) に全ページ・全機能の設計が記載されています。

## DB初期化

```bash
# Supabase SQLエディタで実行
supabase/schema.sql   # テーブル + RLS
supabase/seed.sql     # 初期データ
```
