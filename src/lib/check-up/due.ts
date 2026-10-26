// ============================================================
// Weekly Check-up — when the next one is due, and when Home's card stays away
// ============================================================
//
// A Check-up is a guided voiceprint (docs/specs/weekly-check-up.ears.md): the
// Voice Mirror's run and onboarding's, the same three tasks every time. One is
// due once the newest take in the singer's history is a week old. With no
// take at all it is never due, because there is nothing yet to come back to.
//
// Small on purpose. Home reads it as it draws, to keep a slot for its card
// before the card's own chunk is in, so everything that only the card or the
// Mirror needs (the comparison, its words) lives in then-and-now.ts instead.
// The predicates are pure: the clock is passed in, so a test needs no fake
// timer.

/** A week, the interval between Check-ups. */
export const CHECKUP_INTERVAL_DAYS = 7
export const CHECKUP_INTERVAL_MS = CHECKUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000

/** From two weeks after the newest take, Home's card names its day instead
 *  of saying "a week". */
export const CHECKUP_NAME_THE_DAY_AFTER_MS = 2 * CHECKUP_INTERVAL_MS

/** Where Home keeps the last "Not this week", in epoch milliseconds. */
export const CHECKUP_CARD_DISMISSED_KEY = 'mercurypitch.checkup.notThisWeek.v1'

/** When a take was sung, in epoch milliseconds, or null when its date does not read. */
export function takenAtMs(take: { takenAt: string }): number | null {
  const ms = Date.parse(take.takenAt)
  return Number.isFinite(ms) ? ms : null
}

/** The newest take's time, or null when no take has a date that reads. */
export function newestTakeMs(
  takes: readonly { takenAt: string }[],
): number | null {
  let newest: number | null = null
  for (const take of takes) {
    const ms = takenAtMs(take)
    if (ms !== null && (newest === null || ms > newest)) newest = ms
  }
  return newest
}

/** Due when the newest take is a week old or more; never with no take. */
export function checkupDue(
  takes: readonly { takenAt: string }[],
  now: number,
): boolean {
  const newest = newestTakeMs(takes)
  return newest !== null && now - newest >= CHECKUP_INTERVAL_MS
}

/** "Not this week" holds for a week from the tap. */
export function cardDismissed(
  dismissedAt: number | null,
  now: number,
): boolean {
  return dismissedAt !== null && now - dismissedAt < CHECKUP_INTERVAL_MS
}

/** Which of its two wordings Home's card has for a newest take at `newest`:
 *  "A week since your last Check-up", or the day from two weeks on. Home's
 *  slot reads it too, since the two wrap at different widths. */
export function checkupCardWording(
  newest: number,
  now: number,
): 'week' | 'day' {
  return now - newest >= CHECKUP_NAME_THE_DAY_AFTER_MS ? 'day' : 'week'
}

/** Home's card shows when a Check-up is due and the card was not sent away this week. */
export function checkupCardShown(
  takes: readonly { takenAt: string }[],
  dismissedAt: number | null,
  now: number,
): boolean {
  return checkupDue(takes, now) && !cardDismissed(dismissedAt, now)
}

/** The stored "Not this week", or null when there is none or storage refuses. */
export function readCardDismissal(): number | null {
  try {
    const raw = localStorage.getItem(CHECKUP_CARD_DISMISSED_KEY)
    if (raw === null) return null
    const ms = Number(raw)
    return Number.isFinite(ms) ? ms : null
  } catch {
    return null
  }
}

/** Send the card away for a week. Blocked storage means it may come back
 *  on the next visit, which is the cheaper failure. */
export function dismissCheckupCard(now: number): void {
  try {
    localStorage.setItem(CHECKUP_CARD_DISMISSED_KEY, String(now))
  } catch {
    // Nothing to keep the dismissal in; the card stays away this visit.
  }
}
