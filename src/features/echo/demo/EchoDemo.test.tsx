// ============================================================
// The Echo demo, played through the room on a fake clock
// ============================================================
//
// The room with its demo: timers, performance.now() and animation frames
// advance together, so the two takes play through the room's own
// controller and sequence engine exactly as they do on a phone. The demo
// kit's take clock is wrapped to record every moment the room reports, so
// each tooltip's moment is seen to happen once, in order, where the room
// really reached it. The mic, Merc's renderer, the demo's sound and what
// a run keeps are stand-ins that count.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PlanModule from '@/components/demo-kit/demo-plan'
import { READY_WAIT_MS } from '@/components/demo-kit/useExerciseDemo'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type * as CallModule from '../merc-call'
import type * as SamplerModule from '../merc-sampler'
import type * as CaptureModule from '../useEchoCapture'
import { DEMO_COPY, planEchoDemo } from './demo-cues'
import type { EchoDemoTake } from './demo-script'
import { CALL_AT } from './demo-script'

// ── A capture the test controls ─────────────────────────────────

const fake = vi.hoisted(() => ({
  acquired: 0,
  released: 0,
  windows: 0,
  /** What asking for the audio clock answers: running, or no clock. */
  audio: 'running' as 'running' | 'none',
}))

vi.mock('../useEchoCapture', async () => {
  const actual =
    await vi.importActual<typeof CaptureModule>('../useEchoCapture')
  const ctx = {
    currentTime: 0,
    outputLatency: 0,
    baseLatency: 0,
    state: 'running',
  } as unknown as AudioContext
  return {
    ...actual,
    useEchoCapture: () => ({
      acquire: () => {
        fake.acquired += 1
        return Promise.resolve()
      },
      release: () => {
        fake.released += 1
      },
      held: () => true,
      startWindow: () => {
        fake.windows += 1
      },
      peekFrames: () => [],
      takeFrames: () => [],
      playTone: () => Promise.resolve(),
      audio: () => Promise.resolve(fake.audio === 'running' ? ctx : null),
    }),
  }
})

// Merc's call in a singer's own run: a schedule, and no sound.
vi.mock('../merc-call', async () => {
  const actual = await vi.importActual<typeof CallModule>('../merc-call')
  return {
    ...actual,
    SYNTH_CALL: {
      sing: (_ctx: AudioContext, notes: readonly PhraseNote[], at: number) => ({
        ...actual.callTimes(notes, at),
        stop: () => undefined,
      }),
    },
  }
})

// Merc's recorded voice: loaded when the test says so (merc-sampler.ts).
// The calls fall back to the synth above until it has.
const voice = vi.hoisted(() => ({
  loads: 0,
  /** Resolves the load in flight; null once it has, or before one. */
  done: null as (() => void) | null,
  /** The load answers at once. */
  instant: true,
}))
vi.mock('../merc-sampler', async () => {
  const actual = await vi.importActual<typeof SamplerModule>('../merc-sampler')
  return {
    ...actual,
    preloadMercVoice: () => {
      voice.loads += 1
      if (voice.instant) return Promise.resolve(null)
      return new Promise<null>((resolve) => {
        voice.done = () => resolve(null)
      })
    },
  }
})

// ── The demo's sound, recorded rather than played ──────────────

const sound = vi.hoisted(() => ({ made: 0, sung: [] as string[], stops: 0 }))
vi.mock('./demo-sound', () => ({
  createDemoSound: () => {
    sound.made += 1
    let stopped = false
    return {
      lead: 0.12,
      tone: () => undefined,
      sing: (take: EchoDemoTake) => sound.sung.push(take.id),
      stop: () => {
        if (!stopped) sound.stops += 1
        stopped = true
      },
    }
  },
}))

// ── Every moment the room reports to the demo ──────────────────

const marks = vi.hoisted(() => ({
  list: [] as string[],
  /** When each moment was reported, performance.now() ms. */
  at: new Map<string, number>(),
}))
vi.mock('@/components/demo-kit/demo-plan', async () => {
  const actual = await vi.importActual<typeof PlanModule>(
    '@/components/demo-kit/demo-plan',
  )
  return {
    ...actual,
    takeClock: ((take, startsAt, onMark) =>
      actual.takeClock(take, startsAt, (mark) => {
        marks.list.push(`${take.id}:${mark}`)
        marks.at.set(`${take.id}:${mark}`, performance.now())
        onMark(mark)
      })) as typeof actual.takeClock,
  }
})

// ── What a run keeps, and what a phone feels ────────────────────

