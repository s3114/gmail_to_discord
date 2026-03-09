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

## 動作概要
- Gmail APIで `GMAIL_QUERY` に一致するメールを取得
- 本文テキスト先頭をDiscordへ送信
- 成功したメールのみ `UNREAD` ラベルを外して既読化
- `POLL_INTERVAL_SECONDS` ごとに繰り返し

## 注意
- 同じメールを再送しないために「送信成功後のみ既読化」しています。
- Discordの `content` は文字数制限があるため本文は短縮しています。
