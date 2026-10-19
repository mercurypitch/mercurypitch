// ============================================================
// Lesson 5 recall — two questions from Lesson 3, asked afresh
// ============================================================
//
// Shown to everyone, because Lesson 3 is a prerequisite (WEB-SPEC, Toys 7;
// CURRICULUM § 3.3): Lesson 3's questions 3 and 4 under Lesson 3's ids. The
// kit's quiz runs them under their own id prefix and storage keys, with a
// seed of their own, and marks no lesson done; earlier answers are never
// shown, so the answers measure delayed retrieval. "Try Lesson 3, Step N
// again" opens Lesson 3's page at that step in a new tab, so the viewer
// keeps their place here. Neither question plays a sound.

import { createQuiz } from '@/features/lessons/kit/quiz'
import { RECALL_QUESTIONS, recallStepHref } from './quiz-questions'

export function initRecall(): void {
  createQuiz({
    questions: RECALL_QUESTIONS,
    keys: { seed: 'fyp-l05-recall-seed', record: 'fyp-l05-recall-v1' },
    prefix: 'rc-',
    away: { href: recallStepHref },
  })
}
