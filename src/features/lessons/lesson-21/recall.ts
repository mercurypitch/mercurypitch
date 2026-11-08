// ============================================================
// Lesson 21 recall and quick check — Lessons 6 and 15's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 6's question 2 and
// Lesson 15's question 2, the very objects those pages ask, for everyone,
// since both lessons are this one's prerequisites (WEB-SPEC, Toys 8;
// FACTS 7), under its own prefix and keys, marking no lesson done; earlier
// answers are never shown, so the answers measure delayed retrieval. "Try
// Lesson 6, Step 5 again" and "Try Lesson 15, Step 2 again" open that
// lesson's page at the step in a new tab, so the viewer keeps their place
// here. Lesson 15's question keeps its slot: Play the three notes plays
// E4, F4 and G4 and lights each on the slot's small treble staff, by
// Lesson 15's own handler on this quiz's host, with the page's one sound
// owner, so a newer sound anywhere stops it and it stops what played
// before.
//
// Before the Wrap, the quick check asks LESSON.md's four, three answers
// each, shuffled from the stored seed; its wrong answers link back to this
// page's steps through the deck, and answering all four marks Lesson 21
// done.

import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { bindThreeNotes } from '@/features/lessons/lesson-15/recall'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'

/** Mounts the recall and the quick check; the quick check's step links use `deck`. */
export function initQuizzes(deck: StepDeck): { recall: Quiz; check: Quiz } {
  const recall = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: RECALL_KEYS,
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
  bindThreeNotes(recall.host)
  const check = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 21,
    keys: QUIZ_KEYS,
    deck,
  })
  return { recall, check }
}