const kept = vi.hoisted(() => ({
  history: 0,
  bests: 0,
  haptics: 0,
  root: null as number | null,
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: () => {
    kept.history += 1
  },
}))
const seen = vi.hoisted(() => ({ value: false }))
vi.mock('@/stores/echo-store', () => ({
  rememberedEchoRoot: () => kept.root,
  rememberEchoRoot: (midi: number) => {
    kept.root = midi
  },
  recordEchoBest: () => {
    kept.bests += 1
    return { improved: false }
  },
  echoBest: () => null,
  echoDemoSeen: () => seen.value,
  markEchoDemoSeen: () => {
    seen.value = true
  },
  // The store's rule on this mock's records (no best is ever kept here).
  echoDemoAutoPlays: () => !seen.value && kept.root === null,
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
}))
vi.mock('@/lib/haptics', () => ({
  haptics: {
    tapLight: () => {
      kept.haptics += 1
    },
    success: () => {
      kept.haptics += 1
    },
  },
}))

const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/components/room-kit/reduced-motion', () => ({
  prefersReducedMotion: () => motion.reduced,
}))

const merc = vi.hoisted(() => ({ states: [] as string[] }))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: (name: string) => merc.states.push(name),
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

const { EchoRoom } = await import('../EchoRoom')

// ── The clock ──────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushFrames(): void {
  const due = rafQueue
  rafQueue = []
  for (const callback of due) callback(performance.now())
}

// ── The room's parts ───────────────────────────────────────────
//
// `run` reads a dozen of the room's parts on every frame of a 22-second
// demo, about 1,400 frames a run. Found one at a time, each read walked the
// whole page, and a whole demo took 4 to 5 s on a quiet machine, against
// Vitest's 5 s limit (TESTING.md section 3.7: fix the cost, do not raise the
// ceiling). So while `run` reads a frame, the page is walked once, into an
// index by test id, and every read looks its part up there; outside `run`
// each read walks the page itself. Like `queryByTestId`, a part that is
// there twice is an error.

/** The parts on the page by test id, in page order. */
type Parts = Map<string, HTMLElement[]>

/** The frame `run` is reading, walked once; null between frames. */
let frame: Parts | null = null

function walkParts(): Parts {
  const parts: Parts = new Map()
  for (const el of document.querySelectorAll<HTMLElement>('[data-testid]')) {
    const id = el.getAttribute('data-testid') ?? ''
    const same = parts.get(id)
    if (same === undefined) parts.set(id, [el])
    else same.push(el)
  }
  return parts
}

/** Every part with this test id, in page order. */
const partsWith = (testId: string): HTMLElement[] =>
  (frame ?? walkParts()).get(testId) ?? []

/** The room's part with this test id, or null. */
function part(testId: string): HTMLElement | null {
  const found = partsWith(testId)
  if (found.length > 1)
    throw new Error(`${found.length} parts with the test id ${testId}`)
  return found[0] ?? null
}

/** The room's part with this test id, which must be there. */
function partThere(testId: string): HTMLElement {
  const found = part(testId)
  if (found === null) throw new Error(`no part with the test id ${testId}`)
  return found
}

const room = (): HTMLElement => partThere('echo-room')
const demoMode = (): string | undefined => room().dataset.demo
const keys = (testId: string): string[] =>
  partsWith(testId).map(
    (el) =>
      `${el.getAttribute('data-key')}:${el.getAttribute('data-style') ?? el.getAttribute('data-size')}`,
  )

/** The room the moment a tooltip showed. */
interface Moment {
  phase: string | undefined
  take: string | null
  rings: string[]
  stars: string[]
  result: string | null
  clouds: string
  /** The town's city light: its state's layer, or none. */
  light: string
  topLight: string
}

interface Seen {
  tips: string[]
  takes: string[]
  phases: string[]
  at: Record<string, Moment>
  /** Merc's bubble, before a take and in one. */
  bubbleAlone: string[]
  bubbleInTakes: string[]
  chipInTakes: string[]
  clouds: string[]
  /** The tooltips up while the result showed. */
  overResult: string[]
}

const watched = (): Seen => ({
  tips: [],
  takes: [],
  phases: [],
  at: {},
  bubbleAlone: [],
  bubbleInTakes: [],
  chipInTakes: [],
  clouds: [],
  overResult: [],
})

const push = (list: string[], value: string | null | undefined): void => {
  if (value === null || value === undefined || value === '') return
  if (list[list.length - 1] !== value) list.push(value)
}

