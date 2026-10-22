// ============================================================
// Lesson 3 questions — the quick check, and the recall from Lesson 2
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code.
//
// The recall asks Lesson 2's quiz questions 2 and 4 as committed, under
// their own ids (FACTS 44). Their "Try Step N again" links are written as
// Lesson 2 writes them; the kit's quiz turns a question from another lesson
// into a plain link to that lesson's page, reading "Try Lesson 2, Step N
// again" (kit/quiz.ts `linkAway`), and recallStepHref opens that page at the
// step (WEB-SPEC, New engineering 6: Lesson 2's step deck reads the
// address). Question 2's play button sits in its slot, outside its answers'
// names; recall.ts plays it.

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'

const A_SHARP = signsHtml('A♯')

// A recall link's address, the lesson's own page open at the step: the kit's.
export { recallStepHref } from '@/features/lessons/kit/quiz'

const step = (n: number): string =>
  `<a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l03-q1',
    question: 'When you sing a higher note, what are your vocal folds doing?',
    options: [
      {
        text: 'Vibrating faster',
        correct: true,
        feedback: 'Stretched longer and tighter, they vibrate faster.',
      },
      {
        text: 'Vibrating more slowly',
        feedback: 'Slower vibration gives a lower note.',
      },
      {
        text: 'Staying still while your mouth makes the note',
        feedback: `The mouth shapes the sound; the note starts with the folds. ${step(1)}`,
      },
    ],
  },
  {
    id: 'l03-q2',
    question:
      "Someone says: &#8220;I can't sing. I'm tone deaf.&#8221; What's most likely?",
    options: [
      {
        text: 'Their ears are probably fine; the link to the voice needs practice',
        correct: true,
        feedback:
          'Most people who sing off hear pitch changes as well as accurate singers do.',
      },
      {
        text: "They can't hear the difference between notes",
        feedback: "That's congenital amusia, about 1.5&#8239;% of people.",
      },
      {
        text: 'They need to train their ears before they can sing',
        feedback:
          "Most people who sing off already hear pitch changes as well as accurate singers do: it's the link that needs practice.",
      },
    ],
  },
  {
    id: 'l03-q3',
    question:
      'Merc sings an A3. You sing an A2, an octave lower and 20 cents high. Where is your note?',
    options: [
      {
        text: 'In the band: the same note, an octave lower',
        correct: true,
        feedback: 'An octave away counts, and 20 cents is inside the band.',
      },
      {
        text: 'Outside the band: an octave is 1,200 cents away',
        feedback: `An octave match counts: in Merc's octave, your note is 20 cents high. ${step(4)}`,
      },
      {
        text: 'Off the note: in tune means exactly 0 cents',
        feedback: `In tune is a band, and 20 cents is inside it. ${step(5)}`,
      },
    ],
  },
  {
    id: 'l03-q4',
    question: 'How loud should you sing when you practise matching?',
    options: [
      {
        text: 'At about the volume you talk at',
        correct: true,
        feedback:
          'No shouting, no whispering: a quiet note is just as much the right note.',
      },
      {
        text: 'Loud and full, like a singer on a stage',
        feedback:
          'A loud note is no more the right note than a quiet one, and shouting is an extreme to avoid.',
      },
      {
        text: 'Almost a whisper, to be gentle',
        feedback:
          'Whispering is an extreme too. Speaking volume is the gentle middle.',
      },
    ],
  },
]

/** Lesson 2's questions 2 and 4, asked again here (FACTS 44). */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l02-q2',
    question: 'Listen to two steps. Which one is the semitone?',
    slot: '<button class="btn sm tint" type="button" data-recall-play style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play the two steps</button>',
    options: [
      {
        text: 'The second',
        correct: true,
        feedback:
          'B to C: two white keys, but only one semitone. The first, A to B, is a tone.',
      },
      {
        text: 'The first',
        feedback: `The first, A to B, is a tone, with ${A_SHARP} between them. The second, B to C, is the semitone: two white keys with nothing between. ${step(3)}`,
      },
      {
        text: "They're the same size",
        feedback: `Listen again: the first, A to B, has ${A_SHARP} between, so it's a tone, twice the size of the second, B to C. ${step(3)}`,
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
        feedback: `That's one semitone. A tone is two of them: 200 cents. ${step(6)}`,
      },
      {
        text: '2',
        feedback:
          'Two is how many semitones make a tone. Each is a hundred cents, so a tone is 200.',
      },
    ],
  },
]
