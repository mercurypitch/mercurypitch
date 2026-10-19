// ============================================================
// LipRollRoom: runs over the bay through the real engine, the mic faked
// ============================================================
//
// The capture is fed by hand (frames on the window's own clock), the
// room's tones are recorded and never sound, the waves record the strips
// they are asked to light, and time moves only when a test moves it: the
// timers and performance.now() are fake, and each screen frame is flushed
// by hand. Everything between is the room's own: the controller, the
// machine, the glide engine, the take, the reveal, the scene and the lines.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CREST_NOTE } from '@/components/room-kit/CrestNote'
import type { LitStrip } from '@/components/room-kit/glide-reveal'
import mic from '@/components/room-kit/RoomControls.module.css'
import type { RoutineStop, StopResult, } from '@/components/room-kit/routine-stop'
import { ROUTINE_RESULT_HOLD_MS, ROUTINE_WORDS, } from '@/components/room-kit/routine-stop'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import { tone } from '@/lib/glass/test-frames'
import type { GlidePath } from '@/lib/glide/glide-path'
import { segmentAt } from '@/lib/glide/glide-path'
import type { GlideLevelId } from '@/lib/glide/glide-presets'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { fitLipRoll } from '@/lib/glide/glide-targets'
import type { Voice } from '@/lib/glide/test-glides'
import { follow, framesOf, offset, playGlide, silentWhen, } from '@/lib/glide/test-glides'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { installHaptics } from '@/lib/platform'
import { setExerciseLevel } from '@/stores/exercise-level'
import { vocalRangePreset } from '@/stores/settings-store'
import type * as ArtModule from './bay-art'
import { INTRO, PLAYHEAD_X } from './bay-geometry'
import { LIP_MOUTH } from './bay-ride'
import type * as WavesModule from './bay-waves'
import type { LipPlan } from './lip-run'
import { BREATH_TONE_SEC, COUNT_IN_TONE_SEC, planLipRun } from './lip-run'
import { LIP_LINES } from './merc-lines'
import type * as CaptureModule from './useLipCapture'

// ── A capture the test feeds by hand ────────────────────────────

const fake = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquireError: null as Error | null,
  windows: 0,
  windowAt: 0,
  released: 0,
}))

