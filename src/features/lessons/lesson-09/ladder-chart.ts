// ============================================================
// Lesson 9 ladder chart — Merc's rungs and leaps, in seven states
// ============================================================
//
// The page's one figure (WEB-SPEC, Toys 1): the kit's band chart on a notes
// axis, each of Merc's notes a rung (kit/band-chart-rungs.ts), each leap an
// amber arc (kit/band-chart-arcs.ts), each rung's row named by its syllable
// and its spelled note (kit/band-chart-names.ts). Seven states, each with
// its own window from ladder-data.ts: compact (the hero and the cold open),
// step, hear, ladder, order, landing and free play; and live mode, Sing
// it's frame of the chosen ladder's slots. Sequence mode lays rungs over
// slots, so a phrase reads as a staircase; rung mode lays them across the
// plot, so the ladder reads as rows (order and free play).
//
// A page plays a phrase (`play`) and tells the drawing as each note starts:
// that note's rung lights, swelling in, and every arc into it draws from
// where it leaves, so an arc draws as its second note starts; the end of
// the phrase leaves it whole. The compact and step charts lay out the
// phrase's own notes, one slot each, so a path's middle note appears only
// when its path plays; the other states light the slots or rows they
// already show. Under reduced motion a rung lights at once and an arc is
// drawn whole at once (WEB-SPEC, Toys 1). Only that swell and that drawing
// ask for frames (`wants`): the chart itself paints only what changed, and
// with neither in progress the page rests.
//
// The voice is `fyp-voice`, else the lower (do D3, or D4 for the higher),
// and the chart follows a change made anywhere (`VoiceChoice.subscribe`);
// Move do moves it within its four semitones (`move`). The band chart
// reads its notes axis when it mounts and again at each `setTarget`, so
// the axis here reads the state's window as it is now, and every change of
// state, voice or do sets the target again. The canvas's summary names what
// it shows in spoken names, never the sign: "Do, D3, and so, A3, with
// Merc's leap between them"; live mode's says where do is ("Do is D3").

import type { BandChart, TracePoint } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import type { Arc } from '@/features/lessons/kit/band-chart-arcs'
import { columnArcs } from '@/features/lessons/kit/band-chart-arcs'
import type { RungNames } from '@/features/lessons/kit/band-chart-names'
import { rungNames } from '@/features/lessons/kit/band-chart-names'
import type { Rung } from '@/features/lessons/kit/band-chart-rungs'
import { paintRungs } from '@/features/lessons/kit/band-chart-rungs'
import { q } from '@/features/lessons/kit/dom'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { signName, wordName } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { ChartState, LadderId, NoteWindow } from './ladder-data'
import { degreeStep, doOf, LADDERS, liveWindow, RUNG_ORDER, rungMidi, RUNGS, spelledDegree, windowOf, } from './ladder-data'
import type { SoundNote } from './sounds'
import { COPY_TRACE, LADDER_NOTE_SEC, LANDING, LANDING_SEC, NOTE_SEC, PATH_DEGREE, } from './sounds'

// -------------------------------------------------------------- names

/** A note the page names: its semitones above do, its syllable, its degree on do. */
interface Named {
  readonly step: number
  readonly syllable: string
  readonly degree: number
}

/** The ladder's four rungs and the cold open's re and fa. */
const NAMED: readonly Named[] = [
  ...RUNG_ORDER.map((id) => RUNGS[id]),
  ...(['re', 'fa'] as const).map((p) => ({
    step: degreeStep(PATH_DEGREE[p]),
    syllable: p,
    degree: PATH_DEGREE[p],
  })),
]

/** A note's name on a ladder from `doMidi`: "so · A3" for the canvas, "so, A3" spoken. */
export function noteName(
  doMidi: number,
  midi: number,
): { readonly text: string; readonly spoken: string } {
  const named = NAMED.find((n) => n.step === midi - doMidi)
  if (named === undefined)
    throw new Error(`no name for ${midi - doMidi} semitones above do`)
  const s = spelledDegree(doMidi, named.degree)
  return {
    text: `${named.syllable} · ${signName(s)}`,
    spoken: `${named.syllable}, ${wordName(s)}`,
  }
}

/** Names in a list, as the spec's summary joins two: "do, D3, and so, A3". */
function listed(names: readonly string[]): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** The canvas's summary: the notes it shows, in spoken names, and Merc's leap when it shows one between two. */
export function summaryOf(
  doMidi: number,
  midis: readonly number[],
  leaps: number,
): string {
  const names = [...new Set(midis)].map((m) => noteName(doMidi, m).spoken)
  const text = listed(names)
  const said = text.charAt(0).toUpperCase() + text.slice(1)
  return leaps === 1 && names.length === 2
    ? `${said}, with Merc's leap between them`
    : said
}

