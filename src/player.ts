import {
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import { VoiceBasedChannel } from 'discord.js';
import { spawn, execSync } from 'child_process';
import { getAllStreams, Stream, pickStream } from './streams.js';
import { sessionDb, recalcWeights, getWeight } from './db.js';

export interface NowPlaying {
  stream: Stream;
  sessionId: number;
  startedAt: number;
}

const players = new Map<string, AudioPlayer>(); // guildId → player
const nowPlaying = new Map<string, NowPlaying>(); // guildId → now playing

export async function startPlaying(channel: VoiceBasedChannel): Promise<NowPlaying> {
  const guildId = channel.guild.id;

  // Update weights from DB before picking (includes EXTRA_STREAMS from env)
  const streams = getAllStreams().map((s) => ({ ...s, weight: getWeight(s.id) }));
  const stream = pickStream(streams);

  // Join voice channel
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId,
    adapterCreator: channel.guild.voiceAdapterCreator as any,
  });

  // Create player
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    players.set(guildId, player);
  }

  connection.subscribe(player);

  // Resolve direct stream URL via yt-dlp, then pipe through ffmpeg
  console.log(`[player] starting: ${stream.title}`);

  // Build yt-dlp args
  const cookiesFile = process.env.COOKIES_FILE;
  const cookiesFlag = cookiesFile ? `--cookies "${cookiesFile}"` : '';
  // --playlist-random picks a random entry when the URL is a playlist
  const isPlaylist = stream.url.includes('playlist?list=') || stream.url.includes('/playlist/');
  const playlistFlag = isPlaylist ? '--playlist-random --playlist-items 1' : '';

  let directUrl: string;
  try {
    const ytdlpArgs = [
      '--js-runtimes', `node:${process.execPath}`,
      '-f', '91',          // lowest quality HLS (144p + audio)
      '--get-url', '--quiet',
      ...(cookiesFile ? ['--cookies', cookiesFile] : []),
      ...(isPlaylist ? ['--playlist-random', '--playlist-items', '1'] : []),
      stream.url,
    ];
    directUrl = execSync(`yt-dlp ${ytdlpArgs.map(a => `"${a}"`).join(' ')}`, { timeout: 30000 })
      .toString().trim().split('\n')[0]!;
    console.log(`[player] resolved URL (${directUrl.slice(0, 60)}...)`);
  } catch (e) {
    console.warn(`[player] yt-dlp failed for "${stream.title}", retrying with next stream...`);
    setTimeout(() => startPlaying(channel), 3000);
    return nowPlaying.get(guildId) ?? { stream, sessionId: -1, startedAt: Date.now() };
  }

  const ffmpegProcess = spawn('ffmpeg', [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', directUrl,
    '-vn',               // audio only
    '-f', 's16le',       // raw PCM
    '-ar', '48000',      // 48kHz
    '-ac', '2',          // stereo
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  ffmpegProcess.stderr?.on('data', (d: Buffer) => console.error(`[ffmpeg] ${d.toString().trim()}`));
  ffmpegProcess.on('error', (e) => console.error(`[player] ffmpeg error: ${e.message}`));
  ffmpegProcess.on('close', (code) => console.log(`[player] ffmpeg exited ${code}`));

  const resource = createAudioResource(ffmpegProcess.stdout!, {
    inputType: StreamType.Raw,
  });
  resource.playStream.on('error', (e) => console.error(`[player] audio resource error: ${e.message}`));

  player.play(resource);
  await entersState(player, AudioPlayerStatus.Playing, 10_000);

  const sessionId = sessionDb.start(stream.id);
  const entry: NowPlaying = { stream, sessionId, startedAt: Date.now() };
  nowPlaying.set(guildId, entry);

  // Auto-restart when stream ends
  player.once(AudioPlayerStatus.Idle, () => {
    const np = nowPlaying.get(guildId);
    if (np) {
      sessionDb.end(np.sessionId);
      recalcWeights(np.stream.id);
    }
    // Small delay then restart
    setTimeout(() => startPlaying(channel), 2000);
  });

  return entry;
}

export function stopPlaying(guildId: string): void {
  const np = nowPlaying.get(guildId);
  if (np) {
    sessionDb.end(np.sessionId);
    recalcWeights(np.stream.id);
    nowPlaying.delete(guildId);
  }
  const player = players.get(guildId);
  if (player) {
    player.stop();
    players.delete(guildId);
  }
  const connection = getVoiceConnection(guildId);
  connection?.destroy();
}

export function skipCurrent(guildId: string): void {
  const np = nowPlaying.get(guildId);
  if (np) {
    sessionDb.skip(np.sessionId);
    sessionDb.end(np.sessionId);
    recalcWeights(np.stream.id);
    nowPlaying.delete(guildId);
  }
  const player = players.get(guildId);
  player?.stop(); // triggers Idle → restarts
}

export function likeCurrent(guildId: string): void {
  const np = nowPlaying.get(guildId);
  if (np) sessionDb.like(np.sessionId);
}

export function getNowPlaying(guildId: string): NowPlaying | undefined {
  return nowPlaying.get(guildId);
}
