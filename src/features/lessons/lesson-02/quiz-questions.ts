// ============================================================
// Lesson 2 quick check — the film's four recap questions, from LESSON.md
// ============================================================
//
// Word for word from the lesson's copy, in authored order: the stored seed
// shuffles by position, so reordering the options here would reshuffle every
// returning viewer's answers. The strings are markup, so they stay in code;
// every ♯ and ♭ is made speakable (`signsHtml`). A wrong answer that holds a
// misconception links back to the step whose toy answers it (steps 2, 3, 5
// and 6); question 2's two wrong answers both do, since "They're the same
// size" is mix-up card 1's belief. Question 2 is answered by ear: its play
// button and its "1st" and "2nd" chips sit in its slot (quiz-pair.ts).
// The ids are the telemetry's question_id on every page that asks them;
// Lesson 3's recall check asks questions 2 and 4 as `l02-q2` and `l02-q4`.

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_PAIR_SLOT } from './quiz-pair'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l02-q1',
    question: 'How many semitones make an octave?',
    options: [
      {
        text: '12',
        correct: true,
        feedback:
          'Seven letters and five notes between them: twelve equal steps.',
      },
      {
        text: '7',
        feedback: `Seven is the number of letters. Five more notes sit between them: twelve semitones in all.${tryStep(2)}`,
      },
      {
        text: '8',
        feedback:
          'From A to A there are eight letters, counting both As, and five more notes between them: thirteen notes, so twelve semitone steps.',
      },
    ],
  },
  {
    id: 'l02-q2',
    question: 'Listen to two steps. Which one is the semitone?',
    slot: QUIZ_PAIR_SLOT,
    options: [
      {
        text: 'The second',
        correct: true,
        feedback:
          'B to C: two white keys, but only one semitone. The first, A to B, is a tone.',
      },
      {
        text: 'The first',
        feedback: `${signsHtml('The first, A to B, is a tone, with A♯ between them.')} The second, B to C, is the semitone: two white keys with nothing between.${tryStep(3)}`,
      },
      {
        text: "They're the same size",
        feedback: `${signsHtml("Listen again: the first, A to B, has A♯ between, so it's a tone, twice the size of the second, B to C.")}${tryStep(3)}`,
      },
    ],
  },
  {
    id: 'l02-q3',
    question: signsHtml('C♯ and D♭: one key or two?'),
    options: [
      {
        text: 'One key, with two names',
        correct: true,
        feedback:
          'One semitone up from C and one semitone down from D land on the same key.',
      },
      {
        text: 'Two keys, side by side',
        feedback: `${signsHtml("There's only one key between C and D: C♯ is a semitone up from C, D♭ a semitone down from D, and both land on it.")}${tryStep(5)}`,
      },
      {
        text: 'It depends on the music around it',
        feedback: signsHtml(
          'The music around it decides which name is written, not which key: C♯ and D♭ are one key either way.',
        ),
      },
    ],
  },
  {
    id: 'l02-q4',
    question: 'How many cents is a tone?',
    options: [
      {
        text: '200',
        correct: true,
        feedback: 'Two equal semitones, a hundred cents each.',
      },
      {
        text: '100',
        feedback: `That's one semitone. A tone is two of them: 200 cents.${tryStep(6)}`,
      },
      {
        text: '2',
        feedback:
          'Two is how many semitones make a tone. Each is a hundred cents, so a tone is 200.',
      },
    ],
  },
]