/** Which clouds are up: the take's, the demo's, or none. */
function cloudsUp(): string {
  const up = (id: string) => part(id)?.getAttribute('data-on') === 'true'
  if (up('echo-clouds-demo')) return 'demo-off'
  if (up('echo-clouds')) return 'mid-take'
  return 'none'
}

/** Whose top light is up: the one at full opacity. */
function topLightUp(): string {
  const lit = [
    'echo-top-light',
    'echo-top-light-demo-off',
    'echo-top-light-result',
  ].filter((id) => partThere(id).style.opacity === '1')
  return lit.join(',')
}

/** Note what the room shows this frame. */
function note(log: Seen): void {
  const tip = part('echo-demo-tip')?.dataset.tip
  const take = part('echo-demo-take')?.textContent
  if (tip !== undefined && !(tip in log.at)) {
    log.at[tip] = {
      phase: room().dataset.phase,
      take: take ?? null,
      rings: keys('echo-ring'),
      stars: keys('echo-star'),
      result: part('echo-result')?.textContent ?? null,
      clouds: cloudsUp(),
      light: partThere('echo-citylight').dataset.state ?? '',
      topLight: topLightUp(),
    }
  }
  push(log.tips, tip)
  if (room().dataset.phase === 'result') push(log.overResult, tip)
  push(log.takes, take)
  push(log.phases, room().dataset.phase)
  if (demoMode() === 'playing') {
    const bubble = part('echo-bubble')?.textContent
    push(take === undefined ? log.bubbleAlone : log.bubbleInTakes, bubble)
    if (take !== undefined) {
      push(log.chipInTakes, part('echo-chip')?.textContent)
    }
    push(log.clouds, `${take ?? '-'}:${cloudsUp()}`)
  }
}

/** Advance the fake clock a frame at a time, noting what showed. */
async function run(ms: number, log: Seen = watched()): Promise<Seen> {
  const step = 16
  for (let t = 0; t < ms; t += step) {
    await vi.advanceTimersByTimeAsync(step)
    flushFrames()
    frame = walkParts()
    try {
      note(log)
    } finally {
      frame = null
    }
  }
  return log
}

/** Open the room; the demo starts by itself on a first visit. */
async function open(): Promise<void> {
  render(() => <EchoRoom onDone={() => undefined} />)
  await run(50)
}

