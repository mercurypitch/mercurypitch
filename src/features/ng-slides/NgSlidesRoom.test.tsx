// ============================================================
// NgSlidesRoom: runs over the bridge through the real engine, the mic faked
// ============================================================
//
// The capture is fed by hand (frames on the window's own clock), the
// room's tones are recorded and never sound, the glass records the strips
// it is asked to light, and time moves only when a test moves it: the
// timers and performance.now() are fake, and each screen frame is flushed
// by hand. Everything between is the room's own: the controller, the
// machine, the glide engine, the take, the reveal, the scene and the lines.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tone } from '@/lib/glass/test-frames'
import type { GlidePath } from '@/lib/glide/glide-path'
import { segmentAt } from '@/lib/glide/glide-path'
import type { GlideLevelId } from '@/lib/glide/glide-presets'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import { fitNgSlides } from '@/lib/glide/glide-targets'
import type { Voice } from '@/lib/glide/test-glides'
import { follow, framesOf, offset, playGlide } from '@/lib/glide/test-glides'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { setExerciseLevel } from '@/stores/exercise-level'
import { vocalRangePreset } from '@/stores/settings-store'
import type * as ArtModule from './bridge-art'
import type * as GlassModule from './bridge-glass'
import type { LitStrip } from './bridge-reveal'
import { NG_LINES } from './merc-lines'
import type { NgPlan } from './ng-run'
import { BREATH_TONE_SEC, COUNT_IN_TONE_SEC, planNgRun } from './ng-run'
import type * as CaptureModule from './useNgCapture'

// ── A capture the test feeds by hand ────────────────────────────

const fake = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquireError: null as Error | null,
  windows: 0,
  windowAt: 0,
  released: 0,
}))

vi.mock('./useNgCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>('./useNgCapture')
  const ctx = {
    currentTime: 0,
    outputLatency: 0,
    baseLatency: 0,
    state: 'running',
  } as unknown as AudioContext
  return {
    ...actual,
    useNgCapture: () => ({
      acquire: () =>
        fake.acquireError === null
          ? Promise.resolve()
          : Promise.reject(fake.acquireError),
      release: () => {
        fake.released += 1
      },
      held: () => true,
      startWindow: () => {
        fake.windows += 1
        fake.windowAt = performance.now()
        fake.frames = []
      },
      peekFrames: () => fake.frames.slice(),
      takeFrames: () => {
        const taken = fake.frames
        fake.frames = []
        return taken
      },
      playTone: () => Promise.resolve(),
      audio: () => Promise.resolve(ctx),
    }),
  }
})

// ── The room's tones: recorded, never heard ────────────────────

const heard = vi.hoisted(() => ({
  tones: [] as { midi: number; seconds: number; at: number }[],
  stops: 0,
}))
vi.mock('./bridge-tones', () => ({
  createBridgeTones: () => ({
    play: (_ctx: AudioContext, midi: number, seconds: number) => {
      heard.tones.push({
        midi,
        seconds,
        at: (performance.now() - fake.windowAt) / 1000,
      })
    },
    stop: () => {
      heard.stops += 1
    },
  }),
}))

// ── The glass: the strips it is asked to light ─────────────────

const glass = vi.hoisted(() => ({ strips: [] as LitStrip[], resets: 0 }))
vi.mock('./bridge-glass', async () => {
  const actual = await vi.importActual<typeof GlassModule>('./bridge-glass')
  return {
    ...actual,
    createArchGlass: () => ({
      paint: (strips: readonly LitStrip[]) => glass.strips.push(...strips),
      reset: () => {
        glass.resets += 1
      },
      dispose: () => undefined,
    }),
  }
})

const art = vi.hoisted(() => ({ resultAsked: 0 }))
vi.mock('./bridge-art', async () => {
  const actual = await vi.importActual<typeof ArtModule>('./bridge-art')
  return {
    ...actual,
    preloadNgResult: () => {
      art.resultAsked += 1
    },
  }
})

// Merc's renderer needs WebGL: a stand-in that draws nothing.
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

const kept = vi.hoisted(() => ({
  history: [] as { type: string; score: number; metrics: object }[],
  bests: [] as { level: string; best: { lit: number } }[],
  note: 45 as number | null,
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: {
    type: string
    score: number
    metrics: object
  }) => kept.history.push(entry),
}))
vi.mock('@/stores/ng-slides-store', () => ({
  rememberedNgNote: () => kept.note,
  rememberNgNote: (midi: number) => {
    kept.note = midi
  },
  recordNgBest: (level: string, best: { lit: number }) => {
    kept.bests.push({ level, best })
    return { improved: true, previous: null }
  },
  ngBest: () => null,
  // The demo has been seen on this device: these runs are the singer's.
  ngDemoSeen: () => true,
  markNgDemoSeen: () => undefined,
  ngDemoAutoPlays: () => false,
}))
// No voiceprint on this device: the root is the one kept, or the singer's.
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
}))

