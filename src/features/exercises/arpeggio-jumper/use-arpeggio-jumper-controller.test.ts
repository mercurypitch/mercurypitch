// ============================================================
// Arpeggio Jumper — what each note is scored on, and the grade
// ============================================================
//
// The controller runs on fake timers against a simulated room. Every 16 ms
// (a frame) the room asks what reached the microphone: the singer, the
// speaker's own tone when it bleeds, or nothing. A voice is a function of
// the moment it sings and of what the drill had on screen then; a frame
// reaches the pitch history one mic round trip later. Frames carry the
// detector's realistic clarity (0.9, on its 0-1 scale).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeEma } from '@/features/practice-intelligence/adaptive-difficulty'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { findWeakExercises } from '@/features/practice-intelligence/weakness-analyzer'
import { applyPersistedValue } from '@/lib/storage'
import { exerciseScoringVersion } from '../exercise-comparability'
import type { ExerciseResult } from '../types'
import { EXERCISE_ARPEGGIO_JUMPER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ArpeggioMode, SungNote } from './use-arpeggio-jumper-controller'
import { arpeggioRunHeard, arpeggioTimings, bestOctaveOffset, MIN_SINGING_MS, octaveLine, useArpeggioJumperController, } from './use-arpeggio-jumper-controller'

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69
}

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  const mock: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: ((
      _v: number | null,
    ) => {}) as BaseExerciseController['_setTargetPitch'],
    _getElapsed: () => 0,
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: () => {},
    _completeWithResult: () => {},
    _registerDispose: () => {},
    _getDepths: () => ({ completeDepth: 0, resetDepth: 0, startDepth: 0 }),
    state: () => ({
      status: 'active',
      currentScore: 0,
      elapsedMs: 0,
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
    ...overrides,
  }
  return mock
}

const audioEngine = { playTone: async () => {} }

// ── The simulated room ────────────────────────────────────────────

const C4 = 60
const C_MAJOR = [60, 64, 67, 72]
const FRAME_MS = 16

interface Mark {
  at: number
  phase: number
  target: number | null
  windowMs: number
}

/** What the drill had published by a moment of the run clock (ms). */
interface Screen {
  phaseAt(ms: number): number
  /** When the phase in force at `ms` began. */
  phaseSince(ms: number): number
  /** The target on screen at `ms`, in Hz. */
  targetAt(ms: number): number | null
  /** When the target on screen at `ms` was put there. */
  targetSince(ms: number): number
  /** The singer's window or slot length the drill published. */
  windowMs(ms: number): number
  /** The demo tone sounding at `ms`, in Hz. */
  toneAt(ms: number): number | null
}

/** The pitch a voice makes at the moment it sings, or null for silence. */
type Voice = (ms: number, screen: Screen) => number | null

interface RunOptions {
  voice: Voice
  mode?: ArpeggioMode
  /** The measured mic round trip; frames arrive this long after. */
  latencyMs?: number
  /** The speaker's tone reaches the microphone (laptop speakers). */
  speakerBleed?: boolean
}

interface Run {
  result: ExerciseResult
  live: number[]
  tones: { hz: number; from: number; to: number }[]
  marks: Mark[]
}

