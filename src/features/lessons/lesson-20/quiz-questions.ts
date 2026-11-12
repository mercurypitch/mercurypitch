// ============================================================
// Lesson 20 questions — the quick check, and the recall from Lessons 9 and 10
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. A wrong
// answer that holds a misconception links back to the step whose toy
// answers it (Steps 1, 1, 3 and 2). The kit prints "Right." or "Not quite."
// before each line, so none starts with "Right", "Yes" or "Correct".
// Question 4 is heard: its slot's Play sounds E minor pentatonic, E4 to E5
// in the soft tone (recall.ts binds it), drawn as nothing, and its button
// names neither scale, so the ear answers (WEB-SPEC, Toys 8; FACTS 76).
//
// The recall asks Lesson 9's question 2 and Lesson 10's question 4, the
// very objects those pages ask, under their ids `l09-q2` and `l10-q4`
// (FACTS 7), taken from their quizzes by id. The kit's quiz turns their
// "Try Step 3 again" and "Try Step 5 again" into "Try Lesson 9, Step 3
// again" and "Try Lesson 10, Step 5 again", links to that page at the step
// in a new tab. Neither says what went with better playing in the
// pianists' study, so neither answers the predict (FACTS 1a), and neither
// plays anything.

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_9_QUESTIONS } from '@/features/lessons/lesson-09/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_10_QUESTIONS } from '@/features/lessons/lesson-10/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 8). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l20-seed',
  record: 'fyp-l20-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 8). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l20-recall-seed',
  record: 'fyp-l20-recall-v1',
}

/** The recall's two questions, Lesson 9's second and Lesson 10's fourth, their own objects. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_9_QUESTIONS.filter((q) => q.id === 'l09-q2'),
  ...LESSON_10_QUESTIONS.filter((q) => q.id === 'l10-q4'),
]

/** Question 4's play button, in its slot: "Play", naming neither scale. */
export const PLAY_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-play="e-minor-five" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l20-q1',
    question:
      'Which notes of the major scale does the major pentatonic leave out?',
    options: [
      {
        text: 'Fa and ti',
        correct: true,
        feedback: 'And with them, both semitones.',
      },
      {
        text: 'Re and la',
        feedback: `Re and la stay: do, re, mi, so, la.${tryStep(1)}`,
      },
      {
        text: 'Do and so',
        feedback: 'Its home, do, and its fifth, so, both stay.',
      },
    ],
  },
  {
    id: 'l20-q2',
    question: "Are the pentatonic's steps all the same size?",
    options: [
      {
        text: 'No: 2, 2, 3, 2 and 3 semitones',
        correct: true,
        feedback: 'No semitones, but two steps of three.',
      },
      {
        text: 'Yes: with no semitones, every step is a tone',
        feedback: `Mi to so and la to do are three semitones each.${tryStep(1)}`,
      },
      {
        text: 'Yes: five equal steps fill the octave',
        feedback: 'Five equal steps would need 2.4 semitones each.',
      },
    ],
  },
  {
    id: 'l20-q3',
    question:
      "In the pianists' study, what went with better playing the next day?",
    options: [
      {
        text: 'A higher share of tries that came out right',
        correct: true,
        feedback: 'The plan starts where every note lands.',
      },
      {
        text: 'Longer practice',
        feedback: `How long they practised didn't go with it.${tryStep(3)}`,
      },
      {
        text: 'More tries',
        feedback: "How many tries they made didn't go with it either.",
      },
    ],
  },
  {
    id: 'l20-q4',
    question: 'Listen. Major or minor pentatonic?',
    slot: PLAY_SLOT,
    options: [
      {
        text: 'Minor',
        correct: true,
        feedback: 'Do, me, fa, so, te: its first step is three semitones.',
      },
      {
        text: 'Major',
        feedback: `The major one starts with two tones: do, re, mi.${tryStep(2)}`,
      },
      {
        text: "Neither: it's a major scale",
        feedback: 'It has five different notes, not seven.',
      },
    ],
  },
]
