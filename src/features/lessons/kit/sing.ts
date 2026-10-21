// ============================================================
// Lesson sing it — the breathing ring, with Merc's still at its centre
// ============================================================
//
// Nothing listens and nothing is scored: the ring shows Merc's note as
// ripples while it plays, then breathes, two seconds a breath, while a
// progress arc and a countdown run through the viewer's turn. The still of
// the Merc singing sits in its centre (blue for the lower voice, orange for
// the higher), never a microphone icon. Pages build on it: the sing card
// here plays Merc's note on a button, and a lesson's own guide (Lesson 2's
// slides, Lesson 4's scale) runs the ring beside its drawing. A run can hold
// an in-breath between Merc's note and the turn, and turn as one long
// out-breath: Lesson 5's Listen · Breathe · Sing, and its "sss". A page
// whose run can be cut short ends it where it stands (`stop`).
//
// Mounted on a `.ring` element, any number per page. Inside it: the
// `.ring-progress` and `.ring-breath` circles, the `.ring-ripples` group,
// the `.ring-merc` still and the `.ring-note` and `.ring-state` lines.

import { q, svg, TAU } from './dom'
import { addDrawer, watch } from './frame-loop'
import type { Which } from './merc-duo'
import { reducedMotion } from './motion-switch'
import { COLOR, hz, nameHtml, sharpOf } from './notes'
import { Sound } from './sound'

export interface RingStills {
  readonly blue: string
  readonly orange: string
}

/** The ring's state lines. */
export interface RingWords {
  /** While Merc's note plays. */
  readonly listen: string
  /** Through the viewer's turn, with the seconds left. */
  readonly turn: (secondsLeft: number) => string
  /** Back at rest. */
  readonly done: string
  /** Through a run's in-breath (`breathe`), which counts nothing down. */
  readonly breathe?: string
}

export interface RingRun {
  /** The Merc singing: their still in the ring, their colour on the label and the ripples. */
  readonly which: Which
  /** The ring's label (markup), such as "A3 · 220 Hz". */
  readonly label: string
  /** Seconds of Merc's note. */
  readonly listen: number
  /** Seconds of the viewer's turn after it (0 for none). */
  readonly turn: number
  /** Ripples while Merc's note plays (default true); a silent count-in has none. */
  readonly ripples?: boolean
  /** This run's own state lines, over the ring's (a count-in's "Get ready"). */
  readonly words?: Partial<RingWords>
  /**
   * Seconds of an in-breath between Merc's note and the turn (default none):
   * the circle swells once and nothing counts down (Lesson 5's Listen ·
   * Breathe · Sing).
   */
  readonly breathe?: number
  /**
   * Through the turn, the circle settles back once, one long out-breath,
   * instead of breathing every two seconds (a held note, an "sss").
   */
  readonly exhale?: boolean
}

export interface RingOptions {
  readonly stills: RingStills
  readonly words?: Partial<RingWords>
  /**
   * Under reduced motion, hold the breathing circle and the ripples still
   * and let the countdown carry the turn (Lessons 3 to 6 ask for it).
   */
  readonly calm?: boolean
}

export interface Ring {
  readonly busy: boolean
  /** Merc's note, then the viewer's turn; resolves once the ring is back at rest. */
  run(r: RingRun): Promise<void>
  /** Ends a run where it stands: the ring rests, its ripples go, and the run's promise settles. */
  stop(): void
}

const WORDS: RingWords = {
  listen: 'Listen',
  turn: (n) => `Hum it back · ${n}`,
  done: 'Again whenever you like',
}

export type RingPhase = 'listen' | 'breathe' | 'turn' | 'done'

/** Where a run is `s` seconds in: its phase, and the seconds into that phase. */
export function ringPhase(
  run: RingRun,
  s: number,
): { phase: RingPhase; h: number } {
  const inhaled = run.listen + (run.breathe ?? 0)
  if (s < run.listen) return { phase: 'listen', h: s }
  if (s < inhaled) return { phase: 'breathe', h: s - run.listen }
  if (s < inhaled + run.turn) return { phase: 'turn', h: s - inhaled }
  return { phase: 'done', h: s - inhaled - run.turn }
}

/**
 * How full the breathing circle is, 0 to 1, `h` seconds into a phase: one
 * swell over the in-breath; through the turn a breath every two seconds,
 * or with `exhale` one long settle from full to rest.
 */
export function swellAt(run: RingRun, phase: RingPhase, h: number): number {
  if (phase === 'breathe')
    return 0.5 - 0.5 * Math.cos((Math.PI * h) / (run.breathe ?? 1))
  if (phase !== 'turn') return 0
  if (run.exhale === true)
    return 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, h / run.turn))
  return 0.5 - 0.5 * Math.cos((TAU * h) / 2)
}

interface Running {
  t0: number
  run: RingRun
  colour: string
  lastN: number
  /** The ring's words with the run's own over them. */
  words: RingWords
  resolve: () => void
}

