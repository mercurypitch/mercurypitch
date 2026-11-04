// ============================================================
// Lesson 11 recall — two questions from Lesson 7, asked afresh
// ============================================================
//
// Shown to everyone, because Lesson 7 is this lesson's prerequisite
// (WEB-SPEC, Toys 5): Lesson 7's questions 1 and 4, the very objects its
// page asks, under their own ids (quiz-questions.ts). The kit's quiz runs
// them under its own id prefix and storage keys, with a seed of their own,
// and marks no lesson done; earlier answers are never shown, so the answers
// measure delayed retrieval. "Try Lesson 7, Step N again" opens Lesson 7's
// page at that step in a new tab, so the viewer keeps their place here, and
// where Lesson 7 is not live, as the page state says (kit/page-state.ts),
// the words stay and the link goes. Neither question plays a sound.

import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { RECALL_QUESTIONS } from './quiz-questions'

/** The recall's storage keys: a seed and a record of its own. */
export const RECALL_KEYS = {
  seed: 'fyp-l11-recall-seed',
  record: 'fyp-l11-recall-v1',
} as const

export function initRecall(): void {
  createQuiz({
    questions: RECALL_QUESTIONS,
    keys: RECALL_KEYS,
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
}
