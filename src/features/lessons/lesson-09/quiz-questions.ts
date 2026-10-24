// ============================================================
// Lesson 9 questions — the quick check, and the recall from Lesson 6
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code, with the
// season's curly quotes for a quoted line. A wrong answer that holds a
// misconception links back to the step whose toy answers it (Steps 2, 3, 4
// and 5). The kit prints "Right." or "Not quite." before each line, so none
// starts with "Right", "Yes" or "Correct" (WEB-SPEC, Tests 8).
//
// The recall asks Lesson 6's questions 2 and 3, the very objects Lesson 6's
// page asks, under their ids `l06-q2` and `l06-q3` (FACTS 4, FACTS.md:88).
// The kit's quiz turns their "Try Step 5 again" and "Try Step 2 again" into
// "Try Lesson 6, Step 5 again" and "Try Lesson 6, Step 2 again", links to
// Lesson 6's page at that step in a new tab (WEB-SPEC, Recall,
// WEB-SPEC.md:471-486).

import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_6_QUESTIONS } from '@/features/lessons/lesson-06/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The recall's two questions, Lesson 6's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_6_QUESTIONS.filter((q) => q.id === 'l06-q2' || q.id === 'l06-q3')

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l09-q1',
    question:
      'Someone says: “With a leap, you just jump to the top note and hope.” What does this lesson suggest?',
    options: [
      {
        text: 'Aim: hear the top note first, land in its band, then adjust',
        correct: true,
        feedback:
          'Copied leaps tend to land short, not just anywhere: aim, then listen and adjust.',
      },
      {
        text: "They're right: a leap is too quick to aim",
        feedback: `In one study, copied leaps tended to come out short, not anywhere at random.${tryStep(2)}`,
      },
      {
        text: 'Never leap: always slide up to the top note',
        feedback:
          'A slide is a different shape. Hear the top note, then leap straight to its band.',
      },
    ],
  },
  {
    id: 'l09-q2',
    question:
      'Do up to so is a perfect fifth, 7 semitones. Which two thirds make it?',
    options: [
      {
        text: 'A major third, then a minor third: 4 and 3',
        correct: true,
        feedback: 'Do to mi, then mi to so: two rungs of the ladder.',
      },
      {
        text: 'Two major thirds: 4 and 4',
        feedback: `That's 8 semitones, one past so.${tryStep(3)}`,
      },
      {
        text: 'Two minor thirds: 3 and 3',
        feedback: "That's 6 semitones, one short of so.",
      },
    ],
  },
  {
    id: 'l09-q3',
    question:
      "Which leaps do the Royal Conservatory's voice exams ask singers for first?",
    options: [
      {
        text: 'The minor and major thirds',
        correct: true,
        feedback:
          'Then the fifth, the fourth and the octave, one level at a time.',
      },
      {
        text: 'The octave',
        feedback: `The octave comes after the thirds, the fifth and the fourth.${tryStep(4)}`,
      },
      {
        text: 'The fifth',
        feedback: 'The fifth comes next, after the thirds.',
      },
    ],
  },
  {
    id: 'l09-q4',
    question:
      "You leap from do to so and land 40 cents under so. What's the next move?",
    options: [
      {
        text: "Listen, then slide up into so's band",
        correct: true,
        feedback: "Land, compare, adjust: Lesson 3's loop, after a jump.",
      },
      {
        text: 'Nothing: 40 cents is inside the band',
        feedback: `The band reaches 35 cents either side, and 40 is just outside it: close.${tryStep(5)}`,
      },
      {
        text: "Leave it: a leap can't be adjusted once it lands",
        feedback:
          'It can: a sung note can slide into the band, as in Lesson 3.',
      },
    ],
  },
]
