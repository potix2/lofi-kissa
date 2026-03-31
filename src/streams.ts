/**
 * Curated lofi stream pool.
 * Each stream has a weight that adjusts based on user feedback.
 *
 * Note: YouTube live stream URLs change over time.
 * To verify a stream is live: yt-dlp --get-url <url>
 */
export interface Stream {
  id: string;
  url: string;
  title: string;
  weight: number; // higher = more likely to play
}

export const STREAMS: Stream[] = [
  {
    id: 'lofi-girl',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    title: 'lofi hip hop radio 📚 beats to relax/study to',
    weight: 1.0,
  },
  {
    id: 'chillhop',
    url: 'https://www.youtube.com/watch?v=5yx6BWlEVcY',
    title: 'Chillhop Radio – jazzy & lofi hip hop beats',
    weight: 1.0,
  },
];

/**
 * Load extra streams from environment variables.
 *
 * EXTRA_STREAMS   : comma-separated list of YouTube URLs (videos or playlists)
 * EXTRA_STREAM_TITLES : optional comma-separated titles matching each URL
 *
 * Example .env:
 *   EXTRA_STREAMS=https://www.youtube.com/playlist?list=PLxxxxxx,https://www.youtube.com/watch?v=yyyy
 *   EXTRA_STREAM_TITLES=My Premium Playlist,Favorite Track
 */
export function loadExtraStreams(): Stream[] {
  const raw = process.env.EXTRA_STREAMS ?? '';
  if (!raw.trim()) return [];

  const urls = raw.split(',').map((u) => u.trim()).filter(Boolean);
  const titlesRaw = process.env.EXTRA_STREAM_TITLES ?? '';
  const titles = titlesRaw.split(',').map((t) => t.trim());

  return urls.map((url, i) => ({
    id: `extra-${i}`,
    url,
    title: titles[i] || `Extra Stream ${i + 1}`,
    weight: 1.0,
  }));
}

/**
 * Return all streams: built-in defaults + env-configured extras.
 */
export function getAllStreams(): Stream[] {
  return [...STREAMS, ...loadExtraStreams()];
}

/**
 * Pick a stream using weighted random selection.
 */
export function pickStream(streams: Stream[]): Stream {
  const total = streams.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const stream of streams) {
    r -= stream.weight;
    if (r <= 0) return stream;
  }
  return streams[streams.length - 1]!;
}