vi.mock('./useLipCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>('./useLipCapture')
  const ctx = {
    currentTime: 0,
    outputLatency: 0,
    baseLatency: 0,
    state: 'running',
  } as unknown as AudioContext
  return {
    ...actual,
    useLipCapture: () => ({
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
vi.mock('@/components/room-kit/room-tones', () => ({
  createRoomTones: () => ({
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

// ── The waves: the strips they are asked to light ──────────────

const glass = vi.hoisted(() => ({ strips: [] as LitStrip[], resets: 0 }))
vi.mock('./bay-waves', async () => {
  const actual = await vi.importActual<typeof WavesModule>('./bay-waves')
  return {
    ...actual,
    createBayWaves: () => ({
      paint: (strips: readonly LitStrip[]) => glass.strips.push(...strips),
      reset: () => {
        glass.resets += 1
      },
      dispose: () => undefined,
    }),
  }
})

// The result's lit band: what the room asks of it, in order. Its paint
// never settles, as an <img> never loads in jsdom.
const band = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock('@/components/room-kit/result-band', () => ({
  createResultBand: () => ({
    prepare: () => band.calls.push('prepare'),
    paint: () => {
      band.calls.push('paint')
      return new Promise<void>(() => undefined)
    },
    release: () => band.calls.push('release'),
  }),
}))

const art = vi.hoisted(() => ({ resultAsked: 0 }))
vi.mock('./bay-art', async () => {
  const actual = await vi.importActual<typeof ArtModule>('./bay-art')
  return {
    ...actual,
    preloadLipResult: () => {
      art.resultAsked += 1
    },
  }
})

// Merc's renderer needs WebGL: a stand-in that draws nothing, and keeps
// what it was asked for.
const stage = vi.hoisted(() => ({
  opts: [] as { rings?: boolean; mouth?: string }[],
}))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: (
    _host: HTMLElement,
    opts: { rings?: boolean; mouth?: string } = {},
  ) => {
    stage.opts.push(opts)
    return {
      ok: true,
      setState: () => undefined,
      setVoice: () => undefined,
      setPaused: () => undefined,
      destroy: () => undefined,
    }
  },
}))

const kept = vi.hoisted(() => ({
  history: [] as { type: string; score: number; metrics: object }[],
  bests: [] as { level: string; best: { lit: number } }[],
  note: 52 as number | null,
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: {
    type: string
    score: number
    metrics: object
  }) => kept.history.push(entry),
}))
vi.mock('@/stores/lip-roll-store', () => ({
  rememberedLipNote: () => kept.note,
  rememberLipNote: (midi: number) => {
    kept.note = midi
  },
  recordLipBest: (level: string, best: { lit: number }) => {
    kept.bests.push({ level, best })
    return { improved: true, previous: null }
  },
  lipBest: () => null,
  // The demo has been seen on this device: these runs are the singer's.
  lipDemoSeen: () => true,
  markLipDemoSeen: () => undefined,
  lipDemoAutoPlays: () => false,
}))
// No voiceprint on this device: the root is the one kept, or the singer's.
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
}))

// The room's haptics, counted through the seam the native app fills with
// the device's own at boot (installHaptics, main.tsx): what an iPhone feels.
const felt = { taps: 0, successes: 0 }
installHaptics({
  tapLight: () => {
    felt.taps += 1
  },
  success: () => {
    felt.successes += 1
  },
  warning: () => undefined,
})

const { CaptureError } = await import('./useLipCapture')
const { LipRollRoom } = await import('./LipRollRoom')

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

const room = (): HTMLElement => screen.getByTestId('lip-roll-room')
const phase = (): string | undefined => room().dataset.phase
const bubble = (): string | null =>
  screen.queryByTestId('lip-bubble')?.textContent ?? null
const chip = (): string | null => {
  const text = screen.queryByTestId('lip-chip')?.textContent ?? ''
  return text === '' ? null : text
}
const linesOf = (moment: keyof typeof LIP_LINES): string[] =>
  LIP_LINES[moment].map((line) => line.text)
/** A line as said: the moment's text with its fields filled. */
const said = (text: string, moment: keyof typeof LIP_LINES): boolean =>
  linesOf(moment).some((line) => {
    const pattern = line
      .replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      .replace(/\\\{(note|top|pct)\\\}/gu, '.+')
    return new RegExp(`^${pattern}$`, 'u').test(text)
  })

/** The run's plan, as the room fits it: the same functions, the same inputs. */
function planFor(level: GlideLevelId, settled: number): LipPlan {
  const fit = fitLipRoll({
    voiceprints: [],
    settledMidi: settled,
    voicePreset: vocalRangePreset(),
  })
  return planLipRun(fit, LIP_ROLL_LEVELS[level])
}

/** A voice's frames on the window's clock: silent through the count-in. */
function windowFrames(plan: LipPlan, voice: Voice): PitchFrame[] {
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
  /** The mic's state, and its ring's scale (NaN when it is not drawn). */
  readonly mic: string | undefined
  readonly ring: number
  /** The contact light: its state, and its centre, px. */
  readonly light: { state?: string; x: number; y: number }
}

/** The mic's ring as drawn now: its scale, NaN with none written. */
function ringScale(): number {
  const ring = screen.queryByTestId('lip-mic')?.querySelector(`.${mic.ring}`)
  const scale = /scale\(([\d.]+)\)/u.exec(
    (ring as HTMLElement | null)?.style.transform ?? '',
  )
  return scale === null ? Number.NaN : Number(scale[1])
}

/** The contact light's state and centre (its box's translate plus half). */
function lightNow(): Seen['light'] {
  const el = screen.getByTestId('lip-contact')
  const at = /translate3d\(([-\d.]+)px,([-\d.]+)px/u.exec(el.style.transform)
  return {
    state: el.dataset.state,
    x: Number(at?.[1] ?? Number.NaN) + Number.parseFloat(el.style.width) / 2,
    y: Number(at?.[2] ?? Number.NaN) + Number.parseFloat(el.style.height) / 2,
  }
}

/**
 * Screen frames until `until` on the window's clock (or the phase leaves
 * the run), each frame handing the capture the frames sung by then.
 */
function play(
  frames: readonly PitchFrame[],
  plan: LipPlan,
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
      mic: screen.queryByTestId('lip-mic')?.dataset.state,
      ring: ringScale(),
      light: lightNow(),
    })
    if (phase() !== 'run') break
  }
  return seen
}

