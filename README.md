# 喫茶店 POS 管理（MVP-1）

スマレジCSVの取り込みと売上分析ダッシュボード。

## 常時プレビュー（スマホからもアクセス可）

### スマホ用（おすすめ・パスワード画面なし）

Cloud Agent 実行中は `npm run preview:mobile` で公開します。  
**IP入力や loca.lt の確認画面は出ません。** そのまま開けます。

最新URLは `PREVIEW_URL.json` を参照してください。

### 固定URLで出先からいつでも見る（本番向け）

一時トンネルは切れます。**出先から毎回簡単に見るなら Vercel デプロイが確実です。**

1. [Neon](https://neon.tech) で PostgreSQL を作成（無料）
2. 下のボタンで Vercel にデプロイ（`DATABASE_URL` に Neon の接続文字列）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkai0401%2Fcafe-pos&project-name=cafe-pos&env=DATABASE_URL&envDescription=Neon%20PostgreSQL%20%E6%8E%A5%E7%B6%9A%E6%96%87%E5%AD%97%E5%88%97&envLink=https%3A%2F%2Fneon.tech&demo-title=cafe-pos&demo-description=%E5%96%B6%E6%A5%AD%E7%94%A8%20POS%20MVP)

デプロイ後はこのURLをスマホのホーム画面に追加:

| 画面 | URL |
|------|-----|
| ウェイター（テーブル一覧） | `https://<your-app>.vercel.app/waiter/tables` |
| 管理ダッシュボード | `https://<your-app>.vercel.app/admin/dashboard` |

### クラウド開発用（一時URL）

```bash
npm run preview:public   # DB込み本番ビルド + トンネル
npm run preview:mobile   # スマホ向け（Pinggy・パスワードなし）
```

> `trycloudflare.com` / `loca.lt` は切れたり確認画面が出たりします。スマホでは `preview:mobile` を使ってください。

### ワンコマンドで公開プレビュー

Vercel アカウント不要。DB 込みで本番ビルドを起動し、スマホから開ける公開 URL を自動発行します。

```bash
npm install
npm run preview:public
```

完了すると `PREVIEW_URL.json` に URL が書き出されます。

### 方法A: Vercel（固定URL・本番向け）

1. [Neon](https://neon.tech) で無料の PostgreSQL プロジェクトを作成し、接続文字列をコピー
2. 下のボタンから Vercel にデプロイ（`DATABASE_URL` に Neon の接続文字列を入力）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkai0401%2Fcafe-pos&project-name=cafe-pos&env=DATABASE_URL&envDescription=Neon%20PostgreSQL%20%E6%8E%A5%E7%B6%9A%E6%96%87%E5%AD%97%E5%88%97&envLink=https%3A%2F%2Fneon.tech&demo-title=cafe-pos&demo-description=%E5%96%B6%E6%A5%AD%E7%94%A8%20POS%20MVP)

デプロイ後のURL例:

| 画面 | URL |
|------|-----|
| ウェイター（テーブル一覧） | `https://<your-app>.vercel.app/waiter/tables` |
| 管理ダッシュボード | `https://<your-app>.vercel.app/admin/dashboard` |

`main` への push で自動デプロイする場合は、GitHub リポジトリの Secrets に `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` を登録してください。

### 方法B: Render（固定URL・本番向け）

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kai0401/cafe-pos)

1. 上のボタンから Render にデプロイ（`render.yaml` が PostgreSQL と Web サービスを自動作成）
2. デプロイ完了後 `https://<service-name>.onrender.com/waiter/tables` でアクセス

## 起動方法（ローカル開発）

```bash
npm install
cp .env.example .env
# .env の DATABASE_URL を設定（Neon または docker-compose の PostgreSQL）
npm run db:push
npm run dev
```

ブラウザで http://localhost:3000/admin/dashboard を開く（ポートが塞がれていれば 3002）。

## ウェイター（Phase 2）

| URL | 内容 |
|-----|------|
| `/waiter` | ホーム |
| `/waiter/tables` | テーブル一覧 |
| `/waiter/order/[tableId]/categories` | 注文（カテゴリ） |
| `/waiter/history` | 取引履歴 |

詳細は [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) を参照（iPhone Cursor 共有用）。

スマホからローカル開発サーバーを見る場合は `localhost` ではなく、PC の LAN IP を使います（例: `http://192.168.1.10:3000/waiter/tables`）。PC とスマホは同じ Wi‑Fi に接続してください。

## CSVインポート

1. http://localhost:3000/admin/imports を開く
2. スマレジから出力したCSVをアップロード
3. **プレビュー** → 件数・合計金額を確認 → **インポート実行**

対応形式:
- 商品マスターCSV（Shift_JIS / UTF-8 自動判別）
- 取引明細CSV（スマレジ「取引履歴」）

CLIから一括インポート:

```bash
# data/smaregi/ に 商品.csv と 取引.csv を置いた場合
npm run db:import

# またはパスを直接指定
npx tsx scripts/import-csv.ts "商品.csv" "取引.csv"
```

プレビュー（`npm run preview:public`）も `data/smaregi/` の CSV を自動インポートします。仮のデモメニューは使いません。

## 突合基準（テストデータ）

| 項目 | 期待値 |
|------|--------|
| 取引数 | 6,200件 |
| 合計売上 | ¥11,193,950 |

## 画面一覧

| URL | 内容 |
|-----|------|
| `/admin/dashboard` | 売上ダッシュボード |
| `/admin/analytics/daily` | 日別売上（全日表示） |
| `/admin/analytics/hourly` | 時間帯・曜日別 |
| `/admin/analytics/products` | 商品別売上 |
| `/admin/reports/monthly` | 月次レポート |
| `/admin/imports` | CSVインポート |
| `/admin/products` | 商品一覧 |
| `/waiter` | ウェイターTOP |
| `/waiter/tables` | テーブル一覧（人数選択） |
| `/kitchen` | キッチン画面 |

## 営業設定

- 営業時間: 11:00–18:00
- 定休日: 木曜
- ダッシュボードは「営業日のみ」がデフォルト
- 日別・時間帯画面は「全日・全時間帯」も表示

## DB

本番・開発ともに PostgreSQL を使用します（Vercel / Render では SQLite は使えません）。

**Neon（推奨・Docker 不要）**

1. [neon.tech](https://neon.tech) でプロジェクト作成
2. 接続文字列を `.env` の `DATABASE_URL` に設定
3. `npm run db:push`

**ローカル PostgreSQL（Docker がある場合）**

```bash
npm run db:up
# .env の DATABASE_URL を postgresql://cafe:cafe@localhost:5432/cafe_pos?schema=public に設定
npm run db:push
```

## 技術スタック

Next.js 16 / React 19 / TypeScript / Prisma 6 / PostgreSQL / Recharts / Papaparse
