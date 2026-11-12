// ============================================================
// Lesson 20 run chart — Merc's run as beads on a string, at any tempo
// ============================================================
//
// The page's one drawing of the run (WEB-SPEC, Toys 2, 5 and 6): the kit's
// band chart on a notes axis from a semitone under do to a semitone over
// la, each of the run's notes a rung over its slot in the bead style
// (kit/band-chart-rungs.ts `beads`). The time axis is fixed, 6.75 s across,
// so a faster tempo draws the same beads closer together at the same
// heights (FACTS 39). A bead glows and shows its sung name while its note
// sounds, swelling in over 150 ms, at once under reduced motion. The run
// toy names its rows, "do · D3" to "la · B3"; the hero names nothing, its
// beads faint until a note sounds (FACTS 11). A line drawn as it goes
// (`follow`) is asked for each frame until it ends, and stays as it last
// drew: Play it smudged's illustrated singer, and Sing it's voice. Only a
// swell or such a line asks for frames (`wants`); the chart itself paints
// only what changed.

import type { BandChart, TracePoint } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { rungNames } from '@/features/lessons/kit/band-chart-names'
import type { Rung } from '@/features/lessons/kit/band-chart-rungs'
import { paintRungs, slotsAt } from '@/features/lessons/kit/band-chart-rungs'
import { addDrawer, wake } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { Spelled } from '@/features/lessons/kit/notes'
import { signName } from '@/features/lessons/kit/notes'
import { MAJOR_FIVE, spellDegrees, syllableOf, } from '@/features/lessons/kit/stairs-scales'
import { RUN_AXIS_SEC, RUN_DEGREES } from './sounds'

/** A bead swells in over this long as its note starts. */
const SWELL_MS = 150

/** The run's notes from `doMidi` spelled as written, a degree's letter each: D, E, F♯, A, B for D's. */
export function spelledRun(
  doMidi: number,
  degrees: readonly number[] = RUN_DEGREES,
): Spelled[] {
  const five = spellDegrees(doMidi, MAJOR_FIVE)
  return degrees.map((d) => five[MAJOR_FIVE.indexOf(d)])
}

/** A line drawn as it goes: the line by `now` (ms), the beads whose edges it lights, and whether it has ended. */
export interface LiveLine {
  at(now: number): {
    readonly line: TracePoint[]
    readonly lit: readonly boolean[]
    readonly done: boolean
  }
}

export interface RunChartOptions {
  /** When it draws: its stage on screen, on its step. */
  readonly active: () => boolean
  readonly doMidi: number
  /** Rows named "do · D3" beside the axis; without them nothing is named until it sounds. */
  readonly names: boolean
  /** Beads faint until their notes sound (the hero). */
  readonly faint?: boolean
}

export interface RunChart {
  readonly chart: BandChart
  readonly doMidi: number
  /** The run's notes, as degrees above do. */
  readonly degrees: readonly number[]
  /** Seconds from one bead to the next. */
  readonly every: number
  /** Another do: another voice, or Move do. */
  setDo(doMidi: number): void
  /** Another run: Sing it's smaller one, seven notes to so. */
  setDegrees(degrees: readonly number[]): void
  /** A note every `every` s, each `hold` s long; shorter than its slot, staccato, with no string. */
  setTempo(every: number, hold?: number): void
  /** Bead `i` glows while its note sounds, `dur` s, unless `rest` comes first. */
  glow(i: number, dur: number): void
  /** Every glow out. */
  rest(): void
  /** A line drawn as it goes, or none. */
  follow(live: LiveLine | null): void
  /** Where bead `i` sits on the canvas, CSS px from its top left. */
  beadAt(i: number): { x: number; y: number }
  /** How far apart neighbouring beads stand, CSS px. */
  spacing(): number
  /** The canvas's spoken summary. */
  describe(text: string): void
}

