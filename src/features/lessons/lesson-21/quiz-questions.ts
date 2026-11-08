// ============================================================
// Lesson 21 questions — the quick check, and the recall from Lessons 6 and 15
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code, and every ♯ and ♭ is made speakable (`signsHtml`). A
// wrong answer that holds a misconception links back to the step whose toy
// answers it (Steps 1, 4, 3 and 5). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct" (WEB-SPEC, Toys 8).
//
// The recall asks Lesson 6's question 2 and Lesson 15's question 2, the
// very objects those pages ask, under their ids `l06-q2` and `l15-q2`
// (FACTS 7), each taken from its quiz by id. The kit's quiz turns their
// "Try Step 5 again" and "Try Step 2 again" into "Try Lesson 6, Step 5
// again" and "Try Lesson 15, Step 2 again", links to that page at that
// step in a new tab, and where the lesson is not live keeps the words with
// no link. Lesson 15's question keeps its slot, Play the three notes, its
// notes played by Lesson 15's own handler on this quiz's host (recall.ts).

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_6_QUESTIONS } from '@/features/lessons/lesson-06/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_15_QUESTIONS } from '@/features/lessons/lesson-15/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 8). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l21-seed',
  record: 'fyp-l21-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 8). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l21-recall-seed',
  record: 'fyp-l21-recall-v1',
}

/** The recall's two questions, Lesson 6's own and Lesson 15's, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_6_QUESTIONS.filter((q) => q.id === 'l06-q2'),
  ...LESSON_15_QUESTIONS.filter((q) => q.id === 'l15-q2'),
]

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l21-q1',
    question: signsHtml('Why does G major need F♯?'),
    options: [
      {
        text: 'To put ti a semitone below do, as the pattern needs',
        correct: true,
        feedback: 'Raise F, and the last step is a semitone again.',
      },
      {
        text: 'Every key has exactly one sharp',
        feedback: `C major has none, and D major two.${tryStep(1)}`,
      },
      {
        text: 'G is a black key',
        feedback: 'G is a white key. Its seventh note is the one that moves.',
      },
    ],
  },
  {
    id: 'l21-q2',
    question: signsHtml(
      'A key signature has three sharps: F♯, C♯ and G♯. Where is do?',
    ),
    options: [
      {
        text: 'On A, a semitone above the last sharp',
        correct: true,
        feedback: signsHtml('G♯ is ti, and do sits just above it: A major.'),
      },
      {
        text: signsHtml('On G♯'),
        feedback: `The last sharp is ti, not do.${tryStep(4)}`,
      },
      {
        text: signsHtml('On F♯'),
        feedback: signsHtml(
          'F♯ is the first sharp, the same in every sharp key.',
        ),
      },
    ],
  },
  {
    id: 'l21-q3',
    question: signsHtml('In F major, is the fourth note A♯ or B♭?'),
    options: [
      {
        text: signsHtml('B♭: each letter once'),
        correct: true,
        feedback: signsHtml('F, G, A, B♭: no letter twice.'),
      },
      {
        text: signsHtml('A♯'),
        feedback: `${signsHtml('A♯ is the same piano key, but then F major would have two As and no B.')}${tryStep(3)}`,
      },
      {
        text: 'Either: they sound the same',
        feedback: "They do, but a scale's spelling uses each letter once.",
      },
    ],
  },
  {
    id: 'l21-q4',
    question:
      'Twelve pure fifths overshoot seven octaves by about a quarter of a semitone. What does equal temperament do?',
    options: [
      {
        text: 'Narrows every fifth by about 2 cents, and the circle closes',
        correct: true,
        feedback: 'The gap, shared out in twelve.',
      },
      {
        text: 'Keeps the fifths pure and drops a note',
        feedback: `All twelve notes stay; each fifth gives a little.${tryStep(5)}`,
      },
      {
        text: 'Makes the octave wider',
        feedback: 'The octaves stay pure, 2 to 1. The fifths give way.',
      },
    ],
  },
]