/** Live mode's summary: where do is, in Lesson 4's spelling (WEB-SPEC, Toys 4). */
export const liveSummary = (doMidi: number): string =>
  `Do is ${wordName(spelledDegree(doMidi, 1))}`

// -------------------------------------------------------------- views

/**
 * One of Merc's notes on the chart: its MIDI note, and its slot, seconds
 * across the window (a row across the plot has none); `at` and `dur` are
 * the seconds of sound it stands for, at speed, for a line drawn over it.
 */
export interface Place {
  readonly midi: number
  readonly from?: number
  readonly to?: number
  readonly at: number
  readonly dur: number
  /** Drawn faint while it rests. */
  readonly faint: boolean
}

/** What the chart shows of a state when nothing plays. */
export interface View {
  /** The notes axis, MIDI. */
  readonly window: NoteWindow
  /** Seconds across the chart. */
  readonly seconds: number
  readonly places: readonly Place[]
  /** The leaps shown, as notes of `places` ([first, second]). */
  readonly leaps: readonly (readonly [number, number])[]
  /** Arcs between slots, or numbered columns across the rows. */
  readonly rows: boolean
  /** A singer's line, in seconds of sound (mapped onto the slots) and cents from do, and its words. */
  readonly line: readonly TracePoint[]
  readonly label: string | null
  /** The notes whose rows are named. */
  readonly names: readonly number[]
  readonly summary: string
}

/** Sequence mode's slots: room at each end, a slot's width a second of Merc's note, and room for an arc between. */
const SLOTS = { margin: 0.2, unit: 1.35, gap: 0.9 } as const
/** Live mode's slots abut, a second a second, so the singer's line runs on Merc's time. */
const LIVE_SLOTS = { margin: 0, unit: 1, gap: 0 } as const
/** Seconds across the chart in rung mode, where time places only the arcs' columns. */
const ROW_SEC = 4

/**
 * Slots for notes of `durs` seconds, back to back from 0 at speed: each
 * slot's place across the window, and the window.
 */
function slotted(
  midis: readonly number[],
  durs: readonly number[],
  faint: boolean,
  o: { readonly margin: number; readonly unit: number; readonly gap: number },
): { places: Place[]; seconds: number } {
  let x = o.margin
  let at = 0
  const places = midis.map((midi, i) => {
    const width = (durs[i] / NOTE_SEC) * o.unit
    const place = { midi, from: x, to: x + width, at, dur: durs[i], faint }
    x += width + o.gap
    at += durs[i]
    return place
  })
  return { places, seconds: x - o.gap + o.margin }
}

/** Rows across the plot: rung mode. */
const rowsOf = (midis: readonly number[], faint: boolean): Place[] =>
  midis.map((midi) => ({ midi, at: 0, dur: NOTE_SEC, faint }))

/** The ladder's four rungs from `doMidi`, low to high. */
const rungsOf = (doMidi: number): number[] =>
  RUNG_ORDER.map((id) => rungMidi(doMidi, id))

/** What each state lays out: its notes, how long each slot is, how it rests. */
interface Layout {
  readonly midis: readonly number[]
  readonly durs?: readonly number[]
  readonly rows?: boolean
  readonly faint?: boolean
  readonly leaps?: readonly (readonly [number, number])[]
  readonly names: readonly number[]
  readonly line?: readonly TracePoint[]
  readonly label?: string
}

/**
 * Each state at rest (WEB-SPEC, Toys 1): compact, do's and so's bands with
 * Merc's leap and no names; step, do's band and the second note's; hear,
 * as step, with Step 2's illustration from the start; ladder, four slots,
 * faint; order, the four rungs across the plot, faint; landing, do's slot
 * and so's, longer; free play, the four rungs across the plot.
 */
function layoutOf(state: ChartState, doMidi: number): Layout {
  const [d, mi, so, top] = rungsOf(doMidi)
  const re = doMidi + degreeStep(PATH_DEGREE.re)
  switch (state) {
    case 'compact':
      return { midis: [d, so], leaps: [[0, 1]], names: [] }
    case 'step':
      return { midis: [d, re], names: [d, re, so] }
    case 'hear':
      return {
        midis: [d, so],
        names: [d, so],
        line: COPY_TRACE,
        label: 'an illustration',
      }
    case 'ladder':
      return { midis: [d, mi, so, top], faint: true, names: [d, mi, so, top] }
    case 'order':
      return {
        midis: [d, mi, so, top],
        rows: true,
        faint: true,
        names: [d, mi, so, top],
      }
    case 'landing':
      return {
        midis: [d, so],
        durs: [LANDING.doSec, LANDING_SEC - LANDING.doSec],
        names: [d, so],
      }
    case 'free':
      return { midis: [d, mi, so, top], rows: true, names: [d, mi, so, top] }
  }
}

