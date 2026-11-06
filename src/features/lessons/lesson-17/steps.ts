// ============================================================
// Lesson 17 steps — five steps, one rhythm bar
// ============================================================
//
// Every step shows the one rhythm bar (kit/rhythm-bar.ts), each in its own
// state (WEB-SPEC, Toys 1 and 5; rhythm-views.ts): Step 1's bar to halve and
// join, with Play the halvings; Step 2's bar at any tempo, with Play both;
// Step 3's two bars, counted; Step 4's pads, each a beat to silence, with
// the rest strip; Step 5's two bars on the staff, with Dot, Tie and Clef.
// Each step's controls are the row marked for its state, and the one
// pitch-line switch moves into it, keeping its place for the visit. The
// figure's label, the rows and the toy's state follow the step through the
// deck's `onStep`, whatever the route, and leaving a step stops what it
// plays.
//
// A step's own bar keeps what was heard of it, for the visit: a change
// keeps every symbol it leaves as it was heard, so a changed beat shows
// only its pad until the play each change starts sounds it; an example or
// Play both drawn over the bar gives it back to the step's next Play. Step
// 1's bar is the one the figure shows, so the halvings leave theirs.
//
// As Step 5 opens, the line becomes the staff, carrying what Step 4's line
// holds as it was heard (lift.ts). Step 5's own two bars are then written by
// their first play, whichever of Play, Dot or Tie sounds them, so they too
// are heard before they are seen.

