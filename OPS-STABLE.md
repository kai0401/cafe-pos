# 安定運用方針（Pi本番前提）

**結論:** 店舗の正は Raspberry Pi 一台。Mac は開発・遠隔メンテ用。クラウド（Vercel）は予備・外向けQR用で、営業中の会計DBは Pi と混ぜない。

---

## 1. 役割分担（これだけ守る）

| 役割 | どこ | やること |
|------|------|----------|
| **本番（正）** | Pi `/opt/cafe-pos` + システムPG `:5432` | ウェイター・キッチン・会計・印刷 |
| **開発** | Mac の `cafe-pos` | 機能開発。反映は `npm run pi:deploy` |
| **遠隔メンテ** | Cursor Remote-SSH → `azumaya-pos` | ログ・修正・再起動 |
| **クラウド** | Vercel + Neon | 店外QR／災害時予備。**通常営業では使わない** |

禁止:
- 営業中に Mac 店舗サーバーと Pi を同時起動して会計する
- クラウドと Pi の両方に注文を流す（データ分裂）
- 営業ピーク中の `pi:deploy`（ビルドで一時停止する）

---

## 2. 物理・ネットワーク（落ちない土台）

1. **電源入れっぱなし**（閉店後も可）。UPS があればなお良い（瞬間停電対策）。
2. **有線LAN推奨**。Wi‑Fiだけならルーターで Pi の **DHCP固定（予約）** を必ず取る。
3. スタッフ端末のブックマークは **固定した Pi IP**（例 `http://192.168.x.x:3000/...`）。
4. プリンター（TM-m30）も同一LAN・IP固定。`printer-config.json` と実機を一致させる。
5. 店に持ち込んだ日の最初: `npm run pi:ssh-update` → `npm run pi:status`。

---

## 3. 日常オペ（スタッフ）

開店前（1分）:
- ウェイター画面が開くか
- テスト印刷1枚

閉店後:
- 未会計がないか確認
- 異常があればオーナーに連絡（再起動は遠隔で可）

スタッフは **再インストールしない**。落ちたら電源ケーブル確認 → オーナーへ。

---

## 4. 遠隔デバッグ（オーナー / Cursor）

```bash
npm run pi:status     # 死活
npm run pi:logs       # 直近ログ
npm run pi:restart    # アプリ再起動
```

ライブログ: `ssh azumaya-pos 'sudo journalctl -u cafe-pos-shop -f'`

ヘルスが `db` 異常 → PostgreSQL:
```bash
ssh azumaya-pos 'sudo systemctl status postgresql --no-pager | head -20'
```

---

## 5. アップデート規則

| タイミング | 方法 |
|------------|------|
| 閉店後・暇な時間 | Macで直す → `npm run pi:deploy` |
| 小さな修正 | Remote-SSHで `/opt/cafe-pos` 編集 → `bash scripts/pi-apply.sh` |
| 営業中の緊急 | 原則 `pi:restart` のみ。コード変更は最小・閉店後に本番化 |

デプロイ後は必ず:
1. `pi:status` で `"ok":true`
2. ウェイター1卓・テスト印刷

---

## 6. バックアップ（必須）

- **毎日自動** `pg_dump` → `/opt/cafe-pos/backups/`（7日保持）
- 週1で Mac へコピー推奨: `npm run pi:backup-pull`
- SD破損時: 新しいSDに OS → setup → 最新 dump を復元

手動:
```bash
npm run pi:backup
```

---

## 7. 障害時の優先順位

1. **アプリ再起動** `npm run pi:restart`
2. **Pi再起動** `ssh azumaya-pos 'sudo reboot'`（2〜3分待つ）
3. **印刷だけダメ** → プリンタ電源・IP・LAN。POS自体は継続可
4. **Pi全体死** → 一時的に Mac 店舗サーバー **または** クラウド。その日の会計は片方だけ。復旧後は dump で片側に寄せる
5. **SD死** → バックアップから復元（手順は `PI-SETUP.md` + 最新 dump）

---

## 8. セキュリティ（最低限）

- SSHは鍵のみ（運用済み）
- スタッフPINはクラウド用。店内LANはPINなし前提
- sudo NOPASSWD は便利だが、将来は `systemctl` / `rsync` など必要コマンドだけに絞る
- `.env`・パスワードをチャットやリポジトリに貼らない

---

## 9. 明日の店入れチェックリスト

- [ ] Pi電源ON・有線（または店Wi‑Fi）
- [ ] `npm run pi:ssh-update` → `npm run pi:status`
- [ ] スタッフ端末のURLを Pi IP に差し替え
- [ ] Mac店舗サーバー停止
- [ ] テスト印刷
- [ ] QRを店内URLにするなら `/admin/qr` で再発行
- [ ] バックアップ cron が動いているか確認（`npm run pi:backup` 一回）
