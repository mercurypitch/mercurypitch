// ============================================================
// Lesson 15 recall and quick check — two quizzes on the kit's quiz
// ============================================================
//
// The recall, straight after the hero, is shown to everyone, because
// Lesson 2 is this lesson's prerequisite (WEB-SPEC, Toys 7; FACTS 7):
// Lesson 2's questions 2 and 3, under their own ids (quiz-questions.ts).
// The kit's quiz runs them under its own id prefix and storage keys, with
// a seed of their own, and marks no lesson done; earlier answers are never
// shown, so the answers measure delayed retrieval. "Try Lesson 2, Step N
// again" opens Lesson 2's page at that step in a new tab, so the viewer
// keeps their place here. Question 2's Play is Lesson 2's own pair, A4 to
// B4 then B4 to C5 (FACTS 61), played by Lesson 2's handler on this quiz's
// host with the page's one sound owner, so a newer sound anywhere stops it
// and it stops what played before.
//
// The quick check's four questions mark Lesson 15 done once each has an
// answer. Question 2's Play the three notes plays E4, F4 and G4, 0.5 s
// each with onsets 0.6 s apart (FACTS 65), and lights each on the
// question's small treble staff as it sounds, with no pitch line beside
// it, where they stay at rest once heard; its button is lit while they
// sound, and the play is the page's one sound too.

import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Mark } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene } from '@/features/lessons/kit/staff-draw'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { bindQuizPair } from '@/features/lessons/lesson-02/quiz-pair'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { STEP_PLAYS } from './sounds'

/** The small staff's size in the question's slot, px. */
const SMALL = { w: 168, h: 64 }

/** Question 2's three notes: E, F and G up the treble staff (FACTS 65). */
const THREE = STEP_PLAYS.efg.notes

/**
 * Handles the quick check's Play the three notes wherever the quiz `host`
 * renders it, lighting each note on the slot's small staff as it sounds.
 */
export function bindThreeNotes(host: HTMLElement): void {
  let marks: Mark[] = []
  let run: Run | null = null
  let button: HTMLButtonElement | null = null
  let plays = 0

  const draw = (): void => {
    const el = host.querySelector<SVGSVGElement>('[data-quiz-staff]')
    if (el === null) return
    drawScene(
      el,
      {
        ...emptyScene('treble', [0, 8]),
        marks: marks.filter((m) => m !== undefined),
        cols: THREE.length,
        small: true,
      },
      SMALL,
    )
  }

  function stop(): void {
    if (run === null) return
    plays += 1
    run.stop()
    end()
  }

  // the notes stay on the staff at rest once they have sounded
  function end(): void {
    run = null
    marks = marks.map((m) => ({ ...m, tone: 'rest' }))
    button?.classList.remove('is-on')
    NowPlaying.release(stop)
    draw()
  }

  host.addEventListener('click', (e) => {
    const b =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-quiz-three]')
        : null
    if (b === null) return
    stop()
    NowPlaying.claim(stop)
    const mine = ++plays
    button = b
    b.classList.add('is-on')
    const r = playNotes(
      THREE.map((n) => ({ t: n.t, midi: midiOf(n.note), dur: n.dur })),
      {
        audible: Sound.canPlay(),
        kind: 'soft',
        onNote: (_n, i) => {
          if (mine !== plays) return
          const next = marks.slice()
          next[i] = { note: THREE[i].note, col: i, tone: 'lit' }
          marks = next
          draw()
        },
      },
    )
    run = r
    void r.done.then(() => {
      if (mine === plays) end()
    })
  })
  draw()
}

/** Mounts the recall and the quick check; the quick check's step links use `deck`. */
export function initQuizzes(deck: StepDeck): { recall: Quiz; check: Quiz } {
  const recall = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: RECALL_KEYS,
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
  bindQuizPair(recall.host, NowPlaying)
  const check = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 15,
    keys: QUIZ_KEYS,
    deck,
  })
  bindThreeNotes(check.host)
  return { recall, check }
}
