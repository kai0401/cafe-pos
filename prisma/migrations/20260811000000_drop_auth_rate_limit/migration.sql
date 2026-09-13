-- ログイン機能の廃止に伴い、PIN レート制限テーブルを削除
DROP TABLE IF EXISTS "auth_rate_limits";
