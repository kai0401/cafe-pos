# ラズパイ移設（明日用・短縮手順）

画面・キーボード不要。Mac から SSH だけで完了。

**ゴール:** 店内は `http://ラズパイIP:3000` が速いPOS。印刷もPiからTM-m30へ。

---

## 0. 用意するもの

- Raspberry Pi 4/5（RAM **4GB以上**）
- microSD（32GB以上）＋電源
- 有線LAN推奨（Wi‑Fiでも可）
- プリンター IP（いま `192.168.1.230`）
- 同じ店内Wi‑Fi／LAN

---

## 1. SDを焼く（Mac・5分）

1. [Raspberry Pi Imager](https://www.raspberrypi.com/software/) を開く
2. OS: **Raspberry Pi OS (64-bit) Lite** でOK
3. 歯車（設定）:
   - ホスト名: `azumaya-pos`（任意）
   - **SSH 有効** + パスワード認証
   - ユーザー名 / パスワード（控える）
   - Wi‑Fi（有線なら不要）: 店のSSID
   - ロケール: Asia/Tokyo
4. 書き込み → SDをPiに挿して電源ON（1〜2分待つ）

---

## 2. MacからSSH（接続確認）

```bash
# どちらか
ssh ユーザー名@azumaya-pos.local
# またはルーターでIPを見て
ssh ユーザー名@192.168.x.x
```

初回は `yes` → パスワード入力。入れたらOK。

PiのIPを控える（あとでスタッフ端末のURLになる）:
```bash
hostname -I
```

---

## 3. Mac側：中身を詰めて送る（このリポジトリで）

```bash
cd "/Users/kaifukubayashi/260628 スマレジ/cafe-pos"
bash scripts/pi-export-from-mac.sh
```

できるもの: `.preview-logs/pi-transfer/`（ソース＋DBダンプ）

送る（`USER` と `PI_HOST` を書き換え）:
```bash
export PI_USER=pi          # Imagerで決めたユーザー
export PI_HOST=azumaya-pos.local   # または IP
bash scripts/pi-push.sh
```

---

## 4. Pi側：セットアップ一発

SSHしたあと:

```bash
cd ~/cafe-pos-transfer
sudo bash scripts/pi-shop-setup.sh
```

終わるまで **10〜20分**（`npm install` と `build`）。  
完了メッセージに URL が出る。

確認:
```bash
curl -s http://127.0.0.1:3000/api/health
sudo systemctl status cafe-pos-shop --no-pager | head -15
```

---

## 5. スタッフ端末

| 用途 | URL |
|------|-----|
| ウェイター | `http://ラズパイIP:3000/waiter/tables` |
| キッチン | `http://ラズパイIP:3000/kitchen` |
| 管理 | `http://ラズパイIP:3000/admin/dashboard` |

- ホーム画面に追加し直す
- **スタッフPINは不要**（店内LAN運用。クラウドの `956313` はクラウド用）
- 印刷テスト: 管理 → プリンター → テスト印刷

---

## 6. うまくいったら

- Macの「店舗サーバー」Terminal は止めてOK
- Macは閉じても、**Piの電源は入れっぱなし**
- QRシールは店内URLにする場合は `/admin/qr` で再印刷  
  （外から客が使うならクラウドURLのまま＋データ同期方針が別途必要）

---

## 困ったとき

| 症状 | 確認 |
|------|------|
| SSHできない | 同じWi‑Fiか／ImagerのSSID／有線に変更 |
| healthがdbエラー | `sudo journalctl -u cafe-pos-shop -n 50` |
| 印刷されない | `printer-config.json` のIP、Piとプリンタが同一LANか |
| 再起動後に消える | `sudo systemctl enable cafe-pos-shop`（setup済みのはず） |

ログ:
```bash
sudo journalctl -u cafe-pos-shop -f
```

サービス操作:
```bash
sudo systemctl restart cafe-pos-shop
sudo systemctl stop cafe-pos-shop
```

---

## 明日の最短チェックリスト

- [ ] ImagerでSD（SSH・ユーザー・Wi‑Fi）
- [ ] Pi起動 → `ssh` 成功 → IP控える
- [ ] Macで `pi-export-from-mac.sh` → `pi-push.sh`
- [ ] Piで `sudo bash scripts/pi-shop-setup.sh`
- [ ] スマホでウェイター表示・テスト印刷
- [ ] Mac店舗サーバー停止

---

## Cursor からリモート操作（推奨）

1. Command Palette → **Remote-SSH: Connect to Host** → `azumaya-pos`
2. フォルダ `/opt/cafe-pos` を開く
3. または: `npm run pi:status` / `pi:logs` / `pi:restart` / `pi:deploy` / `pi:backup`
4. IP変更時: `npm run pi:ssh-update`

**安定運用の正本:** [OPS-STABLE.md](./OPS-STABLE.md)  
**店入れ直前手順:** [GO-LIVE.md](./GO-LIVE.md)