let done = 0

/** Open the room and tap the mic: with a note kept, the count-in starts. */
async function startRun(): Promise<void> {
  render(() => <LipRollRoom onDone={() => (done += 1)} />)
  fireEvent.click(screen.getByTestId('lip-mic'))
  await settle()
}

/** Each wave's lit share from the strips the waves were asked to light. */
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
  plan: LipPlan,
  level: GlideLevelId,
): number[] {
  const played = playGlide(
    frames.map((frame) => ({ ...frame, t: frame.t - plan.countIn })),
    plan.path,
    LIP_ROLL_LEVELS[level],
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
  band.calls = []
  kept.history = []
  kept.bests = []
  kept.note = 52
  stage.opts = []
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
    render(() => <LipRollRoom onDone={() => undefined} />)

    expect(phase()).toBe('intro')
    expect(said(bubble() ?? '', 'intro')).toBe(true)
    expect(screen.getByTestId('lip-level').textContent).toContain('Learning')
    expect(chip()).toBeNull()
    // The kept note's fit names the first wave's top.
    expect(bubble()).toContain('C4')
  })

  it("names each wave's top under the middle of its crest, as Merc's line does", () => {
    render(() => <LipRollRoom onDone={() => undefined} />)

    const names = screen.getAllByTestId('lip-top-name')
    expect(names.map((n) => n.textContent)).toEqual(['C4', 'C4', 'C4'])
    const crests = screen.getAllByTestId('lip-target')
    names.forEach((name, k) => {
      // The dotted crest's middle point: the middle of the wave's top.
      const points = (crests[k].getAttribute('d') ?? '')
        .split(/[ML]/u)
        .filter((p) => p !== '')
        .map((p) => p.split(' ').map(Number))
      const [x, y] = points[(points.length - 1) / 2]
      // Each name is centred in a small layer of its own, moved by
      // transform: the layer's offset plus half its box is the name's centre.
      const box = name.parentElement as Element
      const layer = box.parentElement as HTMLElement
      const [tx, ty] = layer.style.transform
        .match(/-?[\d.]+(?=px)/gu)
        ?.map(Number) ?? [Number.NaN, Number.NaN]
      const cx = tx + Number(box.getAttribute('width')) / 2
      const cy = ty + Number(box.getAttribute('height')) / 2
      expect(Number(name.getAttribute('x'))).toBe(
        Number(box.getAttribute('width')) / 2,
      )
      expect(cx).toBeCloseTo(x, 0)
      // Under it, by the name's offset at the intro's zoom (wave A).
      expect(cy - y).toBeCloseTo(INTRO.sy * CREST_NOTE.belowW * 390, 0)
    })
  })

  it("names no tops while the waves are only the room's guess", () => {
    kept.note = null
    render(() => <LipRollRoom onDone={() => undefined} />)

    expect(screen.queryAllByTestId('lip-top-name')).toEqual([])
  })

  it("turns Merc's sound rings off for the whole room: the buzz is drawn beside him", async () => {
    render(() => <LipRollRoom onDone={() => undefined} />)
    await vi.waitFor(() => expect(stage.opts).toHaveLength(1))

    expect(stage.opts).toHaveLength(1)
    expect(stage.opts[0].rings).toBe(false)
    expect(screen.getByTestId('lip-buzz').dataset.on).toBe('true')
  })

  it("gives Merc a lip roll's mouth: his lips together, buzzing", async () => {
    render(() => <LipRollRoom onDone={() => undefined} />)
    await vi.waitFor(() => expect(stage.opts).toHaveLength(1))

    expect(stage.opts[0].mouth).toBe(LIP_MOUTH)
    expect(LIP_MOUTH).toBe('buzz')
  })
})

