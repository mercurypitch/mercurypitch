// ============================================================
// Lesson 1 quick check — the four questions from LESSON.md
// ============================================================
//
// Copied exactly from the reviewed page, in authored order: the stored seed
// shuffles by position, so reordering the options here would reshuffle every
// returning viewer's answers. The strings are markup, so they stay in code.
// The ids are the same on every page that asks them (telemetry.ts):
// Lesson 2's recall check asks questions 2 and 4 as `l01-q2` and `l01-q4`.

import type { QuizQuestion } from '@/features/lessons/kit/quiz'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l01-q1',
    question: 'What makes a note higher?',
    options: [
      {
        text: 'Faster swings (a higher frequency)',
        correct: true,
        feedback: 'Yes. Speed is pitch; size is loudness.',
      },
      {
        text: 'Bigger swings',
        feedback:
          'Bigger swings make it louder, not higher. <a href="#step-3" data-goto-step="3">Try Step 3 again</a>.',
      },
      {
        text: 'Slower swings',
        feedback: 'Slower swings make it lower. Faster is higher.',
      },
    ],
  },
  {
    id: 'l01-q2',
    question: "You double a note's frequency. What do you get?",
    options: [
      {
        text: 'The same note, one octave up',
        correct: true,
        feedback: 'Exactly: two for one is an octave.',
      },
      {
        text: 'A completely different note',
        feedback:
          "It's higher, but it keeps its name: two for one is the octave, the same note one level up.",
      },
      {
        text: 'The same note, twice as loud',
        feedback:
          'Frequency is how fast, not how loud. Twice as fast is an octave higher.',
      },
    ],
  },
  {
    id: 'l01-q3',
    question: 'Why do A3 and A4 share a letter?',
    options: [
      {
        text: "A4 swings exactly twice as fast: they're an octave apart",
        correct: true,
        feedback:
          'Two to one is an octave: the same spot on the spiral, one turn higher.',
      },
      {
        text: 'They are the same frequency',
        feedback:
          'A4 is 440 Hz and A3 is 220 Hz: twice as fast, one octave apart.',
      },
      {
        text: 'They are equally loud',
        feedback:
          'Loudness has nothing to do with names. A4 swings twice as fast as A3: an octave.',
      },
    ],
  },
  {
    id: 'l01-q4',
    question: 'Which note comes right after B3?',
    options: [
      {
        text: 'C4',
        correct: true,
        feedback: 'Yes: the number goes up at C.',
      },
      {
        text: 'C3',
        feedback:
          "Close: the letter is C, but the number goes up at C, so it's C4.",
      },
      {
        text: 'A4',
        feedback: 'After B comes C, and the number goes up there: C4.',
      },
    ],
  },
]
