import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseResult } from '../types'
import { runStoppedEarly } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import { FRAME_MS, manualFrames, pageClock, silentSound, } from './in-time-sound.fixture'
import { seeded } from './take-frames.fixture'
import { noteAt, planRun, TUNE_BEATS } from './tune-plan'
import type { RunPhase, SingInTimeController, } from './use-sing-in-time-controller'
import { REVIEW_MS, useSingInTimeController, } from './use-sing-in-time-controller'

const TUNES = planRun({
  level: 5,
  clef: 'treble',
  voice: 'alto',
  random: seeded(21),
})

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

type History = ReturnType<BaseExerciseController['pitchHistory']>

interface Rig {
  /** How the page draws: a frame every `hopMs`. */
  readonly hopMs?: number
  /** The singer comes in this many seconds after each beat. */
  readonly late?: number
  /** Silent: the singer never sings. */
  readonly silent?: boolean
}

/**
 * The run on a base that records what it is told, its frames drawn on a page
 * clock moved by hand, with a singer who sings each note as the cursor's
 * beat reaches it (`late` seconds after), as the base's frame loop hears it.
 */
function rig(o: Rig = {}) {
  const clock = pageClock()
  const frames = manualFrames()
  const startMs = clock.now()
  let history: History = []
  let lookMs = 0
  let running = true
  const results: ExerciseResult[] = []
  const targets: number[] = []
  const scores: number[] = []
  const disposers: (() => void)[] = []
  const base: BaseExerciseController = {
    pitchHistory: () => history,
    _setTargetPitch: (f: number | null) => {
      if (f !== null) targets.push(f)
    },
    _getElapsed: () => clock.now() - startMs,
    _isRunning: () => running,
    _setRunning: (v: boolean) => {
      running = v
      if (!v) for (const d of disposers) d()
    },
    _commitResult: () => {},
    _updateScore: (s: number) => scores.push(s),
    _updateMetrics: () => {},
    _completeWithResult: (r: ExerciseResult) => results.push(r),
    _registerDispose: (fn: () => void) => disposers.push(fn),
    _getDepths: () => ({ completeDepth: 0, resetDepth: 0, startDepth: 0 }),
    state: () => ({
      status: 'active',
      currentScore: 0,
      elapsedMs: lookMs,
      metrics: {},
    }),
    start: async () => true,
    stop: () => {},
    reset: () => {},
    result: () => null,
    currentPitch: () => null,
    frequencyData: () => null,
    targetPitch: () => null,
    error: () => null,
  }
  let dispose = () => {}
  const c = createRoot((d): SingInTimeController => {
    dispose = d
    return useSingInTimeController(base, {
      sound: silentSound(clock),
      frame: frames.frame,
      now: clock.now,
    })
  })

  /** The note the singer is on now: the cursor's, `late` seconds behind it. */
  const singing = (): number | null => {
    const at = c.beat()
    const tune = c.tunes()[c.index()]
    if (o.silent === true || c.phase() !== 'sing' || at === null) return null
    const b = at - (o.late ?? 0) * (tune.bpm / 60)
    if (b < 0 || b >= TUNE_BEATS) return null
    return tune.notes[noteAt(tune, b)].midi
  }

  const phases: RunPhase[] = []
  const reviews: string[] = []
  /** One frame: the page moves on, the base hears the singer, the run ticks. */
  const step = (): void => {
    const hop = o.hopMs ?? FRAME_MS
    clock.advance(hop)
    vi.advanceTimersByTime(hop)
    lookMs = clock.now() - startMs
    const midi = singing()
    if (midi !== null)
      history = [
        ...history,
        { freq: hz(midi), time: lookMs / 1000, cents: 0, clarity: 0.9 },
      ]
    frames.step()
    if (phases.at(-1) === c.phase()) return
    phases.push(c.phase())
    if (c.phase() === 'review') reviews.push(c.review() ?? '')
  }
  /** Frames until the run has a result, or `ms` of page time. */
  const runFor = (ms: number): void => {
    const until = clock.now() + ms
    while (results.length === 0 && clock.now() < until) step()
  }

  c.startRun({ tunes: TUNES, click: false, level: 5 })
  return {
    c,
    results,
    targets,
    scores,
    phases,
    reviews,
    frames,
    runFor,
    dispose,
    running: () => running,
  }
}

const pitches = (c: SingInTimeController) =>
  c
    .marks()
    .flat()
    .map((v) => v?.pitch ?? null)
