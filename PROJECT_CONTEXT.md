# プロジェクト共有メモ（Mac → iPhone Cursor 用）

このファイルは開発セッションの履歴・決定事項を iPhone 版 Cursor Cloud Agent と共有するためのものです。
**作業前に必ず読んでください。**

## リポジトリ

- GitHub: https://github.com/kai0401/cafe-pos
- ローカル（Mac）: `/Users/kaifukubayashi/260628 スマレジ/cafe-pos`
- ブランチ: `main`

## プロジェクト概要

日本の喫茶店1店舗専用 POS・注文・売上分析。スマレジから段階的に置き換え。

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | スマレジCSV取込 + 売上分析 | ✅ 完了 |
| 2 | ウェイター + キッチン | 🔄 部分実装 |
| 3 | 会計 | 未着手 |
| 4 | QRオーダー・プリンター等 | 未着手 |

## 店舗条件

- 営業: 11:00–18:00
- 定休: **木曜**（`regularClosedDays: [3]`、月=0・木=3）
- ダッシュボードは営業日のみがデフォルト

## 技術スタック

Next.js 16 / React 19 / TypeScript / Prisma **6.19.3** / SQLite（開発）/ Recharts / Papaparse / iconv-lite

## 起動（クラウド / ローカル共通）

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

- 開発サーバー: 通常 `http://localhost:3000`（3000 が塞がれていれば 3002）
- **DB は Git に含めない**（`prisma/dev.db`）。売上データは CSV を `/admin/imports` から再インポート

## 主要 URL

| URL | 内容 |
|-----|------|
| `/admin/dashboard` | 売上ダッシュボード |
| `/admin/imports` | CSVインポート |
| `/admin/analytics/*` | 各種分析 |
| `/waiter` | ウェイターホーム |
| `/waiter/tables` | テーブル一覧 |
| `/waiter/order/[tableId]` | テーブル概要（3タブ） |
| `/waiter/order/[tableId]/categories` | カテゴリ一覧（注文） |
| `/waiter/order/[tableId]/menu/[categoryId]` | 商品 + オプションモーダル |
| `/waiter/history` | 取引履歴（スマレジ風） |
| `/kitchen` | キッチンモニター |

## 取込済みデータ（Mac ローカルのみ）

- 6,200取引 / ¥11,193,950 / 11,504明細（CSV突合OK）
- CSV期間: 2025/07〜2026/06（2025/04〜06はなし）

## 完了した主な実装

### Phase 1
- 商品・取引 CSV 取込（cp932/UTF-8、二重取込防止）
- 管理画面ダッシュボード・日別/時間帯/商品分析・月次レポート

### Phase 2（ウェイター）
- テーブル T1–T9 + テイクアウト1–3
- カテゴリ → 商品 → **オプションモーダル**（白玉・ソフトクリーム等）
- テーブル概要: 入店時間・人数±・メモ・取引中止
- キッチン画面（NEW/COOKING/DONE）
- 取引履歴: 月別 + 日別（全日表示、定休日ラベル）
- iPhone 向け UI（390px幅、44px行高、safe-area）

## スマレジとの差分（未実装）

- **取引完了**（会計）→ Phase 3
- **印刷** → Phase 4
- スタッフ選択・客層選択（表示のみ）
- WebSocket（キッチンは3秒ポーリング）

## 重要な技術判断

| 問題 | 対応 |
|------|------|
| Prisma 7 非互換 | Prisma 6.19.3 に固定 |
| 定休日が金曜になっていた | `[4]`→`[3]`（木曜）に修正 |
| 取引履歴の日付飛び | 月内全日を表示（0件・定休日も） |
| 注文画面が消えた | `/categories` と `/menu` を復元 |
| Git push 失敗 | SSH鍵で `git@github.com:kai0401/cafe-pos.git` |

## カテゴリ（fix-menu.ts 後）

あんみつ / ソフトクリーム / ドリンク / 氷 / シロップ / 軽食

## 次の優先タスク

1. Phase 3 会計（取引完了・支払い・レシート）
2. ウェイター UI のスマレジ完全準拠の細部調整
3. PostgreSQL 本番化（docker-compose.yml あり）

## iPhone Cursor での使い方

1. Cloud Agent で `kai0401/cafe-pos` を開く
2. 最初のプロンプト例:

```
PROJECT_CONTEXT.md を読んで現状を把握してから作業して。
```

3. 環境構築:

```
npm install && cp .env.example .env && npx prisma generate && npm run dev
```

## 秘密情報

- `.env` はコミットしない
- GitHub PAT はチャットに貼らない（SSH 鍵を Mac に設定済み）
