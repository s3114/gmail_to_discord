import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "http://localhost"
);

const scopes = ["https://www.googleapis.com/auth/gmail.modify"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
  prompt: "consent",
});

console.log("Open this URL in your browser and authorize:");
console.log(authUrl);

const rl = readline.createInterface({ input, output });
const code = await rl.question("Paste the authorization code here: ");
rl.close();

const { tokens } = await oauth2Client.getToken(code.trim());

console.log("\nTokens received:");
console.log(JSON.stringify(tokens, null, 2));
console.log("\nSet this in .env:");
console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token ?? "<no refresh_token returned>"}`);