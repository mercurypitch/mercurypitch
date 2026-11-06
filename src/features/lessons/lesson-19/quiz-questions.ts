// ============================================================
// Lesson 19 questions — the quick check, and the recall from Lesson 17
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. A wrong
// answer that holds a misconception links back to the step whose toy
// answers it (Steps 1, 1, 3 and 4). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct". Question 2 is heard: its slot plays Subdivide's second bar of
// 6/8 twice at this page's speed, 4 s (recall.ts binds it), drawn as
// nothing, since the options are words and the ear answers (WEB-SPEC, Toys
// 9; FACTS 68, 69).
//
// The recall asks Lesson 17's questions 3 and 2, in that order, the very
// objects Lesson 17's page asks, under their ids `l17-q3` and `l17-q2`
// (FACTS 7), taken from its quiz by id, as Lesson 17 takes Lesson 8's. The
// kit's quiz turns their "Try Step 5 again" and "Try Step 2 again" into
// "Try Lesson 17, Step 5 again" and "Try Lesson 17, Step 2 again", links
// to Lesson 17's page at that step in a new tab. Neither plays, and
// neither says how a bar's notes group into beats (FACTS 1a).

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_17_QUESTIONS } from '@/features/lessons/lesson-17/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 9). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l19-seed',
  record: 'fyp-l19-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 9). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l19-recall-seed',
  record: 'fyp-l19-recall-v1',
}

/** One of Lesson 17's questions, by its id. */
function lesson17(id: string): QuizQuestion {
  const q = LESSON_17_QUESTIONS.find((x) => x.id === id)
  if (q === undefined) throw new Error(`Lesson 17 has no question ${id}`)
  return q
}

/** The recall's two questions, Lesson 17's own, its third and then its second. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  lesson17('l17-q3'),
  lesson17('l17-q2'),
]

/** Question 2's play button, in its slot. */
export const PLAY_BARS_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-bars style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l19-q1',
    question: 'In 6/8, how many beats are in a bar?',
    options: [
      {
        text: 'Two',
        correct: true,
        feedback: 'Six eighths, in two groups of three.',
      },
      {
        text: 'Six',
        feedback: `Six counts the eighth notes, and they group in threes.${tryStep(1)}`,
      },
      {
        text: 'Three',
        feedback: 'Three beats of two eighths each is 3/4.',
      },
    ],
  },
  {
    id: 'l19-q2',
    question: 'Listen. Is this 6/8 or 3/4?',
    slot: PLAY_BARS_SLOT,
    options: [
      {
        text: '6/8',
        correct: true,
        feedback: 'The kick came back after three eighths: two beats a bar.',
      },
      {
        text: '3/4',
        feedback: `In 3/4 a beat comes every two eighths. Here the kick came back after three.${tryStep(1)}`,
      },
      {
        text: "You can't tell without seeing it written",
        feedback: 'The accents tell you: listen for where the kick comes back.',
      },
    ],
  },
  {
    id: 'l19-q3',
    question: 'What does a triplet do?',
    options: [
      {
        text: 'Fits three notes into the time of two',
        correct: true,
        feedback: "And it's marked with a 3.",
      },
      {
        text: 'Fits two notes into the time of three',
        feedback: `That's the other way round.${tryStep(3)}`,
      },
      {
        text: 'Puts three beats in a bar',
        feedback: "That's a bar of 3/4. A triplet splits one beat.",
      },
    ],
  },
  {
    id: 'l19-q4',
    question: 'What makes a rhythm syncopated?',
    options: [
      {
        text: 'An accent off the beat',
        correct: true,
        feedback: 'Often a note on an “and”, held over the next beat.',
      },
      {
        text: 'Playing it fast',
        feedback: `Speed is the tempo.${tryStep(4)}`,
      },
      {
        text: 'Being in 6/8',
        feedback: 'Any metre can be syncopated.',
      },
    ],
  },
]
