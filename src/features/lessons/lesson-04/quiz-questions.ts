// ============================================================
// Lesson 4 questions — the quick check, and the recall from Lesson 2
// ============================================================
//
// Word for word from LESSON.md, in authored order: the stored seed shuffles
// by position, so reordering the options would reshuffle every returning
// viewer's answers. The strings are markup, so they stay in code; every ♯
// is made speakable (`signsHtml`). A wrong answer that holds a misconception
// links back to the step whose toy answers it (steps 1 and 3). Question 3
// is heard: its play button, in its slot, plays `stop-c` (FACTS 58), and the
// page handles it with one listener on the quiz's host.
//
// The recall asks Lesson 2's quick-check questions 1 and 3, the very
// objects Lesson 2's page asks, under their ids `l02-q1` and `l02-q3`
// (FACTS 30); Lesson 3's draft asks the other two. The kit's quiz turns
// their "Try Step N again" into "Try Lesson 2, Step N again", a plain link
// to Lesson 2's page that opens there at the step, in a new tab.

import { signsHtml } from '@/features/lessons/kit/notes'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_2_QUESTIONS } from '@/features/lessons/lesson-02/quiz-questions'

/** "Try Step N again", as a link the quiz turns into a jump to that step. */
const tryStep = (n: number): string =>
  ` <a href="#step-${n}" data-goto-step="${n}">Try Step ${n} again</a>.`

/** The recall's two questions, Lesson 2's own. */
export const RECALL_QUESTIONS: readonly QuizQuestion[] =
  LESSON_2_QUESTIONS.filter((q) => q.id === 'l02-q1' || q.id === 'l02-q3')

/** A recall link's address: Lesson 2's page, open at the step (`/learn/02#step-2`). */
export const recallStepHref = (lesson: number, step: number): string =>
  `/learn/${String(lesson).padStart(2, '0')}#step-${step}`

/** Question 3's play button: Merc climbs to ti and stops. */
export const STOP_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-stop style="--c: var(--signal-blue)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play</button>'

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'l04-q1',
    question: 'Which pattern of steps makes a major scale?',
    options: [
      {
        text: 'Tone, tone, semitone, tone, tone, tone, semitone',
        correct: true,
        feedback: 'Two tone-tone-semitone groups, joined by a tone.',
      },
      {
        text: 'Seven equal steps',
        feedback: `Two of the steps are half the size of the others: semitones, from mi to fa and from ti to do.${tryStep(1)}`,
      },
      {
        text: 'Tone, semitone, tone, tone, tone, semitone, tone',
        feedback:
          "That's the white keys from D to D, a different scale. In a major scale the semitones fall between mi and fa, and between ti and do.",
      },
    ],
  },
  {
    id: 'l04-q2',
    question: 'You start a major scale on D. Which notes does it use?',
    options: [
      {
        text: signsHtml('D, E, F♯, G, A, B, C♯, D'),
        correct: true,
        feedback: signsHtml(
          'Keeping the pattern takes two black keys, F♯ and C♯.',
        ),
      },
      {
        text: 'D, E, F, G, A, B, C, D',
        feedback: `Those are the white keys from D. Their steps come out in a different order, so it isn't do-re-mi.${tryStep(3)}`,
      },
      {
        text: 'C, D, E, F, G, A, B, C',
        feedback:
          "That's the major scale on C. A major scale can start on any note: start on D and do is D.",
      },
    ],
  },
  {
    id: 'l04-q3',
    question:
      'Merc climbs a major scale to ti and stops. What do most listeners hear?',
    slot: STOP_SLOT,
    options: [
      {
        text: 'It sounds unfinished: ti leans up to do',
        correct: true,
        feedback:
          'Ti sits a semitone below do, and most listeners hear it lean home.',
      },
      {
        text: 'It sounds finished: ti is the top of the scale',
        feedback:
          'Ti is the seventh note, not the end. The scale lands home on do, an octave above where it started.',
      },
      {
        text: 'It sounds unfinished only if the scale started on C',
        feedback: signsHtml(
          'The pull goes wherever home goes: start on D, and ti is C♯, which leans up to D.',
        ),
      },
    ],
  },
  {
    id: 'l04-q4',
    question: 'In D major, which note is mi?',
    options: [
      {
        text: signsHtml('F♯'),
        correct: true,
        feedback: signsHtml(
          'Do is D, re is E, mi is F♯. The names move with home.',
        ),
      },
      {
        text: 'E',
        feedback: signsHtml(
          'E is re, the second note. Count up from do: D, E, F♯.',
        ),
      },
      {
        text: 'F',
        feedback: signsHtml(
          'Mi is two tones above do, and two tones above D is F♯. F is only a tone and a semitone up.',
        ),
      },
    ],
  },
]
