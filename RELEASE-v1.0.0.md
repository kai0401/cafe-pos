# v1.0.0 — Pi店舗 初期運用版（2026-09-13）

あづま家 cafe-pos の **Raspberry Pi 本番前提の初期安定版**。

## この版で確定していること

- 本番の正は Raspberry Pi（`/opt/cafe-pos` + システム PostgreSQL `:5432`）
- Mac 店舗サーバーは使わない（LaunchAgent 無効化済み）
- ウェイターUI簡素化（接続・管理画面導線なし、初回スタッフ名、役割名除外）
- 日次 DB バックアップ、Remote-SSH / `pi:deploy` 運用
- 手順書: `GO-LIVE.md` / `OPS-STABLE.md` / `PI-SETUP.md`

## 復元のしかた

コード:
```bash
git checkout v1.0.0-pi-baseline
```

DB（店の売上データ）はこのタグには含めていません。  
Mac の `backups/from-pi/` または Pi の `/opt/cafe-pos/backups/` の `.sql.gz` を使います。

```bash
# 例（Pi上）
gunzip -c backups/cafe_pos-YYYYMMDD-HHMMSS.sql.gz | \
  psql "postgresql://cafe:cafe@127.0.0.1:5432/cafe_pos"
```

## タグ

`v1.0.0-pi-baseline`
