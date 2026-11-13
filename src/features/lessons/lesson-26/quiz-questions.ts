// ============================================================
// Lesson 26 quiz questions — the recall's two, and the quick check's four
// ============================================================
//
// The recall asks Lesson 12's question on the chord on re and Lesson 24's
// first, in that order, each with its way back to its own lesson (WEB-SPEC,
// Toys 4). The quick check is LESSON.md's, in authored order, each answer's
// sharp made speakable (FACTS 71 to 74). Two of its parts wait for the cold
// open's choice, since each would state the predict's answer: question 2,
// the predict's question asked again, its answers disabled with their
// words kept under "Choose an answer at the top to try this." (the kit
// quiz's `held`), and question 4's Play under "Choose an answer at the top
// to hear this."; a return visit holds both again (FACTS 1a, 40).

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_12_QUESTIONS } from '@/features/lessons/lesson-12/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_24_QUESTIONS } from '@/features/lessons/lesson-24/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

const LOCK = '<svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>'

/** Question 2's line until the cold open's choice. */
export const TRY_HELD = 'Choose an answer at the top to try this.'
/** Question 4's line until the cold open's choice. */
export const HEAR_HELD = 'Choose an answer at the top to hear this.'

/** Question 2's slot: the line that holds its answers, which the quiz hides as it releases them. */
const TRY_SLOT = `<p class="lock-hint" data-quiz-held>${LOCK}${TRY_HELD}</p>`

/** Question 4's play and its line, held until the cold open's choice. */
const PLAY_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-play="parts" aria-label="Play the question\'s two parts" style="--c: var(--chrome)" disabled><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>' +
  `<p class="lock-hint" data-quiz-held>${LOCK}${HEAR_HELD}</p>`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 4). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l26-seed',
  record: 'fyp-l26-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 4). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l26-recall-seed',
  record: 'fyp-l26-recall-v1',
}

/** The recall's two questions, Lesson 12's own and Lesson 24's, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_12_QUESTIONS.filter((q) => q.id === 'l12-q3'),
  ...LESSON_24_QUESTIONS.filter((q) => q.id === 'l24-q1'),
]

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l26-q1',
    question: 'In C major, which note is a third above D, in the key?',
    options: [
      {
        text: 'F',
        correct: true,
        feedback: 'Three letters, D, E, F: 3 semitones, a minor third.',
      },
      {
        text: signsHtml('F♯'),
        feedback: `${signsHtml("F♯ is four semitones up, but it isn't in C major.")}${tryStep(1)}`,
      },
      { text: 'E', feedback: 'D, E is two letters: a second.' },
    ],
  },
  {
    id: 'l26-q2',
    question:
      'A friend harmonises a tune in C major by moving every note up four semitones. What happens?',
    held: true,
    slot: TRY_SLOT,
    options: [
      {
        text: 'Some notes leave the key',
        correct: true,
        feedback:
          'Above re, mi, la and ti, four semitones lands outside C major.',
      },
      {
        text: 'Every note stays in the key',
        feedback: `C major's third is four semitones only above do, fa and so.${tryStep(2)}`,
      },
      {
        text: 'It turns into a different tune',
        feedback: "It's still the tune, in another key.",
      },
    ],
  },
  {
    id: 'l26-q3',
    question:
      'The part above sings mi, fa, so over a C major chord. Which note passes between two chord notes?',
    options: [
      {
        text: 'Fa',
        correct: true,
        feedback: 'E and G are in the chord; F steps between them.',
      },
      { text: 'Mi', feedback: `Mi, E, is in the chord.${tryStep(4)}` },
      { text: 'So', feedback: 'So, G, is in the chord too.' },
    ],
  },
  {
    id: 'l26-q4',
    question:
      'Listen. A tune in C major with two parts above it, one after the other. Which part stays in the key?',
    slot: PLAY_SLOT,
    options: [
      {
        text: 'The second',
        correct: true,
        feedback: "Its thirds came from the key's own notes.",
      },
      {
        text: 'The first',
        feedback: `It moved every note four semitones, off the key.${tryStep(2)}`,
      },
      { text: 'Both', feedback: 'The first left the key.' },
    ],
  },
]
