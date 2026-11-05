// ============================================================
// Lesson 14 song line — the one figure, in each of its states
// ============================================================
//
// The page's one object (WEB-SPEC, Toys 1): the kit's band chart on a notes
// axis, each of Merc's notes a band over its own time, the words strip under
// it, breath marks over its gaps, and light along each band that follows
// its note's level and stays (kit/band-chart-song.ts). Its rows are named by
// syllable alone, do to la, in the kit's 40 px gutter; the summary says the
// spelled notes. States: compact (the hero and the cold open), song (Step
// 1), takes (Step 2), swell (Step 3), endings (Step 4), listen back (Step
// 5), still (the closing card) and live (Sing it, sing-live.ts). Every
// phrase view, the song view and live mode show do − 1 to la + 1; the swell
// shows fa to la (FACTS 82).
//
// A page plays a sound and tells the chart what sounds (`play`): the chart
// runs a playhead along the plot from that moment, lights each band as the
// playhead passes it by its note's level, its syllable with it, and each
// breath mark as it is reached, and leaves the take's shape in light when
// it ends; one cut short keeps the light it got to. It shows one take at a
// time, named in its top left corner, and the next play clears it. A scrub
// draws a take up to the moment it names, without sound. Under reduced
// motion no playhead runs: a band and its syllable light in place as their
// note starts, its light drawn whole, and a breath mark lights at once.
// Only a play asks for frames; at rest the chart paints only what changed.
//
// The voice is `fyp-voice`, else the lower (do D3, or D4 for the higher),
// and the chart follows a change made anywhere (`VoiceChoice.subscribe`).

import type { BandChart, TracePoint } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import type { LevelPoint } from '@/features/lessons/kit/band-chart-hold'
import type { RungNames } from '@/features/lessons/kit/band-chart-names'
import { rungNames } from '@/features/lessons/kit/band-chart-names'
import { paintSong, songUnder } from '@/features/lessons/kit/band-chart-song'
import type { SongBand, SongScene, SongWord, } from '@/features/lessons/kit/band-chart-song-scene'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { VERSE } from '@/features/lessons/kit/twinkle'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { liveSummary, phraseSummary, SONG_SUMMARY, STILL_ALT, swellSummary, } from './lines'
import type { SongNote, TakeId } from './song'
import { chordMarks, doOf, laOf, lineNotes, PUSH_AT, SOLFEGE, SWELL_SEC, SWELL_STAR, SWELL_WINDOW, TAKE_BREATH, takeNotes, VERSE_BREATHS, VERSE_SEC, verseNotes, } from './song'

export type SongState =
  | 'compact'
  | 'song'
  | 'takes'
  | 'swell'
  | 'endings'
  | 'listen'
  | 'still'
  | 'live'

/** A breath mark as a play or a state carries it: its time, and whether it has its word. */
export interface Breath {
  readonly t: number
  readonly word: boolean
}

/** What a play sounds, as the chart draws it. */
export interface Play {
  readonly notes: readonly SongNote[]
  /** Its breath marks, each lit as the playhead reaches it. */
  readonly breaths?: readonly Breath[]
  /** Its name in the plot's top left corner: "take 1". */
  readonly name?: string | null
  /** Seconds across the plot the play starts at (a phrase of the whole song). */
  readonly at?: number
}

/** A play in flight on the chart. */
export interface Drawing {
  /** Seconds since it started, on the chart's clock. */
  readonly t: number
  /** It played to its end: everything it sounded stays lit. */
  end(): void
  /** It was cut short: the light it got to stays, the playhead goes. */
  cancel(): void
}

export interface SongLine {
  readonly chart: BandChart
  readonly state: SongState
  /** Do now, MIDI. */
  readonly doMidi: number
  /** The state at rest; with `line` (1 or 2), Step 4's phrase. */
  show(state: SongState, o?: { readonly line?: 1 | 2 }): void
  /** Do moved (Move do) or the voice changed: the bands, the rows and the window move with it. */
  setDo(doMidi: number): void
  play(p: Play): Drawing
  /** A take drawn up to `t` seconds, without sound (Step 5's scrub). */
  scrub(p: Play, t: number): void
  /** The violet drawings over the plot (Step 3's two lines), and the level strip. */
  drawLines(line: readonly TracePoint[], level: readonly LevelPoint[]): void
  /** The canvas's spoken summary of what it shows now. */
  readonly summary: string
}

/** Each row a degree of the scale, named by its syllable alone, two letters that fit the gutter. */
function syllableNames(): RungNames {
  const of = (doMidi: number) =>
    SOLFEGE.map((s, i) => [doMidi + MAJOR_DEGREES[i], s] as const)
  return {
    gutter: (ctx) => rungNames(of(0)).gutter(ctx),
    paint: (f, target) => rungNames(of(target)).paint(f, target),
  }
}

/** The notes axis of a state, MIDI: do − 1 to la + 1, or fa to la for the swell (FACTS 82). */
export function windowOf(state: SongState, doMidi: number): [number, number] {
  if (state === 'swell')
    return [doMidi + MAJOR_DEGREES[3], doMidi + MAJOR_DEGREES[5]]
  return [doMidi - 1, laOf(doMidi) + 1]
}

