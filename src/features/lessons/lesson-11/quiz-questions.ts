// ============================================================
// Lesson 11 questions — the quick check, and the recall from Lesson 7
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code. A wrong answer that holds a misconception links back
// to the step whose chart answers it (Steps 2 to 5). The kit prints
// "Right." or "Not quite." before each line, so none starts with "Right",
// "Yes" or "Correct". LESSON.md's note on the shuffle is editorial and
// never printed.
//
// The recall asks Lesson 7's questions 1 and 4, the very objects Lesson 7's
// page asks, under their ids `l07-q1` and `l07-q4` (FACTS 4). The kit's
// quiz turns their "Try Step 1 again" and "Try Step 5 again" into "Try
// Lesson 7, Step 1 again" and "Try Lesson 7, Step 5 again", links to
// Lesson 7's page at that step, in a new tab (WEB-SPEC, Toys 5).

import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_7_QUESTIONS } from '@/features/lessons/lesson-07/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's storage keys: the answer-order seed and the record. */
export const QUIZ_KEYS = {
  seed: 'fyp-l11-seed',
  record: 'fyp-l11-quiz-v1',
} as const

/** The recall's two questions, Lesson 7's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_7_QUESTIONS.filter((q) => q.id === 'l07-q1' || q.id === 'l07-q4')

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l11-q1',
    question: 'Your voice flips as you slide up. What does that mean?',
    options: [
      {
        text: 'Your voice changed gear: every voice has gears',
        correct: true,
        feedback:
          'A flip is a change of register, and every voice has registers.',
      },
      {
        text: "You're doing it wrong",
        feedback: `Even a larynx in a lab can flip when its stretch changes smoothly.${tryStep(2)}`,
      },
      {
        text: "You've reached your highest note",
        feedback:
          'A flip can come well inside a range, where either gear can sing.',
      },
    ],
  },
  {
    id: 'l11-q2',
    question:
      "Yesterday your voice flipped on a slide. Today, on the same slide, it didn't. Why might that be?",
    options: [
      {
        text: 'Around the middle, either gear can sing the same notes',
        correct: true,
        feedback:
          'So a slide can switch in a different place, or stay in one gear.',
      },
      {
        text: 'One slide was out of tune',
        feedback: `A flip is a change of gear, not a wrong note.${tryStep(3)}`,
      },
      {
        text: 'Flips only happen to beginners',
        feedback:
          'Every voice has gears, trained or not, and classical singers learn to hide the switch.',
      },
    ],
  },
  {
    id: 'l11-q3',
    question: 'Can practice make the switch go away?',
    options: [
      {
        text: 'No, but it can get smoother',
        correct: true,
        feedback:
          'Singers can smooth it until no one hears a flip, but the switch is still there.',
      },
      {
        text: 'Yes, with enough sirens',
        feedback: `Registers can't be removed: a lab instrument can still pick up a smoothed switch.${tryStep(4)}`,
      },
      {
        text: 'No, and nothing changes how it sounds',
        feedback:
          "Training can smooth how a switch sounds, even though it can't remove it.",
      },
    ],
  },
  {
    id: 'l11-q4',
    question: 'Where is a flip part of the style?',
    options: [
      {
        text: 'Yodelling',
        correct: true,
        feedback:
          'Yodellers use the flip as an ornament, or as a whole way of singing.',
      },
      {
        text: 'Classical opera',
        feedback: `Classical singing works to hide the switch.${tryStep(5)}`,
      },
      {
        text: 'Nowhere',
        feedback:
          'In yodelling, the flip is the point: register effects can be fundamental to some kinds of singing.',
      },
    ],
  },
]
