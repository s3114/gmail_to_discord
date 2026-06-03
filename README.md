# Gmail unread -> Discord (Node.js)

GASの代わりにNode.jsで未読メールを監視し、Discord Webhookへ通知します。通知成功後にメールを既読化します。

## 1. 事前準備
1. Google Cloud Consoleでプロジェクト作成
2. Gmail APIを有効化
3. OAuth同意画面を作成（ExternalでもInternalでも可）
4. OAuth 2.0 クライアントIDを作成（Desktop app）
5. DiscordでWebhook URLを発行

## 2. セットアップ
```bash
npm install
copy .env.example .env
```

`.env` を編集:
- `DISCORD_WEBHOOK_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GMAIL_QUERY` (例: `is:unread newer_than:10m`)
- `POLL_INTERVAL_SECONDS` (例: `10`)

## 3. Refresh Tokenの取得
`GOOGLE_REFRESH_TOKEN` が必要です。付属スクリプトで取得できます。

```bash
npm run token
```

- 表示されたURLにアクセスして許可
- ターミナルに認可コードを貼り付け
- 出力された `GOOGLE_REFRESH_TOKEN=...` を `.env` に設定

> scopeは `gmail.modify` にすると、通知後に既読化できます。

## 4. 実行
```bash
npm start
```

## 複数アカウント・複数送信先
1つのプロセスで複数のGmailアカウントを監視できます。

`.env` の例:
```env
GOOGLE_CLIENT_ID=共通のOAuthクライアントID
GOOGLE_CLIENT_SECRET=共通のOAuthクライアントシークレット
POLL_INTERVAL_SECONDS=10

ACCOUNTS=MAIN,SECOND

MAIN_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
MAIN_GOOGLE_REFRESH_TOKEN=1つ目のRefresh Token
MAIN_GMAIL_QUERY=is:unread newer_than:10m

SECOND_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SECOND_GOOGLE_REFRESH_TOKEN=2つ目のRefresh Token
SECOND_GMAIL_QUERY=is:unread newer_than:10m
```

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` は共通で使えます。アカウントごとに別のOAuthクライアントを使う場合は、`MAIN_GOOGLE_CLIENT_ID` / `MAIN_GOOGLE_CLIENT_SECRET` のように個別指定もできます。

2つ目のRefresh Tokenを取得する場合:
```bash
npm run token -- --account SECOND
```

表示されたURLを、2つ目のGoogleアカウントで認可してください。出力された `SECOND_GOOGLE_REFRESH_TOKEN=...` を `.env` に設定します。

## 動作概要
- Gmail APIで `GMAIL_QUERY` に一致するメールを取得
- 本文テキスト先頭をDiscordへ送信
- 成功したメールのみ `UNREAD` ラベルを外して既読化
- `POLL_INTERVAL_SECONDS` ごとに繰り返し

## 注意
- 同じメールを再送しないために「送信成功後のみ既読化」しています。
- Discordの `content` は文字数制限があるため本文は短縮しています。

## Refresh Tokenが約7日で切れる場合
Google Cloud ConsoleのOAuth同意画面が `External` かつ公開ステータス `Testing` の場合、Gmailなどのスコープで発行したRefresh Tokenは約7日で失効します。

恒久対応:
1. Google Cloud Consoleを開く
2. `APIs & Services` -> `OAuth consent screen` を開く
3. 公開ステータスを `Testing` から `In production` に変更する
4. その後、`npm run token` でRefresh Tokenを取り直す
5. 出力された `GOOGLE_REFRESH_TOKEN=...` を `.env` に設定し直す

個人利用で自分のGmailだけを読む用途なら、通常は公開ステータスを本番にしても一般公開アプリとして配布する必要はありません。ただし、権限画面に未確認アプリの警告が出ることがあります。

それでも切れる場合は、Google側でアクセスを取り消した、6か月以上使っていない、Googleアカウントのパスワードを変更した、同じOAuthクライアントでRefresh Tokenを作りすぎた、などの理由でも `invalid_grant` になります。
