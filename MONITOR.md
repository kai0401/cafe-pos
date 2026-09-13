# 遠隔モニター（店舗ダッシュボード）

店の外から、売上・卓・キッチン・プリンター・サーバー死活を確認する画面です。

## URL

| 場所 | URL |
|------|-----|
| 店内（Pi） | `http://PI_IP:3000/monitor` |
| 遠隔（クラウド） | `https://azumaya-pos.vercel.app/monitor` |

クラウドではスタッフPINが必要な場合があります。

## 仕組み

1. Pi が60秒ごとにライブ状態をクラウドへ心拍送信
2. スマホ／PCでクラウドの `/monitor` を開くと、その心拍を表示
3. 店内で Pi の `/monitor` を開くと、その場のライブDBを表示

## 設定

### クラウド（Vercel）

環境変数:
- `OPS_HEARTBEAT_KEY` … 心拍用の秘密鍵（8文字以上）
- 既存の `STAFF_ACCESS_PIN` … モニター画面の閲覧保護

マイグレーション: `npx prisma migrate deploy`（Vercel build でも実行される想定）

### Pi

`/opt/cafe-pos/.env` に追加:
```
OPS_CLOUD_URL="https://azumaya-pos.vercel.app"
OPS_HEARTBEAT_KEY="（Vercelと同じ鍵）"
```

反映: `sudo systemctl restart cafe-pos-shop`

## API

- `GET /api/ops/snapshot` … モニター用データ（要スタッフ認証・クラウド時）
- `POST /api/ops/heartbeat` … 心拍受信（`x-ops-key`）