async function runArpeggio(options: RunOptions): Promise<Run> {
  const latency = options.latencyMs ?? 0
  const t0 = performance.now()
  const now = () => performance.now() - t0
  const marks: Mark[] = [{ at: -Infinity, phase: 0, target: null, windowMs: 0 }]
  const tones: Run['tones'] = []
  const history: {
    freq: number
    time: number
    cents: number
    clarity: number
  }[] = []
  const live: number[] = []
  let result: ExerciseResult | null = null

  const mark = (patch: Partial<Mark>) => {
    marks.push({ ...marks[marks.length - 1], ...patch, at: now() })
  }
  const markAt = (ms: number): Mark => {
    let found = marks[0]
    for (const m of marks) if (m.at <= ms) found = m
    return found
  }
  const sinceWhen = (ms: number, same: (a: Mark, b: Mark) => boolean) => {
    const current = markAt(ms)
    let since = current.at
    for (let i = marks.indexOf(current); i > 0; i--) {
      if (!same(marks[i - 1], current)) break
      since = marks[i - 1].at
    }
    return since
  }
  const screen: Screen = {
    phaseAt: (ms) => markAt(ms).phase,
    phaseSince: (ms) => sinceWhen(ms, (a, b) => a.phase === b.phase),
    targetAt: (ms) => markAt(ms).target,
    targetSince: (ms) => sinceWhen(ms, (a, b) => a.target === b.target),
    windowMs: (ms) => markAt(ms).windowMs,
    toneAt: (ms) => tones.find((t) => ms >= t.from && ms < t.to)?.hz ?? null,
  }

  const base = createMockBase({
    _getElapsed: now,
    _setTargetPitch: ((v: number | null) => {
      if (v != null && v > 0) mark({ target: v })
      return v
    }) as BaseExerciseController['_setTargetPitch'],
    _updateMetrics: (m) => {
      const patch: Partial<Mark> = {}
      if (typeof m.phase === 'number') patch.phase = m.phase
      if (typeof m.matchWindowMs === 'number') patch.windowMs = m.matchWindowMs
      if (Object.keys(patch).length > 0) mark(patch)
    },
    _updateScore: (score) => live.push(score),
    pitchHistory: () => history,
    _completeWithResult: (r) => {
      result = r
    },
  })
  const speaker = {
    playTone: async (hz: number, ms = 0) => {
      tones.push({ hz, from: now(), to: now() + ms })
    },
  }
  const ctrl = useArpeggioJumperController(base, speaker, {
    micLatencyMs: () => latency,
  })
  ctrl.setArpeggio(C4, 'major', 'up', options.mode ?? 'steps')
  ctrl.startArpeggio()

  for (let spent = 0; result === null && spent < 60_000; spent += FRAME_MS) {
    const sungAt = now() - latency
    const hz =
      options.voice(sungAt, screen) ??
      (options.speakerBleed === true ? screen.toneAt(sungAt) : null)
    if (hz !== null) {
      history.push({ freq: hz, time: now() / 1000, cents: 0, clarity: 0.9 })
    }
    await vi.advanceTimersByTimeAsync(FRAME_MS)
  }
  if (result === null) throw new Error('the run never finished')
  return { result, live, tones, marks }
}

/**
 * Sings the note on screen for as long as the singer's turn runs, starting
 * `reactMs` after each cue. `pitch` turns the target into what is sung.
 */
function onCue(
  pitch: (targetHz: number) => number | null = (hz) => hz,
  { reactMs = 0, holdMs = Infinity } = {},
): Voice {
  return (ms, screen) => {
    const cueAt = ms - reactMs
    const target = screen.targetAt(cueAt)
    if (screen.phaseAt(cueAt) !== 2 || target === null) return null
    // The turn starts when the window opens (steps) or the slot's note
    // appears (echo), whichever is later.
    const cue = Math.max(screen.phaseSince(cueAt), screen.targetSince(cueAt))
    const sung = cueAt - cue
    if (sung >= Math.min(holdMs, screen.windowMs(cueAt))) return null
    return pitch(target)
  }
}

const silent: Voice = () => null
const isNote = (hz: number, midi: number) =>
  Math.abs(freqToMidi(hz) - midi) < 0.01

// ── Tests ─────────────────────────────────────────────────────────

describe('useArpeggioJumperController', () => {
  it('computeResult returns zero and real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useArpeggioJumperController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_ARPEGGIO_JUMPER)
    expect(result.score).toBe(0)
    expect(result.metrics).toEqual({
      notesCompleted: 0,
      avgAccuracy: 0,
      bestNote: 0,
      notesSung: 0,
      octaveOffset: 0,
      echoMode: 0,
      notesHit: 0,
      notesTotal: 0,
    })
  })

  it('startArpeggio targets the root and stays within a major triad+octave', () => {
    const targetMidis: number[] = []
    const base = createMockBase({
      _setTargetPitch: ((v: number | null) => {
        if (v != null && v > 0) targetMidis.push(Math.round(freqToMidi(v)))
        return v
      }) as BaseExerciseController['_setTargetPitch'],
    })
    const ctrl = useArpeggioJumperController(base, audioEngine)
    ctrl.setArpeggio(60, 'major', 'up') // C4 major: 60, 64, 67, 72
    ctrl.startArpeggio()

    // startArpeggio plays only the first note synchronously (root = 60).
    expect(targetMidis.length).toBeGreaterThan(0)
    expect(targetMidis[0]).toBe(60)
    // Every emitted target must be a major-triad-plus-octave tone of C4.
    const expected = new Set([60, 64, 67, 72])
    for (const m of targetMidis) {
      expect(expected.has(m)).toBe(true)
    }
  })

  it('stopArpeggio commits a result and stops running', () => {
    const committed: unknown[] = []
    let runningSet: boolean | undefined
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => {
        runningSet = v
      },
    })
    const ctrl = useArpeggioJumperController(base, audioEngine)
    ctrl.setArpeggio(60, 'major', 'up')
    ctrl.stopArpeggio()

    expect(committed.length).toBe(1)
    expect(runningSet).toBe(false)
  })
})

