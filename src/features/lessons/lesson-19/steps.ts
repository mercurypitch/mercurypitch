// ============================================================
// Lesson 19 steps — four steps, one rhythm bar
// ============================================================
//
// Every step shows the one rhythm bar (kit/rhythm-bar.ts), each in its own
// state (WEB-SPEC, Toys 1, 5 and 6; rhythm-views.ts): Step 1's six eighths
// as a bar of 6/8 or 3/4 on the drums; Step 2's two tunes on the learner's
// staff, with Count, Clef and the pitch line; Step 3's beat 3 split in two
// or in three; Step 4's note on 3 or on "2 and". Each step's controls are
// the row marked for its state; the caption, the rows and the bar follow
// the step through the deck's `onStep`, and leaving a step stops what it
// plays. A switch redraws the bar and plays nothing until Play (Toys 1):
// the notes it leaves stay written as they were heard, and the rest are
// written as they first sound, for the visit. Step 2's text plays either
// tune from its own two buttons.

import { q, qa } from '@/features/lessons/kit/dom'
import { bookDrum } from '@/features/lessons/kit/drum-hits'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { PlayPart, RhythmBar, RhythmView, } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { figureSize } from '@/features/lessons/kit/rhythm-draw'
import { placeRow } from '@/features/lessons/kit/rhythm-layout'
import type { Clef } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { MetreKey, Move, Split, StepState } from './rhythm-views'
import { FIG, keptWritten, lineView, sixPart, sixView, STATE_OF, STEP_BPM, syncBar, tripletBar, tuneParts, tuneView, } from './rhythm-views'

/** The figure's width from which Step 2's tune fits on one system of four bars, an eighth then 19 px or more. */
export const TUNE_WIDE = 540

/** What each switch says it changed, in the figure's polite region. */
export const SWITCH_SAID = {
  '6-8': '6/8: the six eighths in two groups of three',
  '3-4': '3/4: the six eighths in three groups of two',
  tune: { '6-8': 'The 6/8 tune', '3-4': 'The 3/4 tune' },
  eighths: 'Beat 3 as two eighth notes',
  triplet: 'Beat 3 as a triplet: three eighth notes in the time of two',
  'on-3': 'The third note back on beat 3',
  'on-2-and': 'The third note moved to “2 and”, tied through beat 3',
  bass: 'The bass staff: the tune from C3',
  treble: 'The treble staff: the tune from C4',
} as const

interface StepsState {
  step: number
  metre: MetreKey
  tune: MetreKey
  clef: Clef
  split: Split
  move: Move
  /** Count, by step: Steps 2, 3 and 4 have it. */
  counts: Record<number, boolean>
  /** The pitch line, Step 2's own. */
  lanes: boolean
}

/** A view's symbols, row after row, as one list. */
const flat = (view: RhythmView) =>
  view.scene.rows.flatMap((row) => placeRow(row))

