// ============================================================
// Sing It in Time: one run, tune by tune, on the beat
// ============================================================
//
// A run is three tunes (tune-plan.ts). Each one: Merc gives do, the click
// counts one bar in, and the singer sings the two bars while the cursor
// moves on at tempo. Notes advance on the beat, never on a held pitch, as
// Sight-Singing's do (SEASON-2 § 5.2 item 11). Under the singing the beat
// is always seen, and heard only where the singer has asked for the click.
//
// The take opens half a beat before bar 1, as Lesson 18's does
// (kit/take-in-time.ts `OPEN_BEATS`), so Merc's do and the count-in are
// never read as singing, and listens until the last note's window closes,
// moved by the anchor on the singer's first note (take-judge.ts). Each note
// is marked on the staff once its window closes. Then Merc says how the
// tune went, and the next one starts.
//
// The frames are the base exercise's (use-base-exercise.ts), which owns the
// microphone, the voice take and the run's contour; their clock starts as
// the run does, and the beat clock's beats are mapped onto it through the
// page's clock, on which both are read.
//
// Stop ends the run where it is: the notes whose windows closed are judged,
// the rest score nothing, and a run stopped before its last tune is marked
// stopped (run-result.ts).

import { createSignal } from 'solid-js'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { BaseExerciseController } from '../use-base-exercise'
import type { InTimeSound } from './beat-sound'
import { COUNT_BEATS } from './beat-sound'
import { ANCHOR_LATE_BEATS, WINDOW_BEATS } from './in-time-kit'
import { tuneLine } from './in-time-words'
import { meanScore, runResult } from './run-result'
import type { NoteVerdict, TakeOptions, TakeVerdict } from './take-judge'
import { closesAt, judgeTake } from './take-judge'
import type { FrameScheduler, TunePlay } from './tune-clock'
import { animationFrames, createTuneClock, playTune, startFrames, } from './tune-clock'
import type { Tune } from './tune-plan'
import { beatSeconds, noteAt } from './tune-plan'

/** The take opens this many beats before bar 1's first beat (Lesson 18's `OPEN_BEATS`). */
export const OPEN_BEATS = 0.5
/** How long Merc's line on a tune stays up before the next one starts, ms. */
export const REVIEW_MS = 2200
/** A window is read this long after it closes: the frames arrive a little after the voice. */
const CLOSE_MARGIN_SEC = 0.08
/** The take is judged afresh this often while it runs, s, not every frame: a mark can wait a tenth of a second, and a busy phone's frames are better spent on the cursor. */
export const JUDGE_EVERY_SEC = 0.1

/** Where a run is: Merc's do, the count-in, the singing, or Merc's line on a tune. */
export type RunPhase = 'idle' | 'do' | 'count' | 'sing' | 'review'

export interface SingInTimeDeps {
  readonly sound: InTimeSound
  readonly frame?: FrameScheduler
  /** The page's clock, ms: performance.now() by default. */
  readonly now?: () => number
}

export interface SingInTimeRun {
  readonly tunes: readonly Tune[]
  /** The click sounds under the singing too, not only in the count-in. */
  readonly click: boolean
  /** The level the tunes were planned at, for the history. */
  readonly level: number
}

type Marks = readonly (readonly (NoteVerdict | null)[])[]

const sameVerdict = (a: NoteVerdict | null, b: NoteVerdict | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.pitch === b.pitch &&
    a.timing === b.timing &&
    a.cents === b.cents)