describe('the grade is the mean of the note scores', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('grades a flawless note-by-note run 100', async () => {
    const { result, live } = await runArpeggio({ voice: onCue() })

    expect(result.score).toBe(100)
    expect(result.metrics).toMatchObject({
      avgAccuracy: 100,
      bestNote: 100,
      notesSung: 4,
      notesHit: 4,
      notesTotal: 4,
      octaveOffset: 0,
    })
    // The live readout the singer watched ends on the grade.
    expect(live[live.length - 1]).toBe(result.score)
  })

  it('grades a flawless echo run 100', async () => {
    const { result } = await runArpeggio({ voice: onCue(), mode: 'echo' })

    expect(result.score).toBe(100)
    expect(result.metrics).toMatchObject({ notesHit: 4, echoMode: 1 })
  })

  it('grades a silent run 0 and marks it unheard', async () => {
    const { result } = await runArpeggio({ voice: silent })

    expect(result.score).toBe(0)
    expect(result.metrics).toMatchObject({
      notesSung: 0,
      notesHit: 0,
      notesTotal: 4,
    })
    expect(arpeggioRunHeard(result.metrics)).toBe(false)
  })

  it('keeps the best note as praise, outside the grade', async () => {
    // Arrange: the root exact, the other three 20 cents sharp (70 each).
    const sharp = 2 ** (20 / 1200)
    const voice = onCue((hz) => (isNote(hz, C4) ? hz : hz * sharp))

    // Act
    const { result, live } = await runArpeggio({ voice })

    // Assert: (100 + 70 + 70 + 70) / 4 = 77.5; the best note adds nothing.
    expect(result.metrics.bestNote).toBe(100)
    expect(result.score).toBe(78)
    expect(result.score).toBe(result.metrics.avgAccuracy)
    expect(live[live.length - 1]).toBe(78)
  })
})

describe('a new run cuts off the one before it', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stops the earlier echo demo when Stop and a new start come mid-tone', async () => {
    // Arrange: the demo waits out each tone in full. Stop and start again
    // 100 ms into the first one.
    const completed: ExerciseResult[] = []
    const tones: number[] = []
    const base = createMockBase({
      _completeWithResult: (r) => completed.push(r),
    })
    const speaker = {
      playTone: async (hz: number) => {
        tones.push(hz)
      },
    }
    const ctrl = useArpeggioJumperController(base, speaker)
    ctrl.setArpeggio(C4, 'major', 'up', 'echo')
    ctrl.startArpeggio()
    await vi.advanceTimersByTimeAsync(100)
    ctrl.stopArpeggio()
    ctrl.setArpeggio(C4, 'major', 'up', 'echo')
    ctrl.startArpeggio()

    // Act
    await vi.advanceTimersByTimeAsync(30_000)

    // Assert: the first run's one tone, the second run's four, and each run
    // ended once.
    expect(tones).toHaveLength(5)
    expect(completed).toHaveLength(2)
    expect(completed[1].metrics.notesTotal).toBe(4)
  })

  it('drops a tone of the run before that settles after the new start', async () => {
    // Arrange: playTone settles 300 ms after it is called, as it can while
    // the audio context resumes. Stop and a new start come inside that.
    const completed: ExerciseResult[] = []
    const base = createMockBase({
      _completeWithResult: (r) => completed.push(r),
    })
    const slowSpeaker = {
      playTone: () => new Promise<void>((resolve) => setTimeout(resolve, 300)),
    }
    const ctrl = useArpeggioJumperController(base, slowSpeaker)
    ctrl.setArpeggio(C4, 'major', 'up', 'steps')
    ctrl.startArpeggio()
    await vi.advanceTimersByTimeAsync(100)
    ctrl.stopArpeggio()
    ctrl.setArpeggio(C4, 'major', 'up', 'steps')
    ctrl.startArpeggio()

    // Act
    await vi.advanceTimersByTimeAsync(60_000)

    // Assert: the second run asked for its four notes once each, and ended
    // once.
    expect(completed).toHaveLength(2)
    expect(completed[1].metrics.notesTotal).toBe(4)
  })
})

