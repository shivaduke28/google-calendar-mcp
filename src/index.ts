import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { authorize } from "./auth.js";
import { google } from "googleapis";

// 環境変数から設定を読む
const credentialsPath = process.env.GOOGLE_OAUTH_CREDENTIALS;
const tokensPath = process.env.GOOGLE_OAUTH_TOKENS ?? "./tokens.json";

if (!credentialsPath) {
  console.error("GOOGLE_OAUTH_CREDENTIALS 環境変数を設定してください");
  process.exit(1);
}

// OAuth2認証
const auth = await authorize(credentialsPath, tokensPath);
const calendar = google.calendar({ version: "v3", auth });

const server = new McpServer({
  name: "google-calendar-mcp",
  version: "0.1.0",
});

server.registerTool(
  "get-current-time",
  {
    description: "現在の日時を取得する",
    inputSchema: {
      timeZone: z.string().optional().describe("IANAタイムゾーン（例: Asia/Tokyo）"),
    },
  },
  async ({ timeZone }) => {
    const tz = timeZone ?? "Asia/Tokyo";
    const now = new Date().toLocaleString("ja-JP", { timeZone: tz });
    return {
      content: [{ type: "text", text: `現在時刻 (${tz}): ${now}` }],
    };
  }
);

server.registerTool(
  "list-events",
  {
    description: "カレンダーのイベント一覧を取得する",
    inputSchema: {
      calendarId: z.string().default("primary").describe("カレンダーID（デフォルト: primary）"),
      timeMin: z.string().optional().describe("開始日時（ISO 8601）"),
      timeMax: z.string().optional().describe("終了日時（ISO 8601）"),
      maxResults: z.number().optional().default(10).describe("最大取得件数"),
    },
  },
  async ({ calendarId, timeMin, timeMax, maxResults }) => {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin ?? new Date().toISOString(),
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items ?? [];
    const formatted = events.map((e) => {
      const start = e.start?.dateTime ?? e.start?.date ?? "";
      const end = e.end?.dateTime ?? e.end?.date ?? "";
      return `- ${e.summary ?? "(無題)"} | ${start} → ${end}`;
    });

    return {
      content: [{
        type: "text",
        text: formatted.length > 0
          ? formatted.join("\n")
          : "イベントが見つかりませんでした",
      }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
