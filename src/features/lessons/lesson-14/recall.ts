// ============================================================
// Lesson 14 recall — two questions from Lesson 5, asked afresh
// ============================================================
//
// Shown to everyone, because Lesson 5 is this lesson's prerequisite
// (WEB-SPEC, Toys 5): Lesson 5's questions 2 and 4, the very objects its
// page asks, under their own ids (quiz-questions.ts). The kit's quiz runs
// them under its own id prefix and storage keys, with a seed of their own,
// and marks no lesson done; earlier answers are never shown, so the answers
// measure delayed retrieval. "Try Lesson 5, Step N again" opens Lesson 5's
// page at that step in a new tab, so the viewer keeps their place here, and
// where Lesson 5 is not live, as the page state says (kit/page-state.ts),
// the words stay and the link goes. Neither question plays a sound.

import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { RECALL_QUESTIONS } from './quiz-questions'

export function initRecall(): void {
  createQuiz({
    questions: RECALL_QUESTIONS,
    keys: { seed: 'fyp-l14-recall-seed', record: 'fyp-l14-recall-v1' },
    prefix: 'rc-',
    away: { href: recallStepHref },
  })
}
