// ============================================================
// Lesson 27 questions — the quick check, and the recall from Lessons 12 and 23
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code, and every ♯ and ♭ is made speakable (`signsHtml`). A
// wrong answer that holds a misconception links back to the step whose toy
// answers it (Steps 1, 3, 4 and 1). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct" (WEB-SPEC, Toys 7; FACTS 75 to 78). Question 4 is heard: its
// slot plays G3, B3, D4 and F4 together, 1.5 s, for everyone, the same on
// every visit (recall.ts binds it), and its button shows "Play" and is
// named "Play the question's chord", so its name holds what it shows (WCAG
// 2.5.3) and never matches a step's play.
//
// The recall asks Lesson 12's question 3 and Lesson 23's question 1, the
// very objects those pages ask, under their ids `l12-q3` and `l23-q1`
// (FACTS 7), each taken from its quiz by id. The kit's quiz turns their
// "Try Step N again" into "Try Lesson 12, Step 4 again" and the like, links
// to that page at that step in a new tab, and where the lesson is not live
// keeps the words with no link. Neither has a play, and neither says which
// note makes V pull harder, nor anything of a chord turned over (FACTS 1a,
// 1b).

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_12_QUESTIONS } from '@/features/lessons/lesson-12/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_23_QUESTIONS } from '@/features/lessons/lesson-23/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** Question 4's play, in its slot: "Play", named for what it plays. */
const CHORD_PLAY =
  '<button class="btn sm tint" type="button" data-quiz-play="chord" aria-label="Play the question\'s chord" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

/** The quick check's stored answer order and record (WEB-SPEC, Toys 7). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l27-seed',
  record: 'fyp-l27-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 7). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l27-recall-seed',
  record: 'fyp-l27-recall-v1',
}

/** The recall's two questions, Lesson 12's own and Lesson 23's, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_12_QUESTIONS.filter((q) => q.id === 'l12-q3'),
  ...LESSON_23_QUESTIONS.filter((q) => q.id === 'l23-q1'),
]

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l27-q1',
    question: 'Which note turns G, B and D into a dominant seventh in C major?',
    options: [
      {
        text: 'F',
        correct: true,
        feedback: 'A third up from D, in the key: fa.',
      },
      {
        text: signsHtml('F♯'),
        feedback: `${signsHtml("F♯ isn't in C major, and V's notes come from the key's scale.")}${tryStep(1)}`,
      },
      {
        text: 'A',
        feedback:
          'G, A is two letters, a second. The seventh spans seven letters, G up to F.',
      },
    ],
  },
  {
    id: 'l27-q2',
    question: 'In C major, as V7 goes to I, where does B tend to go?',
    options: [
      {
        text: 'Up a semitone, to C',
        correct: true,
        feedback: 'B is ti, and ti leans up to do.',
      },
      {
        text: 'Down a tone, to A',
        feedback: `Ti leans up, not down.${tryStep(3)}`,
      },
      {
        text: 'Down to G',
        feedback:
          'In a middle part it can, but its pull is up a semitone, to C.',
      },
    ],
  },
  {
    id: 'l27-q3',
    question: 'E, G and C, with E at the bottom. What chord is it?',
    options: [
      {
        text: 'C major, first inversion',
        correct: true,
        feedback: 'Its root is C, and its third, E, is in the bass.',
      },
      {
        text: 'E minor',
        feedback: `E minor is E, G and B. Here the root is still C.${tryStep(4)}`,
      },
      {
        text: 'C major, second inversion',
        feedback: 'Second inversion has the fifth, G, in the bass.',
      },
    ],
  },
  {
    id: 'l27-q4',
    question: 'Listen. Which chord is this?',
    slot: CHORD_PLAY,
    options: [
      {
        text: 'A dominant seventh chord',
        correct: true,
        feedback:
          'A major triad with a minor seventh, 10 semitones above its root.',
      },
      {
        text: 'A major seventh chord',
        feedback: `That one's top note is a semitone higher, 11 above the root.${tryStep(1)}`,
      },
      {
        text: 'A major triad',
        feedback: 'Listen for the fourth note: a triad has three.',
      },
    ],
  },
]
