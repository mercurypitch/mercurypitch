// ============================================================
// Lesson 5 questions — the quick check, and the recall from Lesson 3
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code.
//
// The recall asks Lesson 3's quiz questions 3 and 4 as committed, under
// Lesson 3's ids (FACTS 3; quiz-questions.test.ts holds them to Lesson 3's
// own). Their "Try Step N again" links are written as Lesson 3 writes them;
// the kit's quiz turns a question from another lesson into a plain link to
// that lesson's page, in a new tab, reading "Try Lesson 3, Step N again"
// (kit/quiz.ts `linkAway`), and recallStepHref opens that page at the step,
// which Lesson 3's step deck reads from the address. Neither plays a sound.

import type { QuizQuestion } from '@/features/lessons/kit/quiz'

// A recall link's address, the lesson's own page open at the step: the kit's.
export { recallStepHref } from '@/features/lessons/kit/quiz'

const step = (n: number): string =>
  `<a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l05-q1',
    question: "What is your diaphragm's main job?",
    options: [
      {
        text: 'Breathing in: it tightens, and air flows in',
        correct: true,
        feedback:
          "It mostly works on the breath in, and it can't push air out.",
      },
      {
        text: 'Pushing air out hard when you sing a note',
        feedback: `Full lungs and your belly and rib muscles push it out. ${step(2)}`,
      },
      {
        text: "Vibrating, to make your voice's sound",
        feedback:
          'Your vocal folds make the note (Lesson 3). The diaphragm moves air.',
      },
    ],
  },
  {
    id: 'l05-q2',
    question:
      'A singer pushes more and more air into a long note. What happens to the note?',
    options: [
      {
        text: 'It gets louder, and it tends to drift higher',
        correct: true,
        feedback: 'More pressure means louder, and a little higher.',
      },
      {
        text: 'It gets steadier',
        feedback: `A harder push makes the line climb, not settle. ${step(1)}`,
      },
      {
        text: 'It gets louder and stays on the same note',
        feedback:
          'Loud and high are different things, but in a voice one push moves both.',
      },
    ],
  },
  {
    id: 'l05-q3',
    question:
      'For a long, easy note, which start do many singing teachers aim for?',
    options: [
      {
        text: 'Air and sound starting together',
        correct: true,
        feedback: 'The easy start: no puff first, and no catch.',
      },
      {
        text: 'A puff of air first, like &#8220;h&#8221;',
        feedback: `A soft &#8220;h&#8221; is a way in; then lose the puff. ${step(4)}`,
      },
      {
        text: 'A little catch, to start the note firmly',
        feedback:
          "A catch starts with the folds pressed shut; the easy start doesn't.",
      },
    ],
  },
  {
    id: 'l05-q4',
    question: 'What does a steady long note look like on the pitch line?',
    options: [
      {
        text: 'It settles into the band and stays there',
        correct: true,
        feedback: 'It can wave a little and still stay in the band.',
      },
      {
        text: 'A perfectly straight line, with no movement at all',
        feedback: `Steady isn't dead straight: a small vibrato can sit inside the band. ${step(5)}`,
      },
      {
        text: 'The longest line you can make on one breath',
        feedback:
          "Length isn't the goal. Holds here are a fixed 5, 10 or 15 seconds, never a contest.",
      },
    ],
  },
]

/** Lesson 3's questions 3 and 4, asked again here (FACTS 3). */
export const RECALL_QUESTIONS: readonly QuizQuestion[] = [
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