describe('steps mode scores each note on its own window', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the window only after the tone has finished', async () => {
    const { tones, marks } = await runArpeggio({ voice: onCue() })

    const windowsOpen = marks
      .filter((m, i) => m.phase === 2 && marks[i - 1]?.phase !== 2)
      .map((m) => m.at)
    expect(windowsOpen).toHaveLength(4)
    windowsOpen.forEach((opened, i) => {
      expect(opened).toBeGreaterThanOrEqual(tones[i].to)
    })
  })

  it('does not score the speaker tone when nobody sings', async () => {
    // Laptop speakers, echo cancellation off: the tone itself reaches the
    // microphone at exactly the target pitch.
    const { result } = await runArpeggio({ voice: silent, speakerBleed: true })

    expect(result.score).toBe(0)
    expect(result.metrics.notesSung).toBe(0)
    expect(arpeggioRunHeard(result.metrics)).toBe(false)
  })

  it('does not score the tail of the tone that arrives a round trip late', async () => {
    // With 300 ms of round trip, the tone is still reaching the pitch
    // history 50 ms into a window that opens 250 ms after it ends.
    const { result } = await runArpeggio({
      voice: silent,
      speakerBleed: true,
      latencyMs: 300,
    })

    expect(result.metrics.notesSung).toBe(0)
  })

  it('scores a short note on its own frames, not on the note before it', async () => {
    // Arrange: every note held through its window except so (G4), sung
    // in tune for its first 300 ms only.
    const full = onCue()
    const short = onCue((hz) => hz, { holdMs: 300 })
    const voice: Voice = (ms, screen) => {
      const target = screen.targetAt(ms)
      return target !== null && isNote(target, 67)
        ? short(ms, screen)
        : full(ms, screen)
    }

    // Act
    const { result } = await runArpeggio({ voice })

    // Assert
    expect(result.score).toBe(100)
  })

  it('reports a silent note as not sung, scored 0, and counts it in the tally', async () => {
    // Arrange: so (G4) is left out; the others are exact.
    const voice = onCue((hz) => (isNote(hz, 67) ? null : hz))

    // Act
    const { result } = await runArpeggio({ voice })

    // Assert
    expect(result.metrics).toMatchObject({
      notesSung: 3,
      notesHit: 3,
      notesTotal: 4,
    })
    expect(result.score).toBe(75)
    expect(arpeggioRunHeard(result.metrics)).toBe(true)
  })

  it('reads each window one measured round trip late', async () => {
    const { result } = await runArpeggio({ voice: onCue(), latencyMs: 300 })

    expect(result.score).toBe(100)
  })
})

describe('echo mode scores each slot in its own time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays every demo note in full, then waits before slot 0', async () => {
    const { tones, marks } = await runArpeggio({
      voice: onCue(),
      mode: 'echo',
    })
    const { toneMs, gapBeforeEchoMs } = arpeggioTimings(5)

    expect(tones.map((t) => Math.round(freqToMidi(t.hz)))).toEqual(C_MAJOR)
    for (let i = 1; i < tones.length; i++) {
      expect(tones[i].from - tones[i - 1].from).toBeGreaterThanOrEqual(toneMs)
    }
    const responseOpens = marks.find((m) => m.phase === 2)!.at
    expect(responseOpens - tones[3].to).toBeGreaterThanOrEqual(gapBeforeEchoMs)
  })

  it('offsets every slot by the measured round trip', async () => {
    // Arrange: a singer exactly on each slot, heard 300 ms later. Read
    // without the offset, each slot would open on the note before it.

    // Act
    const { result } = await runArpeggio({
      voice: onCue(),
      mode: 'echo',
      latencyMs: 300,
    })

    // Assert
    expect(result.score).toBe(100)
  })

  it('forgives the slide from one note to the next for a singer 200 ms late', async () => {
    // Each slot after the first opens on 200 ms of the note before it, 300
    // to 500 cents away. The settled reading skips the first 15 % of a
    // note's frames.
    const { result } = await runArpeggio({
      voice: onCue((hz) => hz, { reactMs: 200 }),
      mode: 'echo',
    })

    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.metrics.notesHit).toBe(4)
  })
})

