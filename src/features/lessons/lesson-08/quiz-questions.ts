// ============================================================
// Lesson 8 questions — the quick check
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. A wrong
// answer that holds a misconception links back to the step whose toy
// answers it (Steps 2, 3, 4 and 5). Question 2 is heard: its play button
// sits in its slot (quiz-play.ts plays it). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct". The recall's questions, Lesson 6's, are recall.ts's, so a page
// that asks these four again (Lesson 17's recall) loads none of Lesson 6's.

import type { QuizQuestion } from '@/features/lessons/kit/quiz'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** Question 2's play button, in its slot. */
const PLAY_BARS =
  '<button class="btn sm tint" type="button" data-quiz-play="bars" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play two bars</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l08-q1',
    question: 'What does a tempo of 120 BPM mean?',
    options: [
      {
        text: '120 beats every minute: two a second',
        correct: true,
        feedback: 'BPM counts beats per minute, so 120 is twice as fast as 60.',
      },
      {
        text: '120 beats in every bar',
        feedback: `A bar holds a few beats, often 2, 3 or 4. BPM counts beats per minute.${tryStep(2)}`,
      },
      {
        text: 'The song lasts 120 seconds',
        feedback:
          'Tempo says how fast the beats come, not how long the song lasts.',
      },
    ],
  },
  {
    id: 'l08-q2',
    question: 'Listen. How many beats are in each bar?',
    slot: PLAY_BARS,
    options: [
      {
        text: '3',
        correct: true,
        feedback: 'The high click came back every third beat: 1 2 3, 1 2 3.',
      },
      {
        text: '2',
        feedback: `Count from one high click to the next: three beats.${tryStep(3)}`,
      },
      {
        text: '4',
        feedback:
          'The high click came back before a fourth beat: 1 2 3, then 1 again.',
      },
    ],
  },
  {
    id: 'l08-q3',
    question: 'In a bar of four, where does a backbeat go?',
    options: [
      {
        text: 'On 2 and 4',
        correct: true,
        feedback: 'Claps or a snare on the two weak beats.',
      },
      {
        text: 'On 1 and 3',
        feedback: `Those are the strong beats, where the rock beat's kick sits. The backbeat goes on 2 and 4.${tryStep(4)}`,
      },
      {
        text: 'On every beat',
        feedback:
          'A sound on every beat marks the pulse. A backbeat is only 2 and 4.',
      },
    ],
  },
  {
    id: 'l08-q4',
    question:
      'Same song, same speed: the claps move from 1 and 3 to 2 and 4. What changed?',
    options: [
      {
        text: 'The rhythm: which beats are stressed',
        correct: true,
        feedback: 'The tempo stayed; the pattern of stresses moved.',
      },
      {
        text: 'The tempo',
        feedback: `The beats came just as fast. Only the claps moved.${tryStep(5)}`,
      },
      {
        text: 'Nothing: the speed is what makes the rhythm',
        feedback:
          'Speed is the tempo. Rhythm is the pattern of sounds on the beats, and that moved.',
      },
    ],
  },
]