const timings = (c: SingInTimeController) =>
  c
    .marks()
    .flat()
    .map((v) => v?.timing ?? null)
const notes = TUNES.reduce((n, t) => n + t.notes.length, 0)

describe('a run of Sing It in Time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays do, counts in, hears each tune and says how it went, three times, then ends', () => {
    const r = rig()
    r.runFor(90_000)
    expect(r.phases).toEqual([
      'do',
      'count',
      'sing',
      'review',
      'do',
      'count',
      'sing',
      'review',
      'do',
      'count',
      'sing',
      'review',
      'idle',
    ])
    expect(r.reviews).toHaveLength(3)
    expect(r.c.tunesDone()).toBe(3)
    expect(r.running()).toBe(false)
    expect(r.frames.pending).toBe(0)
    r.dispose()
  })

  it('marks a run sung on the beat in tune and on time, and scores it whole', () => {
    const r = rig()
    r.runFor(90_000)
    expect(pitches(r.c)).toEqual(Array(notes).fill('in-tune'))
    expect(timings(r.c)).toEqual(Array(notes).fill('on-time'))
    expect(r.scores).toEqual([100, 100, 100])
    expect(r.results).toHaveLength(1)
    expect(r.results[0].score).toBe(100)
    expect(runStoppedEarly(r.results[0].metrics)).toBe(false)
    expect(r.reviews[0]).toBe(
      `All ${TUNES[0].notes.length} in tune, on the beat.`,
    )
    r.dispose()
  })

  it("aims the contour at Merc's do, then at each note as the singer reaches it", () => {
    const r = rig()
    r.runFor(90_000)
    const first = TUNES[0]
    expect(r.targets[0]).toBeCloseTo(hz(first.doMidi), 6)
    expect(r.targets.slice(1, first.notes.length + 1)).toEqual(
      first.notes.map((n) => hz(n.midi)),
    )
    r.dispose()
  })

  it("counts a late singer's beats from their first note: in tune and on time", () => {
    const r = rig({ late: 0.45 })
    r.runFor(90_000)
    expect(pitches(r.c)).toEqual(Array(notes).fill('in-tune'))
    expect(timings(r.c)).toEqual(Array(notes).fill('on-time'))
    for (const s of r.c.shifts()) expect(s).toBeCloseTo(0.45, 1)
    r.dispose()
  })

  it('still hears a late singer on a page drawing fifteen frames a second', () => {
    const r = rig({ late: 0.45, hopMs: 1000 / 15 })
    r.runFor(90_000)
    expect(pitches(r.c)).toEqual(Array(notes).fill('in-tune'))
    expect(timings(r.c)).toEqual(Array(notes).fill('on-time'))
    r.dispose()
  })

  it('hears no note from a silent singer, and says so', () => {
    const r = rig({ silent: true })
    r.runFor(90_000)
    expect(pitches(r.c)).toEqual(Array(notes).fill('not-heard'))
    expect(r.reviews).toEqual(
      Array(3).fill("I didn't hear you that time. Sing out on the next one."),
    )
    expect(r.results[0].score).toBe(0)
    r.dispose()
  })

  it('ends at Stop, judging the tune up as far as its windows closed, marked stopped', () => {
    const r = rig()
    r.runFor(1)
    // into the second tune's singing
    while (!(r.c.index() === 1 && (r.c.beat() ?? -1) > 2.5)) r.runFor(FRAME_MS)
    r.c.stop()
    expect(r.results).toHaveLength(1)
    const result = r.results[0]
    expect(runStoppedEarly(result.metrics)).toBe(true)
    expect(result.metrics.tunesDone).toBe(1)
    const second = r.c.marks()[1]
    expect(second[0]?.pitch).toBe('in-tune')
    expect(second.at(-1)).toBeNull()
    expect(r.c.marks()[2].every((v) => v === null)).toBe(true)
    expect(r.c.phase()).toBe('idle')
    // nothing goes on after it
    vi.advanceTimersByTime(REVIEW_MS * 4)
    expect(r.frames.pending).toBe(0)
    expect(r.results).toHaveLength(1)
    r.dispose()
  })

  it('stops between tunes without starting the next', () => {
    const r = rig()
    while (r.c.phase() !== 'review') r.runFor(FRAME_MS)
    r.c.reset()
    vi.advanceTimersByTime(REVIEW_MS * 2)
    expect(r.c.phase()).toBe('idle')
    expect(r.c.index()).toBe(0)
    expect(r.frames.pending).toBe(0)
    r.dispose()
  })
})