const felt = vi.hoisted(() => ({ taps: 0, successes: 0 }))
vi.mock('@/lib/haptics', () => ({
  haptics: {
    tapLight: () => {
      felt.taps += 1
    },
    success: () => {
      felt.successes += 1
    },
  },
}))

const { CaptureError } = await import('./useNgCapture')
const { NgSlidesRoom } = await import('./NgSlidesRoom')

// ── Screen frames, flushed by hand ─────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flush(): void {
  const due = rafQueue
  rafQueue = []
  for (const callback of due) callback(performance.now())
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

/** One screen frame every this many ms: coarse, so a run is quick. */
const STEP_MS = 50

const room = (): HTMLElement => screen.getByTestId('ng-slides-room')
const phase = (): string | undefined => room().dataset.phase
const bubble = (): string | null =>
  screen.queryByTestId('ng-bubble')?.textContent ?? null
const chip = (): string | null => {
  const text = screen.queryByTestId('ng-chip')?.textContent ?? ''
  return text === '' ? null : text
}
const linesOf = (moment: keyof typeof NG_LINES): string[] =>
  NG_LINES[moment].map((line) => line.text)
/** A line as said: the moment's text with its fields filled. */
const said = (text: string, moment: keyof typeof NG_LINES): boolean =>
  linesOf(moment).some((line) => {
    const pattern = line
      .replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      .replace(/\\\{(note|top|pct)\\\}/gu, '.+')
    return new RegExp(`^${pattern}$`, 'u').test(text)
  })

/** The run's plan, as the room fits it: the same functions, the same inputs. */
function planFor(level: GlideLevelId, settled: number): NgPlan {
  const fit = fitNgSlides({
    voiceprints: [],
    settledMidi: settled,
    voicePreset: vocalRangePreset(),
  })
  return planNgRun(fit, NG_SLIDES_LEVELS[level])
}

/** A voice's frames on the window's clock: silent through the count-in. */
function windowFrames(plan: NgPlan, voice: Voice): PitchFrame[] {
  return framesOf(plan.path, voice, -plan.countIn).map((frame) => ({
    ...frame,
    t: frame.t + plan.countIn,
  }))
}

/** Seconds on the open window's clock. */
const windowNow = (): number => (performance.now() - fake.windowAt) / 1000

/** What the singer saw on each screen frame. */
interface Seen {
  readonly t: number
  readonly phase: string | undefined
  readonly chip: string | null
  readonly bubble: string | null
}

/**
 * Screen frames until `until` on the window's clock (or the phase leaves
 * the run), each frame handing the capture the frames sung by then.
 */
function play(
  frames: readonly PitchFrame[],
  plan: NgPlan,
  until = plan.countIn + plan.path.duration + 1,
): Seen[] {
  const seen: Seen[] = []
  let next = fake.frames.length
  while (windowNow() < until) {
    vi.advanceTimersByTime(STEP_MS)
    const now = windowNow()
    while (next < frames.length && frames[next].t <= now) {
      fake.frames.push(frames[next])
      next++
    }
    flush()
    seen.push({
      t: now - plan.countIn,
      phase: phase(),
      chip: chip(),
      bubble: bubble(),
    })
    if (phase() !== 'run') break
  }
  return seen
}

let done = 0

/** Open the room and tap the mic: with a note kept, the count-in starts. */
async function startRun(): Promise<void> {
  render(() => <NgSlidesRoom onDone={() => (done += 1)} />)
  fireEvent.click(screen.getByTestId('ng-mic'))
  await settle()
}

/** Each arch's lit share from the strips the glass was asked to light. */
function litShares(path: GlidePath): number[] {
  return path.arches.map((arch) => {
    const ranges = glass.strips
      .filter((strip) => strip.arch === arch.index)
      .map((strip) => [strip.from, strip.to] as [number, number])
      .sort((a, b) => a[0] - b[0])
    let sum = 0
    let end = Number.NEGATIVE_INFINITY
    for (const [from, to] of ranges) {
      const start = Math.max(from, end)
      if (to > start) sum += to - start
      end = Math.max(end, to)
    }
    return Math.min(1, sum / 2)
  })
}

/** The engine's own coverage for the same frames, arch by arch. */
function engineCoverage(
  frames: readonly PitchFrame[],
  plan: NgPlan,
  level: GlideLevelId,
): number[] {
  const played = playGlide(
    frames.map((frame) => ({ ...frame, t: frame.t - plan.countIn })),
    plan.path,
    NG_SLIDES_LEVELS[level],
  )
  const coverage = plan.path.arches.map(() => 0)
  for (const { event } of played.events) {
    if (event.type === 'archEnd') coverage[event.arch] = event.coverage
  }
  return coverage
}

