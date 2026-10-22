/**
 * Spoken forms for the voice, browser-safe (no regex lookbehind, so old Safari can parse it).
 * Chad's rule: a 518 area code is always "five-one-eight", never "five eighteen"; every other digit is
 * read one at a time. The xAI `replace` map ({518: five-one-eight}) backs this up in audio, but phone
 * numbers in tool results and instructions are pre-spoken here so a hyphenated 518-447-7177 can't slip.
 */

export const FIVE_ONE_EIGHT_WORDS = "five-one-eight";

const W = "zero one two three four five six seven eight nine".split(" ");

export function digitsSpoken(s: string): string {
  return [...s.replace(/\D/g, "")].map((c) => W[Number(c)]).join(" ");
}

/**
 * "(518) 463-1516 ext 110" -> "five-one-eight, four six three, one five one six, extension one one zero"
 * "518-458-1167, press 1"   -> "five-one-eight, four five eight, one one six seven, then press one"
 * Anything that isn't a 10-digit US number is returned unchanged.
 */
export function spokenPhone(raw: string): string {
  const m = raw.match(
    /^\s*(?:\+?1[\s.-]*)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})(.*)$/,
  );
  if (!m) return raw;
  const [, area, mid, last, rest] = m;
  const areaSaid = area === "518" ? FIVE_ONE_EIGHT_WORDS : digitsSpoken(area);
  let out = `${areaSaid}, ${digitsSpoken(mid)}, ${digitsSpoken(last)}`;
  const ext = rest.match(/(?:ext\.?|extension|x)\s*(\d+)/i)?.[1];
  const press = rest.match(/press\s*(\d)/i)?.[1];
  if (ext) out += `, extension ${digitsSpoken(ext)}`;
  else if (press) out += `, then press ${digitsSpoken(press)}`;
  return out;
}

/** Every US phone number inside a sentence, spoken (extensions like "x 111" or "ext 110" included). */
const PHONE_IN_TEXT =
  /(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b(?:\s*(?:ext\.?|extension|x)\s*\d+)?/gi;

export function speakPhonesIn(text: string): string {
  return text.replace(PHONE_IN_TEXT, (m) => spokenPhone(m));
}
