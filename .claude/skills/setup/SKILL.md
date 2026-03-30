---
name: setup
description: >
  Initial setup of lofi-kissa on a new machine (WSL/Ubuntu).
  Installs system dependencies, configures .env, builds and starts the bot.
  Trigger words: セットアップ, 初期設定, 環境構築, setup, install, 動かしたい, 起動したい
---

# lofi-kissa セットアップ

## 1. システム依存のインストール

```bash
# ffmpeg（音声処理）
sudo apt install -y ffmpeg

# yt-dlp（YouTube音声取得）
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# バージョン確認
ffmpeg -version | head -1
yt-dlp --version
node --version  # 18以上であること
```

## 2. Node.js（18以上でなければ更新）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
```

## 3. .env の設定

```bash
cp .env.example .env
```

`.env` に以下を記入：

| 変数 | 取得方法 |
|---|---|
| `DISCORD_TOKEN` | Discord Developer Portal → アプリ → Bot → Reset Token |
| `OWNER_ID` | Discord 設定 → 詳細設定 → 開発者モードON → 自分を右クリック → ユーザーIDをコピー |

## 4. Discord Bot の設定（初回のみ）

Discord Developer Portal (https://discord.com/developers/applications) で：

1. New Application → 名前をつける
2. Bot → Reset Token でトークン取得
3. Privileged Gateway Intents → **GUILD_VOICE_STATES** をON
4. OAuth2 → URL Generator → scopes: `bot` + `applications.commands`
   → permissions: `Connect`, `Speak`, `Send Messages`, `Read Message History`
5. 生成されたURLでサーバーに招待

## 5. 依存インストール & ビルド & 起動

```bash
npm install
npm run build
npm start
```

起動後、ボイスチャンネルに入ると自動で音楽が流れます ☕

## 6. 常駐設定（オプション）

WSL上でバックグラウンド常駐させる場合：

```bash
# pm2でプロセス管理
npm install -g pm2
pm2 start dist/index.js --name lofi-kissa
pm2 save
pm2 startup  # 表示されたコマンドを実行
```

## トラブルシューティング

- **音が出ない**: `ffmpeg -version` と `yt-dlp --version` を確認
- **Bot がオンラインにならない**: `DISCORD_TOKEN` が正しいか確認
- **自動参加しない**: `OWNER_ID` がDiscordのユーザーID（18桁の数字）か確認
- **ストリームエラー**: `yt-dlp --update` で最新版に更新
