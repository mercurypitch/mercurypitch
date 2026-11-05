// ============================================================
// Lesson 8 recall — two questions from Lesson 6, asked afresh
// ============================================================
//
// Lesson 3's recall with Lesson 6 for Lesson 2 (WEB-SPEC, Toys 7): open
// only for a viewer who has marked Lesson 6 done (`Done.has(6)`); anyone
// else sees the closed line "Done Lesson 6? Two questions from it", which
// opens the same two. The kit's quiz runs it under its own id prefix and
// storage keys, with a seed of its own, and marks no lesson done; its step
// links open Lesson 6's page at the step, in a new tab. Question 1's Play
// is Lesson 6's own, played by Lesson 6's quiz plays on this quiz's host.
//
// The section sits in a `data-if-live="6"` wrapper, which the site worker,
// or the page state as the page boots, takes out where Lesson 6 is not
// live; so this runs after the masthead has settled the page, and does
// nothing when the section is gone.
//
// It asks Lesson 6's questions 1 and 4, the very objects Lesson 6's page
// asks, under their ids `l06-q1` and `l06-q4` (FACTS 3). The kit's quiz
// turns their "Try Step 3 again" into "Try Lesson 6, Step 3 again", a link
// to Lesson 6's page at that step in a new tab (WEB-SPEC, Toys 7). They are
// taken here, not in quiz-questions.ts, so a page that asks Lesson 8's own
// questions again (Lesson 17's recall) loads none of Lesson 6's, and the
// chunks the other lessons share keep their modules and their stylesheets.

import { q } from '@/features/lessons/kit/dom'
import { Done } from '@/features/lessons/kit/progress'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { bindQuizPlays as bindLesson6Plays } from '@/features/lessons/lesson-06/quiz-play'
import { QUIZ_QUESTIONS as LESSON_6_QUESTIONS } from '@/features/lessons/lesson-06/quiz-questions'

/** The recall's two questions, Lesson 6's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_6_QUESTIONS.filter((q) => q.id === 'l06-q1' || q.id === 'l06-q4')

export function initRecall(): void {
  if (document.getElementById('recall') === null) return
  const box = q<HTMLDetailsElement>('#recallBox')
  box.open = Done.has(6)
  Done.subscribe(() => {
    if (Done.has(6)) box.open = true
  })
  const quiz = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: { seed: 'fyp-l08-recall-seed', record: 'fyp-l08-recall-v1' },
    prefix: 'rc-',
    // "Try Lesson 6, Step 3 again" opens Lesson 6's page at Step 3
    away: { href: recallStepHref },
  })
  bindLesson6Plays(quiz.host)
}
