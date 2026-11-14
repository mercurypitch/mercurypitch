// ============================================================
// Lesson 28 quiz questions — the recall's two, and the quick check's four
// ============================================================
//
// The recall asks Lesson 18's question 2 and Lesson 26's, in that order,
// their own question objects, each with its way back to its own lesson
// (WEB-SPEC, Toys 5; FACTS 7). Lesson 26's question waits there for that
// page's choice; here it is asked afresh, for everyone, so its hold and
// its held line are dropped. The quick check is LESSON.md's, in authored
// order. Question 4 names the cadence the song kept going on, so its Play
// and its three answers wait for the cold open's choice, disabled with
// their words kept, under "Choose an answer at the top to try this." (the
// kit quiz's `held`); a return visit holds it again (FACTS 1a, 77 to 80).

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_18_QUESTIONS } from '@/features/lessons/lesson-18/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_26_QUESTIONS } from '@/features/lessons/lesson-26/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

const LOCK = '<svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>'

/** Question 4's line until the cold open's choice. */
export const TRY_HELD = 'Choose an answer at the top to try this.'

/** Question 4's play and its line, held until the cold open's choice; its button names no cadence. */
const PLAY_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-play="phrase" aria-label="Play the phrase" style="--c: var(--chrome)" disabled><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>' +
  `<p class="lock-hint" data-quiz-held>${LOCK}${TRY_HELD}</p>`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 5). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l28-seed',
  record: 'fyp-l28-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 5). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l28-recall-seed',
  record: 'fyp-l28-recall-v1',
}

/** A question asked afresh: its own page's hold and held line dropped. */
function afresh(q: QuizQuestion): QuizQuestion {
  const { held: _held, slot: _slot, ...rest } = q
  return rest
}

/** The recall's two questions, Lesson 18's own and Lesson 26's, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_18_QUESTIONS.filter((q) => q.id === 'l18-q2'),
  ...LESSON_26_QUESTIONS.filter((q) => q.id === 'l26-q2').map(afresh),
]

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l28-q1',
    question: 'A phrase ends on V. Which cadence is it?',
    options: [
      {
        text: 'Imperfect',
        correct: true,
        feedback: 'It stops on V and sounds unfinished.',
      },
      {
        text: 'Perfect',
        feedback: `A perfect cadence goes on to I.${tryStep(1)}`,
      },
      { text: 'Plagal', feedback: 'Plagal goes IV to I.' },
    ],
  },
  {
    id: 'l28-q2',
    question: 'Which cadence is called the Amen cadence?',
    options: [
      {
        text: 'Plagal',
        correct: true,
        feedback: "IV to I, often after a song's ending.",
      },
      { text: 'Perfect', feedback: `Perfect goes V to I.${tryStep(2)}` },
      { text: 'Imperfect', feedback: 'Imperfect stops on V.' },
    ],
  },
  {
    id: 'l28-q3',
    question: 'In A A B A form, what is B?',
    options: [
      {
        text: 'The bridge, a contrasting section',
        correct: true,
        feedback: 'Here it ends on V, and A comes back.',
      },
      {
        text: 'The chorus',
        feedback: `A chorus repeats its words; here B comes once.${tryStep(3)}`,
      },
      { text: 'The ending', feedback: 'The song ends on A, after B.' },
    ],
  },
  {
    id: 'l28-q4',
    question: 'Listen. How does this phrase end?',
    held: true,
    slot: PLAY_SLOT,
    options: [
      {
        text: 'Interrupted',
        correct: true,
        feedback: "V went to vi, not I: it seems to end, but it isn't home.",
      },
      {
        text: 'Perfect',
        feedback: `A perfect cadence would have ended it there.${tryStep(2)}`,
      },
      {
        text: 'Imperfect',
        feedback: 'An imperfect cadence stops on V. This one moved on.',
      },
    ],
  },
]