/**
 * Mounts the stage's rhythm bar and follows the deck: called before
 * `deck.start()`, so an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): RhythmBar {
  const root = q('#toyRhythm')
  const figure = q('[data-rb]', root)
  const label = q('[data-fig-label]', root)
  const lanesBtn = q<HTMLButtonElement>('[data-rb-lanes]', root)
  const light = playLights()
  const s: StepsState = {
    step: 1,
    metre: '6-8',
    tune: '6-8',
    clef: VoiceChoice.voice === 'higher' ? 'treble' : 'bass',
    split: 'eighths',
    move: 'on-3',
    counts: { 2: false, 3: false, 4: false },
    lanes: false,
  }
  // what was heard of each step's bar, and of each tune, for the visit
  const heard = new Map<string, readonly boolean[]>()
  const keyOf = (): string => (s.step === 2 ? `2:${s.tune}` : String(s.step))

  // Steps 3 and 4 on the stored voice's A; Step 2's tune on its clef
  const higher = (): boolean =>
    s.step === 2 ? s.clef === 'treble' : VoiceChoice.voice === 'higher'
  const bar = mountRhythmBar({
    figure,
    pads: q<HTMLElement>('[data-rb-pads]', root),
    said: q<HTMLElement>('[data-rb-said]', figure),
    freq: () => hz(higher() ? A4 : A3),
    voice: () => (higher() ? 'tavi' : 'merc'),
    owner: NowPlaying,
    drum: bookDrum,
  })

  const systems = (): 1 | 2 => (figureSize(figure).w >= TUNE_WIDE ? 1 : 2)

  /** The step's own bar as it stands. */
  function ownView(): RhythmView {
    if (s.step === 1) return sixView(s.metre)
    if (s.step === 2) return tuneView(s.tune, s.clef, systems())
    if (s.step === 3) return lineView(tripletBar(s.split))
    return lineView(syncBar(s.move))
  }

  /** What is written of the bar shown, row after row. */
  const writtenNow = (): boolean[] =>
    (bar.view?.scene.rows ?? []).flatMap((_, r) => bar.written(r))

  /** Keeps what was heard of the step's bar, for the visit. */
  const keep = (): void => {
    heard.set(keyOf(), writtenNow())
  }

  /** Draws the step's own bar, `written` its symbols as heard, row after row. */
  function showOwn(
    written: readonly boolean[] = heard.get(keyOf()) ?? [],
  ): void {
    const view = ownView()
    const starts = view.scene.rows.map((_, r) =>
      view.scene.rows
        .slice(0, r)
        .reduce((k, row) => k + placeRow(row).length, 0),
    )
    bar.show(view, (r, i) => written[starts[r] + i] === true)
  }

  /** A switch: the bar redrawn, keeping what it leaves as heard; said, and nothing played. */
  function change(apply: () => void, line: string): void {
    bar.stop()
    const before = bar.view === null ? [] : flat(bar.view)
    const was = writtenNow()
    apply()
    showOwn(keptWritten(before, was, flat(ownView())))
    bar.say(line)
  }

  /** Plays the step's own bar: Step 1's on its drums, Step 2's tune system by system, Steps 3 and 4 over the click. */
  function playOwn(btn: HTMLButtonElement | null): void {
    const view = bar.view
    if (view === null) return
    const parts: PlayPart[] =
      s.step === 1
        ? [sixPart(view, s.metre)]
        : s.step === 2
          ? tuneParts(view)
          : [{ view, bpm: () => STEP_BPM }]
    const done = bar.play(parts)
    if (btn !== null) light(btn, done)
  }

  const pressed = (attr: string, value: string): void => {
    for (const b of qa<HTMLButtonElement>(`[${attr}]`, root))
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value))
  }

  // ---------------------------------------------------------------- Step 1: 6/8 · 3/4; Step 2: the tune
  for (const b of qa<HTMLButtonElement>('[data-rb-metre]', root))
    b.addEventListener('click', () => {
      const key: MetreKey = b.dataset.rbMetre === '3-4' ? '3-4' : '6-8'
      if (s.step === 2) return pickTune(key)
      if (key === s.metre) return
      change(() => {
        s.metre = key
      }, SWITCH_SAID[key])
      pressed('data-rb-metre', key)
    })

  /** Step 2's tune: the other tune's staff, as it was heard. */
  function pickTune(key: MetreKey): void {
    if (key === s.tune) return
    bar.stop()
    keep()
    s.tune = key
    showOwn()
    pressed('data-rb-metre', key)
    bar.say(SWITCH_SAID.tune[key])
  }

  // ---------------------------------------------------------------- Step 2: Clef, and the tunes from the text
  const setClef = (c: Clef): void => {
    s.clef = c
    pressed('data-rb-clef', c)
  }
  setClef(s.clef)
  for (const b of qa<HTMLButtonElement>('[data-rb-clef]', root))
    b.addEventListener('click', () => {
      const c: Clef = b.dataset.rbClef === 'treble' ? 'treble' : 'bass'
      if (c === s.clef) return
      bar.stop()
      const was = writtenNow()
      setClef(c)
      showOwn(was)
      bar.say(SWITCH_SAID[c])
    })

  for (const b of qa<HTMLButtonElement>('[data-tune-play]'))
    b.addEventListener('click', () => {
      const key: MetreKey = b.dataset.tunePlay === '3-4' ? '3-4' : '6-8'
      if (deck.current !== 2) deck.show(2, { scroll: false })
      pickTune(key)
      playOwn(b)
    })

  // ---------------------------------------------------------------- Step 3: Eighths · Triplet; Step 4: On 3 · On 2 and
  for (const b of qa<HTMLButtonElement>('[data-rb-split]', root))
    b.addEventListener('click', () => {
      const split: Split =
        b.dataset.rbSplit === 'triplet' ? 'triplet' : 'eighths'
      if (split === s.split) return
      change(() => {
        s.split = split
      }, SWITCH_SAID[split])
      pressed('data-rb-split', split)
    })
  for (const b of qa<HTMLButtonElement>('[data-rb-move]', root))
    b.addEventListener('click', () => {
      const move: Move = b.dataset.rbMove === 'on-2-and' ? 'on-2-and' : 'on-3'
      if (move === s.move) return
      change(() => {
        s.move = move
      }, SWITCH_SAID[move])
      pressed('data-rb-move', move)
    })

  // ---------------------------------------------------------------- every step: Play, Count and the pitch line
  for (const btn of qa<HTMLButtonElement>('[data-rb-play]', root))
    btn.addEventListener('click', () => playOwn(btn))
  for (const btn of qa<HTMLButtonElement>('[data-rb-count]', root))
    btn.addEventListener('click', () => {
      const on = !(s.counts[s.step] ?? false)
      s.counts[s.step] = on
      btn.setAttribute('aria-pressed', String(on))
      bar.see({ counts: on })
    })
  lanesBtn.addEventListener('click', () => {
    s.lanes = !s.lanes
    lanesBtn.setAttribute('aria-pressed', String(s.lanes))
    bar.see({ lanes: s.lanes })
  })

  // a phone turned on its side may fit the tune on one system, or no longer
  if (typeof ResizeObserver !== 'undefined')
    new ResizeObserver(() => {
      if (s.step !== 2 || bar.playing) return
      if ((bar.view?.scene.rows.length ?? 0) === systems()) return
      keep()
      showOwn()
    }).observe(figure)

  // ---------------------------------------------------------------- the deck
  /** A step's state opens: its row, its caption, how it is seen, and its bar as heard. */
  function open(n: number): void {
    const state: StepState = STATE_OF[n] ?? 'metre'
    for (const row of qa('[data-rb-for]', root))
      row.hidden = row.dataset.rbFor !== state
    label.innerHTML = FIG[n] ?? FIG[1]
    bar.see({ counts: s.counts[n] ?? false, lanes: n === 2 && s.lanes })
    pressed('data-rb-metre', n === 2 ? s.tune : s.metre)
    showOwn()
  }

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap, or Step 1 as the deck starts: nothing changes
      if (n === previous) return
      bar.stop()
      keep()
      s.step = n
      open(n)
    },
  })
  showOwn()
  return bar
}