export function useSingInTimeController(
  base: BaseExerciseController,
  deps: SingInTimeDeps,
) {
  const clock = createTuneClock(deps.sound)
  const frame = deps.frame ?? animationFrames
  const now = deps.now ?? (() => performance.now())

  const [phase, setPhase] = createSignal<RunPhase>('idle')
  const [tunes, setTunes] = createSignal<readonly Tune[]>([])
  /** The tune up now, by its place in the run. */
  const [index, setIndex] = createSignal(0)
  /** Beats from bar 1's first beat as heard: below 0 in the do and the count-in. */
  const [beat, setBeat] = createSignal<number | null>(null)
  /** Each tune's notes' verdicts, null until a note's window closes. */
  const [marks, setMarks] = createSignal<Marks>([])
  /** Each tune's anchor: seconds the beats moved to the singer's first note, once known. */
  const [shifts, setShifts] = createSignal<readonly (number | null)[]>([])
  /** Merc's line on the tune just sung. */
  const [review, setReview] = createSignal<string | null>(null)
  /** Tunes whose take has closed. */
  const [tunesDone, setTunesDone] = createSignal(0)

  let play: TunePlay | null = null
  let stopFrames: (() => void) | null = null
  let reviewTimer: ReturnType<typeof setTimeout> | undefined
  /** The base's clock's zero on the page's clock, ms. */
  let baseStartMs = 0
  let level = 5
  let click = false
  let aimed = -1
  let live = false
  /** When the take was last judged, s on the frames' clock. */
  let judgedAt = -Infinity
  /** The base's frames this tune that heard no voice, s on the frames' clock (take-judge.ts `filled`), and the last one seen. */
  let silent: number[] = []
  let lastLook: number | null = null

  /** Stops the tune, its frames and the pause after it; idempotent. */
  function halt(): void {
    live = false
    stopFrames?.()
    stopFrames = null
    play?.stop()
    play = null
    clearTimeout(reviewTimer)
    reviewTimer = undefined
  }
  base._registerDispose(halt)

  /** Seconds on the frames' clock for `ms` on the page's. */
  const framesAt = (ms: number): number => (ms - baseStartMs) / 1000

  function optionsFor(tune: Tune, bar1Ms: number): TakeOptions {
    const bar1 = framesAt(bar1Ms)
    return {
      notes: tune.notes.map((n) => ({
        midi: n.midi,
        beat: n.beat,
        beats: n.beats,
      })),
      bpm: tune.bpm,
      bar1,
      opened: bar1 - OPEN_BEATS * beatSeconds(tune),
      silent,
    }
  }

  /**
   * Notes the base's latest frame where it heard no voice: one the base
   * looked at (its clock moved) that left nothing in the pitch history.
   */
  function look(): void {
    const at = base.state().elapsedMs / 1000
    if (at === lastLook) return
    lastLook = at
    const heard = base.pitchHistory().at(-1)
    if (heard === undefined || Math.abs(heard.time - at) > 1e-6) silent.push(at)
  }

  /** The take's frames, from the pitch history the base keeps. */
  function takeFrames(o: TakeOptions): F0Frame[] {
    return base
      .pitchHistory()
      .filter((p) => p.time >= o.opened - 1e-9)
      .map((p) => ({ t: p.time, f0: p.freq, conf: p.clarity ?? 0 }))
  }

  function setTune<T>(list: readonly T[], i: number, value: T): T[] {
    return list.map((v, k) => (k === i ? value : v))
  }

  function show(i: number, v: TakeVerdict): void {
    const was = marks()[i] ?? []
    if (v.notes.some((n, k) => !sameVerdict(n, was[k] ?? null)))
      setMarks((m) => setTune(m, i, v.notes))
    if (v.settled && shifts()[i] !== v.shift)
      setShifts((s) => setTune(s, i, v.shift))
  }

  /**
   * The note the voice should be on, as the run's contour's target: the
   * cursor's note, moved by the anchor once it is known, so the target
   * changes when the singer's notes do and the result's "Furthest off" is
   * never the moment between two notes.
   */
  function aim(tune: Tune, at: number, shift: number | null): void {
    const k = noteAt(tune, Math.max(0, at - (shift ?? 0) / beatSeconds(tune)))
    if (k === aimed) return
    aimed = k
    base._setTargetPitch(midiToFrequency(tune.notes[k].midi))
  }

  function startTune(i: number): void {
    const tune = tunes()[i]
    setIndex(i)
    setPhase('do')
    setReview(null)
    setBeat(null)
    // Merc's do is the note to sing along with until the tune's first beat
    aimed = -1
    judgedAt = -Infinity
    base._setTargetPitch(midiToFrequency(tune.doMidi))
    silent = []
    lastLook = null
    const current = playTune(clock, deps.sound, tune, {
      lead: true,
      tune: true,
      click,
      voiced: false,
      // the clock counts on past the bars for as long as a window can stay open
      tailBeats: ANCHOR_LATE_BEATS + WINDOW_BEATS + 1,
    })
    play = current
    stopFrames = startFrames(frame, () => tick(i, tune, current))
  }

  function tick(i: number, tune: Tune, current: TunePlay): void {
    if (!live) return
    look()
    clock.pump()
    const at = current.beat()
    setBeat(at)
    if (at !== null)
      setPhase(at < -COUNT_BEATS ? 'do' : at < 0 ? 'count' : 'sing')
    const bar1Ms = current.bar1()
    if (bar1Ms === null) return
    if (at !== null && at >= 0) aim(tune, at, shifts()[i] ?? null)
    const t = framesAt(now())
    if (t - judgedAt < JUDGE_EVERY_SEC - 1e-9) return
    judgedAt = t
    const o = optionsFor(tune, bar1Ms)
    const v = judgeTake(takeFrames(o), o, t)
    show(i, v)
    if (v.settled && t >= closesAt(o, v.shift) + CLOSE_MARGIN_SEC)
      finishTune(i, tune, o)
  }

  function finishTune(i: number, tune: Tune, o: TakeOptions): void {
    stopFrames?.()
    stopFrames = null
    play?.stop()
    play = null
    const v = judgeTake(takeFrames(o), o)
    show(i, v)
    setTunesDone(i + 1)
    base._updateScore(meanScore(marks().slice(0, i + 1), 'judged'))
    setPhase('review')
    setReview(tuneLine(tune, v.notes, v.voice))
    reviewTimer = setTimeout(() => {
      reviewTimer = undefined
      if (!live) return
      if (i + 1 < tunes().length) startTune(i + 1)
      else finish(i + 1)
    }, REVIEW_MS)
  }

  /** Ends the run: its result to the base, which settles the shell. */
  function finish(started: number): void {
    halt()
    setPhase('idle')
    setBeat(null)
    const result = runResult(
      {
        tunes: tunes(),
        marks: marks(),
        tunesDone: tunesDone(),
        tunesStarted: started,
        level,
      },
      Date.now(),
    )
    base._setRunning(false)
    base._completeWithResult(result)
  }

  /** Starts the run's first tune, once the base has the microphone. */
  function startRun(run: SingInTimeRun): void {
    halt()
    setTunes(run.tunes)
    level = run.level
    click = run.click
    setMarks(run.tunes.map((t) => t.notes.map(() => null)))
    setShifts(run.tunes.map(() => null))
    setTunesDone(0)
    baseStartMs = now() - base._getElapsed()
    live = true
    startTune(0)
  }

  /** Stop: the tune up now judged as far as its windows have closed, then the result. */
  function stop(): void {
    if (!live) return
    const i = index()
    const bar1Ms = play?.bar1() ?? null
    if (phase() !== 'review' && bar1Ms !== null) {
      const tune = tunes()[i]
      const o = optionsFor(tune, bar1Ms)
      show(i, judgeTake(takeFrames(o), o, framesAt(now())))
    }
    finish(i + 1)
  }

  function reset(): void {
    halt()
    setPhase('idle')
    setBeat(null)
    setReview(null)
  }

  return {
    phase,
    tunes,
    index,
    beat,
    marks,
    shifts,
    review,
    tunesDone,
    startRun,
    stop,
    reset,
  }
}

export type SingInTimeController = ReturnType<typeof useSingInTimeController>
