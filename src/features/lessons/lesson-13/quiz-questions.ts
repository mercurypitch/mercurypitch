// ============================================================
// Lesson 13 questions — the quick check, and the recall from Lesson 11
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code, with the
// season's curly quotes for a vowel's label. A wrong answer that holds a
// misconception links back to the step whose toy answers it (Steps 1, 3
// and 4). The kit prints "Right." or "Not quite." before each line, so none
// starts with "Right", "Yes" or "Correct" (WEB-SPEC, Recall and quick
// check). No question plays a sound.
//
// The recall asks Lesson 11's questions 1 and 2, the very objects Lesson
// 11's page asks, under their ids `l11-q1` and `l11-q2` (FACTS 4), taken
// from its quiz by id, as Lesson 9's come from Lesson 6's. The kit's quiz
// turns their "Try Step 2 again" and "Try Step 3 again" into "Try Lesson
// 11, Step 2 again" and "Try Lesson 11, Step 3 again", links to Lesson
// 11's page at that step in a new tab, and where Lesson 11 is not live
// keeps the words with no link.

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_11_QUESTIONS } from '@/features/lessons/lesson-11/quiz-questions'

/** The quick check's storage keys, its seed and its record. */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l13-seed',
  record: 'fyp-l13-quiz-v1',
}

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The recall's two questions, Lesson 11's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_11_QUESTIONS.filter((q) => q.id === 'l11-q1' || q.id === 'l11-q2')

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l13-q1',
    question: 'Merc sings A3, 220 Hz. Which of these is one of its harmonics?',
    options: [
      {
        text: '660 Hz',
        correct: true,
        feedback: 'Three times 220: the 3rd bar, where ‘ah’ has its tallest.',
      },
      {
        text: '330 Hz',
        feedback: `That's one and a half times 220, between the 1st and 2nd harmonics.${tryStep(1)}`,
      },
      {
        text: '110 Hz',
        feedback:
          "That's half of 220. The lowest harmonic is the note's own, 220 Hz.",
      },
    ],
  },
  {
    id: 'l13-q2',
    question:
      'Sung on the same note, what makes ‘ee’ sound different from ‘ah’?',
    options: [
      {
        text: 'How loud each harmonic comes out',
        correct: true,
        feedback:
          "Same harmonics, different heights: the vowel's shape picks the peaks.",
      },
      {
        text: 'A slightly different note for each',
        feedback: `The line stays level and the bars stay put: it's one note.${tryStep(4)}`,
      },
      {
        text: 'A louder voice for ‘ah’',
        feedback:
          'Merc sings both at the same volume, and the peaks still move.',
      },
    ],
  },
  {
    id: 'l13-q3',
    question: 'You open your mouth wider. What happens to the first resonance?',
    options: [
      {
        text: 'It rises, and the first peak moves up',
        correct: true,
        feedback:
          "That's what ‘ah’ does after ‘ee’: the tallest bar moves from the 1st to the 3rd.",
      },
      {
        text: 'It falls',
        feedback: `A wider opening raises it.${tryStep(3)}`,
      },
      {
        text: 'It stays where it was',
        feedback: 'Opening the mouth gives the first resonance a large rise.',
      },
    ],
  },
  {
    id: 'l13-q4',
    question:
      "A friend says: “Going from ‘ee’ to ‘ah’, you're singing a different note.” What would you tell them?",
    options: [
      {
        text: "It can be the same note: only the mouth's shape changes",
        correct: true,
        feedback:
          'The folds set the note; the shape of your throat and mouth sets the vowel.',
      },
      {
        text: "They're right: each vowel has its own note",
        feedback: `On one note, every vowel keeps the same harmonics.${tryStep(4)}`,
      },
      {
        text: "They're right, unless you're a trained singer",
        feedback:
          'Every voice sets its note and its vowel in different places, trained or not.',
      },
    ],
  },
]
