// ============================================================
// Lesson 16 questions — the quick check, and the recall from Lessons 9 and 15
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code. A wrong answer that holds a misconception links back
// to the step whose toy answers it (Steps 2, 1, 4 and 3). The kit prints
// "Right." or "Not quite." before each line, so none starts with "Right",
// "Yes" or "Correct" (WEB-SPEC, Toys 5). Question 3 is the one Lesson 18's
// recall plans to ask word for word, so its words and its id stay as they
// are once shipped. Question 4 is heard: its slot plays do, a second of
// quiet, then re, in the learner's octave (FACTS 69).
//
// The recall asks Lesson 9's question 2 and Lesson 15's question 1, the
// very objects those pages ask, under their ids `l09-q2` and `l15-q1`
// (FACTS 7), each taken from its quiz by id. The kit's quiz turns their
// "Try Step 3 again" and "Try Step 1 again" into "Try Lesson 9, Step 3
// again" and "Try Lesson 15, Step 1 again", links to that page at that step
// in a new tab, and where the lesson is not live keeps the words with no
// link. Neither plays anything.

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_9_QUESTIONS } from '@/features/lessons/lesson-09/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_15_QUESTIONS } from '@/features/lessons/lesson-15/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 5). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l16-seed',
  record: 'fyp-l16-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 5). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l16-recall-seed',
  record: 'fyp-l16-recall-v1',
}

/** The recall's two questions, Lesson 9's own and Lesson 15's, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_9_QUESTIONS.filter((q) => q.id === 'l09-q2'),
  ...LESSON_15_QUESTIONS.filter((q) => q.id === 'l15-q1'),
]

/** Question 4's play, in its slot: do, a second of quiet, then re, in the learner's octave (FACTS 69). */
const PLAY_DO_RE =
  '<button class="btn sm tint" type="button" data-quiz-play="do-re" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play do, then re</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l16-q1',
    question:
      'What does a singer need to sing a new tune on its written notes?',
    options: [
      {
        text: 'A note to start from, such as do',
        correct: true,
        feedback: 'From one note, relative pitch finds the rest.',
      },
      {
        text: 'Absolute pitch',
        feedback: `Absolute pitch would do it with no note, but one note to start from is enough.${tryStep(2)}`,
      },
      {
        text: 'To hear the whole tune once',
        feedback:
          "Then it wouldn't be sight-singing. One note is enough to start.",
      },
    ],
  },
  {
    id: 'l16-q2',
    question: "In G, where does the lower voice's do sit on the bass staff?",
    options: [
      {
        text: 'In the top space',
        correct: true,
        feedback: "G3: the lower voice's do in Sing it.",
      },
      {
        text: 'On the top line',
        feedback: `The top line is A, re in G. Count down one step to the top space.${tryStep(1)}`,
      },
      {
        text: 'In the space above the staff',
        feedback: "That's B, mi in G: two steps up from do.",
      },
    ],
  },
  {
    id: 'l16-q3',
    question: 'On the staff, do, mi and so sit...',
    options: [
      {
        text: 'On three lines in a row, or three spaces in a row',
        correct: true,
        feedback: 'Each skips one letter: a leap of a third.',
      },
      {
        text: 'On three neighbouring places, like line, space, line',
        feedback: `Neighbouring places are steps, like do, re, mi.${tryStep(4)}`,
      },
      {
        text: "Anywhere: the staff doesn't show leaps",
        feedback: 'It does: line to line skips one letter.',
      },
    ],
  },
  {
    id: 'l16-q4',
    question: 'Listen. What helps most to sing the note after do?',
    slot: PLAY_DO_RE,
    options: [
      {
        text: 'Hearing it inside before you sing it',
        correct: true,
        feedback: 'Imagine it in the beat before, then sing.',
      },
      {
        text: 'Singing it louder',
        feedback: `Louder doesn't move a note. Hear it first, then sing.${tryStep(3)}`,
      },
      {
        text: 'Waiting for it to play',
        feedback: "Then you'd be echoing, not reading. Hear it inside first.",
      },
    ],
  },
]
