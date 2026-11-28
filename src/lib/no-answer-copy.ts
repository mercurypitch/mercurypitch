// ============================================================
// No answer — what a person reads when our servers did not answer
// ============================================================
//
// fetchWithDeadline (src/db/api-fetch.ts) ends a call that got no answer by
// its deadline with an ApiDeadlineError, and refuses one made while the API
// is out of reach with an ApiUnreachableError. Their messages are written for
// the console: an address and a number of milliseconds. Shown as they were, a
// stem split ended in "Splitting the instrumental failed: No answer from
// https://… within 15000 ms" (28 Nov 2026).
//
// So a surface that shows a failure to a person asks here first. The errors
// are known by name, as isNetworkError knows them (global-error-handler.ts):
// this module imports nothing, so it adds no other module to a page.

/** What a person reads when one of our servers did not answer. */
export const NO_ANSWER_TEXT =
  "Couldn't reach Mercury Pitch's servers. Check your connection and try again."

/**
 * Whether a failure is a call to our servers that got no answer by its
 * deadline, or one not sent because a recent call got none.
 */
export function isNoAnswer(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ApiDeadlineError' || error.name === 'ApiUnreachableError')
  )
}

/**
 * The text to show for a failure: NO_ANSWER_TEXT when our servers did not
 * answer, the error's own message otherwise, and `fallback` when it has none.
 */
export function failureText(error: unknown, fallback: string): string {
  if (isNoAnswer(error)) return NO_ANSWER_TEXT
  if (error instanceof Error && error.message !== '') return error.message
  return fallback
}
