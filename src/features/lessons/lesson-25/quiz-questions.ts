// ============================================================
// Lesson 25 questions — the quick check, and the recall from Lessons 10 and 21
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code, and every ♯ and ♭ is made speakable (`signsHtml`). A
// wrong answer that holds a misconception links back to the step whose toy
// answers it (Steps 3, 1, 4 and 3). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct" (WEB-SPEC, Toys 7; FACTS 66 to 69). Question 4 is heard: its
// slot plays A melodic minor going up in the learner's octave, 3.15 s, the
// same on every visit (recall.ts binds it), and its button shows "Play"
// and is named "Play the question's scale", so its name holds what it
// shows (WCAG 2.5.3) and never matches Step 3's plays.
//
// The recall asks Lesson 10's question 4 and Lesson 21's question 2, the
// very objects those pages ask, under their ids `l10-q4` and `l21-q2`
// (FACTS 7), each taken from its quiz by id. The kit's quiz turns their
// "Try Step 5 again" and "Try Step 4 again" into "Try Lesson 10, Step 5
// again" and "Try Lesson 21, Step 4 again", links to that page at that
// step in a new tab, and where the lesson is not live keeps the words with
// no link. Neither has a play, and neither says what a raised note does to
// a chord (FACTS 1a).

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_10_QUESTIONS } from '@/features/lessons/lesson-10/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_21_QUESTIONS } from '@/features/lessons/lesson-21/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** Question 4's play, in its slot: "Play", named for what it plays. */
const SCALE_PLAY =
  '<button class="btn sm tint" type="button" data-quiz-play="scale" aria-label="Play the question\'s scale" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

/** The quick check's stored answer order and record (WEB-SPEC, Toys 7). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l25-seed',
  record: 'fyp-l25-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 7). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l25-recall-seed',
  record: 'fyp-l25-recall-v1',
}

/** The recall's two questions, Lesson 10's own and Lesson 21's, in that order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  ...LESSON_10_QUESTIONS.filter((q) => q.id === 'l10-q4'),
  ...LESSON_21_QUESTIONS.filter((q) => q.id === 'l21-q2'),
]

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l25-q1',
    question: 'In A harmonic minor, which note is raised?',
    options: [
      {
        text: signsHtml('G to G♯: te becomes ti'),
        correct: true,
        feedback: 'Ti leans up to do, a semitone above.',
      },
      {
        text: signsHtml('F to F♯: le becomes la'),
        feedback: `That's melodic minor's extra raise, going up.${tryStep(3)}`,
      },
      {
        text: signsHtml('C to C♯: me becomes mi'),
        feedback: signsHtml(
          "Mi would make the home chord, A, C♯ and E, major: Lesson 10's change.",
        ),
      },
    ],
  },
  {
    id: 'l25-q2',
    question: 'Why does a minor key often raise te just before it comes home?',
    options: [
      {
        text: 'Ti sits a semitone under do and makes the chord on so major',
        correct: true,
        feedback: signsHtml(
          'E, G♯ and B, so, ti and re, make a major chord, and ti leans up to do.',
        ),
      },
      {
        text: 'To turn the key into a major key',
        feedback: `Only one note moves; me keeps the key minor.${tryStep(1)}`,
      },
      {
        text: 'Because natural minor has no seventh',
        feedback: 'It has one, te, a tone under do.',
      },
    ],
  },
  {
    id: 'l25-q3',
    question: "Which key shares C major's key signature?",
    options: [
      {
        text: 'A minor',
        correct: true,
        feedback: 'Relative keys: same notes, do on A.',
      },
      {
        text: 'C minor',
        feedback: `C minor shares C major's do, not its signature: it has three flats.${tryStep(4)}`,
      },
      {
        text: 'A major',
        feedback:
          "A major has three sharps: it shares A minor's do, not C major's signature.",
      },
    ],
  },
  {
    id: 'l25-q4',
    question: 'Listen. Which scale is this, going up?',
    slot: SCALE_PLAY,
    options: [
      {
        text: 'Melodic minor',
        correct: true,
        feedback: 'Le and te were both raised on the way up.',
      },
      {
        text: 'Natural minor',
        feedback: `Listen to the top: the last two steps are tone, semitone.${tryStep(3)}`,
      },
      {
        text: 'Major',
        feedback:
          'Close: going up, melodic minor differs from major by one note, the third.',
      },
    ],
  },
]