describe('the run is scored in the octave that fits it', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('scores a run sung an octave above as if in the guide octave, and says so', async () => {
    const { result, live } = await runArpeggio({ voice: onCue((hz) => hz * 2) })

    expect(result.score).toBe(100)
    expect(result.metrics).toMatchObject({ octaveOffset: 1, notesHit: 4 })
    expect(octaveLine(result.metrics.octaveOffset)).toBe(
      'Scored an octave above the guide tone.',
    )
    expect(live[live.length - 1]).toBe(100)
  })

  it('scores a run sung an octave below as if in the guide octave, and says so', async () => {
    const { result } = await runArpeggio({ voice: onCue((hz) => hz / 2) })

    expect(result.score).toBe(100)
    expect(result.metrics).toMatchObject({ octaveOffset: -1, notesHit: 4 })
    expect(octaveLine(result.metrics.octaveOffset)).toBe(
      'Scored an octave below the guide tone.',
    )
  })

  it('still asks for the leap to the top do', async () => {
    // Arrange: do, mi and so an octave up, then the top do back in the
    // guide's octave: the singer did not make the leap.
    const voice = onCue((hz) => (isNote(hz, 72) ? hz : hz * 2))

    // Act
    const { result } = await runArpeggio({ voice })

    // Assert: scored an octave up, the top do is a whole octave short.
    expect(result.metrics).toMatchObject({
      octaveOffset: 1,
      notesHit: 3,
      notesTotal: 4,
    })
    expect(result.score).toBe(75)
  })

  it('says nothing about the octave for a run in the guide octave', () => {
    expect(octaveLine(0)).toBeNull()
  })
})

describe('bestOctaveOffset', () => {
  /** A note aimed at `target` and sung as ten frames of `sung`. */
  const note = (target: number, sung: number | null): SungNote => ({
    midi: target,
    frames:
      sung === null
        ? []
        : Array.from({ length: 10 }, (_, i) => ({
            freq: midiToHz(sung),
            time: i * 0.016,
            cents: 0,
          })),
  })

  it('picks the offset with the least total error in a mixed run', () => {
    // Three notes an octave up, and the top do in the guide's octave 40
    // cents flat: offset 0 costs 3 x 1200 + 40 cents, offset +1 costs 1240.
    const run = [note(60, 72), note(64, 76), note(67, 79), note(72, 71.6)]

    expect(bestOctaveOffset(run)).toBe(1)
  })

  it('keeps the guide octave on a tie', () => {
    // Two notes up, two in the guide octave: 2400 cents either way.
    const run = [note(60, 72), note(64, 76), note(67, 67), note(72, 72)]

    expect(bestOctaveOffset(run)).toBe(0)
  })

  it('keeps the guide octave when nothing was sung', () => {
    expect(bestOctaveOffset([note(60, null), note(64, null)])).toBe(0)
  })
})

