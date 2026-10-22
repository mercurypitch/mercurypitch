// ============================================================
// Lesson 7 questions — the quick check, and the recall from Lesson 3
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. A wrong
// answer that holds a misconception links back to the step whose chart
// answers it (Steps 1, 2, 4 and 5).
//
// The recall asks Lesson 3's questions 1 and 4, the very objects Lesson 3's
// page asks, under their ids `l03-q1` and `l03-q4` (FACTS 3). The kit's
// quiz turns their "Try Step 1 again" into "Try Lesson 3, Step 1 again", a
// link to Lesson 3's page at that step, in a new tab (WEB-SPEC, Toys 5).

import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_3_QUESTIONS } from '@/features/lessons/lesson-03/quiz-questions'

export { recallStepHref } from '@/features/lessons/lesson-03/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The recall's two questions, Lesson 3's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_3_QUESTIONS.filter((q) => q.id === 'l03-q1' || q.id === 'l03-q4')

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l07-q1',
    question: 'What does a siren look like on the pitch line?',
    options: [
      {
        text: 'A smooth hill, up and back down, with no steps',
        correct: true,
        feedback:
          'One glide up and back, sliding between notes, never stepping.',
      },
      {
        text: 'A staircase, one step for each note',
        feedback: `That's a scale. A siren slides, so its line has no steps.${tryStep(1)}`,
      },
      {
        text: 'A straight line at your highest note',
        feedback:
          'A siren keeps moving: up, then back down, turning round wherever is easy.',
      },
    ],
  },
  {
    id: 'l07-q2',
    question: 'What do studies say about warming up on lip trills and “ng”?',
    options: [
      {
        text: 'Few of them test singers, and many look mainly at what changes straight away',
        correct: true,
        feedback:
          'And most singer studies had no comparison group: how much they help is still open.',
      },
      {
        text: 'They prove lip trills protect your voice',
        feedback: `The studies don't show that: few of them test singers, and many are short-term.${tryStep(2)}`,
      },
      {
        text: "There aren't any",
        feedback: 'There are dozens, though few of them test singers.',
      },
    ],
  },
  {
    id: 'l07-q3',
    question:
      'A friend says the best singers have the widest range. What does this lesson suggest?',
    options: [
      {
        text: 'Not really: a song uses only a slice of a voice',
        correct: true,
        feedback: "“Twinkle” spans 9 of a two-octave voice's 24 semitones.",
      },
      {
        text: "They're right: more notes make a better singer",
        feedback: `A range is easy to count, but a song asks for a slice, sung with ease.${tryStep(4)}`,
      },
      {
        text: "A range can't be measured, so it can't matter",
        feedback:
          'It can, in semitones, though in one study it varied by several across recordings.',
      },
    ],
  },
  {
    id: 'l07-q4',
    question:
      'Two singers have exactly the same range. Are they the same voice type?',
    options: [
      {
        text: 'Not always: where each voice is comfortable, and how it sounds, count too',
        correct: true,
        feedback: 'A voice type is a label, not a box.',
      },
      {
        text: 'Always: the range decides the type',
        feedback: `Range is one part; where a voice sits comfortably counts for more.${tryStep(5)}`,
      },
      {
        text: "Only if they're the same height",
        feedback:
          "Bodies differ on average, but even a scan of the throat couldn't reliably tell sopranos from altos.",
      },
    ],
  },
]
