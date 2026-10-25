// ============================================================
// Lesson 10 questions — the quick check, and the recall from Lesson 6
// ============================================================
//
// Word for word from LESSON.md, in authored order, the right answer first:
// the stored seed shuffles by position, so reordering the options would
// reshuffle every returning viewer's answers. The strings are markup, so
// they stay in code; every ♭ is made speakable (`signsHtml`). A wrong
// answer that holds a misconception links back to the step whose toy
// answers it (Steps 1, 3, 4 and 5). The kit prints "Right." or "Not
// quite." before each line, so none starts with "Right", "Yes" or
// "Correct". Question 2 is heard: its play button sits in its slot, shows
// "Play" and is named "Play the question's chord", so its name holds what
// it shows (WCAG 2.5.3) and never matches the cold open's Play the chord
// (WEB-SPEC, Toys 8). Lesson 12's recall asks questions 1 and 2 by their
// ids, so the ids and that slot stay as they are once shipped.
//
// The recall asks Lesson 6's questions 2 and 3, the very objects Lesson 6's
// page asks, under their ids `l06-q2` and `l06-q3`, with Lesson 6's play
// button in the second's slot (FACTS 7). The kit's quiz turns their "Try
// Step 5 again" into "Try Lesson 6, Step 5 again", a link to Lesson 6's
// page at that step in a new tab (WEB-SPEC, Toys 8).

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_6_QUESTIONS } from '@/features/lessons/lesson-06/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The recall's two questions, Lesson 6's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_6_QUESTIONS.filter((q) => q.id === 'l06-q2' || q.id === 'l06-q3')

/** Question 2's play button, in its slot: D4, F4 and A4 together (FACTS 79). */
const PLAY_CHORD =
  '<button class="btn sm tint" type="button" data-quiz-play="chord" aria-label="Play the question\'s chord" style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l10-q1',
    question: 'How many semitones are in a minor third?',
    options: [
      {
        text: '3',
        correct: true,
        feedback: "One fewer than a major third's 4.",
      },
      {
        text: '4',
        feedback: `Four semitones make a major third; a minor third is one fewer.${tryStep(1)}`,
      },
      {
        text: '2',
        feedback: signsHtml(
          'Two semitones make a tone, a second. A third is three letters wide: C up to E♭ is 3 semitones.',
        ),
      },
    ],
  },
  {
    id: 'l10-q2',
    question: 'Listen. Is this chord major or minor?',
    slot: PLAY_CHORD,
    options: [
      {
        text: 'Minor',
        correct: true,
        feedback: 'Its third sits 3 semitones above the root: do-me-so.',
      },
      {
        text: 'Major',
        feedback: `A major chord's third is 4 semitones up, and this one's is 3.${tryStep(3)}`,
      },
      {
        text: "It depends on how fast it's played",
        feedback:
          "Tempo can change how happy or sad music sounds, but a chord's quality comes from its third.",
      },
    ],
  },
  {
    id: 'l10-q3',
    question:
      'A friend says: “Minor always sounds sad.” What do the studies in this lesson suggest?',
    options: [
      {
        text: 'It depends: tempo, the rest of the music and what you grew up hearing all play a part',
        correct: true,
        feedback: 'In one study, tempo counted for more than major or minor.',
      },
      {
        text: "They're right: minor sounds sad to everyone",
        feedback: `In two remote communities in northwest Pakistan, listeners rated the major and minor versions about equally pleasant.${tryStep(4)}`,
      },
      {
        text: 'Only musicians hear it that way',
        feedback:
          "In one study, non-musicians' happy and sad ratings followed major and minor too, not just the tempo.",
      },
    ],
  },
  {
    id: 'l10-q4',
    question:
      'In C natural minor, which notes of C major move down a semitone?',
    options: [
      {
        text: 'E, A and B: mi, la and ti become me, le and te',
        correct: true,
        feedback: 'Do, re, fa and so stay where they were.',
      },
      {
        text: 'Only E: mi becomes me',
        feedback: `That one change makes the minor chord. The natural minor scale lowers la and ti too.${tryStep(5)}`,
      },
      {
        text: 'All seven, so the scale starts a semitone lower',
        feedback: 'Do stays home: C major and C minor share their tonic, C.',
      },
    ],
  },
]
