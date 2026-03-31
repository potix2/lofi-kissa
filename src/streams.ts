/**
 * Curated lofi stream pool.
 * Each stream has a weight that adjusts based on user feedback.
 *
 * Note: YouTube live stream URLs change over time.
 * To find current URLs: search YouTube for the channel and copy the live stream URL.
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
    id: 'lofi-girl-night',
    url: 'https://www.youtube.com/watch?v=Na0w3Mz46GA',
    title: 'lofi hip hop radio 💤 beats to sleep/chill to',
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
