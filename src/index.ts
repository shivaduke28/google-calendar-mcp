import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { encode } from "@toon-format/toon";
import { authorize } from "./auth.js";
import { calendar as googleCalendar } from "@googleapis/calendar";
import { loadPermissionConfig, checkPermission, denyMessage, PermissionAction, OperationType } from "./permissions.js";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

// バイナリと同じディレクトリをデフォルトのベースパスにする
// 環境変数が設定されていればそちらを優先する
const baseDir = dirname(process.execPath);
const credentialsPath = process.env.GOOGLE_OAUTH_CREDENTIALS ?? resolve(baseDir, "credentials.json");
const tokensPath = process.env.GOOGLE_OAUTH_TOKENS ?? resolve(baseDir, "tokens.json");
const permissionConfigPath = process.env.GOOGLE_CALENDAR_PERMISSIONS ?? resolve(baseDir, "permissions.json");

if (!existsSync(credentialsPath)) {
  console.error(`credentials.json が見つかりません: ${credentialsPath}`);
  console.error("GOOGLE_OAUTH_CREDENTIALS 環境変数を設定するか、バイナリと同じディレクトリに credentials.json を配置してください");
  process.exit(1);
}

// OAuth2認証
const auth = await authorize(credentialsPath, tokensPath);
const cal = googleCalendar({ version: "v3", auth });

// パーミッション設定
const permConfig = await loadPermissionConfig(permissionConfigPath);

// 認証ユーザーのメールアドレスを取得
let selfEmail = "";
try {
  const me = await cal.calendarList.get({ calendarId: "primary" });
  selfEmail = me.data.id ?? "";
} catch {
  console.error("認証ユーザーのメールアドレスの取得に失敗しました");
}

const server = new McpServer({
  name: "google-calendar-mcp",
  version: "0.2.1",
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
        const res = await cal.events.list({
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

server.registerTool(
  "create-event",
  {
    description: "カレンダーイベントを作成する。",
    inputSchema: {
      calendarId: z.string().describe("カレンダーID。自分のカレンダーは \"primary\""),
      summary: z.string().describe("イベントのタイトル"),
      start: z.string().describe("開始日時（ISO 8601）"),
      end: z.string().describe("終了日時（ISO 8601）"),
      description: z.string().optional().describe("説明"),
      location: z.string().optional().describe("場所"),
      attendees: z.array(z.string()).optional().describe("ゲストのメールアドレスの配列"),
    },
  },
  async ({ calendarId, summary, start, end, description, location, attendees }) => {
    const { action, condition } = checkPermission(permConfig, OperationType.Create, attendees ?? [], selfEmail);

    if (action === PermissionAction.Deny) {
      return {
        content: [{ type: "text", text: denyMessage(OperationType.Create, condition) }],
        isError: true,
      };
    }

    const event = await cal.events.insert({
      calendarId,
      requestBody: {
        summary,
        start: { dateTime: start, timeZone: "Asia/Tokyo" },
        end: { dateTime: end, timeZone: "Asia/Tokyo" },
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(attendees !== undefined && { attendees: attendees.map((email) => ({ email })) }),
      },
    });

    return {
      content: [{
        type: "text",
        text: `イベントを作成しました: ${event.data.summary ?? "(無題)"} (ID: ${event.data.id})`,
      }],
    };
  }
);

server.registerTool(
  "update-event",
  {
    description: "カレンダーイベントを更新する。変更したいフィールドのみ指定する。",
    inputSchema: {
      calendarId: z.string().describe("カレンダーID。自分のカレンダーは \"primary\""),
      eventId: z.string().describe("更新するイベントのID"),
      summary: z.string().optional().describe("新しいタイトル"),
      start: z.string().optional().describe("新しい開始日時（ISO 8601）"),
      end: z.string().optional().describe("新しい終了日時（ISO 8601）"),
      description: z.string().optional().describe("新しい説明"),
      location: z.string().optional().describe("新しい場所"),
      attendees: z.array(z.string()).optional().describe("新しいゲストのメールアドレスの配列（指定すると既存のゲストを置き換える）"),
    },
  },
  async ({ calendarId, eventId, summary, start, end, description, location, attendees: newAttendees }) => {
    // 既存のイベントを取得してパーミッションチェック
    const existing = await cal.events.get({ calendarId, eventId });
    const existingAttendees = (existing.data.attendees ?? [])
      .map((a) => a.email)
      .filter((e): e is string => Boolean(e));

    const { action, condition } = checkPermission(permConfig, OperationType.Update, existingAttendees, selfEmail);

    if (action === PermissionAction.Deny) {
      return {
        content: [{ type: "text", text: denyMessage(OperationType.Update, condition) }],
        isError: true,
      };
    }

    const patch: Record<string, unknown> = {};
    if (summary !== undefined) patch.summary = summary;
    if (description !== undefined) patch.description = description;
    if (location !== undefined) patch.location = location;
    if (start !== undefined) patch.start = { dateTime: start, timeZone: "Asia/Tokyo" };
    if (end !== undefined) patch.end = { dateTime: end, timeZone: "Asia/Tokyo" };
    if (newAttendees !== undefined) patch.attendees = newAttendees.map((email) => ({ email }));

    const updated = await cal.events.patch({
      calendarId,
      eventId,
      requestBody: patch,
    });

    return {
      content: [{
        type: "text",
        text: `イベントを更新しました: ${updated.data.summary ?? "(無題)"}`,
      }],
    };
  }
);

server.registerTool(
  "delete-event",
  {
    description: "カレンダーイベントを削除する。",
    inputSchema: {
      calendarId: z.string().describe("カレンダーID。自分のカレンダーは \"primary\""),
      eventId: z.string().describe("削除するイベントのID"),
    },
  },
  async ({ calendarId, eventId }) => {
    // 既存のイベントを取得してパーミッションチェック
    const existing = await cal.events.get({ calendarId, eventId });
    const attendees = (existing.data.attendees ?? [])
      .map((a) => a.email)
      .filter((e): e is string => Boolean(e));

    const { action, condition } = checkPermission(permConfig, OperationType.Delete, attendees, selfEmail);

    if (action === PermissionAction.Deny) {
      return {
        content: [{ type: "text", text: denyMessage(OperationType.Delete, condition) }],
        isError: true,
      };
    }

    await cal.events.delete({ calendarId, eventId });

    return {
      content: [{
        type: "text",
        text: `イベント「${existing.data.summary ?? "(無題)"}」を削除しました。`,
      }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