/** Seconds across the plot in a state: a phrase's 6, the song's 36, the swell's two windows. */
export function secondsOf(state: SongState): number {
  if (state === 'song' || state === 'still') return VERSE_SEC
  if (state === 'swell') return SWELL_WINDOW
  return 6
}

/** A note as a band over its time, in cents from do, unlit. */
const bandOf = (doMidi: number, n: SongNote, at = 0): SongBand => ({
  c: (n.midi - doMidi) * 100,
  from: n.from + at,
  to: n.to + at,
})

/** A syllable centred under its note. */
const syllableOf = (n: SongNote, at = 0): SongWord => ({
  t: (n.from + n.to) / 2 + at,
  text: n.printed,
})

/** The phrase numbers under the song, each centred under its 6 s (WEB-SPEC, Toys 1, Song). */
const PHRASE_NUMBERS: readonly SongWord[] = VERSE.map((_, k) => ({
  t: k * 6 + 3,
  text: String(k + 1),
}))

/** The light a band keeps once sounded: its note's level, shifted to its place. */
const lightOf = (n: SongNote, at = 0): LevelPoint[] =>
  n.light.map((p) => ({ t: p.t + at, level: p.level }))

const blank = (): SongScene => ({
  bands: [],
  words: [],
  chords: [],
  breaths: [],
  labels: [],
  name: null,
  level: null,
})

/** The song scene of a state at rest. */
export function restingScene(
  state: SongState,
  doMidi: number,
  line: 1 | 2 = 1,
): SongScene {
  switch (state) {
    case 'compact':
    case 'takes':
    case 'listen':
    case 'live': {
      const notes = lineNotes(0, doMidi)
      return {
        ...blank(),
        bands: notes.map((n) => bandOf(doMidi, n)),
        words: notes.map((n) => syllableOf(n)),
      }
    }
    case 'endings': {
      const notes = lineNotes(line, doMidi)
      return {
        ...blank(),
        bands: notes.map((n) => bandOf(doMidi, n)),
        words: notes.map((n) => syllableOf(n)),
        chords: chordMarks(line),
      }
    }
    case 'song':
      return {
        ...blank(),
        bands: verseNotes(doMidi).map((n) => bandOf(doMidi, n)),
        words: PHRASE_NUMBERS,
        breaths: VERSE_BREATHS.map((t) => ({ t, lit: false, word: false })),
      }
    case 'still': {
      // the swell drawn in light on each "star", in lines 1 and 5
      const stars = new Set([6, 4 * 7 + 6])
      return {
        ...blank(),
        bands: verseNotes(doMidi).map((n, i) => {
          if (!stars.has(i)) return bandOf(doMidi, n)
          const at = n.from - SWELL_STAR[0].t
          const swell = SWELL_STAR.map((p) => ({ t: p.t + at, level: p.level }))
          return { ...bandOf(doMidi, n), light: swell, upTo: n.to }
        }),
        words: PHRASE_NUMBERS,
        breaths: VERSE_BREATHS.map((t) => ({ t, lit: true, word: false })),
      }
    }
    case 'swell': {
      const so = MAJOR_DEGREES[4] * 100
      return {
        ...blank(),
        bands: [
          { c: so, from: 0, to: SWELL_SEC },
          { c: so, from: PUSH_AT, to: SWELL_WINDOW },
        ],
        labels: [
          { t: SWELL_SEC / 2, text: 'the swell' },
          { t: PUSH_AT + SWELL_SEC / 2, text: "Lesson 5's push" },
        ],
        level: [],
      }
    }
  }
}

/** A state's spoken summary. */
export function summaryFor(
  state: SongState,
  doMidi: number,
  line: 1 | 2 = 1,
): string {
  switch (state) {
    case 'song':
      return SONG_SUMMARY
    case 'still':
      return STILL_ALT
    case 'swell':
      return swellSummary(doMidi)
    case 'endings':
      return phraseSummary(line, doMidi)
    case 'live':
      return liveSummary(doMidi)
    default:
      return phraseSummary(0, doMidi)
  }
}

/** The scene of a play `t` seconds in: what has sounded lit, the sounding note's band and syllable on. */
export function playedScene(
  rest: SongScene,
  doMidi: number,
  p: Play,
  t: number,
  o: { readonly reduced: boolean; readonly whole: boolean },
): SongScene {
  const at = p.at ?? 0
  const sounding = (n: SongNote): boolean => !o.whole && t >= n.from && t < n.to
  const playedBands = p.notes.map((n) => {
    const started = o.whole || t >= n.from
    const upTo = o.whole
      ? n.to + at
      : o.reduced
        ? started
          ? n.to + at
          : -1
        : t + at
    return {
      ...bandOf(doMidi, n, at),
      glow: sounding(n) ? 1 : 0,
      light: lightOf(n, at),
      upTo,
    }
  })
  // a phrase of the whole song lights its own bands and leaves the rest as they rest
  const keep =
    at === 0 && rest.bands.length === p.notes.length ? [] : rest.bands
  const bands =
    keep.length === 0
      ? playedBands
      : keep.map(
          (b) =>
            playedBands.find(
              (q) => Math.abs(q.from - b.from) < 1e-6 && q.c === b.c,
            ) ?? b,
        )
  // a phrase view's syllables, one a note: the sounding one in ink
  const words =
    rest.words.length === p.notes.length && at === 0
      ? rest.words.map((w, i) =>
          sounding(p.notes[i]) ? { ...w, on: true } : w,
        )
      : rest.words
  const reached = (b: Breath): boolean => o.whole || t >= b.t
  const breaths = [
    ...rest.breaths.filter(
      (r) => !(p.breaths ?? []).some((b) => Math.abs(b.t + at - r.t) < 1e-6),
    ),
    ...(p.breaths ?? []).map((b) => ({
      t: b.t + at,
      lit: reached(b),
      word: b.word,
    })),
  ]
  return { ...rest, bands, words, breaths, name: p.name ?? rest.name }
}