export function mountRing(root: HTMLElement, opts: RingOptions): Ring {
  const progress = q<SVGCircleElement>('.ring-progress', root)
  const breath = q<SVGCircleElement>('.ring-breath', root)
  const ripples = q<SVGGElement>('.ring-ripples', root)
  const img = q<HTMLImageElement>('.ring-merc', root)
  const note = q('.ring-note', root)
  const state = q('.ring-state', root)
  const words: RingWords = { ...WORDS, ...opts.words }
  const circ = 2 * Math.PI * Number(progress.getAttribute('r') ?? 182)
  const seen = watch(root)
  const still = (): boolean => opts.calm === true && reducedMotion()
  let now: Running | null = null
  let rips: { t: number; c: SVGCircleElement }[] = []

  function rest(): void {
    breath.setAttribute('r', '150')
    breath.setAttribute('opacity', '.55')
  }

  function listening(r: Running, t: number): void {
    const last = rips[rips.length - 1]
    if (
      r.run.ripples !== false &&
      !still() &&
      (last === undefined || t - last.t > 420)
    ) {
      const c = svg(
        'circle',
        {
          cx: 200,
          cy: 200,
          r: 120,
          fill: 'none',
          stroke: r.colour,
          'stroke-width': 1.5,
        },
        ripples,
      )
      rips.push({ t, c })
    }
    rest()
  }

  /** The breathing circle at `b`, 0 at rest to 1 full. */
  function swell(b: number): void {
    breath.setAttribute('r', (142 + 22 * b).toFixed(1))
    breath.setAttribute('opacity', (0.45 + 0.45 * b).toFixed(2))
    breath.setAttribute('stroke-width', (2 + 2 * b).toFixed(1))
  }

  /** The in-breath: the circle swells once over the phase, and nothing counts down. */
  function breathing(r: Running, h: number): void {
    if (r.lastN !== -2) {
      r.lastN = -2
      state.textContent = r.words.breathe ?? 'Breathe in'
      progress.setAttribute('stroke-dashoffset', String(circ))
    }
    swell(still() ? 0.5 : swellAt(r.run, 'breathe', h))
  }

  function turning(r: Running, h: number): void {
    const n = Math.ceil(r.run.turn - h)
    if (n !== r.lastN) {
      r.lastN = n
      state.textContent = r.words.turn(n)
    }
    // breathe in and out, two seconds a breath; or, a held note, one long out-breath
    swell(still() ? 0.5 : swellAt(r.run, 'turn', h))
    progress.setAttribute(
      'stroke-dashoffset',
      (circ * (1 - h / r.run.turn)).toFixed(1),
    )
  }

  function finish(r: Running): void {
    state.textContent = r.words.done
    progress.setAttribute('stroke-dashoffset', String(circ))
    rest()
    breath.setAttribute('stroke-width', '2')
    now = null
    r.resolve()
  }

  function fade(t: number): void {
    rips = rips.filter((r) => {
      const a = (t - r.t) / 1600
      if (a >= 1) {
        r.c.remove()
        return false
      }
      r.c.setAttribute('r', (118 + a * 72).toFixed(1))
      r.c.setAttribute('opacity', (0.7 * (1 - a)).toFixed(2))
      return true
    })
  }

  addDrawer({
    active: () => now !== null && seen(),
    draw(t) {
      const r = now
      if (r === null) return
      const { phase, h } = ringPhase(r.run, (t - r.t0) / 1000)
      if (phase === 'listen') listening(r, t)
      else if (phase === 'breathe') breathing(r, h)
      else if (phase === 'turn') turning(r, h)
      else finish(r)
      fade(t)
    },
  })

  return {
    get busy() {
      return now !== null
    },
    stop() {
      if (now !== null) finish(now)
      rips.forEach((r) => r.c.remove())
      rips = []
    },
    run(run) {
      return new Promise<void>((resolve) => {
        const blue = run.which === 'blue'
        const runWords: RingWords = { ...words, ...run.words }
        img.src = blue ? opts.stills.blue : opts.stills.orange
        note.innerHTML = run.label
        note.style.color = blue ? COLOR.blue : COLOR.orange
        state.textContent = runWords.listen
        now = {
          t0: performance.now(),
          run,
          colour: blue ? COLOR.blue : COLOR.orange,
          lastN: -1,
          words: runWords,
          resolve,
        }
      })
    },
  }
}

/** A sing button: the Merc who sings, and the note. */
export interface SingNote {
  readonly button: HTMLButtonElement
  readonly which: Which
  readonly midi: number
}

export interface SingOptions extends RingOptions {
  readonly notes: readonly SingNote[]
  /** Seconds of Merc's note (default 2.4) and of the hum back (default 4). */
  readonly listen?: number
  readonly turn?: number
}

/**
 * The sing card: each button plays its Merc's "ooh" on its note and runs
 * the ring inside `root`; every button waits while the ring runs.
 */
export function mountSing(root: HTMLElement, opts: SingOptions): Ring {
  const ring = mountRing(q('.ring', root), opts)
  const listen = opts.listen ?? 2.4
  const turn = opts.turn ?? 4
  const buttons = opts.notes.map((n) => n.button)

  function go({ which, midi }: SingNote): void {
    if (ring.busy) return
    const audible = Sound.canPlay()
    const label = `${nameHtml(sharpOf(midi))} · ${Math.round(hz(midi))} Hz`
    const done = ring.run({ which, label, listen, turn })
    if (audible) Sound.voice(hz(midi), { kind: 'merc', dur: listen })
    buttons.forEach((b) => {
      b.disabled = true
    })
    void done.then(() =>
      buttons.forEach((b) => {
        b.disabled = false
      }),
    )
  }

  for (const n of opts.notes) n.button.addEventListener('click', () => go(n))
  return ring
}