import { q, qa } from '@/features/lessons/kit/dom'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { RhythmBar, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { figureSize } from '@/features/lessons/kit/rhythm-draw'
import type { Bar, GridBar, GridRefusal, NoteValue, } from '@/features/lessons/kit/rhythm-model'
import { FOUR_QUARTERS, halve, HALVINGS, join, placeBars, toggleRest, writeGrid, } from '@/features/lessons/kit/rhythm-model'
import { beatWords, lengthsWords, symbolWords, } from '@/features/lessons/kit/rhythm-words'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { lift, liftPlan } from './lift'
import type { StepState } from './rhythm-views'
import { BOTH_PARTS, BOTH_SIXTY, BOTH_TWICE, BOTH_VIEW, COUNT_BARS, COUNT_PARTS, FIG, HALVING_PARTS, HALVING_VIEWS, restView, rowView, staffBars, STATE_OF, STEP_BPM, TEMPO_BAR, } from './rhythm-views'

/** Why Halve or Join cannot go, in the hint's words (WEB-SPEC, Toys 1). */
export const REFUSAL_HINT: Readonly<Record<GridRefusal, string>> = {
  shortest: 'A sixteenth is the shortest note here.',
  pair: 'Join needs a quarter on the other beat of the pair too.',
  halves: 'Join needs a half note in the other half of the bar too.',
  whole: 'A whole note already fills the bar.',
  silent: 'Turn the rest back into a note first.',
}

/** What Dot, Tie and Clef say they changed, in Step 5 and free play (WEB-SPEC, Toys 1). */
export const STAFF_SAID = {
  dotOn: 'Dots added: a dotted half note, then a dotted quarter and an eighth',
  dotOff: 'Dots taken off: a half note and a quarter, then two quarters',
  tieOn: 'Tie added across the bar line',
  tieOff: 'Tie taken off',
  bass: 'The bass staff: every note on A3',
  treble: 'The treble staff: every note on A4',
} as const

/** Said once the halvings have been heard to their end. */
export const HALVINGS_LINE =
  'A whole note, two half notes, four quarter notes, eight eighth notes and sixteen sixteenth notes at 60 beats per minute: 4 seconds, 2 seconds each, 1 second each, 0.5 seconds each and 0.25 seconds each.'

const NAME: Readonly<Record<number, string>> = {
  4: 'whole',
  2: 'half',
  1: 'quarter',
  0.5: 'eighth',
  0.25: 'sixteenth',
}

/** The cell of a grid bar that holds a beat. */
const cellOf = (g: GridBar, beat: number) =>
  g.cells.find((c) => c.from <= beat && beat < c.from + Math.max(c.value, 1))

/**
 * Which symbols of `after` stay written: each one written the same, at the
 * same beat, in `before` and heard there. A changed beat's symbols wait for
 * their sound.
 */
export function keptWritten(
  before: readonly Bar[],
  heard: readonly boolean[],
  after: readonly Bar[],
): boolean[] {
  const old = placeBars(before)
  return placeBars(after).map((p) =>
    old.some(
      (o, i) =>
        heard[i] === true &&
        o.beat === p.beat &&
        o.beats === p.beats &&
        o.kind === p.kind &&
        o.value === p.value &&
        o.dotted === p.dotted &&
        o.tie === p.tie,
    ),
  )
}

/** What a beat holds: its own symbols, or the one it is part of, "a half rest". */
function holdingWords(bar: Bar, beat: number): string {
  const placed = placeBars([bar])
  const over = placed.find((p) => p.beat < beat && beat < p.beat + p.beats)
  if (over === undefined) return beatWords(placed, beat)
  return symbolWords([{ kind: over.kind, value: over.value as NoteValue }])
}

/** The live line for a Halve that went: "Beat 2 halved: two eighth notes"; a half or a whole note says itself. */
export function halvedLine(
  before: GridBar,
  after: GridBar,
  beat: number,
): string {
  const c = cellOf(before, beat)
  if (c !== undefined && c.value >= 2)
    return `The ${NAME[c.value]} note halved: two ${NAME[c.value / 2]} notes`
  return `Beat ${beat + 1} halved: ${holdingWords(writeGrid(after), beat)}`
}

/** The live line for a Join that went: "Beat 2 joined: a quarter note", "Beats 1 and 2 joined: a half note". */
export function joinedLine(
  before: GridBar,
  after: GridBar,
  beat: number,
): string {
  const c = cellOf(before, beat)
  if (c === undefined || c.value < 1)
    return `Beat ${beat + 1} joined: ${holdingWords(writeGrid(after), beat)}`
  if (c.value === 2) return 'The two half notes joined: a whole note'
  const first = Math.floor(beat / 2) * 2
  return `Beats ${first + 1} and ${first + 2} joined: a half note`
}

/** The live line for a pad that made its beat silent, or sounding again. */
export function restLine(after: GridBar, beat: number): string {
  const words = holdingWords(writeGrid(after), beat)
  return after.silent[beat]
    ? `Beat ${beat + 1} silent: ${words}`
    : `Beat ${beat + 1} sounding again: ${words}`
}

/**
 * Shows a Tempo slider at a tempo: its place, its label, what a screen
 * reader says, and its track filled to the thumb (the kit's CSS reads --p,
 * and without it the fill sits halfway whatever the tempo).
 */
export function showTempo(input: HTMLInputElement, bpm: number): void {
  const min = Number(input.min)
  const max = Number(input.max)
  input.value = String(bpm)
  input.setAttribute('aria-valuetext', `${bpm} beats per minute`)
  input.style.setProperty('--p', `${((bpm - min) / (max - min)) * 100}%`)
  const readout = input.closest('.slider-row')?.querySelector('label b')
  if (readout) readout.textContent = `${bpm} BPM`
}

/** What the steps hold for the visit. */
interface StepsState {
  step: number
  grid: GridBar
  chosen: number
  tempo: number
  counts: boolean
  countPlays: number
  rests: GridBar
  dot: boolean
  tie: boolean
  clef: Clef
  /** Step 5's own two bars written by a play yet, in place of what came across. */
  staffPlayed: boolean
}

/** The step's own bar as it stands. */
function ownView(s: StepsState): RhythmView {
  if (s.step === 1)
    return rowView([writeGrid(s.grid)], STEP_BPM, 'line', 'choose')
  if (s.step === 2) return rowView([TEMPO_BAR], s.tempo, 'line')
  if (s.step === 3) return rowView([COUNT_BARS[0]], STEP_BPM, 'line')
  if (s.step === 4)
    return rowView([writeGrid(s.rests)], STEP_BPM, 'line', 'press')
  return rowView(staffBars(s.dot, s.tie), STEP_BPM, s.clef)
}

const ownBars = (s: StepsState): readonly Bar[] => ownView(s).scene.rows[0].bars

/** What Step 4's line held as it was left: its bars, as heard. */
interface Carried {
  readonly view: RhythmView
  readonly written: readonly boolean[]
}

/**
 * Mounts the stage's rhythm bar and follows the deck: called before
 * `deck.start()`, so an address that names a step opens it.
 */
export function initSteps(): RhythmBar {
  const root = q('#toyRhythm')
  const figure = q('[data-rb]', root)
  const label = q('[data-fig-label]', root)
  const hint = q('[data-rb-hint]', root)
  const lanesBtn = q<HTMLButtonElement>('[data-rb-lanes]', root)
  const light = playLights()
  const s: StepsState = {
    step: 1,
    grid: FOUR_QUARTERS,
    chosen: 0,
    tempo: STEP_BPM,
    counts: false,
    countPlays: 0,
    rests: FOUR_QUARTERS,
    dot: false,
    tie: false,
    clef: VoiceChoice.voice === 'higher' ? 'treble' : 'bass',
    staffPlayed: false,
  }
  // each step's own bar as heard, kept while another view or step shows
  const heard = new Map<number, readonly boolean[]>()
  let ownShown = false
  let carried: Carried | null = null

  // the stored voice's A, A3 unless the higher is stored; on the staff, the clef's
  const midi = (): number => {
    if (s.step === 5) return s.clef === 'treble' ? A4 : A3
    return VoiceChoice.voice === 'higher' ? A4 : A3
  }
  const bar = mountRhythmBar({
    figure,
    pads: q<HTMLElement>('[data-rb-pads]', root),
    said: q<HTMLElement>('[data-rb-said]', figure),
    freq: () => hz(midi()),
    voice: () => (midi() === A4 ? 'tavi' : 'merc'),
    owner: NowPlaying,
    onPad,
  })

  function keepOwn(): void {
    if (ownShown) heard.set(s.step, bar.written(0))
  }

  function showOwn(written: readonly boolean[] = [], readings = true): void {
    bar.show(ownView(s), (_r, i) => written[i] === true, { readings })
    ownShown = true
  }

  /** Draws a view over the step's own bar, which keeps what was heard of it. */
  function showOther(view: RhythmView): void {
    keepOwn()
    bar.show(view)
    ownShown = false
  }

  /** Step 1's bar is the one the figure shows: the halvings leave theirs. */
  function syncGrid(): void {
    const k = bar.view === null ? -1 : HALVING_VIEWS.indexOf(bar.view)
    if (k === -1) return
    s.grid = HALVINGS[k]
    ownShown = true
  }

  /** Plays the step's own bar, shown, at its tempo. */
  function playOwn(btn: HTMLButtonElement | null): void {
    const view = bar.view
    if (view === null) return
    const bpm = s.step === 2 ? () => s.tempo : () => STEP_BPM
    const done = bar.play([{ view, bpm }], {
      line: lengthsWords(view.scene.rows[0].bars, bpm()),
    })
    if (btn !== null) light(btn, done)
  }

  /**
   * A change to the step's own bar: drawn keeping what it leaves as heard,
   * said, and played at once unless `play` is false.
   */
  function change(apply: () => void, line: string, play = true): void {
    bar.stop()
    if (s.step === 1) syncGrid()
    const before = ownBars(s)
    const was = ownShown ? bar.written(0) : (heard.get(s.step) ?? [])
    apply()
    showOwn(keptWritten(before, was, ownBars(s)))
    if (s.step === 1) gridButtons()
    bar.say(line)
    if (play) playOwn(null)
  }

  // ---------------------------------------------------------------- Step 1: Halve and Join
  const halveBtn = q<HTMLButtonElement>('[data-rb-halve]', root)
  const joinBtn = q<HTMLButtonElement>('[data-rb-join]', root)

  /** Each button's state for the chosen beat, with the hint for one that cannot go. */
  function gridButtons(): void {
    const h = halve(s.grid, s.chosen)
    const j = join(s.grid, s.chosen)
    halveBtn.setAttribute('aria-disabled', String('refused' in h))
    joinBtn.setAttribute('aria-disabled', String('refused' in j))
    const why = 'refused' in h ? h.refused : 'refused' in j ? j.refused : null
    hint.textContent = why === null ? '' : REFUSAL_HINT[why]
    hint.hidden = why === null
  }

  function onPad(b: number): void {
    if (s.step === 1) {
      syncGrid()
      s.chosen = b
      bar.choose(b)
      gridButtons()
    } else if (s.step === 4) {
      const next = toggleRest(s.rests, b)
      change(
        () => {
          s.rests = next
        },
        restLine(next, b),
      )
    }
  }

  halveBtn.addEventListener('click', () => {
    syncGrid()
    const h = halve(s.grid, s.chosen)
    if ('refused' in h) return bar.say(REFUSAL_HINT[h.refused])
    const line = halvedLine(s.grid, h.bar, s.chosen)
    change(() => {
      s.grid = h.bar
    }, line)
  })
  joinBtn.addEventListener('click', () => {
    syncGrid()
    const j = join(s.grid, s.chosen)
    if ('refused' in j) return bar.say(REFUSAL_HINT[j.refused])
    const line = joinedLine(s.grid, j.bar, s.chosen)
    change(() => {
      s.grid = j.bar
    }, line)
  })
  const halvingsBtn = q<HTMLButtonElement>('[data-rb-halvings]', root)
  halvingsBtn.addEventListener('click', () => {
    keepOwn()
    ownShown = false
    const done = bar.play(HALVING_PARTS, { line: HALVINGS_LINE })
    light(halvingsBtn, done)
    // the sixteenths stay written, and Reset puts back four quarters (FACTS 66)
    void done.then(() => {
      if (s.step !== 1) return
      syncGrid()
      gridButtons()
    })
  })

  // ---------------------------------------------------------------- Step 2: Tempo and Play both
  const tempo = q<HTMLInputElement>('[data-rb-tempo]', root)
  showTempo(tempo, s.tempo)
  tempo.addEventListener('input', () => {
    s.tempo = Number(tempo.value)
    showTempo(tempo, s.tempo)
    // what sounds next takes the new tempo from the next beat; the readings go
    if (s.step === 2 && ownShown) bar.retempo(s.tempo)
  })
  const bothBtn = q<HTMLButtonElement>('[data-rb-both]', root)
  bothBtn.addEventListener('click', () => {
    showOther(BOTH_VIEW)
    const done = bar.play(BOTH_PARTS, {
      line: `${lengthsWords([BOTH_SIXTY], 60)} ${lengthsWords(BOTH_TWICE, 120)}`,
    })
    light(bothBtn, done)
  })

  // ---------------------------------------------------------------- Step 3: Count
  const countBtn = q<HTMLButtonElement>('[data-rb-count]', root)
  countBtn.addEventListener('click', () => {
    s.counts = !s.counts
    s.countPlays = 0
    countBtn.setAttribute('aria-pressed', String(s.counts))
    bar.see({ counts: s.counts })
  })

  /** Step 3's two bars in turn; every second play with Count on, the counts faint and unlit. */
  function playCounts(btn: HTMLButtonElement): void {
    if (s.counts) s.countPlays++
    ownShown = false
    const done = bar.play(COUNT_PARTS, {
      faint: s.counts && s.countPlays % 2 === 0,
      line: COUNT_BARS.map((b) => lengthsWords([b], STEP_BPM)).join(' '),
    })
    light(btn, done)
  }

  // ---------------------------------------------------------------- Step 4: the rest strip
  for (const btn of qa<HTMLButtonElement>('[data-rb-rest]', root))
    btn.addEventListener('click', () => {
      const view = restView(btn.dataset.rbRest ?? '')
      if (view === null) return
      showOther(view)
      const done = bar.play([{ view, bpm: () => STEP_BPM, fresh: true }], {
        line: lengthsWords(view.scene.rows[0].bars, STEP_BPM),
      })
      light(btn, done)
    })

  // ---------------------------------------------------------------- Step 5: Dot, Tie and Clef
  const dotBtn = q<HTMLButtonElement>('[data-rb-dot]', root)
  const tieBtn = q<HTMLButtonElement>('[data-rb-tie]', root)
  const clefBtns = qa<HTMLButtonElement>('[data-rb-clef]', root)

  /** Step 5's first play: its own two bars, written as they sound in place of what came across. */
  function playStaff(btn: HTMLButtonElement | null): void {
    s.staffPlayed = true
    showOwn()
    playOwn(btn)
  }

  /** Dot or Tie: the bars changed, said and played. */
  function staffChange(apply: () => void, line: string): void {
    if (s.staffPlayed) return change(apply, line)
    apply()
    bar.say(line)
    playStaff(null)
  }

  dotBtn.addEventListener('click', () => {
    const line = s.dot ? STAFF_SAID.dotOff : STAFF_SAID.dotOn
    staffChange(() => {
      s.dot = !s.dot
    }, line)
    dotBtn.setAttribute('aria-pressed', String(s.dot))
  })
  tieBtn.addEventListener('click', () => {
    const line = s.tie ? STAFF_SAID.tieOff : STAFF_SAID.tieOn
    staffChange(() => {
      s.tie = !s.tie
    }, line)
    tieBtn.setAttribute('aria-pressed', String(s.tie))
  })

  const setClef = (c: Clef): void => {
    s.clef = c
    for (const b of clefBtns)
      b.setAttribute('aria-pressed', String(b.dataset.rbClef === c))
  }
  setClef(s.clef)

  const ownViewOf = (step: number): RhythmView => ownView({ ...s, step })

  /** What came across from Step 4, on the clef's staff. */
  function carriedView(): RhythmView {
    const row = (carried?.view ?? ownViewOf(4)).scene.rows[0]
    return rowView(row.bars, row.bpm, s.clef, null, {
      beats: row.beats,
      reads: row.reads,
    })
  }

  /** Step 5 opens: its own bars as heard, or the line lifting into the staff. */
  function openStaff(): void {
    if (s.staffPlayed) return showOwn(heard.get(5) ?? [])
    const written = carried?.written ?? []
    const view = carriedView()
    bar.show(view, (_r, i) => written[i] === true)
    ownShown = false
    if (bar.seen.lanes) return
    const size = figureSize(figure)
    lift(figure, liftPlan(view.scene.rows, s.clef, size.w, size.h))
  }

  /** Step 5 on the other clef, as it shows: the staff and the sound move together; what was heard stays written. */
  function redrawClef(c: Clef): void {
    bar.stop()
    const written = bar.written(0)
    setClef(c)
    if (ownShown) showOwn(written)
    else bar.show(carriedView(), (_r, i) => written[i] === true)
  }

  for (const b of clefBtns)
    b.addEventListener('click', () => {
      const c: Clef = b.dataset.rbClef === 'treble' ? 'treble' : 'bass'
      if (c === s.clef) return
      redrawClef(c)
      bar.say(STAFF_SAID[c])
    })
  // a voice chosen in the sung part sets the clef for the rest of the visit
  // (WEB-SPEC, Toys 7, part 2, state 2), Step 5 redrawn on it if it shows
  VoiceChoice.subscribe((v) => {
    const c: Clef = v === 'higher' ? 'treble' : 'bass'
    if (v === null || c === s.clef) return
    if (s.step === 5) redrawClef(c)
    else setClef(c)
  })

  // ---------------------------------------------------------------- every step: Play, Reset and the pitch line
  function onPlay(btn: HTMLButtonElement): void {
    if (s.step === 3) return playCounts(btn)
    if (s.step === 5 && !s.staffPlayed) return playStaff(btn)
    if (s.step === 1) syncGrid()
    // an example or Play both gives the step's own bar back
    if (!ownShown) showOwn(heard.get(s.step) ?? [], false)
    playOwn(btn)
  }
  for (const btn of qa<HTMLButtonElement>('[data-rb-play]', root))
    btn.addEventListener('click', () => onPlay(btn))
  for (const btn of qa<HTMLButtonElement>('[data-rb-reset]', root))
    btn.addEventListener('click', () =>
      change(
        () => {
          if (s.step === 1) s.grid = FOUR_QUARTERS
          else s.rests = FOUR_QUARTERS
        },
        'Back to four quarter notes',
        false,
      ),
    )
  lanesBtn.addEventListener('click', () => {
    const on = !bar.seen.lanes
    lanesBtn.setAttribute('aria-pressed', String(on))
    bar.see({ lanes: on })
  })

  // ---------------------------------------------------------------- the deck
  /** A step's state opens: its rows, the switch in its controls, its label and its bar. */
  function open(n: number): void {
    const state: StepState = STATE_OF[n] ?? 'halves'
    for (const row of qa('[data-rb-for]', root))
      row.hidden = row.dataset.rbFor !== state
    q(`.rb-row[data-rb-for="${state}"]`, root).append(lanesBtn)
    label.innerHTML = FIG[n] ?? FIG[1]
    hint.hidden = true
    bar.see({ counts: n === 3 && s.counts })
    if (n === 5) openStaff()
    else showOwn(heard.get(n) ?? [])
    if (n === 1) gridButtons()
  }

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap, or Step 1 as the deck starts: nothing changes
      if (n === previous) return
      bar.stop()
      if (previous === 1) syncGrid()
      if (previous === 4 && bar.view !== null)
        carried = { view: bar.view, written: bar.written(0) }
      keepOwn()
      s.step = n
      open(n)
    },
  })
  showOwn()
  gridButtons()
  return bar
}
