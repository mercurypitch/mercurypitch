// ============================================================
// Season fixtures — a lesson coming later, found rather than named
// ============================================================
//
// Many tests need a lesson whose page is not written yet. Naming one ties
// the test to the season as it stands, and the test breaks the day that
// lesson's page lands, though nothing it checks has changed. These tests
// ask the season for the first lesson with no page instead, as Lesson 9's
// spec asks of its own (WEB-SPEC Tests 12).

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
