// ============================================================
// Lesson 4 sing it — Merc's scale, the octave-up scale, the guide, Move do
// ============================================================
//
// Lesson 2's slide guide grown to thirteen rows, do to do (WEB-SPEC, Toys
// 4): the eight scale rows named do to do with the letters of the scale last
// played, in its octave, the other five faint. Play Merc's scale sings the
// model on do = D3 in Merc's "ooh" and Play it an octave up on D4 (FACTS
// 63): up to so and back, a rest, up to ti, a 2 s hold, and do. The path
// lights in the app's target amber as it is sung, while the ring beside it
// shows the still of the Merc singing it, blue for D3 and orange for D4.
//
// Start the guide, enabled once either scale has played, is the viewer's
// turn: a soft count-in on do for its one second, then a chrome line sweeps
// the path for 18.2 s; the ring breathes only through the hold on ti, the
// still of the Merc last heard at its centre. Move do shifts do a semitone
// lower or higher, up to four either way: the rows relabel, the path keeps
// its shape, and both scales and the count-in follow it. Nothing listens.

import { q, qa } from '@/features/lessons/kit/dom'
import { majorScale } from '@/features/lessons/kit/major-scale'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { COUNT_IN_SEC, countIn, nextShift, setMoveEnds, } from '@/features/lessons/kit/move-do'
import { MAJOR_SOLFEGE } from '@/features/lessons/kit/names-modes'
import { hz, nameHtml, wordName } from '@/features/lessons/kit/notes'
import type { Ring, RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import type { GuideRow } from '@/features/lessons/kit/slide-guide'
import { mountGuide } from '@/features/lessons/kit/slide-guide'
import { Sound } from '@/features/lessons/kit/sound'
import { GUIDE_SEC, guidePath, singModel, TI_HOLD } from './examples'

/** Merc's do, and Tavi's an octave up (FACTS 52 and 63). */
const MERC_DO = 50

const DEGREES = [0, 2, 4, 5, 7, 9, 11, 12]

/** The thirteen rows from do up to do: the scale's eight named, the five between them faint. */
export function scaleRows(doMidi: number): GuideRow[] {
  const spelled = majorScale(doMidi)
  return Array.from({ length: 13 }, (_, k) => {
    const i = DEGREES.indexOf(k)
    return i === -1
      ? { midi: doMidi + k, label: '', faint: true }
      : {
          midi: doMidi + k,
          label: `<span class="sol">${MAJOR_SOLFEGE[i]}</span> ${nameHtml(spelled[i])}`,
        }
  })
}

/** The guide's accessible name: its rows in words, and Merc's path over them. */
export function guideLabel(doMidi: number): string {
  const spelled = majorScale(doMidi)
  return (
    `Thirteen rows, ${wordName(spelled[0])} to ${wordName(spelled[7])}, pitch as height, ` +
    "the eight of the scale named do to do: Merc's path climbs do to so and back, rests, " +
    'climbs to ti and holds it, then lands on do an octave up.'
  )
}

/** The ring's label: do's name and frequency. */
const ringLabel = (doMidi: number): string =>
  `Do: ${nameHtml(majorScale(doMidi)[0])} · ${Math.round(hz(doMidi))} Hz`

export function initSing(stills: RingStills): void {
  const section = q('#sing')
  const guideRoot = q('#scaleGuide', section)
  const startBtn = q<HTMLButtonElement>('[data-guide-start]', section)
  const hint = q('[data-guide-hint]', section)
  const scales = qa<HTMLButtonElement>('[data-scale]', section)
  const moves = qa<HTMLButtonElement>('[data-move-do]', section)
  const ring: Ring = mountRing(q('.ring', section), { stills })
  // the scale last played: Merc's (D3) until one plays, then its octave, moved by Move do
  let base = MERC_DO
  let which: Which = 'blue'
  let shift = 0
  let heard = false
  const doMidi = (): number => base + shift
  const guide = mountGuide(guideRoot, {
    rows: scaleRows(doMidi()),
    path: guidePath(doMidi()),
    rest: 'amber',
  })
  // the guide's runs end on timers; the ring's end only in frames it is seen
  // in, so a ring scrolled off screen would hold the buttons for ever
  const busy = (): boolean => guide.busy

  function relabel(): void {
    guide.set(scaleRows(doMidi()), guidePath(doMidi()))
    guideRoot.setAttribute('aria-label', guideLabel(doMidi()))
    setMoveEnds(moves, shift)
  }

  function playScale(b: HTMLButtonElement): void {
    if (busy()) return
    base = Number(b.dataset.scale)
    which = b.dataset.merc === 'orange' ? 'orange' : 'blue'
    relabel()
    b.classList.add('is-on')
    const audible = Sound.canPlay()
    void singModel(doMidi(), audible)
    void ring.run({
      which,
      label: ringLabel(doMidi()),
      listen: GUIDE_SEC,
      turn: 0,
    })
    void guide.model().then(() => {
      b.classList.remove('is-on')
      heard = true
      startBtn.setAttribute('aria-disabled', 'false')
      hint.hidden = true
    })
  }

  // the ring: ready during the count-in, still while the line sweeps, breathing through ti's hold
  function ringThroughGuide(): void {
    const label = ringLabel(doMidi())
    const quiet = { which, label, ripples: false } as const
    void ring.run({
      ...quiet,
      listen: COUNT_IN_SEC,
      turn: 0,
      words: { listen: 'Get ready' },
    })
    window.setTimeout(
      () =>
        void ring.run({
          ...quiet,
          listen: TI_HOLD.from,
          turn: TI_HOLD.to - TI_HOLD.from,
          words: {
            listen: 'Sing with the line',
            turn: (n) => `Wait on ti · ${n}`,
          },
        }),
      COUNT_IN_SEC * 1000,
    )
    window.setTimeout(
      () =>
        void ring.run({
          ...quiet,
          listen: GUIDE_SEC - TI_HOLD.to,
          turn: 0,
          words: { listen: 'Land on do' },
        }),
      (COUNT_IN_SEC + TI_HOLD.to) * 1000,
    )
  }

  for (const b of scales) b.addEventListener('click', () => playScale(b))

  startBtn.addEventListener('click', () => {
    if (!heard || busy()) return
    startBtn.classList.add('is-on')
    countIn(doMidi(), Sound.canPlay())
    ringThroughGuide()
    void guide
      .sweep(COUNT_IN_SEC)
      .then(() => startBtn.classList.remove('is-on'))
  })

  for (const b of moves)
    b.addEventListener('click', () => {
      if (busy()) return
      shift = nextShift(shift, b)
      relabel()
    })

  relabel()
}