export function mountRunChart(root: HTMLElement, o: RunChartOptions): RunChart {
  let doMidi = o.doMidi
  let degrees: readonly number[] = RUN_DEGREES
  let every = 0.6
  let hold = every
  /** When each bead's note began, while it sounds. */
  const glowing = new Map<number, number>()
  /** A glow's end, kept from an older `rest` by its round. */
  let round = 0
  let live: LiveLine | null = null
  let moving = false

  /** How far a swell has come since `since`: all the way at once under reduced motion. */
  function progress(since: number | undefined, now: number): number {
    if (since === undefined) return 0
    const k = reducedMotion() ? 1 : Math.min(1, (now - since) / SWELL_MS)
    if (k < 1) moving = true
    return k
  }

  /** The scene for this moment: the beads, their glow and lit edges, and a live line. */
  function paint(now: number): void {
    moving = false
    const s = chart.scene
    const sung = live?.at(now) ?? null
    if (sung !== null && !sung.done) moving = true
    const names = degrees.map(syllableOf)
    s.rungs = slotsAt(degrees.length, every, hold).map(
      (slot, i): Rung => ({
        label: names[i],
        c: degrees[i] * 100,
        from: slot.from,
        to: slot.to,
        glow: progress(glowing.get(i), now),
        lit: sung?.lit[i] === true,
        faint: o.faint === true,
      }),
    )
    s.beads = { string: hold >= every }
    if (sung !== null) s.line = sung.line
  }

  // the swell and a live line, ahead of the chart's own drawer, so the
  // chart paints what this frame moved them to
  addDrawer({
    active: o.active,
    wants: () => moving,
    draw: (now) => paint(now),
  })

  const named = (): ReturnType<typeof rungNames> => {
    const spelled = spelledRun(doMidi, MAJOR_FIVE.slice(0, 5))
    return rungNames(
      MAJOR_FIVE.slice(0, 5).map(
        (d, i) =>
          [doMidi + d, `${syllableOf(d)} · ${signName(spelled[i])}`] as const,
      ),
    )
  }
  let names = named()
  // without row names, an empty list: the axis then names no row at all
  const unnamed = rungNames([])
  const chart = mountBandChart(root, {
    target: doMidi,
    axis: {
      get notes(): readonly [number, number] {
        return [doMidi - 1, doMidi + 10]
      },
      names: {
        gutter: (ctx) => (o.names ? names : unnamed).gutter(ctx),
        paint: (f, target) => (o.names ? names : unnamed).paint(f, target),
      },
    },
    window: RUN_AXIS_SEC,
    active: o.active,
    paintRungs,
  })

  function redraw(): void {
    paint(performance.now())
    wake()
  }
  redraw()

  return {
    chart,
    get doMidi() {
      return doMidi
    },
    get degrees() {
      return degrees
    },
    get every() {
      return every
    },
    setDo(next) {
      if (next === doMidi) return
      doMidi = next
      names = named()
      chart.setTarget(doMidi)
      redraw()
    },
    setDegrees(next) {
      degrees = next
      glowing.clear()
      redraw()
    },
    setTempo(next, holdSec = next) {
      every = next
      hold = holdSec
      redraw()
    },
    glow(i, dur) {
      const at = performance.now()
      const mine = round
      glowing.set(i, at)
      redraw()
      window.setTimeout(() => {
        if (mine !== round || glowing.get(i) !== at) return
        glowing.delete(i)
        redraw()
      }, dur * 1000)
    },
    rest() {
      round += 1
      glowing.clear()
      redraw()
    },
    follow(next) {
      live = next
      if (next === null) chart.scene.line = []
      redraw()
    },
    beadAt: (i) => {
      const slot = slotsAt(degrees.length, every, hold)[i]
      return chart.pointOf(slot?.from ?? 0, (degrees[i] ?? 0) * 100)
    },
    spacing: () => chart.pointOf(every, 0).x - chart.pointOf(0, 0).x,
    describe: (text) => chart.describe(text),
  }
}
