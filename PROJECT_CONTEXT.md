# プロジェクト共有メモ（Mac → iPhone Cursor 用）

このファイルは開発セッションの履歴・決定事項を iPhone 版 Cursor Cloud Agent と共有するためのものです。
**作業前に必ず読んでください。**

## リポジトリ

- GitHub: https://github.com/kai0401/cafe-pos
- ローカル（Mac）: `/Users/kaifukubayashi/260628 スマレジ/cafe-pos`
- ブランチ: `main`

## プロジェクト概要

日本の喫茶店1店舗専用 POS・注文・売上分析。スマレジから段階的に置き換え。
**本番は Vercel + Neon（店舗 Mac 不要）。** iPhone / iPad / お客様スマホだけで運用。

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | スマレジCSV取込 + 売上分析 | ✅ 完了 |
| 2 | ウェイター + キッチン | ✅ 完了 |
| 3 | 会計（支払い方法・お釣り） | ✅ 完了 |
| 4 | TM-m30 プリンター（伝票・レシート・ドロワー） | ✅ 完了（LAN専用・クラウドではキッチン画面+STORES） |
| 5 | QRオーダー | ✅ 完了 |
| 6 | 自動精算機連携 | 未着手（ハードウェア依存） |
| 7 | **店舗導入**（Vercel + Neon・Mac不要） | 🔄 進行中 → [ROLLOUT.md](./ROLLOUT.md) |

## 店舗条件

- 営業: 11:00–18:00
- 定休: **木曜**（`regularClosedDays: [3]`、月=0・木=3）
- ダッシュボードは営業日のみがデフォルト

## 技術スタック

Next.js 16 / React 19 / TypeScript / Prisma **6.19.3** / PostgreSQL（本番・プレビュー）/ SQLite（Mac ローカル `dev.db`）/ Recharts / Papaparse / iconv-lite

## 起動（クラウド / ローカル共通）

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

- 開発サーバー: 通常 `http://localhost:3000`（3000 が塞がれていれば 3002）
- **iPhone接続**: `npm run dev:mobile` → 同じWi‑FiのiPhoneで `http://<MacのIP>:3000/waiter/tables`
- 接続ガイド画面: `/waiter/connect`（QRコード付き）
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
| `/waiter/history` | 取引履歴（月別 → 日別 → 取引明細・取消） |
| `/kitchen` | キッチンモニター |
| `/admin/closing` | レジ締め（日次締め + 締めレポート印刷） |
| `/admin/settings` | 営業設定（店名・営業時間・定休日・インボイス・**STORES決済**） |
| `/admin/qr` | **テーブル別QRシール印刷**（常設貼付用・トークン付きURL） |
| `/qr/[tableId]?t=トークン` | **お客様QRオーダー**（人数選択→注文→状況確認） |
| `/qr/payment/complete` | STORESオンライン決済完了画面 |

## STORES決済・QRオーダー

- **STORES決済**: `/admin/settings` で有効化。ウェイター会計で「STORES決済」選択 → 端末で決済 → 「決済完了」
- **オンライン決済**: `.env` に `STORES_API_KEY`（Coiney API）を設定すると決済URLを発行
- **QRオーダー**: `/admin/qr` でシールを**一度印刷して各テーブルに常設**
- URLは `https://<app>.vercel.app/qr/{tableId}?t={qrToken}`
- お客様は LTE・Wi‑Fi どちらでもアクセス可（クラウド運用）
- QR注文は `Order.channel = QR`。テーブル一覧に QR バッジ表示
- 全品提供後、STORES有効時はお客様がスマホから STORES で支払い可能

## 取込済みデータ（Mac ローカルのみ）

- 6,200取引 / ¥11,193,950 / 11,504明細（CSV突合OK）
- CSV期間: 2025/07〜2026/06（2025/04〜06はなし）
- **Git に CSV は含めない**（機密・容量のため）。クラウドでは `data/smaregi/商品.csv` と `取引.csv` を配置するか `/admin/imports` から再インポート

## Cloud Agent での作業（2026-06）

- `npm run preview:public` … DB 込み本番ビルド + cloudflared 公開 URL
- `npm run preview:tunnel` … トンネル URL だけ再発行
- PR #4 … 仮デモメニュー（17品）を廃止し、スマレジ CSV インポートに切替（**要 CSV 配置**）
- Phase 3 基本: `completeOrderCheckout`、取引完了ボタン、簡易レシート印刷（`window.print`）
- 人数選択ダイアログを画面中央モーダルに変更（PR #1 マージ済）

## 完了した主な実装