describe('a run sung on the dots', () => {
  it('counts in on the root, plays each breath its root once, and lights every wave', async () => {
    const plan = planFor('learning', 52)
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
    // The chip counts the waves, each once and in order.
    expect(changes(seen.map((s) => s.chip)).filter((c) => c !== null)).toEqual([
      'Wave 1 of 3',
      'Wave 2 of 3',
      'Wave 3 of 3',
    ])
    // Nothing is said while the singer rides a wave (strictly inside one:
    // an instant on its edge, to the float, is the breath's); a line in
    // each breath.
    const riding = (t: number): boolean => {
      const segment = t < 0 ? null : segmentAt(plan.path, t)
      return (
        segment !== null &&
        segment.phase !== 'breath' &&
        segment.phase !== 'landing'
      )
    }
    for (const s of seen) {
      if (s.phase !== 'run' || !riding(s.t - 1e-9) || !riding(s.t + 1e-9)) {
        continue
      }
      expect(s.bubble).toBeNull()
    }
    const lines = changes(
      seen.filter((s) => s.t > 0 && s.phase === 'run').map((s) => s.bubble),
    )
    expect(lines.filter((line) => line !== null)).toHaveLength(2)

    // The result: every wave lit, one haptic each and one for the bay; its
    // tops' sparkles on; a chip for the breaks and none for the jumps.
    expect(phase()).toBe('result')
    expect(felt.taps).toBe(3)
    expect(felt.successes).toBe(1)
    expect(
      screen.getAllByTestId('lip-sparkles').map((g) => g.dataset.lit),
    ).toEqual(['true', 'true', 'true'])
    expect(screen.getByTestId('lip-result').textContent).toContain('%')
    expect(
      screen.getAllByTestId('lip-result-chip').map((c) => c.textContent),
    ).toEqual(['No breaks'])
    expect(kept.history).toHaveLength(1)
    expect(kept.history[0].type).toBe('lip-roll-bay')
    expect(screen.getByTestId('lip-result').textContent).toContain(
      `${kept.history[0].score}%`,
    )
    expect(kept.bests).toEqual([
      {
        level: 'learning',
        best: expect.objectContaining({ lit: kept.history[0].score }),
      },
    ])
    expect(art.resultAsked).toBe(1)
    // The band was decoded and sized as the last one began, so the
    // result's frame only copies its columns (room-kit/result-band.ts).
    expect(band.calls).toEqual(['prepare', 'paint'])
    expect(fake.released).toBe(1)
    expect(chip()).toBeNull()
  })

  it("lights the waves exactly as far as the engine's coverage, wave by wave", async () => {
    setExerciseLevel('singer')
    const plan = planFor('singer', 52)
    const a2 = plan.path.arches[2]
    // Three semitones flat over the third wave's way down: where the dots
    // will be 0.6 s later, past anything the level forgives.
    const voice = offset(follow(plan.path), (t) =>
      t > a2.start + (a2.end - a2.start) * 0.55 && t < a2.end ? -300 : 0,
    )
    const frames = windowFrames(plan, voice)
    await startRun()
    play(frames, plan)

    const coverage = engineCoverage(frames, plan, 'singer')
    expect(coverage[2]).toBeLessThan(0.7)
    expect(coverage[2]).toBeGreaterThan(0.3)
    const lit = litShares(plan.path)
    lit.forEach((share, k) => expect(share).toBeCloseTo(coverage[k], 9))
    // A wave under the level's share is not lit: no tap for it, no cheer.
    const litWaves = coverage.filter(
      (c) => c >= LIP_ROLL_LEVELS.singer.litShare,
    )
    expect(felt.taps).toBe(litWaves.length)
    expect(felt.successes).toBe(0)
  })
})

