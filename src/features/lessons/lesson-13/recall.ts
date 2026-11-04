// ============================================================
// Lesson 13 recall — two questions from Lesson 11, asked afresh
// ============================================================
//
// Shown to everyone, because Lesson 11 is this lesson's prerequisite
// (WEB-SPEC, Recall and quick check): Lesson 11's questions 1 and 2, under
// their own ids (quiz-questions.ts). The kit's quiz runs them under its own
// id prefix and storage keys, with a seed of their own, and marks no lesson
// done; earlier answers are never shown, so the answers measure delayed
// retrieval. "Try Lesson 11, Step N again" opens Lesson 11's page at that
// step in a new tab, so the viewer keeps their place here, and where Lesson
// 11 is not live, as the page state says (kit/page-state.ts), the words
// stay and the link goes. Neither question plays a sound.

import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { RECALL_QUESTIONS } from './quiz-questions'

export function initRecall(): void {
  createQuiz({
    questions: RECALL_QUESTIONS,
    keys: { seed: 'fyp-l13-recall-seed', record: 'fyp-l13-recall-v1' },
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
}
