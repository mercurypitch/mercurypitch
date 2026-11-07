// ============================================================
// Lesson 24 questions — the quick check, and the recall from Lessons 10 and 23
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code. A wrong answer that holds a misconception links back
// to the step whose figure answers it (Steps 1, 2, 4 and 2). The kit
// prints "Right." or "Not quite." before each line, so none starts with
// "Right", "Yes" or "Correct". Question 4 is heard: its slot plays A3 with
// E4 at exactly 330 Hz, a pure fifth, for 4.0 s, the same for everyone
// (recall.ts binds it). Its button shows "Play" and is named "Play the
// question's pair", so its name holds what it shows (WCAG 2.5.3); like the
// Pure word's play, it waits for the cold open's choice under the Pure
// word's line, since a still pair heard before it says what in tune sounds
// like, while its answers stay open (WEB-SPEC, Toys 5; FACTS 46, 77).
// Lesson 26's recall asks question 1 word for word (FACTS 74), so its id,
// its words and its answers stay as they are once shipped.
//
// The recall asks Lesson 10's question 1 and Lesson 23's question 3, the
// very objects those pages ask, under their ids `l10-q1` and `l23-q3`
// (FACTS 7), each taken from its quiz by id. The kit's quiz turns their
// "Try Step 1 again" into "Try Lesson 10, Step 1 again" and "Try Lesson
// 23, Step 1 again", links to that page at that step in a new tab, and
// where the lesson is not live keeps the words with no link. Neither says
// anything about beats, tuning or a drone (FACTS 1a).

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_10_QUESTIONS } from '@/features/lessons/lesson-10/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_23_QUESTIONS } from '@/features/lessons/lesson-23/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 5). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l24-seed',
  record: 'fyp-l24-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 5). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l24-recall-seed',
  record: 'fyp-l24-recall-v1',
}

/** The recall's two questions, Lesson 10's own and Lesson 23's, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_10_QUESTIONS.filter((q) => q.id === 'l10-q1'),
  ...LESSON_23_QUESTIONS.filter((q) => q.id === 'l23-q3'),
]

/** What question 4's play says until the cold open's choice: the Pure word's line (FACTS 46). */
export const PURE_HELD = 'Choose an answer at the top to hear this.'

/** Question 4's play and its lock line, in its slot: A3 with E4 at 330 Hz, held until the cold open's choice (FACTS 77). */
const PLAY_PAIR =
  '<button class="btn sm tint" type="button" data-quiz-play="pure" aria-label="Play the question\'s pair" style="--c: var(--chrome)" disabled><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>' +
  `<p class="lock-hint" data-quiz-held><svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>${PURE_HELD}</p>`

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l24-q1',
    question:
      'Two notes, 220 Hz and 223 Hz, sound together. How many times a second do they beat?',
    options: [
      {
        text: '3',
        correct: true,
        feedback: 'Beats a second are the difference: 223 − 220.',
      },
      {
        text: '443',
        feedback: `That's the two added. Beats come from the difference.${tryStep(1)}`,
      },
      {
        text: "None: they're too close to hear",
        feedback: 'Close notes beat; only the same note is still.',
      },
    ],
  },
  {
    id: 'l24-q2',
    question:
      'Above a drone, the piano plays a fifth, then a major third. What do you hear?',
    options: [
      {
        text: 'Both beat, the third much faster',
        correct: true,
        feedback:
          "The piano's third is 0.8 % wide; its fifth only a hair narrow.",
      },
      {
        text: 'Only the fifth beats',
        feedback: `The third beats too, and much faster.${tryStep(2)}`,
      },
      {
        text: 'Neither beats: the piano is in tune',
        feedback: "The piano's fifth and third aren't pure: both beat.",
      },
    ],
  },
  {
    id: 'l24-q3',
    question:
      'You hold a harmony note while another singer sings a different part. What helps keep the harmony together?',
    options: [
      {
        text: 'Listening to the other part',
        correct: true,
        feedback: 'Singers who heard each other kept their harmony closer.',
      },
      {
        text: 'Blocking the other part out',
        feedback: `Alone, your own note may be closer, but listening keeps the harmony.${tryStep(4)}`,
      },
      {
        text: 'Singing louder than them',
        feedback: "Louder isn't closer in tune; listening is what helps.",
      },
    ],
  },
  {
    id: 'l24-q4',
    question: 'Listen. Is this pair beating or still?',
    slot: PLAY_PAIR,
    options: [
      {
        text: 'Still',
        correct: true,
        feedback: 'A pure fifth: its harmonics meet exactly.',
      },
      {
        text: 'Beating slowly',
        feedback: `Listen for a slow swell in the loudness: this pair has none.${tryStep(2)}`,
      },
      {
        text: 'Beating fast',
        feedback: "A fast beat is the piano's third. This is a pure fifth.",
      },
    ],
  },
]
