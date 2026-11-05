// ============================================================
// Lesson 14 questions — the quick check, and the recall from Lesson 5
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code, with the
// season's curly quotes for a quoted word. A wrong answer that holds a
// misconception links back to the step whose toy answers it (Steps 2, 3
// and 4). The kit prints "Right." or "Not quite." before each line, so none
// starts with "Right", "Yes" or "Correct". No question plays a sound.
//
// The recall asks Lesson 5's questions 2 and 4, the very objects Lesson 5's
// page asks, under their ids `l05-q2` and `l05-q4` (FACTS 7), taken from
// its quiz by id, as Lesson 13's come from Lesson 11's. The kit's quiz
// turns their "Try Step 1 again" and "Try Step 5 again" into "Try Lesson 5,
// Step 1 again" and "Try Lesson 5, Step 5 again", links to Lesson 5's page
// at that step in a new tab, and where Lesson 5 is not live keeps the words
// with no link.

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_5_QUESTIONS } from '@/features/lessons/lesson-05/quiz-questions'

/** The quick check's storage keys, its seed and its record. */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l14-seed',
  record: 'fyp-l14-quiz-v1',
}

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The recall's two questions, Lesson 5's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_5_QUESTIONS.filter((q) => q.id === 'l05-q2' || q.id === 'l05-q4')

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l14-q1',
    question:
      'Someone says: “If every note is in tune, the song is finished.” What does this lesson suggest?',
    options: [
      {
        text: 'The notes are the start: breaths and a swell shape the phrase too',
        correct: true,
        feedback:
          "Merc's two takes both kept every note in the band, and still differed.",
      },
      {
        text: "They're right: in tune is the whole job",
        feedback: `Merc's takes kept every note in the band, yet they breathed and swelled differently.${tryStep(2)}`,
      },
      {
        text: 'In tune stops mattering once a phrase is shaped',
        feedback: 'The notes still matter: shaping comes on top of them.',
      },
    ],
  },
  {
    id: 'l14-q2',
    question: 'Where does a breath you plan usually go?',
    options: [
      {
        text: 'At the end of a phrase, where the words pause',
        correct: true,
        feedback:
          "That's where a breath mark usually sits, and it takes its time from the note before.",
      },
      {
        text: 'Wherever you happen to run out of air',
        feedback: `A breath you plan waits for the phrase's end, where the words pause.${tryStep(2)}`,
      },
      {
        text: 'Just before each long note',
        feedback:
          'Take 1 breathed just before “star”, inside the phrase. The breath goes after it.',
      },
    ],
  },
  {
    id: 'l14-q3',
    question:
      'On a swell, a note grows louder, then softer. What should its line do?',
    options: [
      {
        text: 'Stay level, in its band',
        correct: true,
        feedback: 'Louder without higher: the light grows, not the line.',
      },
      {
        text: 'Rise as it grows, then fall',
        feedback: `That's Lesson 5's push. A swell keeps loud and high apart.${tryStep(3)}`,
      },
      {
        text: 'Drop below the band as it fades',
        feedback: "Quieter isn't lower: the line stays level as it fades too.",
      },
    ],
  },
  {
    id: 'l14-q4',
    question: 'Which ending sounds finished?',
    options: [
      {
        text: '“What you are”: V to I, landing on do',
        correct: true,
        feedback: 'A perfect cadence: the tune comes home to do.',
      },
      {
        text: '“World so high”: stopping on re, over V',
        feedback: `That's an imperfect cadence: it sounds unfinished, so the song goes on.${tryStep(4)}`,
      },
      {
        text: 'Both, because both end on a long note',
        feedback: 'Both end on a long note, but only one lands on do.',
      },
    ],
  },
]
