// ============================================================
// Season fixtures — a lesson coming later, found rather than named
// ============================================================
//
// Many tests need a lesson whose page is not written yet. Naming one ties
// the test to the season as it stands, and the test breaks the day that
// lesson's page lands, though nothing it checks has changed. These tests
// ask the season for the first lesson with no page instead, as Lesson 9's
// spec asks of its own (WEB-SPEC Tests 12). Once every lesson in the season
// has a page, a test of a lesson coming later gives the season one for its
// length (`withNoPage`), as explorer.test.ts gives a lesson no drill; a
// browser test asks the page state to hold a lesson back instead, as
// learn-publish-state.spec.ts does, since a test's season never reaches the
// page it loads.

import type { Lesson } from './season'
import { LESSONS } from './season'

/**
 * The first lesson, the trailer left out, with no page yet and that also
 * passes `also`. Asked with no `also`, it is the season's first gap, so the
 * lesson before it has a page: tests that take `later.n - 1` as a lesson
 * with a page rely on that (next-card.test.ts, explorer-reveal.test.ts).
 * Throws when there is none, so a test whose example is gone fails by
 * saying so rather than by testing nothing.
 */
export function lessonWithNoPage(
  also: (L: Lesson) => boolean = () => true,
): Lesson {
  const waiting = LESSONS.filter((M) => M.n > 0 && M.page === undefined)
  if (waiting.length === 0)
    throw new Error(
      'Every lesson has a page now: give this test a lesson held back (publish.ts seasonFor) or retire it.',
    )
  const L = waiting.find(also)
  if (L === undefined)
    throw new Error(
      `No lesson without a page passes this test's own condition. Lessons with no page: ${waiting.map((M) => M.n).join(', ')}.`,
    )
  return L
}

/**
 * Runs `test` with the season's last lesson drawn as one not written yet,
 * its page and its reading time taken off its entry, and puts both back
 * after, whether the test passes or not (a promise's, once it settles).
 * `test` is given the season's first lesson with no page, which is that one
 * while the rest of the season has pages, so the lesson before it has a
 * page as `lessonWithNoPage` promises.
 */
export function withNoPage<T>(test: (later: Lesson) => T): T {
  const entry = LESSONS[LESSONS.length - 1] as {
    -readonly [K in keyof Lesson]: Lesson[K]
  }
  const { page, minutes } = entry
  delete entry.page
  delete entry.minutes
  const restore = (): void => {
    if (page !== undefined) entry.page = page
    if (minutes !== undefined) entry.minutes = minutes
  }
  let settled = true
  try {
    const out = test(lessonWithNoPage())
    if (out instanceof Promise) {
      settled = false
      return out.finally(restore) as T
    }
    return out
  } finally {
    if (settled) restore()
  }
}
