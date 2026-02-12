# google-calendar-mcp

Google Calendar API の MCP (Model Context Protocol) サーバー。

参加者の所属ドメインに基づくパーミッション制御により、外部参加者を含むイベントの変更・削除をサーバー側でブロックできます。

## Tools

| ツール | 説明 |
|---|---|
| `get-current-time` | 現在の日時を取得する |
| `list-events` | 1人または複数人のカレンダーのイベント一覧を取得する（TOON形式） |
| `create-event` | カレンダーイベントを作成する（ゲスト指定可） |
| `update-event` | カレンダーイベントを更新する（ゲスト変更可） |
| `delete-event` | カレンダーイベントを削除する |

`list-events` のレスポンスは [TOON](https://github.com/toon-format/toon) 形式で返されます。

## Setup

### 1. GCP プロジェクトの準備

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Calendar API を有効化
3. OAuth 同意画面を設定
4. OAuth 2.0 クライアント ID を作成（デスクトップアプリ）
5. 認証情報の JSON ファイルをダウンロード → `credentials.json` として保存

### 2. 使い方

#### npx（推奨）

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "npx",
      "args": ["-y", "google-calendar-mcp"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/path/to/credentials.json",
        "GOOGLE_OAUTH_TOKENS": "/path/to/tokens.json",
        "GOOGLE_CALENDAR_PERMISSIONS": "/path/to/permissions.json"
      }
    }
  }
}
```

#### ソースから実行

```bash
npm install
npm run build
```

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "node",
      "args": ["/path/to/google-calendar-mcp/dist/index.js"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/path/to/credentials.json",
        "GOOGLE_OAUTH_TOKENS": "/path/to/tokens.json"
      }
    }
  }
}
```

### 3. 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `GOOGLE_OAUTH_CREDENTIALS` | Yes | OAuth クライアント認証情報の JSON ファイルパス |
| `GOOGLE_OAUTH_TOKENS` | Yes | ユーザートークンの保存先パス。初回認証時に自動生成 |
| `GOOGLE_CALENDAR_PERMISSIONS` | No | パーミッション設定ファイルパス。未指定時はデフォルト設定を使用 |

### 4. 認証

初回起動時にブラウザが開き、Google アカウントでの認証を求められます。認証後、トークンが `GOOGLE_OAUTH_TOKENS` で指定したパスに自動保存され、以降はブラウザ認証なしで起動できます。

## Permissions

パーミッション設定ファイルで、操作タイプと参加者の条件に基づいて `allow` / `deny` を制御できます。

`GOOGLE_CALENDAR_PERMISSIONS` で指定したファイルが存在しない場合、以下のデフォルト設定で自動生成されます：

```json
{
  "internalDomain": "",
  "permissions": {
    "read": { "self_only": "allow", "internal": "allow", "external": "allow" },
    "create": { "self_only": "allow", "internal": "allow", "external": "deny" },
    "update": { "self_only": "allow", "internal": "allow", "external": "deny" },
    "delete": { "self_only": "allow", "internal": "allow", "external": "deny" }
  }
}
```

### 参加者の条件

各操作ごとに、参加者の条件に基づいて `allow` / `deny` を指定します。

| 条件 | 説明 |
|---|---|
| `self_only` | 参加者が自分のみ（または参加者なし） |
| `internal` | 他の参加者が全員 `internalDomain` に属する |
| `external` | `internalDomain` 外の参加者が含まれる |

## Development

```bash
npm install
npm run dev          # tsx で開発実行
npm run build        # tsc でビルド
npm run typecheck    # 型チェック
```

## License

ISC
