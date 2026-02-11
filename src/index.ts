import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { encode } from "@toon-format/toon";
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
    description: "1人または複数人のカレンダーのイベント一覧を取得する。レスポンスはTOON形式で返す。",
    inputSchema: {
      calendarIds: z.array(z.string()).describe("カレンダーID（メールアドレス）の配列。自分のカレンダーは \"primary\""),
      timeMin: z.string().describe("開始日時（ISO 8601）"),
      timeMax: z.string().describe("終了日時（ISO 8601）"),
      maxResults: z.number().optional().default(20).describe("カレンダーごとの最大取得件数"),
    },
  },
  async ({ calendarIds, timeMin, timeMax, maxResults }) => {
    const rows: { date: string; calendar: string; id: string; summary: string; start: string; end: string; attendees: string }[] = [];

    for (const calendarId of calendarIds) {
      try {
        const res = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
        });

        for (const e of res.data.items ?? []) {
          const startDt = e.start?.dateTime ? new Date(e.start.dateTime) : null;
          const endDt = e.end?.dateTime ? new Date(e.end.dateTime) : null;
          const isAllDay = !e.start?.dateTime;

          rows.push({
            date: isAllDay
              ? (e.start?.date ?? "")
              : (startDt?.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) ?? ""),
            calendar: calendarId,
            id: e.id ?? "",
            summary: e.summary ?? "(無題)",
            start: isAllDay ? "終日" : (startDt?.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }) ?? ""),
            end: isAllDay ? "" : (endDt?.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }) ?? ""),
            attendees: (e.attendees ?? []).map((a) => a.email).filter(Boolean).join(";"),
          });
        }
      } catch {
        rows.push({
          date: "",
          calendar: calendarId,
          id: "",
          summary: "(アクセス権限がありません)",
          start: "",
          end: "",
          attendees: "",
        });
      }
    }

    return {
      content: [{
        type: "text",
        text: rows.length > 0
          ? encode({ events: rows })
          : "イベントが見つかりませんでした",
      }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