describe('the contact light', () => {
  it.each(['learning', 'singer', 'professional'] as const)(
    "is lit inside the %s band and dim outside it, on the target at Merc's x",
    async (level) => {
      setExerciseLevel(level)
      const plan = planFor(level, 52)
      const { bandCents } = LIP_ROLL_LEVELS[level]
      const [, second] = plan.path.arches
      // Inside the band on the first and last waves, outside it on the
      // second: read at each top's middle, where the path is flat and the
      // lag allowance cannot help.
      const voice = offset(follow(plan.path), (t) =>
        t >= second.start && t <= second.landingEnd
          ? 1.5 * bandCents
          : 0.8 * bandCents,
      )
      await startRun()
      const seen = play(windowFrames(plan, voice), plan)

      const crests = screen.getAllByTestId('lip-target')
      for (const [k, wave] of plan.path.arches.entries()) {
        const top = seen.find((s) => s.t >= (wave.topStart + wave.topEnd) / 2)
        expect(top?.light.state).toBe(k === 1 ? 'off' : 'on')
        // On the dotted crest's middle, at the playhead.
        const points = (crests[k].getAttribute('d') ?? '')
          .split(/[ML]/u)
          .filter((p) => p !== '')
          .map((p) => p.split(' ').map(Number))
        expect(top?.light.y).toBeCloseTo(points[(points.length - 1) / 2][1], 0)
        expect(top?.light.x).toBeCloseTo(PLAYHEAD_X * 390, 0)
      }
      // Nothing outside the sung parts: the count-in, landings and rests.
      const judged = (t: number) =>
        plan.path.arches.some((a) => t > a.start - 0.1 && t < a.end + 0.1)
      for (const s of seen) {
        if (s.phase === 'run' && !judged(s.t)) {
          expect(s.light.state).toBe('hidden')
        }
      }
    },
  )

  it('rings once as the voice comes back onto the path, and not with reduced motion', async () => {
    const rings: unknown[] = []
    Element.prototype.animate = vi.fn((frames: unknown) => {
      rings.push(frames)
      return {} as Animation
    })
    setExerciseLevel('singer')
    const plan = planFor('singer', 52)
    const [first] = plan.path.arches
    const offAt = first.start + 0.5
    // Off by a third of an octave for half a second, then back on.
    const voice = offset(follow(plan.path), (t) =>
      t >= offAt && t < offAt + 0.5 ? 400 : 0,
    )
    await startRun()
    play(windowFrames(plan, voice), plan, plan.countIn + first.end)

    expect(rings).toHaveLength(1)
    expect(screen.getByTestId('lip-contact').dataset.catches).toBe('1')
    cleanup()

    // Reduced motion: the colour changes, no ring runs.
    rings.length = 0
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    fake.frames = []
    await startRun()
    const seen = play(windowFrames(plan, voice), plan, plan.countIn + first.end)

    expect(rings).toHaveLength(0)
    expect(seen.some((s) => s.light.state === 'off')).toBe(true)
    // Read inside the wave: from its end on, the mic waits and the light is out.
    expect(seen.filter((s) => s.t < first.end).at(-1)?.light.state).toBe('on')
  })
})

describe('stopping', () => {
  it('drops the take: nothing kept, the mic closed, the bay back at the start', async () => {
    const plan = planFor('learning', 52)
    const frames = windowFrames(plan, follow(plan.path))
    await startRun()
    const a1 = plan.path.arches[1]
    play(frames, plan, plan.countIn + (a1.start + a1.end) / 2)
    expect(chip()).toBe('Wave 2 of 3')
    const resetsBefore = glass.resets

    fireEvent.click(screen.getByTestId('lip-mic'))

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
    const plan = planFor('learning', 52)
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
    ['learning', 2],
    ['singer', 2],
    ['professional', 0],
  ] as const)(
    'runs %s at its own timing, with %i breath tones',
    async (level, breathTones) => {
      setExerciseLevel(level)
      const plan = planFor(level, 52)
      const frames = windowFrames(plan, follow(plan.path))
      await startRun()
      const seen = play(frames, plan)

      expect(heard.tones.slice(1)).toHaveLength(breathTones)
      // Each root after its rest's pause, never while the singer lands.
      const pause = LIP_ROLL_LEVELS[level].pauseSec
      heard.tones.slice(1).forEach((played, k) => {
        const due = plan.path.arches[k].landingEnd + pause
        expect(played.at - plan.countIn).toBeGreaterThanOrEqual(due - 1e-9)
        expect(played.at - plan.countIn).toBeLessThan(
          due + STEP_MS / 1000 + 1e-9,
        )
      })
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
    const plan = planFor('learning', 52)
    const frames = windowFrames(plan, follow(plan.path))
    await startRun()
    play(frames, plan, plan.countIn + 2)
    setExerciseLevel('professional')
    play(frames, plan)

    expect(kept.bests.map((b) => b.level)).toEqual(['learning'])
    expect(heard.tones.slice(1)).toHaveLength(2)
  })
})

