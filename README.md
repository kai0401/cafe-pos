# 喫茶店 POS

スマレジ代替の注文・会計・売上分析システム。

## 店舗導入（クラウド・Mac 不要）

スマレジ切替手順は **[ROLLOUT.md](./ROLLOUT.md)** を参照。

```bash
npm run cloud:deploy      # デプロイ手順を表示
npm run rollout:check     # 環境変数チェック（本番）
```

**本番URL例（Vercel + Neon）**

| 画面 | URL |
|------|-----|
| ウェイター | `https://<app>.vercel.app/waiter/tables` |
| キッチン | `https://<app>.vercel.app/kitchen` |
| 管理 | `https://<app>.vercel.app/admin/login` |
| QRオーダー | `https://<app>.vercel.app/qr/...` |

1. [Neon](https://neon.tech) で PostgreSQL を作成
2. Vercel にデプロイ（`DATABASE_URL`, `PUBLIC_BASE_URL`, `ADMIN_PIN`, `STAFF_PIN` を設定）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkai0401%2Fcafe-pos&project-name=cafe-pos&env=DATABASE_URL&envDescription=Neon%20PostgreSQL%20%E6%8E%A5%E7%B6%9A%E6%96%87%E5%AD%97%E5%88%97&envLink=https%3A%2F%2Fneon.tech&demo-title=cafe-pos&demo-description=%E5%96%B6%E6%A5%AD%E7%94%A8%20POS%20MVP)

## スマホ開発（ローカル）

```bash
npm run dev:mobile    # 同じ Wi‑Fi から接続（LAN URL 表示）
npm run dev:tunnel    # HTTPS 公開 URL（LTE からも接続可）
```

スマホで開く: `/waiter/open` → 接続確認 → テーブル一覧

## 常時プレビュー（開発用）

```bash
npm run preview:public   # 本番ビルド + 公開 URL
npm run preview:mobile   # スマホ向け（Pinggy・パスワードなし）
npm run preview:tunnel   # トンネル URL の再発行
```

> トンネル URL は一時的です。`npm run dev:tunnel` で毎回新しい URL が発行されます。

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
# 店舗 Mac: DATABASE_URL="file:./prisma/dev.db"（デフォルト）
# クラウド: Neon の PostgreSQL 接続文字列に差し替え
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

### iPhone接続（推奨）

```bash
npm run dev:mobile
```

ターミナルに表示されるURLを iPhone の Safari で開き、**共有 → ホーム画面に追加** でアプリ化できます。

接続ガイド（QRコード）: `/waiter/connect` または 設定 → iPhone接続

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

## QRオーダー

1. 管理画面 → **QRオーダー** でテーブル別QRコードを印刷し、各テーブルに設置
2. お客様が店内Wi‑Fiに接続した状態でスマホで読み取ると注文ページが開きます
3. 注文はキッチンモニターとTM-m30伝票に自動連携されます

## レシートプリンター（Epson TM-m30）

1. TM-m30 を店内LAN（同じWi‑Fi）に接続
2. ウェイター → 設定 → **プリンター設定** でIPアドレスを入力
   - IPはプリンターのステータスシート（電源投入時に紙送りボタン長押し）で確認
3. **テスト印刷** で接続確認

| タイミング | 印刷内容 |
|-----------|---------|
| 注文送信 | キッチン伝票（テーブル・商品・メモ） |
| 「印刷」ボタン | お会計伝票（明細・合計） |
| 会計完了 | レシート（支払い方法・お釣り）＋現金時ドロワー |

各自動印刷は設定画面でON/OFFできます。プリンター未設定・障害時も注文と会計は通常どおり動作します。

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
