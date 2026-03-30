# lofi-kissa ☕

> A personal lofi Discord bot — like walking into your own café.

No commands. No menus. Just join a voice channel and the music starts.
Leave and it stops. The bot quietly learns what you like.

## Setup

```bash
cp .env.example .env
# Fill in DISCORD_TOKEN and OWNER_ID

npm install
npm run build
npm start
```

## How it works

- **Auto-play**: Bot joins your voice channel automatically when you do
- **Now playing card**: Shows current stream with ❤️ / ⏭️ buttons
- **Silent learning**: Listening time, likes, and skips adjust future picks
- **No selection needed**: The café picks the vibe for you

## Requirements

- Node.js 18+
- ffmpeg (`sudo apt install ffmpeg` on WSL/Ubuntu)
- Discord bot with `GUILD_VOICE_STATES` intent enabled