describe('the first note', () => {
  it('with no note kept, hears an easy note first and fits the waves to it', async () => {
    kept.note = null
    await startRun()
    expect(phase()).toBe('settle')
    expect(heard.tones).toEqual([])

    // Two seconds of a steady E3.
    const hum = tone(52, 2)
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
    const plan = planFor('learning', 52)
    expect(heard.tones.map((t) => t.midi)).toEqual([plan.roots[0]])
    expect(said(bubble() ?? '', 'found')).toBe(true)
    expect(fake.windows).toBe(2)
  })
})

describe('a blocked mic', () => {
  it('shows the block and tries again from it', async () => {
    fake.acquireError = new CaptureError('denied', 'Lip roll')
    await startRun()
    expect(phase()).toBe('blocked')
    expect(kept.history).toEqual([])

    fake.acquireError = null
    fireEvent.click(screen.getByTestId('lip-retry'))
    await settle()
    expect(phase()).toBe('run')
  })
})

describe('the mic through a run', () => {
  /** Strictly inside a wave's up, top or down: the singer's turn. */
  const ridden = (plan: LipPlan, t: number): boolean => {
    const segment = t < 0 ? null : segmentAt(plan.path, t)
    return (
      segment !== null &&
      segment.phase !== 'breath' &&
      segment.phase !== 'landing'
    )
  }

  it('waits through the count-in, each landing and each breath, and is the singer turn on every wave', async () => {
    const plan = planFor('learning', 52)
    const frames = windowFrames(plan, follow(plan.path))
    await startRun()

    const seen = play(frames, plan)

    // Clear of each edge by more than a screen frame.
    const clear = seen.filter(
      (s) =>
        s.phase === 'run' &&
        ridden(plan, s.t - 0.06) === ridden(plan, s.t + 0.06),
    )
    const turns = clear.filter((s) => ridden(plan, s.t))
    const waits = clear.filter((s) => !ridden(plan, s.t))
    expect(turns.length).toBeGreaterThan(0)
    expect(waits.some((s) => s.t < 0)).toBe(true)
    expect(turns.every((s) => s.mic === 'sing')).toBe(true)
    expect(waits.every((s) => s.mic === 'wait')).toBe(true)
  })

  it('moves the ring with the voice and lets it fall back when the voice stops mid-wave', async () => {
    const plan = planFor('learning', 52)
    const arch = plan.path.arches[1]
    const gap = { from: arch.start + 0.4, to: arch.start + 1.2 }
    const voice = silentWhen(
      follow(plan.path),
      (t) => t >= gap.from && t < gap.to,
    )
    await startRun()

    const seen = play(windowFrames(plan, voice), plan)

    const sung = seen.filter((s) => s.t > gap.from - 0.2 && s.t < gap.from)
    const hushed = seen.filter((s) => s.t > gap.to - 0.1 && s.t < gap.to)
    expect(gap.to).toBeLessThan(arch.end)
    expect(sung.length).toBeGreaterThan(0)
    expect(hushed.length).toBeGreaterThan(0)
    expect(sung.every((s) => s.mic === 'sing' && s.ring > 1.2)).toBe(true)
    expect(hushed.every((s) => s.mic === 'sing' && s.ring < 1.05)).toBe(true)
  })
})

