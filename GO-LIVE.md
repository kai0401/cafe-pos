# 店入れ・本番スイッチ（直前まで完了）

**いまの状態（自宅LAN）:** Pi 稼働中 / Mac店舗サーバー停止済 / データ同期済 / 日次バックアップ稼働

店のWi‑Fiに繋いだあとは、下の「店でやること」だけ。

---

## スタッフURL（店のPi IPに書き換える）

自宅では `192.168.1.11`。店では `npm run pi:ssh-update` 後のIPを使う。

| 用途 | URL |
|------|-----|
| ウェイター | `http://PI_IP:3000/waiter/tables` |
| キッチン | `http://PI_IP:3000/kitchen` |
| 管理 | `http://PI_IP:3000/admin/dashboard` |
| プリンター設定 | `http://PI_IP:3000/admin/printer` |
| QR再発行 | `http://PI_IP:3000/admin/qr` |
| 遠隔モニター | `http://PI_IP:3000/monitor`（外からは `https://azumaya-pos.vercel.app/monitor`） |

プリンター想定IP: `192.168.1.230:9100`（店の実機に合わせて `admin/printer` で確認）

---

## 店でやること（この4つだけ）

1. Pi電源ON（有線LAN推奨）→ 同じ店内ネットに接続
2. Macで:
   ```bash
   cd "/Users/kaifukubayashi/260628 スマレジ/cafe-pos"
   npm run pi:ssh-update
   npm run pi:status
   ```
   → `"ok":true` と products/tables が出ればOK
3. スタッフ端末のブックマークを上のURLに差し替え（ホーム画面追加し直し）
4. 管理→プリンター→**テスト印刷** 1枚

終わったら営業開始。Mac店舗サーバーは起動しない。

---

## 遠隔（Cursor）

- 接続: Remote-SSH → `azumaya-pos` → `/opt/cafe-pos`
- 死活: `npm run pi:status`
- ログ: `npm run pi:logs`
- 再起動: `npm run pi:restart`
- 更新（閉店後）: `npm run pi:deploy`
- バックアップ: `npm run pi:backup` / Macへ `npm run pi:backup-pull`

詳細方針: [OPS-STABLE.md](./OPS-STABLE.md)

---

## すでに済んでいること（再作業不要）

- [x] Pi `/opt/cafe-pos` + **システムPostgreSQL :5432**（埋め込みPGは無効）
- [x] systemd 常駐（`CAFE_POS_SYSTEM_PG=1`・再起動後も自動起動・再起動試験OK）
- [x] SSH鍵・Cursor Remote-SSH
- [x] 日次 `pg_dump` cron（3:15）＋手動バックアップ確認済
- [x] Mac LaunchAgent（shop/tunnel）**無効化済**（正はPiのみ）
- [x] Mac↔Pi データ一致（orders 63 / sales 6230 / products 59）
- [x] `pi:deploy` が `.env` / プリンター設定を上書きしないよう保護
- [x] 運用ドキュメント（OPS-STABLE / 本ファイル）

## 店でだけ残る作業

1. `pi:ssh-update`（店のIP）
2. スタッフ端末のURL差し替え
3. **テスト印刷**（自宅LANにプリンタが無いため未実施）
4. ルーターで Pi IP 予約（推奨）
