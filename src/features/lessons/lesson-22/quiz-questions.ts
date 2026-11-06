// ============================================================
// Lesson 22 questions — the quick check, and the recall from Lessons 5 and 14
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code, with the season's curly quotes for a quoted line. A
// wrong answer that holds a misconception links back to the step whose toy
// answers it (Steps 2, 3, 3 and 4). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct". Question 3 is heard: its slot plays Step 3's slow wave, ±50
// cents at two swings a second on A3 for 3.0 s, and draws nothing, so it
// is answered by ear (recall.ts binds it). Its button shows "Play" and is
// named "Play the question's wave", so its name holds what it shows (WCAG
// 2.5.3) and never matches Step 3's plays; like the slow wave everywhere
// on the page, it waits for Step 3's choice, under its lock line, since it
// would answer Step 3's predict (WEB-SPEC, Toys 5; FACTS 1a, 24, 71).
//
// The recall asks Lesson 5's question 3 and Lesson 14's question 3, the
// very objects those pages ask, under their ids `l05-q3` and `l14-q3`
// (FACTS 7), each taken from its quiz by id. The kit's quiz turns their
// "Try Step 4 again" and "Try Step 3 again" into "Try Lesson 5, Step 4
// again" and "Try Lesson 14, Step 3 again", links to that page at that step
// in a new tab, and where the lesson is not live keeps the words with no
// link. Neither says anything about a vibrato, or where a wave's note is
// heard (FACTS 1a).

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_5_QUESTIONS } from '@/features/lessons/lesson-05/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_14_QUESTIONS } from '@/features/lessons/lesson-14/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 5). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l22-seed',
  record: 'fyp-l22-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 5). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l22-recall-seed',
  record: 'fyp-l22-recall-v1',
}

/** The recall's two questions, Lesson 5's and Lesson 14's own, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_5_QUESTIONS.filter((q) => q.id === 'l05-q3'),
  ...LESSON_14_QUESTIONS.filter((q) => q.id === 'l14-q3'),
]

/** What question 3's play says until Step 3's choice, as free play's slow wave says it (LESSON.md). */
export const SLOW_HELD = "Answer Step 3's question first to hear this."

/** Question 3's play and its lock line, in its slot: Step 3's slow wave, held until Step 3's choice (FACTS 71). */
const PLAY_SLOW =
  '<button class="btn sm tint" type="button" data-quiz-play="slow" aria-label="Play the question\'s wave" style="--c: var(--amber)" disabled><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>' +
  `<p class="lock-hint" data-quiz-held><svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>${SLOW_HELD}</p>`

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l22-q1',
    question:
      "A singer's held note swings up and down six times a second. What does “six times a second” measure?",
    options: [
      {
        text: 'Its rate',
        correct: true,
        feedback:
          'Rate counts the swings in a second; extent measures how far each one reaches.',
      },
      {
        text: 'Its extent',
        feedback: `Extent is how far each swing reaches, in cents.${tryStep(2)}`,
      },
      {
        text: 'How loud it is',
        feedback:
          'A vibrato is a wave in pitch: the line moves, not the strip.',
      },
    ],
  },
  {
    id: 'l22-q2',
    question:
      'A held note waves evenly, 50 cents up and 50 cents down. Which straight note sounds the same?',
    options: [
      {
        text: 'The middle of the swing',
        correct: true,
        feedback:
          'People match an even wave to a straight note near its middle.',
      },
      {
        text: 'The top of the swing',
        feedback: `The peaks reach highest, but the ear hears the middle.${tryStep(3)}`,
      },
      {
        text: 'The bottom of the swing',
        feedback:
          'People match it to the middle, between the top and the bottom.',
      },
    ],
  },
  {
    id: 'l22-q3',
    question:
      'Listen. Is this one note with a vibrato, or a note moving up and down?',
    slot: PLAY_SLOW,
    options: [
      {
        text: 'A note moving up and down',
        correct: true,
        feedback: 'At two swings a second, the ear follows the pitch.',
      },
      {
        text: 'One note with a vibrato',
        feedback: `Two swings a second is slow enough to hear the pitch move.${tryStep(3)}`,
      },
      {
        text: 'A straight note',
        feedback: "It rises and falls: a straight note wouldn't.",
      },
    ],
  },
  {
    id: 'l22-q4',
    question:
      "A friend says: “A held note without a vibrato isn't finished.” What does this lesson say?",
    options: [
      {
        text: 'Both are used in singing, and a straight note is finished',
        correct: true,
        feedback: 'Styles differ, and singers can change their vibrato.',
      },
      {
        text: "They're right: every finished note needs a vibrato",
        feedback: `Some choir experts want a minimal vibrato or none.${tryStep(4)}`,
      },
      {
        text: 'A vibrato puts a note out of tune',
        feedback:
          "We hear an even vibrato at its middle: it's in tune if its middle is.",
      },
    ],
  },
]
