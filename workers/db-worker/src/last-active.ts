// ── Last-active tracking: pure, dependency-free helper ───────────────
// No D1 / auth / Env imports, so this is importable by the frontend test
// suite (src/tests/last-active.test.ts) as well as the worker. The actual
// database write lives in auth.ts (getAuth); only the throttle *decision*
// lives here so it can be unit tested without D1.

/**
 * How often a user's `lastActiveAt` is refreshed. Ongoing site visits are
 * tracked without multiplying D1 writes — at most one write per user per
 * window, however many authenticated requests they make in between.
 */
export const ACTIVE_THROTTLE_MS = 15 * 60 * 1000

/**
 * Whether `lastActiveAt` should be refreshed now. True when it has never been
 * set (null/undefined), is unparseable, or is older than the throttle window;
 * false while still inside the window. Treating an unparseable value as "touch
 * now" self-heals a bad timestamp instead of freezing updates forever.
 */
export function shouldTouchLastActive(
  lastActiveAt: string | null | undefined,
  nowMs: number,
  throttleMs: number = ACTIVE_THROTTLE_MS,
): boolean {
  if (!lastActiveAt) return true
  const last = new Date(lastActiveAt).getTime()
  if (Number.isNaN(last)) return true
  return nowMs - last > throttleMs
}
