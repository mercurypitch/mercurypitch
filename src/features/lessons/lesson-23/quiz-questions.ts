// ============================================================
// Lesson 23 questions — the quick check, and the recall from Lesson 6
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code. A wrong answer that holds a misconception links back
// to the step whose toy answers it (Steps 2, 3, 1 and 4). The kit prints
// "Right." or "Not quite." before each line, so none starts with "Right",
// "Yes" or "Correct". Question 4 is heard: its slot plays B3 and F4
// together for 1.5 s, the same for everyone (recall.ts binds it), and its
// button shows "Play" and is named "Play the question's interval", so its
// name holds what it shows (WCAG 2.5.3) and never matches Step 4's play
// (WEB-SPEC, Toys 7; FACTS 73, 78). Lesson 27 plans to ask question 1 and
// Lesson 24 question 3 as their recalls (FACTS 75, 77), so the ids, the
// words and question 4's slot stay as they are once shipped.
//
// The recall asks Lesson 6's questions 3 and 4, the very objects Lesson
// 6's page asks, under their ids `l06-q3` and `l06-q4` (FACTS 7), taken
// from its quiz by id, as Lesson 10's page takes its two. The kit's quiz
// turns their "Try Step 2 again" and "Try Step 4 again" into "Try Lesson
// 6, Step 2 again" and "Try Lesson 6, Step 4 again", links to Lesson 6's
// page at that step in a new tab. The first keeps Lesson 6's own Play,
// C4 then F4, a perfect fourth, which Lesson 6's quiz plays handle; the
// second has none. Neither names six semitones, F sharp, a tritone or the
// middle of the octave (FACTS 1a).

import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_6_QUESTIONS } from '@/features/lessons/lesson-06/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 7). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l23-seed',
  record: 'fyp-l23-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 7). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l23-recall-seed',
  record: 'fyp-l23-recall-v1',
}

/** The recall's two questions, Lesson 6's own, in its order. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_6_QUESTIONS.filter((q) => q.id === 'l06-q3' || q.id === 'l06-q4')

/** Question 4's play button, in its slot: B3 and F4 together (FACTS 73). */
const PLAY_INTERVAL =
  '<button class="btn sm tint" type="button" data-quiz-play="tritone" aria-label="Play the question\'s interval" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l23-q1',
    question:
      'How many semitones does the interval that splits the octave in half span?',
    options: [
      {
        text: '6',
        correct: true,
        feedback: "Six up and six more make the octave's twelve.",
      },
      {
        text: '7',
        feedback: `Seven is the perfect fifth, C up to G, and five more make the octave.${tryStep(2)}`,
      },
      {
        text: '5',
        feedback: 'Five is the perfect fourth. Half of twelve is six.',
      },
    ],
  },
  {
    id: 'l23-q2',
    question:
      'C up to G is a perfect fifth. Turn it upside down: G up to C. What is it?',
    options: [
      {
        text: 'A perfect fourth',
        correct: true,
        feedback: '5 and 4 make 9, 7 and 5 make 12, and perfect stays perfect.',
      },
      {
        text: 'A perfect fifth',
        feedback: `Only the tritone keeps its semitones when it turns over.${tryStep(3)}`,
      },
      {
        text: 'A minor fourth',
        feedback: 'Fourths are perfect, never major or minor.',
      },
    ],
  },
  {
    id: 'l23-q3',
    question: 'Which of these is never called major or minor?',
    options: [
      {
        text: 'A fifth',
        correct: true,
        feedback: 'Unisons, fourths, fifths and octaves are perfect.',
      },
      {
        text: 'A third',
        feedback: `Thirds come in major and minor: 4 semitones or 3.${tryStep(1)}`,
      },
      {
        text: 'A sixth',
        feedback: 'Sixths come in major and minor, like thirds.',
      },
    ],
  },
  {
    id: 'l23-q4',
    question: 'Listen. Which interval is this?',
    slot: PLAY_INTERVAL,
    options: [
      {
        text: 'A tritone',
        correct: true,
        feedback: 'B up to F: six semitones, the halfway interval.',
      },
      {
        text: 'A perfect fifth',
        feedback: `B up to F is a fifth, but a semitone short of perfect: six semitones.${tryStep(4)}`,
      },
      {
        text: 'A perfect fourth',
        feedback: 'A perfect fourth is five semitones. This one is six.',
      },
    ],
  },
]
