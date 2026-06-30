# 喫茶店 POS 管理（MVP-1）

スマレジCSVの取り込みと売上分析ダッシュボード。

## 起動方法

```bash
cd cafe-pos
npm install
npm run dev
```

ブラウザで http://localhost:3000/admin/dashboard を開く。

## CSVインポート

1. http://localhost:3000/admin/imports を開く
2. スマレジから出力したCSVをアップロード
3. **プレビュー** → 件数・合計金額を確認 → **インポート実行**

対応形式:
- 商品マスターCSV（Shift_JIS / UTF-8 自動判別）
- 取引明細CSV（スマレジ「取引履歴」）

CLIから一括インポート:

```bash
npx tsx scripts/import-csv.ts "商品.csv" "取引.csv"
```

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

## 営業設定

- 営業時間: 11:00–18:00
- 定休日: 木曜
- ダッシュボードは「営業日のみ」がデフォルト
- 日別・時間帯画面は「全日・全時間帯」も表示

## DB

開発環境は SQLite（`prisma/dev.db`）。本番は PostgreSQL に切替可能（`docker-compose.yml` 参照）。

```bash
# PostgreSQL（Docker がある場合）
npm run db:up
# .env の DATABASE_URL を postgresql://... に変更
npm run db:push
```

## 技術スタック

Next.js 16 / React 19 / TypeScript / Prisma 6 / SQLite / Recharts / Papaparse
