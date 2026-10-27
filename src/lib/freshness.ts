/**
 * List freshness and correction links (Murphy + Baer: keep the list right, make it easy to fix).
 * Pure functions so tests can pin the date math.
 */
export const STALE_AFTER_DAYS = 14;
export const CHANGE_EMAIL = "hello@helpgetup.com";

/** True when the list's oldest "checked" date is more than STALE_AFTER_DAYS days before `now`. */
export function isListStale(checkedOn: string, now: Date = new Date(), days: number = STALE_AFTER_DAYS): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) return false;
  const [y, m, d] = checkedOn.split("-").map(Number);
  const checked = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return (today - checked) / 86_400_000 > days;
}

/** mailto link for "Report a change" on one stop. Body stays in English so the inbox reads one way. */
export function reportChangeHref(stopName: string): string {
  const subject = `Change for ${stopName}`;
  const body = "What changed (hours, address, rules):\n";
  return `mailto:${CHANGE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
