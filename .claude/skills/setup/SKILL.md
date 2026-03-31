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

---

### 6. YouTube Premium プレイリストの再生（オプション）

YouTube Premium コンテンツやメンバー限定動画を再生するには、ブラウザの Cookie を yt-dlp に渡す必要があります。

#### cookies.txt のエクスポート

**Chrome / Edge の場合（拡張機能使用）**:
1. Chrome ウェブストアで [**Get cookies.txt LOCALLY**](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) をインストール
2. YouTube (https://www.youtube.com) を開いてログイン済みであることを確認
3. 拡張機能アイコンをクリック → **Export** → `cookies.txt` を安全な場所に保存
   ```bash
   # 例: WSL の場合
   mkdir -p ~/.config/lofi-kissa
   cp /mnt/c/Users/<username>/Downloads/cookies.txt ~/.config/lofi-kissa/cookies.txt
   chmod 600 ~/.config/lofi-kissa/cookies.txt
   ```

**Firefox の場合**:
```bash
# yt-dlp 内蔵のブラウザ Cookie 取得（Firefox が起動していないこと）
yt-dlp --cookies-from-browser firefox --get-url "https://www.youtube.com/watch?v=test"
# または Firefox アドオン "cookies.txt" で手動エクスポート
```

#### .env の設定

```bash
# .env に追記
COOKIES_FILE=/home/<user>/.config/lofi-kissa/cookies.txt

# プレイリスト URL を追加（カンマ区切りで複数指定可）
EXTRA_STREAMS=https://www.youtube.com/playlist?list=PLxxxxxx
EXTRA_STREAM_TITLES=My Premium Lofi Playlist
```

#### 動作確認

```bash
# cookies を使って URL が解決できるか確認
yt-dlp --cookies ~/.config/lofi-kissa/cookies.txt \
  --get-url --quiet --playlist-random --playlist-items 1 \
  "https://www.youtube.com/playlist?list=PLxxxxxx"
# → CDN URL が返れば OK
```

> ⚠️ **セキュリティ注意**: `cookies.txt` はアカウントへのアクセス権を含みます。
> - `.gitignore` に追加されていることを確認（デフォルトで除外済み）
> - 他者と共有しない
> - 定期的にブラウザでログアウト→再ログインして更新する
