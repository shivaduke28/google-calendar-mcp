import { OAuth2Client } from "google-auth-library";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { exec } from "node:child_process";

interface OAuthCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface SavedTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export async function authorize(
  credentialsPath: string,
  tokensPath: string
): Promise<OAuth2Client> {
  const content = await readFile(credentialsPath, "utf-8");
  const credentials: OAuthCredentials = JSON.parse(content);
  const { client_id, client_secret } = credentials.installed;

  const oauth2Client = new OAuth2Client(
    client_id,
    client_secret,
    "http://localhost:3000/callback"
  );

  // 保存済みトークンがあれば読み込む
  try {
    const tokens = JSON.parse(await readFile(tokensPath, "utf-8")) as SavedTokens;
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  } catch {
    // トークンがなければブラウザ認証
  }

  const tokens = await authenticateWithBrowser(oauth2Client);
  await writeFile(tokensPath, JSON.stringify(tokens, null, 2));
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

function authenticateWithBrowser(
  oauth2Client: OAuth2Client
): Promise<SavedTokens> {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) return;

      const url = new URL(req.url, "http://localhost:3000");
      const code = url.searchParams.get("code");

      if (!code) {
        res.writeHead(400);
        res.end("No code received");
        reject(new Error("No authorization code received"));
        server.close();
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>認証成功！このタブを閉じてください。</h1>");
        resolve(tokens as SavedTokens);
      } catch (err) {
        res.writeHead(500);
        res.end("Token exchange failed");
        reject(err);
      } finally {
        server.close();
      }
    });

    server.listen(3000, () => {
      console.error(`\n認証が必要です。ブラウザを開きます...\n`);
      const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${command} '${authUrl}'`, (err) => {
        if (err) {
          console.error(`ブラウザの自動起動に失敗しました。以下のURLを手動で開いてください:\n${authUrl}\n`);
        }
      });
    });
  });
}
