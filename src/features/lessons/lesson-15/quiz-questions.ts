// ============================================================
// Lesson 15 questions — the quick check, and the recall from Lesson 2
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. A wrong
// answer that holds a misconception links back to the step whose toy
// answers it (Steps 1, 2, 5 and 4). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct". Question 2 is heard: its slot plays E4, F4 and G4 and lights
// them on a small treble staff of its own (recall.ts binds it), with no
// pitch line beside it, since one lane and then two would answer it
// (WEB-SPEC, Toys 1 and 7). Question 1's words stay as they are: Lesson 16
// plans to ask it, word for word, as its recall.
//
// The recall asks Lesson 2's questions 2 and 3, the very objects Lesson
// 2's page asks, under their ids `l02-q2` and `l02-q3` (FACTS 7), taken
// from its quiz by id, as Lesson 4's come from Lesson 2's. The kit's quiz
// turns their "Try Step 3 again" and "Try Step 5 again" into "Try Lesson
// 2, Step 3 again" and "Try Lesson 2, Step 5 again", links to Lesson 2's
// page at that step in a new tab. Question 2's slot is Lesson 2's own, its
// pair played by Lesson 2's handler on this quiz's host.

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_2_QUESTIONS } from '@/features/lessons/lesson-02/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 7). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l15-seed',
  record: 'fyp-l15-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 7). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l15-recall-seed',
  record: 'fyp-l15-recall-v1',
}

/** The recall's two questions, Lesson 2's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_2_QUESTIONS.filter((q) => q.id === 'l02-q2' || q.id === 'l02-q3')

/** Question 2's play and the small staff it lights, in the question's slot. */
export const THREE_NOTES_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-three style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play the three notes</button><svg class="l15-quiz-staff" data-quiz-staff aria-hidden="true"></svg>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l15-q1',
    question: 'In the treble clef, which line does the clef curl round?',
    options: [
      {
        text: 'The second line from the bottom: G',
        correct: true,
        feedback: "That's why it's called the G clef: the G above middle C.",
      },
      {
        text: 'The bottom line: E',
        feedback: `E is the bottom line. The clef curls round the line above it, G.${tryStep(1)}`,
      },
      {
        text: 'The middle line: B',
        feedback:
          "B is the middle line. Count down two letters, B, A, G, to reach the clef's line.",
      },
    ],
  },
  {
    id: 'l15-q2',
    question:
      'Listen. Two steps up the staff, one letter each. Are they the same size in sound?',
    slot: THREE_NOTES_SLOT,
    options: [
      {
        text: 'No: E to F is a semitone, F to G a tone',
        correct: true,
        feedback:
          'The staff counts letters, and E to F has no black key between.',
      },
      {
        text: 'Yes: one letter is always one step',
        feedback: `One letter, yes, but E to F is a semitone and F to G a tone.${tryStep(2)}`,
      },
      {
        text: 'It depends on the clef',
        feedback: 'Whatever the clef, E to F is a semitone and F to G a tone.',
      },
    ],
  },
  {
    id: 'l15-q3',
    question: 'Where does middle C sit on the grand staff?',
    options: [
      {
        text: 'On the one ledger line between the two staves',
        correct: true,
        feedback:
          'One below the treble staff and one above the bass: the same C.',
      },
      {
        text: 'On the middle line of the treble staff',
        feedback: `The treble staff's middle line is B, above middle C.${tryStep(5)}`,
      },
      {
        text: 'On the bottom line of the bass staff',
        feedback: 'That line is G, more than an octave below middle C.',
      },
    ],
  },
  {
    id: 'l15-q4',
    question:
      'In the bass clef, which line do the two dots sit either side of?',
    options: [
      {
        text: 'The second line from the top: F',
        correct: true,
        feedback: "That's why it's called the F clef: the F below middle C.",
      },
      {
        text: 'The top line: A',
        feedback: `A is the top line. The dots sit either side of the line below it, F.${tryStep(4)}`,
      },
      {
        text: 'The middle line: D',
        feedback:
          "D is the middle line. Count up two letters, D, E, F, to reach the dots' line.",
      },
    ],
  },
]
