/**
 * Chad's golden rule (Oct 22, 2026): a spoken 518 (the area name or in a phone number) is always
 * "five-one-eight", never "five eighteen". Port of royalty/say518.py. Applied only to text the voice
 * speaks (scripted lines); never to stored data or alerts. Server-only (uses regex lookbehind).
 *
 *   say518("Call (518) 555-0142") -> "Call five-one-eight, five five five, zero one four two"
 *   say518("the 518")             -> "the five-one-eight"
 */
export const FIVE_ONE_EIGHT = "five-one-eight";

const W = "zero one two three four five six seven eight nine".split(" ");

// A US number with the 518 area code: (518) 555-0142, 518-555-0142, 518.555.0142, 518 555 0142, +1 518..., 5185550142
const PHONE_518 =
  /(?<!\d)(?:\+?1[\s.-]?)?\(?518\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/g;
const SPACED_518 = /(?<!\d)5[ .-]1[ .-]8(?!\d)/g; // "5 1 8"
const BARE_518 = /(?<![\d.,])518(?!\d|,\d{3})/g; // "the 518"; not 5,518 or 1518 or 518,000

function digits(s: string): string {
  return [...s].map((c) => W[Number(c)]).join(" ");
}

export function say518(text: string): string {
  return text
    .replace(
      PHONE_518,
      (_m, a: string, b: string) =>
        `${FIVE_ONE_EIGHT}, ${digits(a)}, ${digits(b)}`,
    )
    .replace(SPACED_518, FIVE_ONE_EIGHT)
    .replace(BARE_518, FIVE_ONE_EIGHT);
}

/**
 * xAI `replace` map (audio-only pronunciation fix, applied before TTS, whole-word, case-insensitive).
 * Backs up the instruction-level rule for anything the model says itself.
 */
export const REPLACE_518: Record<string, string> = { "518": FIVE_ONE_EIGHT };
