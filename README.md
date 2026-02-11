# google-calendar-mcp

Google Calendar API の MCP (Model Context Protocol) サーバー。

参加者の所属ドメインに基づくパーミッション制御により、外部参加者を含むイベントの変更・削除をサーバー側でブロックできます。

## Tools

| ツール | 説明 |
|---|---|
| `get-current-time` | 現在の日時を取得する |
| `list-events` | 1人または複数人のカレンダーのイベント一覧を取得する（TOON形式） |
| `create-event` | カレンダーイベントを作成する |
| `update-event` | カレンダーイベントを更新する |
| `delete-event` | カレンダーイベントを削除する |

`list-events` のレスポンスは [TOON](https://github.com/toon-format/toon) 形式で返されます。

## Setup

### 1. GCP プロジェクトの準備

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Calendar API を有効化
3. OAuth 同意画面を設定
4. OAuth 2.0 クライアント ID を作成（デスクトップアプリ）
5. 認証情報の JSON ファイルをダウンロード

### 2. インストール

```bash
bun install
```

### 3. MCP クライアントの設定

Claude Code の `.mcp.json` での設定例：

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "bun",
      "args": ["run", "/path/to/google-calendar-mcp/src/index.ts"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/path/to/credentials.json",
        "GOOGLE_CALENDAR_PERMISSIONS": "/path/to/permissions.json"
      }
    }
  }
}
```

### 4. 認証

初回起動時にブラウザが開き、Google アカウントでの認証を求められます。認証後、トークンが `tokens.json` に自動保存され、以降はブラウザ認証なしで起動できます。

## Environment Variables

| 変数 | 必須 | 説明 |
|---|---|---|
| `GOOGLE_OAUTH_CREDENTIALS` | Yes | GCP からダウンロードした OAuth クライアント認証情報の JSON ファイルパス |
| `GOOGLE_OAUTH_TOKENS` | No | ユーザートークンの保存先パス（デフォルト: `./tokens.json`）。初回認証時に自動生成される |
| `GOOGLE_CALENDAR_PERMISSIONS` | No | パーミッション設定ファイルパス |

## Permissions

パーミッション設定ファイルで、操作タイプと参加者の条件に基づいて `allow` / `deny` を制御できます。

### 参加者の条件

| 条件 | 説明 |
|---|---|
| `self_only` | 参加者が自分のみ（または参加者なし） |
| `internal` | 他の参加者が全員 `internalDomain` に属する |
| `external` | `internalDomain` 外の参加者が含まれる |

### 設定例

```json
{
  "internalDomain": "example.com",
  "permissions": {
    "read": "allow",
    "create": "allow",
    "update": {
      "self_only": "allow",
      "internal": "allow",
      "external": "deny"
    },
    "delete": {
      "self_only": "allow",
      "internal": "allow",
      "external": "deny"
    }
  }
}
```

`read` / `create` は文字列で一括指定、`update` / `delete` は条件ごとに指定できます。

パーミッション設定ファイルが指定されない場合、全操作が `allow` になります。

## Tests

```bash
bun test
```

## License

ISC
