// ============================================================
// Lesson 6 questions — the quick check, and the recall from Lesson 4
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code; every ♯
// is made speakable (`signsHtml`). A wrong answer that holds a misconception
// links back to the step whose toy answers it (Steps 3, 5, 2 and 4).
// Questions 1 and 3 are heard: each play button sits in its question's
// slot (quiz-play.ts plays them).
//
// The recall asks Lesson 4's questions 1 and 4, the very objects Lesson 4's
// page asks, under their ids `l04-q1` and `l04-q4` (FACTS 7). The kit's quiz
// turns their "Try Step 1 again" into "Try Lesson 4, Step 1 again", a
// link to Lesson 4's page at that step, in a new tab (WEB-SPEC, Toys 7).

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_4_QUESTIONS } from '@/features/lessons/lesson-04/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The recall's two questions, Lesson 4's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_4_QUESTIONS.filter((q) => q.id === 'l04-q1' || q.id === 'l04-q4')

/** A question's play button, in its slot. */
const playSlot = (what: string, color: string): string =>
  `<button class="btn sm tint" type="button" data-quiz-play="${what}" style="--c: var(${color})"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>`

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l06-q1',
    question: signsHtml(
      'Merc sings the first line from C, then from F♯. What stayed the same?',
    ),
    slot: playSlot('lines', '--signal-blue'),
    options: [
      {
        text: 'The intervals between the notes',
        correct: true,
        feedback:
          'Every note moved up six semitones, so every interval stayed put.',
      },
      {
        text: 'The notes',
        feedback: `${signsHtml('Every note changed: from F♯, each one is a black key.')}${tryStep(3)}`,
      },
      {
        text: "Nothing: it's a different tune",
        feedback: "It's still “Twinkle”: its intervals didn't change.",
      },
    ],
  },
  {
    id: 'l06-q2',
    question: 'How far is the leap in “twin-kle, twin-kle”?',
    options: [
      {
        text: '7 semitones: a perfect fifth',
        correct: true,
        feedback:
          'Five letters, C to G, make a fifth; seven semitones make it perfect.',
      },
      {
        text: '5 semitones: a perfect fourth',
        feedback: `Five semitones is the fourth that opens “Auld Lang Syne”. C up to G is seven.${tryStep(5)}`,
      },
      {
        text: 'It depends on the starting note',
        feedback:
          "From any start it's seven: that's why the tune survives a move.",
      },
    ],
  },
  {
    id: 'l06-q3',
    question: 'Listen. From the first note to the second: a step or a leap?',
    slot: playSlot('fourth', '--chrome'),
    options: [
      {
        text: 'A leap',
        correct: true,
        feedback: 'Five semitones up, a perfect fourth, like “Should auld”.',
      },
      {
        text: 'A step',
        feedback: `A step is a semitone or a tone. This one is five semitones.${tryStep(2)}`,
      },
      {
        text: 'The same note twice',
        feedback: 'The second note is higher: five semitones up.',
      },
    ],
  },
  {
    id: 'l06-q4',
    question:
      "A version keeps five of the line's seven notes and every up and down. But it swaps the sizes of its two rises, the leap and the step up. Is it still “Twinkle”?",
    options: [
      {
        text: 'No: two intervals changed',
        correct: true,
        feedback:
          "The ups and downs aren't the whole tune; the sizes count too.",
      },
      {
        text: 'Yes: most of the notes are the same',
        feedback: `Most notes match, but a tune lives in its intervals, and two of them changed.${tryStep(4)}`,
      },
      {
        text: 'Yes: every up and down is the same',
        feedback:
          'Same ups and downs, new sizes: in one study, people recognised familiar tunes changed that way less often than ones that kept the sizes too.',
      },
    ],
  },
]
