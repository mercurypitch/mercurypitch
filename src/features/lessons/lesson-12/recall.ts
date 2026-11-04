// ============================================================
// Lesson 12 recall — two questions from Lesson 10, asked afresh
// ============================================================
//
// Shown to everyone, because Lesson 10 is this lesson's prerequisite
// (WEB-SPEC, Toys 8; FACTS 7): Lesson 10's questions 1 and 2, under their
// own ids (quiz-questions.ts). The kit's quiz runs them under its own id
// prefix and storage keys, with a seed of their own, and marks no lesson
// done; earlier answers are never shown, so the answers measure delayed
// retrieval. "Try Lesson 10, Step N again" opens Lesson 10's page at that
// step in a new tab, so the viewer keeps their place here, and where
// Lesson 10 is not live, as the page state says (kit/page-state.ts), the
// words stay and the link goes. The second question's Play is Lesson 10's
// own D minor, D4, F4 and A4 for 1.4 s (FACTS 67), played by Lesson 10's
// quiz plays on this quiz's host, the page's one sound (kit/now-playing.ts).

import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { bindQuizPlays as bindLesson10Plays } from '@/features/lessons/lesson-10/quiz-play'
import { RECALL_KEYS, RECALL_QUESTIONS } from './quiz-questions'

export function initRecall(): void {
  const quiz = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: RECALL_KEYS,
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
  bindLesson10Plays(quiz.host)
}