/** Consecutive repeats dropped. */
const changes = <T,>(values: readonly T[]): T[] =>
  values.filter((value, i) => i === 0 || value !== values[i - 1])

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  rafQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844)
  // jsdom has no canvas: the ribbon draws into nothing.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  setExerciseLevel('learning')
  fake.frames = []
  fake.acquireError = null
  fake.windows = 0
  fake.windowAt = 0
  fake.released = 0
  heard.tones = []
  heard.stops = 0
  glass.strips = []
  glass.resets = 0
  art.resultAsked = 0
  kept.history = []
  kept.bests = []
  kept.note = 45
  felt.taps = 0
  felt.successes = 0
  done = 0
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the intro', () => {
  it("opens on Merc's line, the level and the mic, with no chip", () => {
    render(() => <NgSlidesRoom onDone={() => undefined} />)

    expect(phase()).toBe('intro')
    expect(said(bubble() ?? '', 'intro')).toBe(true)
    expect(screen.getByTestId('ng-level').textContent).toContain('Learning')
    expect(chip()).toBeNull()
    // The kept note's fit names the first slide's root.
    const root = planFor('learning', 45).roots[0]
    expect(screen.getByTestId('ng-root-name').textContent).toBe(
      midiToNoteNameOctave(root),
    )
  })
})

describe('a run sung on the line', () => {
  it('counts in on the root, plays each breath its root once, and lights every arch', async () => {
    const plan = planFor('learning', 45)
    const frames = windowFrames(plan, follow(plan.path))
    await startRun()
    expect(phase()).toBe('run')
    expect(said(bubble() ?? '', 'listen')).toBe(true)

    const seen = play(frames, plan)

    // The count-in's tone, then one tone a breath: each root once, in order.
    expect(heard.tones.map((t) => t.midi)).toEqual(plan.roots)
    expect(heard.tones.map((t) => t.seconds)).toEqual([
      COUNT_IN_TONE_SEC,
      ...plan.roots.slice(1).map(() => BREATH_TONE_SEC),
    ])
    expect(heard.tones[0].at).toBeLessThan(0.1)
    // The chip counts the slides, each once and in order.
    expect(changes(seen.map((s) => s.chip)).filter((c) => c !== null)).toEqual([
      'Slide 1 of 5',
      'Slide 2 of 5',
      'Slide 3 of 5',
      'Slide 4 of 5',
      'Slide 5 of 5',
    ])
    // Nothing is said while the singer slides (strictly inside a slide: an
    // instant on its edge, to the float, is the breath's); a line in each
    // breath.
    const sliding = (t: number): boolean => {
      const segment = t < 0 ? null : segmentAt(plan.path, t)
      return (
        segment !== null &&
        segment.phase !== 'breath' &&
        segment.phase !== 'landing'
      )
    }
    for (const s of seen) {
      if (s.phase !== 'run' || !sliding(s.t - 1e-9) || !sliding(s.t + 1e-9)) {
        continue
      }
      expect(s.bubble).toBeNull()
    }
    const lines = changes(
      seen.filter((s) => s.t > 0 && s.phase === 'run').map((s) => s.bubble),
    )
    expect(lines.filter((line) => line !== null)).toHaveLength(4)

    // The result: every arch lit, one haptic each and one for the bridge.
    expect(phase()).toBe('result')
    expect(felt.taps).toBe(5)
    expect(felt.successes).toBe(1)
    expect(screen.getByTestId('ng-result').textContent).toContain('%')
    expect(screen.getAllByTestId('ng-result-chip')[0].textContent).toBe(
      'No jumps',
    )
    expect(kept.history).toHaveLength(1)
    expect(kept.history[0].type).toBe('ng-slides-bridge')
    expect(screen.getByTestId('ng-result').textContent).toContain(
      `${kept.history[0].score}%`,
    )
    expect(kept.bests).toEqual([
      {
        level: 'learning',
        best: expect.objectContaining({ lit: kept.history[0].score }),
      },
    ])
    expect(art.resultAsked).toBe(1)
    expect(fake.released).toBe(1)
    expect(chip()).toBeNull()
  })

  it("lights the glass exactly as far as the engine's coverage, arch by arch", async () => {
    const plan = planFor('learning', 45)
    const a2 = plan.path.arches[2]
    // Three semitones flat over the third slide's way down: where the line
    // will be 0.6 s later, far ahead of anything the level forgives.
    const voice = offset(follow(plan.path), (t) =>
      t > a2.start + (a2.end - a2.start) * 0.55 && t < a2.end ? -300 : 0,
    )
    const frames = windowFrames(plan, voice)
    await startRun()
    play(frames, plan)

    const coverage = engineCoverage(frames, plan, 'learning')
    expect(coverage[2]).toBeLessThan(0.7)
    expect(coverage[2]).toBeGreaterThan(0.3)
    const lit = litShares(plan.path)
    lit.forEach((share, k) => expect(share).toBeCloseTo(coverage[k], 9))
    // An arch under the level's share is not lit: no tap for it, no cheer.
    const litArches = coverage.filter(
      (c) => c >= NG_SLIDES_LEVELS.learning.litShare,
    )
    expect(felt.taps).toBe(litArches.length)
    expect(felt.successes).toBe(0)
  })
})

