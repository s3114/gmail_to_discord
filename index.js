import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const {
  DISCORD_WEBHOOK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_USER_ID = "me",
  GMAIL_QUERY = "is:unread newer_than:10m",
  POLL_INTERVAL_SECONDS = "10",
  POLL_INTERVAL_MINUTES,
} = process.env;

const requiredEnv = [
  "DISCORD_WEBHOOK_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "http://localhost",
);

oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: "v1", auth: oauth2Client });
let hasSentAuthErrorNotification = false;

function decodeBase64Url(input) {
  if (!input) return "";
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function extractPlainBody(payload) {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const fromPart = extractPlainBody(part);
      if (fromPart) return fromPart;
    }
  }

  return "";
}

function truncateForDiscord(text, max = 1500) {
  if (!text) return "(本文なし)";
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max)}...`
    : normalized;
}

async function sendDiscordWebhook(content) {
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${body}`);
  }
}

function isInvalidGrantError(err) {
  const errText = String(err?.message ?? "");
  const causeText = String(err?.cause?.message ?? "");
  return errText.includes("invalid_grant") || causeText.includes("invalid_grant");
}

async function notifyOAuthReauthNeededOnce(err) {
  if (hasSentAuthErrorNotification) return;
  hasSentAuthErrorNotification = true;

  const message = [
    "<@&1508497554986242110>",
    "⚠️ **gmail_to_discord auth error**",
    "Google OAuth refresh failed (`invalid_grant`).",
    "Please run `npm run token` and update `GOOGLE_REFRESH_TOKEN` in `.env`.",
    "",
    `Time: ${new Date().toISOString()}`,
    `Detail: ${String(err?.message ?? "unknown error")}`,
  ].join("\n");

  try {
    await sendDiscordWebhook(message);
  } catch (notifyErr) {
    console.error("Failed to send auth error notification to Discord:", notifyErr?.message ?? notifyErr);
  }
}

async function processUnreadMessages() {
  const listRes = await gmail.users.messages.list({
    userId: GOOGLE_USER_ID,
    q: GMAIL_QUERY,
    maxResults: 20,
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) {
    console.log(`[${new Date().toISOString()}] No unread messages.`);
    return;
  }

  console.log(
    `[${new Date().toISOString()}] Found ${messages.length} unread message(s).`,
  );

  for (const msg of messages) {
    try {
      const detailRes = await gmail.users.messages.get({
        userId: GOOGLE_USER_ID,
        id: msg.id,
        format: "full",
      });

      const detail = detailRes.data;
      const headers = detail.payload?.headers ?? [];
      const subject =
        headers.find((h) => h.name?.toLowerCase() === "subject")?.value ??
        "(No Subject)";
      const from =
        headers.find((h) => h.name?.toLowerCase() === "from")?.value ??
        "(Unknown Sender)";
      const plainBody = extractPlainBody(detail.payload);
      const excerpt = truncateForDiscord(plainBody, 1200);

      const content = [
        "📩 **新着メール**",
        `**From**: ${from}`,
        `**Subject**: ${subject}`,
        "",
        "```",
        excerpt,
        "```",
      ].join("\n");

      await sendDiscordWebhook(content);

      await gmail.users.messages.modify({
        userId: GOOGLE_USER_ID,
        id: msg.id,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });

      console.log(`Notified and marked as read: ${msg.id}`);
    } catch (err) {
      console.error(`Failed to process message ${msg.id}:`, err.message);
    }
  }
}

async function main() {
  const intervalSeconds = POLL_INTERVAL_SECONDS
    ? Number(POLL_INTERVAL_SECONDS)
    : Number(POLL_INTERVAL_MINUTES) * 60;
  const intervalMs = intervalSeconds * 1000;

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("POLL_INTERVAL_SECONDS must be a positive number.");
  }

  await processUnreadMessages();

  setInterval(async () => {
    try {
      await processUnreadMessages();
    } catch (err) {
      if (isInvalidGrantError(err)) {
        await notifyOAuthReauthNeededOnce(err);
      }
      throw err;
    }
  }, intervalMs);

  console.log(
    `Watcher started. Query=\"${GMAIL_QUERY}\" interval=${intervalSeconds}s`,
  );
}

async function run() {
  try {
    await main();
  } catch (err) {
    const isInvalidGrant = isInvalidGrantError(err);

    if (isInvalidGrant) {
      await notifyOAuthReauthNeededOnce(err);
      console.error("");
      console.error("OAuth token refresh failed: invalid_grant");
      console.error("Please verify:");
      console.error("1) GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET match the same OAuth client used to issue the refresh token.");
      console.error("2) GOOGLE_REFRESH_TOKEN is valid (not revoked / not from another client).");
      console.error("3) OAuth consent screen is published, or your Google account is added as a test user.");
      console.error("4) .env values do not include extra spaces or quotes.");
      console.error("Run `npm run token` to issue a new refresh token if needed.");
      console.error("");
    }

    console.error(err);
    process.exit(1);
  }
}

run();
