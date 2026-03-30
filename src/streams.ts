/**
 * Curated lofi stream pool.
 * Each stream has a weight that adjusts based on user feedback.
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
    title: 'lofi hip hop radio • beats to relax/study to',
    weight: 1.0,
  },
  {
    id: 'lofi-girl-night',
    url: 'https://www.youtube.com/watch?v=rUxyKA_-grg',
    title: 'lofi hip hop radio • beats to sleep/chill to',
    weight: 1.0,
  },
  {
    id: 'chillhop',
    url: 'https://www.youtube.com/watch?v=7NOSDKb0HlU',
    title: 'Chillhop Radio – jazzy lofi beats',
    weight: 1.0,
  },
  {
    id: 'lofi-cafe',
    url: 'https://www.youtube.com/watch?v=lP9bMzVyMC4',
    title: 'Coffee Shop Radio – lofi hip hop beats',
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