### Phase 1
- 商品・取引 CSV 取込（cp932/UTF-8、二重取込防止）
- 管理画面ダッシュボード・日別/時間帯/商品分析・月次レポート

### Phase 2（ウェイター）
- テーブル T1–T9 + テイクアウト1–3
- カテゴリ → 商品 → **オプションモーダル**（白玉・ソフトクリーム等）+ 数量選択
- テーブル概要: 入店時間・人数±・メモ・取引中止
- 注文履歴: 未送信品の数量変更・取消
- **会計**: 支払い方法選択（現金/クレジット/交通系IC/QR）・お釣り計算
- キッチン画面（NEW/COOKING/DONE）
- 取引履歴: 月別 + 日別（スマレジ+自前POS両方）
- 商品管理: 売切・非表示切替
- iPhone 向け UI（390px幅、44px行高、safe-area）

## プリンター連携（TM-m30）

- ESC/POS RAW 印刷（TCP 9100）。日本語は Shift_JIS、¥ は ESC R 8
- **注文送信 → キッチン伝票を自動印刷**（設定でON/OFF）
- **会計完了 → レシート自動印刷 + 現金時ドロワーキック**
- 概要タブ「印刷」→ お会計伝票（プリンター未設定時はブラウザ印刷にフォールバック）
- 設定: `/waiter/settings/printer`（IP・ポート・用紙幅・テスト印刷）
- 設定は `printer-config.json`（gitignore済・端末ローカル）
- プリンター障害時も注文・会計は止めない（fire-and-forget + console.error）

## QRオーダー

- `/qr/[tableId]` — 客向け注文ページ（カテゴリタブ・トッピング・数量・カート・注文状況）
- 注文は既存の waiter API を利用（送信でキッチン + TM-m30 伝票にも自動連携）
- `/admin/qr` — テーブル別QRコード印刷シート（店内LANのURLを自動使用）
- DBはスキーマ共通。ローカルは SQLite（`schema.prisma` provider=sqlite、vercel-build で postgresql に差し替え）

## スタッフ・客層

- 概要タブから選択可能。`Order.staffName` / `Order.customerSegment`（db push 済）
- スタッフ名は端末 localStorage に履歴保存、会計時に `SalesTransaction.staffName` へ記録
- 客層プリセット: 男性/女性/男女/家族連れ/観光客/常連

## 会計まわり（値引き・取消・レジ締め）

- **値引き**: 会計モーダルに値引き入力。`subtotalAmount − discountAmount = totalAmount` で記録、レシートに小計/値引き行を印字
- **取引取消（返金）**: `/waiter/history/[month]/[date]` の取引明細から実行。元取引は変更せず、負の金額の `REFUND` 取引を新規作成（会計データの不変性）。二重取消はブロック。OWN_POS の集計は SALE+REFUND を反映（返金は件数・客数に加算しない）。SMAREGI 取込分は従来通り SALE のみ集計
- **レジ締め**: `/admin/closing`。純売上・返金・値引き・支払い方法別・客数を表示、未会計テーブルがあると締め不可。実行で `ReportSnapshot`（DAILY_CLOSING）保存 + TM-m30 で締めレポート印刷
- **インボイス**: `/admin/settings` で登録番号を設定するとレシートに「登録番号」を印字

## スマレジとの差分（未実装）

- 自動精算機連携（ハードウェア依存）
- WebSocket（キッチンは3秒ポーリング + 接続エラー表示で運用可）
- クラウド本番では TM-m30 印刷不可（キッチン画面 + STORES端末レシートで代替）

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

1. **Vercel + Neon 本番デプロイ**（店舗 Mac 不要）→ `npm run cloud:deploy`
2. `/admin/imports` でスマレジ CSV インポート、`/admin/qr` で QR シール印刷
3. スタッフ iPhone / キッチン iPad の PWA をクラウド URL に付け替え
4. 自動精算機連携（ハードウェア入手後）

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

## 店舗導入（Phase 7）

**店舗に Mac は不要。Vercel + Neon でクラウド運用。**

| 端末 | 用途 |
|------|------|
| スタッフ iPhone | `/waiter` PWA（LTE/Wi‑Fi） |
| キッチン iPad | `/kitchen` 常時表示 |
| STORES 端末 | 会計・レシート印刷 |
| お客様スマホ | テーブル常設 QR |

環境変数: `DATABASE_URL`（Neon）, `PUBLIC_BASE_URL`（ログイン機能は廃止済み）

手順: **[ROLLOUT.md](./ROLLOUT.md)**

## 秘密情報

- `.env` はコミットしない
- GitHub PAT はチャットに貼らない（SSH 鍵を Mac に設定済み）
