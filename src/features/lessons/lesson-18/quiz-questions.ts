// ============================================================
// Lesson 18 questions — the quick check, and the recall from Lessons 16 and 17
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. A wrong
// answer that holds a misconception links back to the step whose toy
// answers it (Steps 1 to 4). The kit prints "Right." or "Not quite." before
// each line, so none starts with "Right", "Yes" or "Correct". Question 4 is
// heard: its slot's Play sounds so, fa, mi loud, then after a beat the same
// three quiet (recall.ts binds it), drawn as nothing, and its button names
// neither loudness, so the ear answers (WEB-SPEC, Toys 4; FACTS 83).
//
// The recall asks Lesson 16's question 3 and Lesson 17's question 1, the
// very objects those pages ask, under their ids `l16-q3` and `l17-q1`
// (FACTS 7), taken from their quizzes by id. The kit's quiz turns their
// "Try Step 4 again" and "Try Step 1 again" into "Try Lesson 16, Step 4
// again" and "Try Lesson 17, Step 1 again", links to that page at the step
// in a new tab. Neither says what reading note by note costs, so neither
// answers the predict (FACTS 1a), and neither plays anything.

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_16_QUESTIONS } from '@/features/lessons/lesson-16/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_17_QUESTIONS } from '@/features/lessons/lesson-17/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 4). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l18-seed',
  record: 'fyp-l18-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 4). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l18-recall-seed',
  record: 'fyp-l18-recall-v1',
}

/** The recall's two questions, Lesson 16's third and Lesson 17's first, their own objects. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_16_QUESTIONS.filter((q) => q.id === 'l16-q3'),
  ...LESSON_17_QUESTIONS.filter((q) => q.id === 'l17-q1'),
]

/** Question 4's play button, in its slot: "Play", naming neither loudness. */
export const PLAY_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-play="so-fa-mi" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l18-q1',
    question:
      'Someone says: "To sight-sing, work out each note\'s name, then sing it." What does this lesson suggest?',
    options: [
      {
        text: 'Read patterns you know, and keep the beat',
        correct: true,
        feedback:
          'Names help at first. Reading patterns kept Merc on the beat.',
      },
      {
        text: "They're right: name each note, then sing it",
        feedback: `Then each note falls further behind while the beat runs on.${tryStep(1)}`,
      },
      {
        text: "Sing only tunes you've heard before",
        feedback: "Then it wouldn't be sight-singing.",
      },
    ],
  },
  {
    id: 'l18-q2',
    question:
      'On the staff, two notes side by side on the same line, with no curve joining them, are...',
    options: [
      {
        text: 'The same note, sung twice',
        correct: true,
        feedback: 'A repeated note: the same line, sung again.',
      },
      {
        text: 'A step to the next place',
        feedback: `A step moves to the next line or space.${tryStep(2)}`,
      },
      {
        text: 'One note, held for both beats',
        feedback:
          "Only a tie, Lesson 17's curve, joins two notes into one sound.",
      },
    ],
  },
  {
    id: 'l18-q3',
    question: 'Why does the click count in a bar before you sing?',
    options: [
      {
        text: 'To set the tempo',
        correct: true,
        feedback: 'Four clicks, and you know how fast the beat goes.',
      },
      {
        text: 'To give you the first note',
        feedback: `Do comes from the note played first. The count-in sets the tempo.${tryStep(3)}`,
      },
      {
        text: 'To warm up your voice',
        feedback: "It's clicks, not singing: it sets how fast the beat goes.",
      },
    ],
  },
  {
    id: 'l18-q4',
    question: 'Listen. What changed the second time?',
    slot: PLAY_SLOT,
    options: [
      {
        text: 'Only the loudness',
        correct: true,
        feedback: 'The same three notes, f, then p.',
      },
      {
        text: 'The notes went lower',
        feedback: `The same notes both times: quieter never means lower.${tryStep(4)}`,
      },
      {
        text: 'The tempo',
        feedback: 'The notes came just as fast both times.',
      },
    ],
  },
]