/** A layout on a window, as the chart shows it. */
function viewFrom(
  l: Layout,
  window: NoteWindow,
  doMidi: number,
  summary?: string,
): View {
  const faint = l.faint === true
  const leaps = l.leaps ?? []
  const laid =
    l.rows === true
      ? { places: rowsOf(l.midis, faint), seconds: ROW_SEC }
      : slotted(l.midis, l.durs ?? l.midis.map(() => NOTE_SEC), faint, SLOTS)
  return {
    window,
    ...laid,
    leaps,
    rows: l.rows === true,
    line: l.line ?? [],
    label: l.label ?? null,
    names: l.names,
    summary: summary ?? summaryOf(doMidi, l.midis, leaps.length),
  }
}

/** A state at rest, on a ladder from `doMidi`. */
export const viewOf = (state: ChartState, doMidi: number): View =>
  viewFrom(layoutOf(state, doMidi), windowOf(state, doMidi), doMidi)

/** Live mode: the chosen ladder's slots, faint, 1.5 s each on Merc's time, its rungs named. */
export function liveViewOf(ladder: LadderId, doMidi: number): View {
  const midis = LADDERS[ladder].map((n) => rungMidi(doMidi, n.rung))
  const laid = slotted(
    midis,
    midis.map(() => LADDER_NOTE_SEC),
    true,
    LIVE_SLOTS,
  )
  return {
    window: liveWindow(ladder, doMidi),
    ...laid,
    leaps: [],
    rows: false,
    line: [],
    label: null,
    names: [...new Set(midis)],
    summary: liveSummary(doMidi),
  }
}

/** The states that lay out a phrase's own notes, one slot each: the rest light the slots or rows they show. */
const OWN_SLOTS: ReadonlySet<ChartState> = new Set(['compact', 'step'])

// -------------------------------------------------------------- lines

/**
 * A point of a line, seconds of sound, as seconds across the window: over
 * the slot that sounds then. A point on the edge between two slots stands
 * at the end of the first when the next point shares its moment (the line
 * leaps there), and at the start of the second otherwise.
 */
function slotTime(
  places: readonly Place[],
  t: number,
  leapsNext: boolean,
): number {
  const i = places.findIndex((p) =>
    leapsNext ? t <= p.at + p.dur : t < p.at + p.dur,
  )
  const p = places[i < 0 ? places.length - 1 : i]
  const from = p.from ?? 0
  const to = p.to ?? from
  const k = Math.min(Math.max((t - p.at) / p.dur, 0), 1)
  return from + k * (to - from)
}

/** A line in seconds of sound, over the view's slots. */
export function lineOver(
  places: readonly Place[],
  points: readonly TracePoint[],
): TracePoint[] {
  return points.map((p, i) => ({
    t: slotTime(places, p.t, points[i + 1]?.t === p.t),
    c: p.c,
  }))
}

/** Words beside a line, under its end, where they never cover the band it falls short of. */
const LABEL_UNDER = 130

/** The view's leaps as arcs: between slots, or each in its column across the rows, numbered when there are several. */
function arcsOf(v: View, doMidi: number): Arc[] {
  const c = (k: number): number => (v.places[k].midi - doMidi) * 100
  if (v.rows) {
    const arcs = columnArcs(
      v.leaps.map(([a, b]) => [c(a), c(b)] as const),
      v.seconds,
    )
    return v.leaps.length > 1
      ? arcs
      : arcs.map((a) => ({ from: a.from, to: a.to }))
  }
  return v.leaps.map(([a, b]) => ({
    from: { t: v.places[a].to ?? 0, c: c(a) },
    to: { t: v.places[b].from ?? 0, c: c(b) },
  }))
}

// -------------------------------------------------------------- phrases

/** A phrase the page plays: its notes as they sound, and its leaps as pairs of note indices. */
export interface Phrase {
  readonly notes: readonly SoundNote[]
  readonly leaps?: readonly (readonly [number, number])[]
}

/** The drawing of a phrase in flight: the page tells it as each note starts, and how it ended. */
export interface PhraseDrawing {
  /** Note `i` starts: its rung lights while it sounds, and every arc into it draws. */
  note(i: number): void
  /** Heard to its end: every arc whole, no rung lit. */
  end(): void
  /** Cut short: the state at rest again. */
  cancel(): void
}

