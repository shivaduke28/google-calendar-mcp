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

#### バイナリ版（推奨）

バイナリと `credentials.json` を同じディレクトリに配置するだけで動きます。

```
some-folder/
├── google-calendar-mcp    ← バイナリ
├── credentials.json       ← GCP からダウンロードした認証情報
├── permissions.json       ← 初回起動時に自動生成
└── tokens.json            ← 初回認証時に自動生成
```

MCP クライアントの設定：

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "/path/to/google-calendar-mcp"
    }
  }
}
```

#### ソースから実行

```bash
bun install
```

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "bun",
      "args": ["run", "/path/to/google-calendar-mcp/src/index.ts"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/path/to/credentials.json"
      }
    }
  }
}
```

#### バイナリのビルド

```bash
bun build --compile src/index.ts --outfile google-calendar-mcp
```

### 3. 認証

初回起動時にブラウザが開き、Google アカウントでの認証を求められます。認証後、トークンが `tokens.json` に自動保存され、以降はブラウザ認証なしで起動できます。

## Environment Variables

すべて省略可能です。バイナリと同じディレクトリのファイルを自動検出します。

| 変数 | デフォルト | 説明 |
|---|---|---|
| `GOOGLE_OAUTH_CREDENTIALS` | `{バイナリDir}/credentials.json` | OAuth クライアント認証情報の JSON ファイルパス |
| `GOOGLE_OAUTH_TOKENS` | `{バイナリDir}/tokens.json` | ユーザートークンの保存先パス。初回認証時に自動生成 |
| `GOOGLE_CALENDAR_PERMISSIONS` | `{バイナリDir}/permissions.json` | パーミッション設定ファイルパス。存在しなければ自動生成 |

## Permissions

パーミッション設定ファイルで、操作タイプと参加者の条件に基づいて `allow` / `deny` を制御できます。

`permissions.json` が存在しない場合、以下のデフォルト設定で自動生成されます：

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

## Tests

```bash
bun test
```

## License

ISC
