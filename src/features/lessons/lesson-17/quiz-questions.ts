// ============================================================
// Lesson 17 questions — the quick check, and the recall from Lesson 8
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. A wrong
// answer that holds a misconception links back to the step whose toy
// answers it (Steps 1, 2, 5 and 3). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct". Question 4 is heard: its slot plays two eighths and a quarter
// at 60 BPM over two clicks (recall.ts binds it), drawn as nothing, since
// the options are words and the ear answers (WEB-SPEC, Toys 9).
//
// The recall asks Lesson 8's questions 2 and 4, the very objects Lesson 8's
// page asks, under their ids `l08-q2` and `l08-q4` (FACTS 7), taken from
// its quiz by id, as Lesson 8 takes Lesson 6's. The kit's quiz turns their
// "Try Step 3 again" and "Try Step 5 again" into "Try Lesson 8, Step 3
// again" and "Try Lesson 8, Step 5 again", links to Lesson 8's page at
// that step in a new tab. Question 2's Play two bars is Lesson 8's own,
// played by Lesson 8's handler on this quiz's host. Lesson 8's question 1
// stays out: its right answer, two beats a second, would answer the
// predict for a learner who reads on before choosing (FACTS 1a).

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_8_QUESTIONS } from '@/features/lessons/lesson-08/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 9). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l17-seed',
  record: 'fyp-l17-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 9). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l17-recall-seed',
  record: 'fyp-l17-recall-v1',
}

/** The recall's two questions, Lesson 8's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_8_QUESTIONS.filter((q) => q.id === 'l08-q2' || q.id === 'l08-q4')

/** Question 4's play button, in its slot. */
export const PLAY_RHYTHM_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-rhythm style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play the rhythm</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l17-q1',
    question: 'How many quarter notes last as long as one whole note?',
    options: [
      {
        text: '4',
        correct: true,
        feedback: 'A quarter note is a quarter of a whole note.',
      },
      {
        text: '2',
        feedback: `Two half notes make a whole note, and quarter notes are half as long as halves.${tryStep(1)}`,
      },
      {
        text: 'It depends on the tempo',
        feedback:
          "The tempo changes the seconds, not the shares: it's always four.",
      },
    ],
  },
  {
    id: 'l17-q2',
    question:
      'At 120 BPM, with a quarter note on each beat, how long does each quarter note last?',
    options: [
      {
        text: 'Half a second',
        correct: true,
        feedback: '120 beats a minute is two beats a second.',
      },
      {
        text: 'A quarter of a second',
        feedback: `The name counts quarters of a whole note, not of a second.${tryStep(2)}`,
      },
      {
        text: 'One second',
        feedback: "That's at 60 BPM. At 120, every beat lasts half as long.",
      },
    ],
  },
  {
    id: 'l17-q3',
    question: 'In 4/4, how long does a dotted half note last?',
    options: [
      {
        text: 'Three beats',
        correct: true,
        feedback: "A half note's two beats, and half as much again.",
      },
      {
        text: 'Two and a half beats',
        feedback: `A dot adds half the note's own length, and half of two beats is one.${tryStep(5)}`,
      },
      {
        text: 'Four beats',
        feedback: 'Four beats is a whole note.',
      },
    ],
  },
  {
    id: 'l17-q4',
    question: 'Listen. Which rhythm did you hear?',
    slot: PLAY_RHYTHM_SLOT,
    options: [
      {
        text: 'Two eighths, then a quarter',
        correct: true,
        feedback: '1 and 2: two short notes, then a longer one.',
      },
      {
        text: 'A quarter, then two eighths',
        feedback: `The short notes came first.${tryStep(3)}`,
      },
      {
        text: 'Three quarters',
        feedback: 'The first two notes came twice as fast as the last.',
      },
    ],
  },
]