/** A rung swells in over this long as its note starts; an arc draws over this long. */
const SWELL_MS = 150
const ARC_MS = 300

/** For each note, the place it lights: the next with its pitch, else the first. */
function placesOf(
  places: readonly Place[],
  notes: readonly SoundNote[],
): (number | null)[] {
  let next = 0
  return notes.map((n) => {
    let k = places.findIndex((p, i) => i >= next && p.midi === n.midi)
    if (k < 0) k = places.findIndex((p) => p.midi === n.midi)
    if (k >= 0) next = k + 1
    return k < 0 ? null : k
  })
}

// -------------------------------------------------------------- the chart

/** A state of the chart, or Sing it's live frame. */
export type LadderView = ChartState | 'live'

export interface LadderChartOptions {
  /** The state it opens in. */
  readonly state: ChartState
  /** When it draws: a deck's `toyActive(n)`; default while its canvas is on screen. */
  readonly active?: () => boolean
}

export interface LadderChart {
  /** The kit's chart, for a line or a lit edge a page draws over the rungs. */
  readonly chart: BandChart
  readonly state: LadderView
  readonly voice: Voice
  /** Do, MIDI: the chart's target. */
  readonly doMidi: number
  /** The view as it rests now. */
  readonly view: View
  show(state: ChartState): void
  /** Sing it's live frame for the chosen ladder. */
  showLive(ladder: LadderId): void
  /** Move do: semitones from the voice's home do, within four. */
  move(shift: number): void
  /** Draws a phrase as it plays. */
  play(phrase: Phrase): PhraseDrawing
  /** A line in seconds of sound, over the slots shown now. */
  lineOf(points: readonly TracePoint[]): TracePoint[]
}

/** A phrase as drawn: what lights, which arcs draw, and since when. */
interface Drawing {
  readonly view: View
  readonly arcs: readonly Arc[]
  readonly lights: readonly (number | null)[]
  /** The note each arc lands on. */
  readonly into: readonly number[]
  /** The places whose turn has come: drawn in full from then on, on a chart that laid out the phrase. */
  readonly played: Set<number>
  readonly own: boolean
  /** Each lit place: when it lit, ms. */
  readonly lit: Map<number, number>
  /** Each drawing arc: when it started, ms; whole once done. */
  readonly drawing: Map<number, number>
  readonly timers: number[]
}

