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
import { spawn } from 'child_process';
import { STREAMS, Stream, pickStream } from './streams.js';
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

  // Update weights from DB before picking
  const streams = STREAMS.map((s) => ({ ...s, weight: getWeight(s.id) }));
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

  // Stream audio via yt-dlp
  console.log(`[player] starting: ${stream.title}`);
  const ytdlProcess = spawn('yt-dlp', [
    stream.url,
    '-f', 'bestaudio',
    '-o', '-',
    '--quiet',
    '--no-warnings',
    '--js-runtimes', 'nodejs',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  // If yt-dlp fails, retry with next stream after short delay
  ytdlProcess.on('error', (e) => console.error(`[player] yt-dlp error: ${e.message}`));
  ytdlProcess.on('close', (code) => {
    if (code !== 0) {
      console.warn(`[player] yt-dlp exited ${code} for "${stream.title}", retrying with next stream...`);
      setTimeout(() => startPlaying(channel), 3000);
    }
  });

  const resource = createAudioResource(ytdlProcess.stdout!, {
    inputType: StreamType.Arbitrary,
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
