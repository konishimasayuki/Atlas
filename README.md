# Atlas 一括業務管理システム — コア（認証・権限・ユーザー管理）

「Atlas 一括業務管理システム」の共通コア。ログイン・権限による画面表示制御・ユーザー管理を提供する。
各モジュール（①〜⑥）はこのコアの上に載る。接続仕様書（atlas-integration-spec）に従うこと。

## スタック
React + Vite / Vercel API Routes / Upstash Redis / Biome

## セットアップ
1. Vercel にこのリポジトリを接続（自動デプロイ）。
2. Vercel の環境変数に Upstash の値を設定：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. デプロイ後、初回アクセスすると **初回セットアップ画面** が出る（ユーザーが1人もいないとき）。
   最初の管理者（全画面＋ユーザー管理権限）を作成すると、そのままログイン状態になる。
4. 以降は 設定(⑦) → ユーザー管理 から、各担当のユーザーを権限付きで追加する。

## 権限のしくみ
- 各ユーザーは `allowedModules`（①〜⑦のどれを見られるか）を持つ。ログイン後、権限のある画面だけメニューに出る。
- `canManageUsers` が true のユーザーだけ、設定でユーザー追加ができる（サーバ側でも検証）。

## ログイン保持
セッションは Redis に無期限で保存し、Cookie も長期。**ログアウトするまで保持**される。

## キー設計（接続仕様書 §6）
- ユーザー: `atlas:{tenant}:core:user:{loginId}`
- ユーザー一覧(SET): `atlas:{tenant}:core:users`
- セッション: `atlas:{tenant}:core:session:{token}`

現状は単一テナント（t001）。将来ログイン時のテナント解決に拡張予定。

## API
| メソッド / パス | 用途 |
|---|---|
| GET  /api/core/auth/setup  | 初期化済みか判定 |
| POST /api/core/auth/setup  | 最初の管理者を作成（未初期化時のみ） |
| POST /api/core/auth/login  | ログイン |
| POST /api/core/auth/logout | ログアウト |
| GET  /api/core/auth/me     | 現在のユーザーと権限 |
| GET  /api/core/users       | ユーザー一覧（要 canManageUsers） |
| POST /api/core/users       | ユーザー追加（要 canManageUsers） |
