// ============================================================
// Lesson 12 questions — the quick check, and the recall from Lesson 10
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code. Every ♯
// is made speakable (`signsHtml`), and every Roman numeral too: it shows
// as printed and is read as its number and quality (numerals.ts; WEB-SPEC,
// Toys 8). A wrong answer that holds a misconception links back to the
// step whose toy answers it (Steps 3, 1, 2, 4, 2 and 5). None of the four
// plays a sound. The kit prints "Right." or "Not quite." before each line,
// so none starts with "Right", "Yes" or "Correct".
//
// The recall asks Lesson 10's questions 1 and 2, the very objects Lesson
// 10's page asks, under their ids `l10-q1` and `l10-q2` (FACTS 7), taken
// from its quiz by id, as Lesson 4's come from Lesson 2's. The kit's quiz
// turns their "Try Step 1 again" and "Try Step 3 again" into "Try Lesson
// 10, Step 1 again" and "Try Lesson 10, Step 3 again", links to Lesson
// 10's page at that step in a new tab, and where Lesson 10 is not live
// keeps the words with no link. The second plays Lesson 10's D minor, its
// button named "Play the question's chord".

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizOptions, QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_10_QUESTIONS } from '@/features/lessons/lesson-10/quiz-questions'
import { numeralHtml } from './numerals'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The quick check's stored answer order and record (WEB-SPEC, Toys 8). */
export const QUIZ_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l12-seed',
  record: 'fyp-l12-quiz-v1',
}

/** The recall's storage keys, its seed and its record (WEB-SPEC, Toys 8). */
export const RECALL_KEYS: QuizOptions['keys'] = {
  seed: 'fyp-l12-recall-seed',
  record: 'fyp-l12-recall-v1',
}

/** The recall's two questions, Lesson 10's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_10_QUESTIONS.filter((q) => q.id === 'l10-q1' || q.id === 'l10-q2')

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l12-q1',
    question: 'In C major, which notes make the chord on la?',
    options: [
      {
        text: 'A, C and E',
        correct: true,
        feedback:
          "La, do and mi: A, with the scale's notes a third and a fifth above it.",
      },
      {
        text: signsHtml('A, C♯ and E'),
        feedback: `${signsHtml("C♯ isn't in C major, and the key's chords use only its notes.")}${tryStep(3)}`,
      },
      {
        text: 'F, A and C',
        feedback: `That's the chord on fa, ${numeralHtml('IV')}. The chord on la is built up from A.${tryStep(1)}`,
      },
    ],
  },
  {
    id: 'l12-q2',
    question: `In C major, the chord on re is written ${numeralHtml('ii')}. What does that tell you?`,
    options: [
      {
        text: "Its root is the scale's second note, and it's minor",
        correct: true,
        feedback: 'Re is degree 2, and small letters mean minor: D, F, A.',
      },
      {
        text: "It's the second chord in the song",
        feedback: `A numeral names the root's place in the scale, not the chord's place in a song.${tryStep(2)}`,
      },
      {
        text: "Its root is the scale's second note, and it's diminished",
        feedback: `A diminished chord adds a small circle, as in ${numeralHtml('vii°')}. D, F, A is 3 then 4 semitones: minor.`,
      },
    ],
  },
  {
    id: 'l12-q3',
    question: `In C major, what are the roots of ${numeralHtml('I–V–vi–IV')}?`,
    options: [
      {
        text: 'C, G, A and F',
        correct: true,
        feedback: 'Do, so, la and fa: degrees 1, 5, 6 and 4.',
      },
      {
        text: 'C, D, E and F',
        feedback: `Those are the scale's first four notes. The numerals point to degrees 1, 5, 6 and 4.${tryStep(4)}`,
      },
      {
        text: 'A, E, F and D',
        feedback: `That counts from A. The numerals count from the key's do, C.${tryStep(2)}`,
      },
    ],
  },
  {
    id: 'l12-q4',
    question:
      "A friend says: “Those two songs use the same four chords. They're the same song.” What does this lesson suggest?",
    options: [
      {
        text: 'Not necessarily: the tune, in its rhythm, can make them two songs',
        correct: true,
        feedback:
          "Ask someone to sing a song, and they'll usually sing its tune. Two tunes can share every chord.",
      },
      {
        text: 'Same chords, same song',
        feedback: `This lesson's two tunes share every chord and are still two tunes.${tryStep(5)}`,
      },
      {
        text: "Only if they're in the same key",
        feedback:
          'Even in the same key, a different tune over the same chords can make a different song.',
      },
    ],
  },
]
