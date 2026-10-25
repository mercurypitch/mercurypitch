// ============================================================
// Lesson 9 recall — two questions from Lesson 6, asked afresh
// ============================================================
//
// Shown to everyone, because Lesson 6 is this lesson's prerequisite
// (WEB-SPEC, Toys 5): Lesson 6's questions 2 and 3, the very objects its
// page asks, under their own ids (quiz-questions.ts). The kit's quiz runs
// them under its own id prefix and storage keys, with a seed of their own,
// and marks no lesson done; earlier answers are never shown, so the answers
// measure delayed retrieval. "Try Lesson 6, Step N again" opens Lesson 6's
// page at that step in a new tab, so the viewer keeps their place here, and
// where Lesson 6 is not live, as the page state says (kit/page-state.ts),
// the words stay and the link goes. Question 3's Play is Lesson 6's own C4
// then F4 (FACTS 96), played by Lesson 6's quiz plays on this quiz's host,
// the page's one sound (kit/now-playing.ts).

import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { bindQuizPlays as bindLesson6Plays } from '@/features/lessons/lesson-06/quiz-play'
import { RECALL_QUESTIONS } from './quiz-questions'

export function initRecall(): void {
  const quiz = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: { seed: 'fyp-l09-recall-seed', record: 'fyp-l09-recall-v1' },
    prefix: 'rc-',
    away: { href: recallStepHref },
  })
  bindLesson6Plays(quiz.host)
}