export function mountLadderChart(
  root: HTMLElement,
  opts: LadderChartOptions,
): LadderChart {
  const canvas = q<HTMLCanvasElement>('canvas', root)
  const active = opts.active ?? watch(canvas)
  let voice: Voice = VoiceChoice.voice ?? 'lower'
  let shift = 0
  let state: LadderView = opts.state
  let ladder: LadderId = 'full'
  let doMidi = doOf(voice, shift)
  let view = viewOf(opts.state, doMidi)
  let names = rungNames([])
  let drawing: Drawing | null = null

  const named: RungNames = {
    gutter: (ctx) => names.gutter(ctx),
    paint: (f, target) => names.paint(f, target),
  }

  // a swell or an arc the last paint left part way, so the next frame moves it on
  let moving = false

  /** How far a swell or an arc of `ms` has come since `since`: all the way at once under reduced motion. */
  function progress(
    since: number | undefined,
    ms: number,
    now: number,
  ): number {
    if (since === undefined) return 0
    const k = reducedMotion() ? 1 : Math.min(1, (now - since) / ms)
    if (k < 1) moving = true
    return k
  }

  function rungOf(p: Place, k: number, now: number): Rung {
    const since = drawing?.lit.get(k)
    const ownTurn = drawing?.own === true && !drawing.played.has(k)
    return {
      c: (p.midi - doMidi) * 100,
      from: p.from,
      to: p.to,
      glow: progress(since, SWELL_MS, now),
      faint: p.faint || ownTurn,
    }
  }

  /** The phrase's arcs as far as each is drawn; the view's, whole, with none in flight. */
  function arcsNow(v: View, now: number): Arc[] {
    const d = drawing
    if (d === null) return arcsOf(v, doMidi)
    return d.arcs.map((a, j) => ({
      ...a,
      drawn: progress(d.drawing.get(j), ARC_MS, now),
    }))
  }

  /** The scene for this moment: the view's rungs and line, and the arcs as far as drawn. */
  function paint(now: number): void {
    const v = drawing?.view ?? view
    const s = chart.scene
    moving = false
    s.rungs = v.places.map((p, k) => rungOf(p, k, now))
    s.arcs = arcsNow(v, now)
    s.line = v.rows ? [] : lineOver(v.places, v.line)
    const end = s.line[s.line.length - 1]
    s.label =
      v.label === null || end === undefined || end.c === null
        ? null
        : {
            // under the line's end, over so's slot
            t: v.places[v.places.length - 1].from ?? 0,
            c: end.c - LABEL_UNDER,
            text: v.label,
          }
  }

  /** The view on the chart: its window and target read again, its names, its summary. */
  function apply(next: View): void {
    stopDrawing()
    view = next
    names = rungNames(
      view.names.map((m) => [m, noteName(doMidi, m).text] as const),
    )
    chart.setTarget(doMidi)
    chart.setWindow(view.seconds)
    paint(performance.now())
    chart.describe(view.summary)
  }

  function stopDrawing(): void {
    drawing?.timers.forEach((id) => window.clearTimeout(id))
    drawing = null
  }

  const restView = (): View =>
    state === 'live' ? liveViewOf(ladder, doMidi) : viewOf(state, doMidi)

  // the swell and the arcs, ahead of the chart's own drawer, so that the
  // chart paints what this frame moved them to
  addDrawer({
    active,
    wants: () => moving,
    draw: (now) => paint(now),
  })

  const chart = mountBandChart(root, {
    target: doMidi,
    axis: {
      get notes() {
        return (drawing?.view ?? view).window
      },
      names: named,
    },
    window: view.seconds,
    active,
    paintRungs,
  })
  apply(view)

  /** The view a phrase draws over: its own slots on the compact and step charts, else the state's. */
  function phraseView(p: Phrase): View {
    if (state === 'live' || !OWN_SLOTS.has(state)) return view
    const midis = p.notes.map((n) => n.midi)
    const leaps = p.leaps ?? []
    return viewFrom(
      { midis, leaps, names: view.names },
      view.window,
      doMidi,
      summaryOf(doMidi, midis, leaps.length),
    )
  }

  function play(p: Phrase): PhraseDrawing {
    stopDrawing()
    const v = phraseView(p)
    const leaps = p.leaps ?? []
    // the leaps are pairs of notes; a view that laid out its own notes has a place a note
    const lights = placesOf(v.places, p.notes)
    const asPlaces: View = {
      ...v,
      leaps: leaps.map(([a, b]) => [lights[a] ?? 0, lights[b] ?? 0] as const),
    }
    const mine: Drawing = {
      view: asPlaces,
      arcs: arcsOf(asPlaces, doMidi),
      lights,
      into: leaps.map(([, b]) => b),
      played: new Set(),
      own: state !== 'live' && OWN_SLOTS.has(state),
      lit: new Map(),
      drawing: new Map(),
      timers: [],
    }
    drawing = mine
    chart.setWindow(v.seconds)
    paint(performance.now())
    wake()
    const live = (): boolean => drawing === mine
    return {
      note(i) {
        if (!live()) return
        const k = mine.lights[i]
        const now = performance.now()
        if (k !== null) {
          mine.played.add(k)
          mine.lit.set(k, now)
          const off = (p.notes[i]?.dur ?? 0) * 1000
          mine.timers.push(
            window.setTimeout(() => {
              if (mine.lit.get(k) !== now) return
              mine.lit.delete(k)
              paint(performance.now())
              wake()
            }, off),
          )
        }
        mine.into.forEach((b, j) => {
          if (b === i) mine.drawing.set(j, now)
        })
        paint(now)
        wake()
      },
      end() {
        if (!live()) return
        // the phrase stays drawn, whole and at rest, as its own view
        const ended = { ...mine.view }
        stopDrawing()
        view = ended
        paint(performance.now())
        chart.describe(view.summary)
        wake()
      },
      cancel() {
        if (live()) apply(restView())
      },
    }
  }

  function follow(): void {
    doMidi = doOf(voice, shift)
    apply(restView())
  }

  VoiceChoice.subscribe((v) => {
    const next = v ?? 'lower'
    if (next === voice) return
    voice = next
    follow()
  })

  return {
    chart,
    get state() {
      return state
    },
    get voice() {
      return voice
    },
    get doMidi() {
      return doMidi
    },
    get view() {
      return drawing?.view ?? view
    },
    show(next) {
      state = next
      apply(viewOf(next, doMidi))
    },
    showLive(id) {
      state = 'live'
      ladder = id
      apply(liveViewOf(id, doMidi))
    },
    move(next) {
      shift = next
      follow()
    },
    play,
    lineOf: (points) => lineOver((drawing?.view ?? view).places, points),
  }
}