describe('stopping', () => {
  it('drops the take: nothing kept, the mic closed, the bridge back at the start', async () => {
    const plan = planFor('learning', 45)
    const frames = windowFrames(plan, follow(plan.path))
    await startRun()
    const a1 = plan.path.arches[1]
    play(frames, plan, plan.countIn + (a1.start + a1.end) / 2)
    expect(chip()).toBe('Slide 2 of 5')
    const resetsBefore = glass.resets

    fireEvent.click(screen.getByTestId('ng-mic'))

    expect(phase()).toBe('intro')
    expect(kept.history).toEqual([])
    expect(kept.bests).toEqual([])
    expect(fake.released).toBe(1)
    expect(heard.stops).toBeGreaterThan(0)
    expect(glass.resets).toBe(resetsBefore + 1)
    expect(chip()).toBeNull()
    expect(said(bubble() ?? '', 'intro')).toBe(true)
    // The frames that come after are not heard: the run is gone.
    const strips = glass.strips.length
    vi.advanceTimersByTime(500)
    flush()
    expect(glass.strips.length).toBe(strips)
    expect(felt.successes).toBe(0)
  })

  it('drops the take when the singer leaves the app', async () => {
    const plan = planFor('learning', 45)
    const frames = windowFrames(plan, follow(plan.path))
    await startRun()
    play(frames, plan, plan.countIn + 3)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(phase()).toBe('intro')
    expect(said(bubble() ?? '', 'left')).toBe(true)
    expect(kept.history).toEqual([])
    expect(kept.bests).toEqual([])
  })
})

describe('the levels', () => {
  it.each([
    ['learning', 4],
    ['singer', 4],
    ['professional', 0],
  ] as const)(
    'runs %s at its own timing, with %i breath tones',
    async (level, breathTones) => {
      setExerciseLevel(level)
      const plan = planFor(level, 45)
      const frames = windowFrames(plan, follow(plan.path))
      await startRun()
      const seen = play(frames, plan)

      expect(heard.tones.slice(1)).toHaveLength(breathTones)
      // The path is the level's: the result comes as its last landing ends.
      const end = seen.find((s) => s.phase === 'result')
      expect(end?.t).toBeGreaterThanOrEqual(plan.path.duration - 1e-9)
      expect(end?.t).toBeLessThan(plan.path.duration + STEP_MS / 1000 + 1e-9)
      expect(kept.bests.map((b) => b.level)).toEqual([level])
      // Only Pro judges the tops.
      expect('tops' in kept.history[0].metrics).toBe(level === 'professional')
    },
  )

  it('keeps the level a run started at, when the setting changes during it', async () => {
    const plan = planFor('learning', 45)
    const frames = windowFrames(plan, follow(plan.path))
    await startRun()
    play(frames, plan, plan.countIn + 2)
    setExerciseLevel('professional')
    play(frames, plan)

    expect(kept.bests.map((b) => b.level)).toEqual(['learning'])
    expect(heard.tones.slice(1)).toHaveLength(4)
  })
})

describe('the first note', () => {
  it('with no note kept, hears an easy note first and fits the slides to it', async () => {
    kept.note = null
    await startRun()
    expect(phase()).toBe('settle')
    expect(heard.tones).toEqual([])

    // Two seconds of a steady D3.
    const hum = tone(50, 2)
    let next = 0
    for (let i = 0; i < 40 && phase() === 'settle'; i++) {
      vi.advanceTimersByTime(STEP_MS)
      while (next < hum.length && hum[next].t <= windowNow()) {
        fake.frames.push(hum[next])
        next++
      }
      flush()
    }

    expect(phase()).toBe('run')
    const plan = planFor('learning', 50)
    expect(heard.tones.map((t) => t.midi)).toEqual([plan.roots[0]])
    expect(said(bubble() ?? '', 'found')).toBe(true)
    expect(fake.windows).toBe(2)
  })
})

describe('a blocked mic', () => {
  it('shows the block and tries again from it', async () => {
    fake.acquireError = new CaptureError('denied', 'Ng slides')
    await startRun()
    expect(phase()).toBe('blocked')
    expect(kept.history).toEqual([])

    fake.acquireError = null
    fireEvent.click(screen.getByTestId('ng-retry'))
    await settle()
    expect(phase()).toBe('run')
  })
})