describe('the mic and the contact light', () => {
  it.each(['learning', 'singer', 'professional'] as const)(
    'at %s, wait and no light through each stop between waves, and the light only while the mic says sing',
    async (level) => {
      setExerciseLevel(level)
      const plan = planFor(level, 52)
      const { pauseSec } = LIP_ROLL_LEVELS[level]
      await startRun()

      const seen = play(windowFrames(plan, follow(plan.path)), plan)

      const run = seen.filter((s) => s.phase === 'run')
      // Each stop: the wave's landing, the pause, then the rest of the
      // rest, up to the next wave.
      for (const [k, arch] of plan.path.arches.slice(0, -1).entries()) {
        const next = plan.path.arches[k + 1]
        const stop = run.filter((s) => s.t >= arch.end && s.t < next.start)
        const pause = stop.filter(
          (s) => s.t >= arch.landingEnd && s.t < arch.landingEnd + pauseSec,
        )
        expect(stop.length).toBeGreaterThan(0)
        expect(pause.length > 0).toBe(pauseSec > 0)
        expect(
          stop.every((s) => s.mic === 'wait' && s.light.state === 'hidden'),
        ).toBe(true)
      }
      // Frame by frame, the light shows exactly while the mic says sing,
      // its last instant included (the take hands the engine every frame
      // sung by the screen's time).
      const apart = run.filter(
        (s) => (s.light.state !== 'hidden') !== (s.mic === 'sing'),
      )
      expect(apart).toEqual([])
      expect(run.some((s) => s.mic === 'sing' && s.light.state === 'on')).toBe(
        true,
      )
    },
  )
})

