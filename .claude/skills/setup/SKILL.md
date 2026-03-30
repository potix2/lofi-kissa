---
name: setup
description: >
  lofi-kissaの初期セットアップ・起動前チェックを行う。
  インストール状況の確認、不足があれば案内、DiscordBot作成の誘導も実施する。
  Trigger words: セットアップ, 初期設定, 環境構築, setup, install, 動かしたい, 起動したい, 起動できない, preflight
---

# lofi-kissa セットアップ

## 手順

### 1. Preflight チェックを実行

```bash
bash .claude/skills/setup/preflight.sh
```

結果を確認し、❌ の項目を順番に対応する。

---

### 2. ❌ が出た場合の対処

#### Node.js が古い / 未インストール
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts && nvm use --lts
```

#### ffmpeg が未インストール
```bash
sudo apt install -y ffmpeg
```

#### yt-dlp が未インストール
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

#### .env が未設定
```bash
cp .env.example .env
# エディタで開いて DISCORD_TOKEN と OWNER_ID を記入
```

---

### 3. Discord Bot の作成（DISCORD_TOKEN が未取得の場合）

1. https://discord.com/developers/applications を開く
2. **New Application** → 名前（例: `lofi-kissa`）を入力
3. 左メニュー **Bot** → **Reset Token** → トークンをコピーして `.env` に記入
4. 同ページ **Privileged Gateway Intents** → **GUILD_VOICE_STATES** をON → Save
5. 左メニュー **OAuth2** → **URL Generator**
   - Scopes: `bot` + `applications.commands`
   - Bot Permissions: `Connect`, `Speak`, `Send Messages`, `Read Message History`
6. 生成されたURLをブラウザで開いてサーバーに招待

**OWNER_ID の確認方法**:
Discord 設定 → 詳細設定 → 開発者モードをON → 自分のアイコンを右クリック → 「ユーザーIDをコピー」

---

### 4. ビルド & 起動

```bash
npm install
npm run build
npm start
```

`☕ lofi-kissa ready` と表示されたら成功。
ボイスチャンネルに入ると自動で音楽が始まります。

---

### 5. 常駐設定（オプション）

```bash
npm install -g pm2
pm2 start dist/index.js --name lofi-kissa
pm2 save && pm2 startup
```