describe('the time to sing never drops below the floor', () => {
  afterEach(() => {
    clearLaunchOverride()
    vi.useRealTimers()
  })

  it('keeps every window and slot at 1.2 s or more at every level', () => {
    for (let level = 1; level <= 10; level++) {
      const t = arpeggioTimings(level)
      expect(t.windowMs).toBeGreaterThanOrEqual(MIN_SINGING_MS)
      expect(t.slotMs).toBeGreaterThanOrEqual(MIN_SINGING_MS)
    }
    expect(MIN_SINGING_MS).toBe(1200)
  })

  it('shortens the demo tone instead as the level rises', () => {
    const tones = Array.from(
      { length: 10 },
      (_, i) => arpeggioTimings(i + 1).toneMs,
    )

    tones.slice(1).forEach((ms, i) => expect(ms).toBeLessThan(tones[i]))
    expect(arpeggioTimings(10).slotMs).toBe(1200)
    expect(arpeggioTimings(10).toneMs).toBe(420)
  })

  it('gives each echo slot 1.2 s at level 10 and still grades a flawless run 100', async () => {
    // Arrange
    vi.useFakeTimers()
    setLaunchOverride(EXERCISE_ARPEGGIO_JUMPER, {
      type: EXERCISE_ARPEGGIO_JUMPER,
      difficulty: 10,
    })

    // Act
    const { result, marks } = await runArpeggio({
      voice: onCue(),
      mode: 'echo',
    })

    // Assert
    const response = marks.filter((m) => m.phase === 2)
    const slotStarts = response
      .filter((m, i) => i === 0 || m.target !== response[i - 1].target)
      .map((m) => m.at)
    expect(slotStarts).toHaveLength(4)
    for (let i = 1; i < slotStarts.length; i++) {
      expect(slotStarts[i] - slotStarts[i - 1]).toBe(MIN_SINGING_MS)
    }
    expect(result.score).toBe(100)
  })
})

describe('runs graded the old way are set aside', () => {
  const HISTORY_KEY = 'mercurypitch_exercise_history'
  /** Twelve runs scored the old way, every one held at its cap of 75. */
  const oldRuns = Array.from({ length: 12 }, (_, i) => ({
    type: EXERCISE_ARPEGGIO_JUMPER,
    score: 75,
    metrics: {},
    completedAt: 1000 - i,
  }))

  beforeEach(() => {
    vi.useFakeTimers()
    applyPersistedValue('mercurypitch_exercise_difficulty', JSON.stringify({}))
    applyPersistedValue(
      'mercurypitch_exercise_difficulty_adjusted_at',
      JSON.stringify({}),
    )
    applyPersistedValue(HISTORY_KEY, JSON.stringify(oldRuns))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('steps the level up after five flawless runs', async () => {
    // Arrange: five flawless runs, stamped with the drill's scoring.
    const runs = []
    for (let i = 0; i < 5; i++) {
      const { result } = await runArpeggio({ voice: onCue() })
      runs.unshift({
        type: result.type,
        score: result.score,
        metrics: result.metrics,
        completedAt: 2000 + i,
        scoringVersion: exerciseScoringVersion(result.type),
      })
    }
    applyPersistedValue(HISTORY_KEY, JSON.stringify([...runs, ...oldRuns]))

    // Act
    const level = updateDifficultyFromEma(EXERCISE_ARPEGGIO_JUMPER)

    // Assert: version 1 held every run under the step-up line of 90, and
    // its runs no longer pull the average down.
    expect(runs.map((r) => r.score)).toEqual([100, 100, 100, 100, 100])
    expect(computeEma(EXERCISE_ARPEGGIO_JUMPER)).toBe(100)
    expect(level).toBe(6)
  })

  it('stops flagging the drill weak on scores from its old grade', () => {
    // Arrange: eight runs graded 56 the old way, under the weak line of 65,
    // then two runs of the same singing graded 69 the new way.
    const v1 = Array.from({ length: 8 }, (_, i) => ({
      type: EXERCISE_ARPEGGIO_JUMPER,
      score: 56,
      metrics: {},
      completedAt: 1000 - i,
    }))
    const v2 = [0, 1].map((i) => ({
      type: EXERCISE_ARPEGGIO_JUMPER,
      score: 69,
      metrics: {},
      completedAt: 2000 - i,
      scoringVersion: exerciseScoringVersion(EXERCISE_ARPEGGIO_JUMPER),
    }))
    applyPersistedValue(HISTORY_KEY, JSON.stringify([...v2, ...v1]))

    // Act
    const weak = findWeakExercises().map((w) => w.type)

    // Assert: mixed in, the old runs would average 59 and flag it.
    expect(weak).not.toContain(EXERCISE_ARPEGGIO_JUMPER)
  })
})
