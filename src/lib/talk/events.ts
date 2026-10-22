/** Talk button events counted by /api/t (same plumbing as albanyaiguy.com, no Meta Pixel, no sales events). */
export const EVENTS = [
  "talk_press",
  "mic_denied",
  "session_connected",
  "session_length",
  "session_error",
] as const;
export type TalkEvent = (typeof EVENTS)[number];

export const LENGTH_BUCKETS = ["lt30s", "30-60s", "1-2m", "2-4m", "4m+"] as const;