describe('the dots ahead of Merc', () => {
  /** An element's translate3d, px (a bare 0 has no unit). */
  const translateOf = (el: Element): [number, number] => {
    const at = /translate3d\(([-\d.]+)(?:px)?,([-\d.]+)(?:px)?,/u.exec(
      (el as HTMLElement).style.transform,
    )
    return [Number(at?.[1] ?? Number.NaN), Number(at?.[2] ?? Number.NaN)]
  }
  /** Painted over `under`: the scene sets no z-index, so document order. */
  const over = (top: Node, under: Node): boolean =>
    (under.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING) !==
    0

  /** His box, the window over his front half, and where the copy lands. */
  function aheadNow() {
    // His box: the layer his renderer's host sits in.
    const box = screen.getByTestId('lip-merc').parentElement as HTMLElement
    const ahead = screen.getByTestId('lip-dots-ahead')
    const [left, top] = translateOf(box)
    const [x, y] = translateOf(ahead)
    const [ix, iy] = translateOf(ahead.firstElementChild as Element)
    const [dx, dy] = translateOf(screen.getByTestId('lip-dots'))
    return {
      size: Number.parseFloat(box.style.width),
      left,
      top,
      x,
      y,
      w: Number.parseFloat(ahead.style.width),
      h: Number.parseFloat(ahead.style.height),
      copy: [x + ix, y + iy],
      dots: [dx, dy],
    }
  }

  /** The window on his box's front half, and the copy on the dots. */
  function expectOverHisFront(): ReturnType<typeof aheadNow> {
    const at = aheadNow()
    expect(at.x).toBeCloseTo(at.left + at.size / 2, 0)
    expect(at.y).toBeCloseTo(at.top, 0)
    expect(at.w).toBeCloseTo(at.size / 2, 0)
    expect(at.h).toBeCloseTo(at.size, 0)
    expect(at.copy[0]).toBeCloseTo(at.dots[0], 2)
    expect(at.copy[1]).toBeCloseTo(at.dots[1], 2)
    return at
  }

  it('draws the dots over Merc and under the near sea, the voice still over the dots', () => {
    render(() => <LipRollRoom onDone={() => undefined} />)

    const dots = screen.getByTestId('lip-dots')
    const ribbon = screen.getByTestId('lip-ribbon')
    const merc = screen.getByTestId('lip-merc')
    const ahead = screen.getByTestId('lip-dots-ahead')
    const front = screen.getByTestId('lip-front')
    expect(over(ribbon, dots)).toBe(true)
    expect(over(merc, ribbon)).toBe(true)
    expect(over(ahead, merc)).toBe(true)
    expect(over(front, ahead)).toBe(true)
    // Pulled back and faded with the take at the result, as the near sea.
    expect(ahead.parentElement).toBe(front.parentElement)
    // Only the dots: each wave's dotted path drawn again, nothing else.
    const crests = screen.getAllByTestId('lip-target')
    expect(new Set(crests.map((c) => c.id)).size).toBe(3)
    expect(
      [...ahead.querySelectorAll('use')].map((u) => u.getAttribute('href')),
    ).toEqual(crests.map((c) => `#${c.id}`))
    expect(ahead.querySelectorAll('path, text').length).toBe(0)
    // At the intro, where he stands on the first root.
    expectOverHisFront()
  })

  it('keeps them over his front through a climb, each dot on its own', async () => {
    const plan = planFor('learning', 52)
    const [first] = plan.path.arches
    await startRun()
    play(
      windowFrames(plan, follow(plan.path)),
      plan,
      plan.countIn + (first.start + first.topStart) / 2,
    )
    expect(phase()).toBe('run')

    const at = expectOverHisFront()
    // The climb's next dots run through the window, well ahead of him.
    const points = (
      screen.getAllByTestId('lip-target')[0].getAttribute('d') ?? ''
    )
      .split(/[ML]/u)
      .filter((p) => p !== '')
      .map((p) => p.split(' ').map(Number))
    const ahead = points.filter(([px, py]) => {
      const x = px + at.dots[0]
      const y = py + at.dots[1]
      return (
        x > at.x + at.w / 4 && x <= at.x + at.w && y >= at.y && y <= at.y + at.h
      )
    })
    expect(ahead.length).toBeGreaterThan(0)
  })
})

describe('in the Warm-up', () => {
  /** The first stop of four, counting what the room hands it. */
  function warmUp(settledNote: number | null = null) {
    const calls = { finish: [] as StopResult[], skip: 0 }
    const stop: RoutineStop = {
      index: 0,
      count: 4,
      settledNote,
      finish: (result) => calls.finish.push(result),
      skip: () => {
        calls.skip += 1
      },
    }
    return { stop, calls }
  }

  it('opens on the stop\'s chip, Merc\'s cue and "Skip stop", with no level', () => {
    const { stop, calls } = warmUp()
    render(() => <LipRollRoom onDone={() => undefined} routine={stop} />)

    expect(phase()).toBe('intro')
    expect(chip()).toBe('Warm-up 1 of 4')
    expect(bubble()).toBe(linesOf('routine')[0])
    expect(screen.queryByTestId('lip-level')).toBeNull()
    const skip = screen.getByTestId('lip-skip-stop')
    expect(skip.textContent).toBe(ROUTINE_WORDS.skip)
    fireEvent.click(skip)
    expect(calls.skip).toBe(1)
  })

  it('fits the waves to the note an earlier stop started from, when it keeps none', () => {
    kept.note = null
    render(() => (
      <LipRollRoom onDone={() => undefined} routine={warmUp(55).stop} />
    ))

    expect(bubble()).toBe(linesOf('routine')[0])
    cleanup()
    render(() => (
      <LipRollRoom onDone={() => undefined} routine={warmUp().stop} />
    ))
    expect(said(bubble() ?? '', 'introAny')).toBe(true)
  })

  it('holds its result without Again or Done, then hands "N% lit" and its note on once', async () => {
    const { stop, calls } = warmUp()
    render(() => <LipRollRoom onDone={() => undefined} routine={stop} />)
    fireEvent.click(screen.getByTestId('lip-mic'))
    await settle()
    expect(chip()).not.toBe('Warm-up 1 of 4')
    const plan = planFor('learning', 52)
    play(windowFrames(plan, follow(plan.path)), plan)

    expect(phase()).toBe('result')
    expect(screen.queryByTestId('lip-again')).toBeNull()
    expect(screen.queryByTestId('lip-done')).toBeNull()
    expect(screen.queryByTestId('lip-level')).toBeNull()
    expect(screen.queryByTestId('lip-ask')).toBeNull()
    expect(kept.history).toHaveLength(1)
    const pct = /\d+%/u.exec(
      screen.getByTestId('lip-result').textContent ?? '',
    )?.[0]
    expect(pct).toBeDefined()
    expect(calls.finish).toEqual([])
    vi.advanceTimersByTime(1200 + ROUTINE_RESULT_HOLD_MS)
    expect(calls.finish).toEqual([
      { id: EXERCISE_LIP_ROLL_BAY, line: `${pct} lit`, settledNote: 52 },
    ])
    fireEvent.click(screen.getByTestId('lip-routine-on'))
    vi.advanceTimersByTime(10_000)
    expect(calls.finish).toHaveLength(1)
  })
})
