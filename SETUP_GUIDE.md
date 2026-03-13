# 評価制度システム v2.0 - セットアップガイド

## 全体の流れ

```
Step 1: Supabaseプロジェクト作成        (5分)
Step 2: データベーススキーマ投入         (3分)
Step 3: Google OAuth認証設定            (10分)
Step 4: 環境変数設定 + 認証有効化        (3分)
Step 5: 初期データ投入                   (5分)
Step 6: Netlifyデプロイ                 (5分)
```

---

## Step 1: Supabaseプロジェクト作成

1. https://supabase.com にアクセス → ログイン（GitHub推奨）
2. 「New Project」をクリック
3. 以下を入力:
   - **Project name**: `hyoka-system`
   - **Database Password**: 強力なパスワードを設定（メモしておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択
4. 「Create new project」→ 2分ほど待つ

### キーの取得

プロジェクト作成後:
1. 左サイドバー「Project Settings」（歯車アイコン）
2. 「API」タブをクリック
3. 以下2つをコピー:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public key** → `eyJhbG...`（長い文字列）

---

## Step 2: データベーススキーマ投入

1. Supabaseダッシュボード左サイドバー「SQL Editor」をクリック
2. 「New query」をクリック
3. プロジェクト内の `supabase/schema.sql` の中身を全てコピー＆ペースト
4. 「Run」ボタンをクリック
5. 「Success」と表示されれば完了

### 確認方法
- 左サイドバー「Table Editor」を開く
- 以下のテーブルが表示されていればOK:
  - organizations, divisions, members, division_members
  - grade_definitions, kpi_templates, kpi_items
  - value_items, behavior_items
  - okr_periods, okr_objectives, okr_key_results, okr_checkins
  - eval_periods, evaluations, eval_kpi_scores, eval_behavior_scores, eval_value_scores
  - crosssell_routes, crosssell_tosses
  - one_on_ones, improvement_plans
  - quarterly_bonuses, win_sessions, win_session_entries

---

## Step 3: Google OAuth認証設定

### 3-1. Google Cloud Console側

1. https://console.cloud.google.com にアクセス
2. プロジェクトを選択（または新規作成）
3. 左メニュー「APIとサービス」→「認証情報」
4. 「認証情報を作成」→「OAuthクライアントID」
5. アプリケーションの種類: 「ウェブアプリケーション」
6. 以下を入力:
   - **名前**: `評価制度システム`
   - **承認済みリダイレクトURI**: `https://xxxxx.supabase.co/auth/v1/callback`
     （xxxxxはSupabaseのProject URL）
7. 「作成」→ **クライアントID** と **クライアントシークレット** をコピー

### 3-2. Supabase側

1. Supabaseダッシュボード「Authentication」→「Providers」
2. 「Google」を展開 → トグルをON
3. 以下を入力:
   - **Client ID**: Step 3-1でコピーしたクライアントID
   - **Client Secret**: Step 3-1でコピーしたシークレット
4. 「Save」

### 3-3. 許可ドメイン設定

1. 「Authentication」→「URL Configuration」
2. **Site URL**: `http://localhost:5959`（開発時）
3. **Redirect URLs** に追加:
   - `http://localhost:5959/**`
   - `https://あなたのドメイン.netlify.app/**`（デプロイ後）

---

## Step 4: 環境変数設定 + 認証有効化

### 4-1. 環境変数ファイル作成

プロジェクトルートで `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

`.env.local` を編集:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...あなたのanon key
```

### 4-2. 認証ミドルウェア有効化

`src/middleware.ts` を以下に書き換え:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### 4-3. 開発サーバー再起動

```bash
# サーバー停止 → 再起動
npm run dev -- -p 5959
```

http://localhost:5959 にアクセス → ログイン画面が表示されればOK

---

## Step 5: 初期データ投入

Supabase SQL Editorで以下を実行:

```sql
-- 1. 組織
INSERT INTO organizations (id, name, fiscal_year_start)
VALUES ('00000000-0000-0000-0000-000000000001', 'イケメングループ', 4);

-- 2. 事業部（7つ）
INSERT INTO divisions (id, org_id, name, phase, mission) VALUES
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'システム開発事業部', 'profitable', 'プロダクト品質'),
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'TaskMate', 'profitable', 'ポインター営業'),
('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '補助金事業部', 'profitable', '採択率向上'),
('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'ASP事業部', 'profitable', '報酬最大化'),
('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'イケメン製作所', 'investing', 'リピート率'),
('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'INTERCONNECT', 'investing', '登録企業拡大'),
('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'CommitmentPay', 'investing', '導入企業拡大');

-- 3. 等級定義（G1-G5）
INSERT INTO grade_definitions (org_id, grade, name, description) VALUES
('00000000-0000-0000-0000-000000000001', 'G1', 'メンバー', '基本業務を自律的に遂行'),
('00000000-0000-0000-0000-000000000001', 'G2', 'シニア', 'チーム内で専門性を発揮'),
('00000000-0000-0000-0000-000000000001', 'G3', 'マネージャー', 'チームを率いて成果を出す'),
('00000000-0000-0000-0000-000000000001', 'G4', '事業部長', '事業部の経営責任を持つ'),
('00000000-0000-0000-0000-000000000001', 'G5', '代表', '全社の経営判断を行う');

-- 4. バリュー評価項目（全社共通3項目）
INSERT INTO value_items (org_id, name, definition, axis, max_score, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'Be Bold', '失敗を恐れず、大胆に挑戦する', '外面', 7, 1),
('00000000-0000-0000-0000-000000000001', 'Build Together', 'チームで協力し、共に成長する', '内面', 7, 2),
('00000000-0000-0000-0000-000000000001', 'Own the Numbers', '数字に責任を持ち、結果にコミットする', '実行', 7, 3);

-- 5. 評価期間（2026年度H1）
INSERT INTO eval_periods (org_id, name, half, fiscal_year, start_date, end_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', '2026年度 H1', 'H1', 2026, '2026-04-01', '2026-09-30', 'planning');

-- 6. OKR期間（2026 Q1）
INSERT INTO okr_periods (org_id, name, quarter, fiscal_year, start_date, end_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', '2026 Q1', 1, 2026, '2026-04-01', '2026-06-30', 'planning');
```

---

## Step 6: Netlifyデプロイ

### 6-1. GitHubリポジトリ作成

```bash
cd hyoka-system
git add -A
git commit -m "Initial commit: 評価制度システム v2.0"
git remote add origin https://github.com/あなた/hyoka-system.git
git push -u origin main
```

### 6-2. Netlifyに接続

1. https://app.netlify.com にログイン
2. 「Add new site」→「Import an existing project」
3. GitHubを選択 → `hyoka-system` リポジトリを選択
4. ビルド設定:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
5. 「Advanced build settings」→ 環境変数を追加:
   - `NEXT_PUBLIC_SUPABASE_URL` = あなたのURL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = あなたのキー
6. 「Deploy」

### 6-3. Netlifyプラグイン

```bash
npm install -D @netlify/plugin-nextjs
```

`netlify.toml` は既に設定済み。

### 6-4. 本番URLをSupabaseに登録

デプロイ完了後、NetlifyのURL（例: `https://hyoka-system.netlify.app`）を:
1. Supabase「Authentication」→「URL Configuration」
2. **Site URL** を本番URLに変更
3. **Redirect URLs** に `https://hyoka-system.netlify.app/**` を追加
4. Google Cloud Consoleの「承認済みリダイレクトURI」にも追加:
   `https://xxxxx.supabase.co/auth/v1/callback`

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| ログイン後に真っ白 | Redirect URL未設定 | Supabase URL Configurationを確認 |
| 500エラー | 環境変数未設定 | `.env.local` の値を確認 |
| テーブルが見えない | スキーマ未投入 | SQL Editorで `schema.sql` を再実行 |
| Google認証エラー | リダイレクトURI不一致 | Google Console + Supabaseの両方を確認 |
| RLSで全データ見えない | membersにauth_user_id未設定 | ログイン後に自分のmemberレコードを作成 |

---

## 次に開発するもの（優先順）

1. **ログイン後のユーザー紐付け** - Supabase AuthのUIDとmembersテーブルのauth_user_idを連携
2. **モックデータ → Supabase実データ** - 各ページのTODOコメント箇所をSupabaseクエリに置換
3. **フォーム送信** - 評価入力・OKRチェックインのsubmit処理をServer Actionsで実装
4. **通知連携** - LINE/Slack Webhook設定