describe('the Echo demo', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
    })
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
    // A 390 x 844 phone, so the sky is laid out and drawn.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    Object.assign(fake, {
      acquired: 0,
      released: 0,
      windows: 0,
      audio: 'running',
    })
    Object.assign(sound, { made: 0, sung: [], stops: 0 })
    Object.assign(voice, { loads: 0, done: null, instant: true })
    Object.assign(kept, { history: 0, bests: 0, haptics: 0, root: null })
    marks.list = []
    marks.at.clear()
    seen.value = false
    motion.reduced = false
    merc.states = []
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("waits for Merc's recorded voice before its first call", async () => {
    voice.instant = false
    await open()
    await run(3000)
    // The clock is running, the voice is still loading: no demo yet.
    expect(voice.loads).toBeGreaterThan(0)
    expect(demoMode()).toBe('idle')
    expect(sound.sung).toEqual([])

    voice.done?.()
    await run(50)
    expect(demoMode()).toBe('playing')
    await run(1500)
    expect(sound.sung).toEqual(['off'])
  })

  it('starts without the recorded voice once READY_WAIT_MS has passed', async () => {
    voice.instant = false
    await open()
    await run(1200 + READY_WAIT_MS - 300)
    expect(demoMode()).toBe('idle')
    await run(600)
    expect(demoMode()).toBe('playing')
  })

  it('plays by itself on a first visit: every moment once and in order, each tooltip on its own, nothing kept', async () => {
    await open()
    expect(demoMode()).toBe('idle')

    const log = await run(22000)

    // The room reported each moment exactly once, in the order it sang.
    expect(marks.list).toEqual([
      'off:call',
      'off:early',
      'off:land:0',
      'off:miss:1',
      'off:land:2',
      'off:phraseEnd',
      'on:call',
      'on:land:0',
      'on:land:1',
      'on:land:2',
      'on:phraseEnd',
      'on:result',
    ])
    // One tooltip a moment, each once, in the cues' order.
    expect(log.tips).toEqual([
      'call',
      'early',
      'flat',
      'lands',
      'joins',
      'score',
    ])
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])

    // What each tooltip explains is on the screen as it shows.
    expect(log.at.call).toMatchObject({ phase: 'call', take: DEMO_COPY.off })
    expect(log.at.call.rings).toEqual([
      'p0-r0:waiting',
      'p0-r1:waiting',
      'p0-r2:waiting',
    ])
    expect(log.at.early.phase).toBe('call')
    // Take 1 moved on from the flat note and landed the next: the flat
    // note's ring is left dark between the two stars.
    expect(log.at.flat).toMatchObject({
      phase: 'between',
      stars: ['p0-0:phrase', 'p0-2:phrase'],
      rings: ['p0-r1:missed'],
    })
    expect(log.at.lands).toMatchObject({
      phase: 'response',
      take: DEMO_COPY.on,
    })
    expect(log.at.lands.stars).toEqual(['p0-0:phrase'])
    expect(log.at.joins.phase).toBe('between')
    expect(log.at.joins.stars).toEqual([
      'p0-0:phrase',
      'p0-1:phrase',
      'p0-2:phrase',
    ])
    expect(log.at.score.phase).toBe('result')
    // The phrase's tooltip goes with the stars it pointed at.
    expect(log.overResult).toEqual(['score'])
    expect(log.at.score.result).toMatch(/^3 of 3/u)

    // Screen 3's clouds through take 1, a take's through take 2, none at the result.
    expect(log.clouds).toContain(`${DEMO_COPY.off}:demo-off`)
    expect(log.clouds).toContain(`${DEMO_COPY.on}:mid-take`)
    expect(log.at.flat.clouds).toBe('demo-off')
    expect(log.at.lands.clouds).toBe('mid-take')
    expect(log.at.score.clouds).toBe('none')
    // The town's light goes with the clouds: screen 3's, then a take's.
    expect(log.at.flat.light).toBe('demo-off')
    expect(log.at.lands.light).toBe('mid-take')
    expect(log.at.score.light).toBe('none')
    // So does the top light: screen 3's soft band, the room's, the result's.
    expect(log.at.flat.topLight).toBe('echo-top-light-demo-off')
    expect(log.at.lands.topLight).toBe('echo-top-light')
    expect(log.at.score.topLight).toBe('echo-top-light-result')

    // Merc speaks once, before the takes; the takes' chip and bubble keep quiet.
    expect(log.bubbleAlone).toEqual([DEMO_COPY.watch])
    expect(log.bubbleInTakes).toEqual([])
    expect(log.chipInTakes).toEqual([])

    // The end card, the record, and nothing of a singer's.
    expect(demoMode()).toBe('end')
    expect(screen.getByTestId('echo-demo-end').textContent).toContain(
      DEMO_COPY.endTitle,
    )
    expect(seen.value).toBe(true)
    expect(sound.sung).toEqual(['off', 'on'])
    expect([fake.acquired, fake.windows]).toEqual([0, 0])
    expect([kept.history, kept.bests, kept.haptics, kept.root]).toEqual([
      0,
      0,
      0,
      null,
    ])
  })

  it('reaches its end card in about 19 s, nothing played fast', async () => {
    await open()
    await run(1200)
    expect(demoMode()).toBe('playing')
    const from = performance.now()
    while (demoMode() === 'playing' && performance.now() - from < 30000) {
      await run(100)
    }
    expect(demoMode()).toBe('end')
    const seconds = (performance.now() - from) / 1000
    expect(seconds).toBeGreaterThan(18.5)
    expect(seconds).toBeLessThan(19.7)
    // Each moment came as far after its take's call as the script dates
    // it: the room played both takes at their own speed.
    const plan = planEchoDemo(57)
    for (const id of ['off', 'on'] as const) {
      const call = marks.at.get(`${id}:call`) ?? NaN
      for (const event of plan.takes[id].events) {
        const at = marks.at.get(`${id}:${event.type}`) ?? NaN
        expect((at - call) / 1000, `${id}:${event.type}`).toBeCloseTo(
          event.at - CALL_AT,
          1,
        )
      }
    }
  })

  it('Skip ends it on the end card, with every sound off, and counts it seen', async () => {
    await open()
    await run(4000)
    expect(demoMode()).toBe('playing')

    fireEvent.click(screen.getByTestId('echo-demo-skip'))
    await run(50)

    expect(demoMode()).toBe('end')
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(true)
    expect(room().dataset.phase).toBe('intro')
    expect(screen.queryAllByTestId('echo-ring')).toHaveLength(0)
  })

  it('Watch again plays it from the start', async () => {
    await open()
    await run(4000)
    fireEvent.click(screen.getByTestId('echo-demo-skip'))
    await run(50)
    marks.list = []
    marks.at.clear()

    fireEvent.click(screen.getByTestId('echo-demo-again'))
    const log = await run(22000)

    expect(sound.made).toBe(2)
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])
    expect(marks.list[0]).toBe('off:call')
    expect(marks.list[marks.list.length - 1]).toBe('on:result')
    expect(demoMode()).toBe('end')
  })

  it('Try it hands the room back: the mic is pointed out, and a tap on it starts a run', async () => {
    await open()
    await run(22000)
    expect(demoMode()).toBe('end')

    fireEvent.click(screen.getByTestId('echo-demo-try'))
    await run(50)

    expect(demoMode()).toBe('idle')
    expect(room().dataset.phase).toBe('intro')
    expect(screen.getByTestId('echo-demo-tip').dataset.tip).toBe('mic')
    expect(screen.getByTestId('echo-demo-tip').textContent).toBe(
      DEMO_COPY.micHint,
    )
    expect(screen.queryByTestId('echo-result')).toBeNull()

    fireEvent.click(screen.getByTestId('echo-mic'))
    await run(100)

    expect(fake.acquired).toBe(1)
    expect(room().dataset.phase).toBe('settle')
    expect(screen.queryByTestId('echo-demo-tip')).toBeNull()
  })

  it('never plays by itself in the Warm-up, even on a first visit; "?" still plays it', async () => {
    render(() => (
      <EchoRoom
        onDone={() => undefined}
        routine={{
          index: 0,
          count: 4,
          settledNote: null,
          finish: () => undefined,
          skip: () => undefined,
        }}
      />
    ))
    await run(3000)
    expect(demoMode()).toBe('idle')
    expect(sound.made).toBe(0)

    fireEvent.click(screen.getByTestId('echo-ask'))
    await run(100)

    expect(demoMode()).toBe('playing')
    expect(screen.queryByTestId('echo-skip-stop')).toBeNull()
  })

  it('plays by itself only until it is seen; then "?" plays it', async () => {
    seen.value = true
    await open()
    await run(3000)
    expect(demoMode()).toBe('idle')
    expect(sound.made).toBe(0)

    fireEvent.click(screen.getByTestId('echo-ask'))
    await run(100)

    expect(demoMode()).toBe('playing')
    expect(screen.queryByTestId('echo-ask')).toBeNull()
    expect(screen.getByTestId('echo-demo-skip')).toBeTruthy()
  })

  it('offers no "?" while a run is on', async () => {
    seen.value = true
    await open()
    expect(screen.getByTestId('echo-ask')).toBeTruthy()

    fireEvent.click(screen.getByTestId('echo-mic'))
    await run(100)

    expect(room().dataset.phase).toBe('settle')
    expect(screen.queryByTestId('echo-ask')).toBeNull()
  })

  it('a cold first visit with no running audio clock offers the play card', async () => {
    fake.audio = 'none'
    await open()
    await run(2500)

    expect(demoMode()).toBe('card')
    expect(sound.made).toBe(0)
    expect(screen.getByTestId('echo-demo-card').textContent).toContain(
      DEMO_COPY.cardTitle,
    )

    fireEvent.click(screen.getByTestId('echo-demo-not-now'))
    await run(50)

    expect(demoMode()).toBe('idle')
    expect(seen.value).toBe(true)
  })

  it('plays from the play card once its Watch is tapped', async () => {
    fake.audio = 'none'
    await open()
    await run(2500)
    expect(demoMode()).toBe('card')

    fake.audio = 'running'
    fireEvent.click(screen.getByTestId('echo-demo-watch'))
    await run(100)

    expect(demoMode()).toBe('playing')
    expect(sound.made).toBe(1)
  })

  it('stops when the app goes to the background, unseen, and offers itself again', async () => {
    await open()
    await run(5000)
    expect(demoMode()).toBe('playing')

    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await run(50)
    visibility.mockRestore()

    expect(demoMode()).toBe('card')
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(false)
    expect(room().dataset.phase).toBe('intro')
    expect([fake.acquired, kept.haptics]).toEqual([0, 0])
  })

  it('stops its sound when the room goes', async () => {
    await open()
    await run(5000)
    expect(sound.stops).toBe(0)

    cleanup()

    expect(sound.stops).toBe(1)
  })

  it('moves Merc without a hop or a cheer with reduced motion', async () => {
    motion.reduced = true
    await open()
    await run(22000)

    expect(demoMode()).toBe('end')
    expect(merc.states).not.toContain('hop')
    expect(merc.states).not.toContain('celebrate')
  })
})