/** Merc's take `id` of the first phrase as the chart draws it: named, its breath mark with its word. */
export const takePlay = (id: TakeId, doMidi: number): Play => ({
  notes: takeNotes(id, doMidi),
  breaths: [{ t: TAKE_BREATH[id], word: true }],
  name: `take ${String(id)}`,
})

/** Mounts the song line on `root` (a figure holding its canvas) in `state`. */
export function mountSongLine(
  root: HTMLElement,
  o: {
    readonly state: SongState
    /** When it draws: a deck's `toyActive(n)`; default while the canvas is on screen. */
    readonly active?: () => boolean
    /** Follow the stored voice (default true); Sing it's chart sets its own do. */
    readonly followVoice?: boolean
  },
): SongLine {
  let state = o.state
  let line: 1 | 2 = 1
  let doMidi = doOf(VoiceChoice.voice ?? 'lower')
  let win = windowOf(state, doMidi)
  let chart: BandChart | null = null
  const canvas = root.querySelector('canvas')
  chart = mountBandChart(root, {
    target: doMidi,
    axis: {
      get notes() {
        return win
      },
      names: syllableNames(),
    },
    window: secondsOf(state),
    active: o.active ?? (canvas === null ? undefined : watch(canvas)),
    paintRungs: paintSong,
    under: songUnder(() => chart?.scene.song),
  })
  const c: BandChart = chart
  let rest = restingScene(state, doMidi)
  // the play in flight, and the clock it started on
  let current: { p: Play; start: number; done: boolean } | null = null
  let summary = ''

  const describe = (text: string): void => {
    summary = text
    c.describe(text)
  }

  function rebuild(): void {
    win = windowOf(state, doMidi)
    c.setTarget(doMidi)
    c.setWindow(secondsOf(state))
    rest = restingScene(state, doMidi, line)
    c.scene.song = rest
    describe(summaryFor(state, doMidi, line))
  }

  const now = (): number => performance.now() / 1000

  function frame(): void {
    const cur = current
    if (cur === null) return
    const t = now() - cur.start
    const reduced = reducedMotion()
    c.scene.song = playedScene(rest, doMidi, cur.p, t, {
      reduced,
      whole: false,
    })
    c.scene.playhead = reduced ? null : Math.min(t + (cur.p.at ?? 0), c.window)
  }

  addDrawer({
    active: o.active ?? (canvas === null ? () => true : watch(canvas)),
    wants: () => current !== null && !current.done,
    draw: frame,
  })

  function settle(cur: NonNullable<typeof current>, whole: boolean): void {
    if (current !== cur) return
    cur.done = true
    const t = now() - cur.start
    c.scene.song = playedScene(rest, doMidi, cur.p, t, {
      reduced: reducedMotion(),
      whole,
    })
    c.scene.playhead = null
    current = null
    wake()
  }

  if (o.followVoice !== false)
    VoiceChoice.subscribe((v) => {
      const next = doOf(v ?? 'lower')
      if (next === doMidi) return
      doMidi = next
      current = null
      rebuild()
    })
  rebuild()

  return {
    chart: c,
    get state() {
      return state
    },
    get doMidi() {
      return doMidi
    },
    get summary() {
      return summary
    },
    show(next, so) {
      state = next
      line = so?.line ?? 1
      current = null
      c.clear()
      rebuild()
    },
    setDo(midi) {
      if (midi === doMidi) return
      doMidi = midi
      current = null
      c.clear()
      rebuild()
    },
    play(p) {
      // the last take is cleared, and the new one drawn as it sounds
      c.scene.line = []
      c.scene.head = null
      const cur = { p, start: now(), done: false }
      current = cur
      frame()
      wake()
      return {
        get t() {
          return now() - cur.start
        },
        end: () => settle(cur, true),
        cancel: () => settle(cur, false),
      }
    },
    scrub(p, t) {
      current = null
      c.scene.song = playedScene(rest, doMidi, p, t, {
        reduced: false,
        whole: false,
      })
      c.scene.playhead = t + (p.at ?? 0)
      wake()
    },
    drawLines(lineNow, level) {
      c.scene.line = [...lineNow]
      c.scene.song = { ...rest, level: [...level] }
      wake()
    },
  }
}
