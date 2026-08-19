# Atlas 一括業務管理システム — コア（認証・会社・権限・ユーザー管理）

マルチテナント対応の共通コア。会社コード＋ID＋パスワードでログインし、権限に応じて画面(①〜⑦)の表示を制御する。
各モジュール（①〜⑥）はこのコアの上に載る。接続仕様書（atlas-integration-spec）に従うこと。

## スタック
React + Vite / Vercel API Routes / Upstash Redis / Biome

## 3階層の権限
| 階層 | 会社コード | できること |
|---|---|---|
| スーパー管理者（運営） | `z.z` | 会社の追加、会社ごとの契約機能(①〜⑦)設定、各社の初期管理者作成 |
| 会社の管理者 | 各社のコード | 自社ユーザーの追加・権限設定（自社の契約範囲内） |
| 一般ユーザー | 各社のコード | 権限のある画面を使う |

**機能制限は2重**：実際に見える画面 ＝ 会社の契約機能(enabledModules) ∩ 本人の許可機能(allowedModules)。
会社が未契約の画面は、社員に許可しても表示されない。

## セットアップ
1. Vercel にリポジトリを接続（自動デプロイ）。
2. Vercel の環境変数に Upstash を設定：`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
3. 初回アクセスで **初回セットアップ画面**（スーパー管理者を1人作成）。会社コードは `z.z`。
   - 作成時に **デモ会社（コード `TEST`）** が自動投入される。
4. スーパー管理者でログイン（会社コード `z.z`）→ 運営コンソールで会社を追加。

## デモアカウント（自動投入）
| 項目 | 値 |
|---|---|
| 会社コード | `TEST` |
| ログインID | `demo` |
| パスワード | `demo1234` |
| 権限 | 会社管理者（全機能＋ユーザー管理） |

※ 本番前に必ずパスワード変更 or 削除すること。ログイン画面のデモ案内表示は LoginPage.jsx の `.demo-hint` ブロックを消せば非表示になる。

## ログイン保持
セッションは Redis に無期限保存＋Cookie も長期。**ログアウトするまで保持**。

## キー設計（接続仕様書 §6）
- 会社: `atlas:_super:company:{code}` ／ 会社一覧SET `atlas:_super:companies`
- スーパー管理者: `atlas:_super:admin:{loginId}`
- 会社ユーザー: `atlas:{code}:core:user:{loginId}` ／ 一覧SET `atlas:{code}:core:users`
- セッション: `atlas:session:{token}`（トークン単位・会社横断で解決）

`{tenant}` は会社コード。運営領域は `_super`。

## API
| メソッド / パス | 権限 | 用途 |
|---|---|---|
| GET  /api/core/auth/setup       | — | 初期化済みか |
| POST /api/core/auth/setup       | — | スーパー管理者作成＋デモ投入（未初期化時のみ） |
| POST /api/core/auth/login       | — | 会社コード＋ID＋PWでログイン |
| POST /api/core/auth/logout      | 認証 | ログアウト |
| GET  /api/core/auth/me          | 認証 | 現在のユーザー・権限 |
| GET  /api/core/users            | 会社管理者 | 自社ユーザー一覧 |
| POST /api/core/users            | 会社管理者 | 自社ユーザー追加（契約範囲内） |
| GET  /api/core/companies        | スーパー | 会社一覧 |
| POST /api/core/companies        | スーパー | 会社追加＋初期管理者作成 |
| POST /api/core/companies/update | スーパー | 契約機能・有効状態の更新 |
