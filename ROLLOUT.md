# 導入ガイド・スケジュール（クラウド運用・店舗 Mac 不要）

スマレジから自社 POS（cafe-pos）への段階的移行手順です。

## 結論：Vercel + Neon で運用（店舗にサーバー不要）

| 役割 | 端末 | 内容 |
|------|------|------|
| **POS本体** | クラウド（Vercel） | 注文・会計・売上分析・QRオーダー |
| **データベース** | Neon PostgreSQL | 売上・商品・経費を永続保存 |
| **ウェイター** | スタッフの iPhone | PWA（ホーム画面追加）。LTE/Wi‑Fi どちらでも可 |
| **キッチン** | 店舗の iPad / タブレット | `/kitchen` を常時表示（伝票は画面） |
| **会計・レシート** | STORES 決済端末 | クレジット・QR・電子マネー + レシート印刷 |
| **お客様注文** | お客様のスマホ | テーブル常設QR → クラウドURL |

**店舗に Mac や PC を置く必要はありません。**

---

## ハードウェア構成（最小）

```
お客様スマホ ──QR──► Vercel (cafe-pos)
スタッフiPhone ──────► 同上 /waiter
キッチンiPad ────────► 同上 /kitchen
STORES端末 ──────────► 会計時にスタッフが操作
```

| 懸念 | 対応 |
|------|------|
| TM-m30（LAN印刷） | クラウドからは不可。**キッチン画面**で代替。レシートは **STORES端末** |
| レシート画像（経費） | PostgreSQL に保存（クラウド対応済み） |
| 管理画面のセキュリティ | ログイン廃止（店舗運用向け。URL を知っている人は操作可能） |
| DBバックアップ | Neon の自動バックアップ + 週次 CSV エクスポート |
| QRシール | `https://<your-app>.vercel.app/qr/...` を印刷して常設 |

---

## 第0週 — クラウド構築

### 1. Neon で PostgreSQL 作成

1. [neon.tech](https://neon.tech) でプロジェクト作成
2. 接続文字列をコピー

### 2. Vercel にデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkai0401%2Fcafe-pos)

**環境変数（必須）**

| 変数 | 例 | 用途 |
|------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Neon 接続 |
| `PUBLIC_BASE_URL` | `https://cafe-pos.vercel.app` | QRシール・接続URL |
| `STORES_API_KEY` | （任意） | QRからのオンライン決済 |

デプロイ後 `vercel-build` がスキーマを反映します（`prisma/migrations` があれば `migrate deploy`、なければ互換のため `db push`）。

デプロイ後の疎通確認:

```bash
SMOKE_BASE_URL=https://<your-app>.vercel.app npm run smoke:check
```

スキーマ運用: `prisma/migrations` があるため本番ビルドは `prisma migrate deploy` を使います。既存 Neon DB が `db push` で作られている場合は、初回だけ `prisma migrate resolve --applied 20260809000000_init` で履歴を揃えてください。

### 3. 初期データ

1. `https://<your-app>.vercel.app/admin/dashboard` を開く（ログインなし）
2. `/admin/imports` からスマレジ CSV をインポート
3. `/admin/settings` で店舗名・STORES決済を有効化
4. `/admin/qr` で QRシールを印刷 → 各テーブルに貼付

### 4. スタッフ端末セットアップ

| 端末 | URL | 手順 |
|------|-----|------|
| iPhone（ウェイター） | `/waiter/tables` | Safari → 共有 → ホーム画面に追加 |
| iPad（キッチン） | `/kitchen` | 同上。充電しながら常時表示 |

---

## 導入スケジュール（4週間）

営業：11:00–18:00 / 定休：木曜

### 第1週 — リハーサル

| 日 | 内容 |
|----|------|
| 月〜水 | スタッフが iPhone で注文練習（実会計なし） |
| 木（定休） | キッチンiPad + ウェイターで全フロー確認 |
| 金〜日 | T8・T9 のみ試運転。会計はスマレジ継続 |

**ゴール**: クラウド POS で注文 → キッチン画面に表示

### 第2週 — 並行運用

| 日 | 内容 |
|----|------|
| 月〜水 | 全テーブル POS 注文 + STORES で会計 |
| 木（定休） | 売上照合（POS vs スマレジ） |
| 金〜日 | 日次締めを POS で実施 |

### 第3週 — 完全切替

| 日 | 内容 |
|----|------|
| 月 | スマレジ会計終了 |
| 火〜水 | QRオーダー本番（貼付済みシール） |
| 木（定休） | 1週間振り返り |
| 金〜日 | 通常運用 |

### 第4週 — 安定化

スマレジ解約準備・最終 CSV エクスポート保管

---

## 日常運用（Mac 不要）

| タイミング | やること |
|------------|----------|
| 開店前 | キッチンiPadで `/kitchen` を開く。iPhone PWA を起動 |
| 営業中 | ウェイターが iPhone で注文・会計。STORES端末で決済 |
| お客様 | テーブルQRから注文（任意） |
| 閉店後 | `/admin/closing` で日次締め。経費レシート撮影 |
| 週1 | Neon ダッシュボードでバックアップ確認 |

---

## 印刷について

| 種類 | 方法 |
|------|------|
| キッチン伝票 | **キッチン画面**（iPad）で表示。音通知あり |
| お会計レシート | **STORES決済端末**が印刷 |
| 締めレポート | `/admin/closing` からブラウザ印刷 |

TM-m30 を使いたい場合は将来「印刷ブリッジ」端末が必要ですが、**Mac なし運用では必須ではありません**。

---

## ロールバック

第3週前であればスマレジ会計に戻せます。クラウド POS は閲覧のみに切替。

---

## 導入完了の定義

- [ ] 1週間、スマレジなしで営業完結
- [ ] iPhone + キッチンiPad + STORES で全フロー安定
- [ ] QRシールからお客様注文が動作
- [ ] 管理画面にログインなしで入れる
- [ ] 経費レシート撮影が1件以上成功

---

## ローカル開発（オーナーの手元 Mac のみ）

店舗には置きません。開発・CSV取込テスト用です。

```bash
npm install
cp .env.example .env
npm run dev
```

詳細は [README.md](./README.md) / [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)

---

## 障害時の切り分け（短）

| 症状 | 確認 |
|------|------|
| `/api/health` が 503 | Neon `DATABASE_URL`・接続・`migrate deploy` 失敗ログ |
| migrate エラー（既に表がある） | `npx prisma migrate resolve --applied 20260809000000_init` 後に再デプロイ |
| 会計したが売上が無い | ほぼ解消済み（会計はトランザクション化）。残る場合は order `PAID` と `sales_transactions.external_id=pos-…` を突合 |
| STORES が AWAITING_ONLINE のまま | API キー・`/api/payments/stores/:id` の sync・Coiney ダッシュボードの支払状態 |
| 古い決済 URL で支払われた | 新規セッション作成時に旧 URL のリモートキャンセルを試行。支払済みなら sync で会計確定 |
| オンライン決済待ちで取引中止できない | 仕様どおり。お客様にキャンセルしてもらうか支払完了後に処理 |
| スタッフ API が 401 | ログインは廃止済み。デプロイが古い場合は最新を反映 |
| QR で会計ボタンが出ない | キッチン完了（DONE）または提供済（SERVED）まで待つ。ドリンク等は送信時に自動提供済 |

### 決済の役割分担

| 経路 | 手段 |
|------|------|
| QR お客様セルフ払い（オンライン） | クレジットカード（Coiney） |
| ホール会計（端末） | STORES 端末のカード / QR / 電子マネー |
| 現金 | ウェイター会計画面 |
