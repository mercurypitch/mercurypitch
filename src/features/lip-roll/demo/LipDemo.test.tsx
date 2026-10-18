// ============================================================
// The Lip roll demo, played through the room on a fake clock
// ============================================================
//
// The room with its demo: timers, performance.now() and animation frames
// advance together, so the two takes play through the room's own
// controller, take and glide engine exactly as they do on a phone. The
// demo kit's take clock is wrapped to record every event the room reports,
// so each tooltip's event is seen to happen where the room really reached
// it. The mic, the room's tones, Merc's renderer, the waves, the demo's
// sound and what a run keeps are stand-ins that count.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PlanModule from '@/components/demo-kit/demo-plan'
import type { LitStrip } from '@/components/room-kit/glide-reveal'
import type * as WavesModule from '../bay-waves'
import type * as CaptureModule from '../useLipCapture'
import { DEMO_COPY, planLipDemo } from './demo-cues'
import type { LipDemoTake } from './demo-script'

// ── A capture the test controls ─────────────────────────────────

const fake = vi.hoisted(() => ({
  acquired: 0,
  released: 0,
  windows: 0,
  /** What asking for the audio clock answers: running, or no clock. */
  audio: 'running' as 'running' | 'none',
}))

vi.mock('../useLipCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>('../useLipCapture')
  const ctx = {
    currentTime: 0,
    outputLatency: 0,
    baseLatency: 0,
    state: 'running',
  } as unknown as AudioContext
  return {
    ...actual,
    useLipCapture: () => ({
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

// The room's own tones: the demo plays none of them.
const roomTones = vi.hoisted(() => ({ played: 0 }))
vi.mock('@/components/room-kit/room-tones', () => ({
  createRoomTones: () => ({
    play: () => {
      roomTones.played += 1
    },
    stop: () => undefined,
  }),
}))

// The waves: the strips they are asked to light, and each reset.
const glass = vi.hoisted(() => ({ strips: [] as LitStrip[], resets: 0 }))
vi.mock('../bay-waves', async () => {
  const actual = await vi.importActual<typeof WavesModule>('../bay-waves')
  return {
    ...actual,
    createBayWaves: () => ({
      paint: (strips: readonly LitStrip[]) => glass.strips.push(...strips),
      reset: () => {
        glass.resets += 1
        glass.strips = []
      },
      dispose: () => undefined,
    }),
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
      sing: (take: LipDemoTake) => sound.sung.push(take.id),
      stop: () => {
        if (!stopped) sound.stops += 1
        stopped = true
      },
    }
  },
}))

// ── Every event the room reports to the demo ───────────────────

const marks = vi.hoisted(() => ({
  list: [] as string[],
  /** When each event was first reported, performance.now() ms. */
  at: new Map<string, number>(),
  /** When each take's clock read zero, performance.now() ms. */
  zero: new Map<string, number>(),
}))
vi.mock('@/components/demo-kit/demo-plan', async () => {
  const actual = await vi.importActual<typeof PlanModule>(
    '@/components/demo-kit/demo-plan',
  )
  return {
    ...actual,
    takeClock: ((take, startsAt, onMark) => {
      marks.zero.set(take.id, startsAt)
      return actual.takeClock(take, startsAt, (mark) => {
        const key = `${take.id}:${mark}`
        marks.list.push(key)
        if (!marks.at.has(key)) marks.at.set(key, performance.now())
        onMark(mark)
      })
    }) as typeof actual.takeClock,
  }
})

// ── What a run keeps, and what a phone feels ────────────────────

const kept = vi.hoisted(() => ({
  history: 0,
  bests: 0,
  haptics: 0,
  note: null as number | null,
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: () => {
    kept.history += 1
  },
}))
const seen = vi.hoisted(() => ({ value: false }))
vi.mock('@/stores/lip-roll-store', () => ({
  rememberedLipNote: () => kept.note,
  rememberLipNote: (midi: number) => {
    kept.note = midi
  },
  recordLipBest: () => {
    kept.bests += 1
    return { improved: false, previous: null }
  },
  lipBest: () => null,
  lipDemoSeen: () => seen.value,
  markLipDemoSeen: () => {
    seen.value = true
  },
  // The store's rule on this mock's records (no best is ever kept here).
  lipDemoAutoPlays: () => !seen.value && kept.note === null,
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

const { LipRollRoom } = await import('../LipRollRoom')

// ── The clock ──────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushFrames(): void {
  const due = rafQueue
  rafQueue = []
  for (const callback of due) callback(performance.now())
}

const room = (): HTMLElement => screen.getByTestId('lip-roll-room')
const demoMode = (): string | undefined => room().dataset.demo

/** The wave's lit share, from the strips the waves were asked to light. */
function litShare(): number {
  const ranges = glass.strips
    .filter((strip) => strip.arch === 0)
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
}

/** The room the moment a tooltip showed. */
interface Moment {
  phase: string | undefined
  take: string | null
  /** The wave's lit share then. */
  lit: number
}

interface Seen {
  tips: string[]
  takes: string[]
  at: Record<string, Moment>
  /** When each tooltip showed and went, performance.now() ms. */
  shown: Record<string, [number, number]>
  /** Merc's bubble, before a take and in one. */
  bubbleAlone: string[]
  bubbleInTakes: string[]
  chipInTakes: string[]
  /** Each take's wave lit share as it ended. */
  litAtEnd: Record<string, number>
}

const watched = (): Seen => ({
  tips: [],
  takes: [],
  at: {},
  shown: {},
  bubbleAlone: [],
  bubbleInTakes: [],
  chipInTakes: [],
  litAtEnd: {},
})

const push = (list: string[], value: string | null | undefined): void => {
  if (value === null || value === undefined || value === '') return
  if (list[list.length - 1] !== value) list.push(value)
}

/** What one frame showed: the tooltip, the take, the bubble and the chip. */
function note(log: Seen, lastTake: string | null): string | null {
  const tip = screen.queryByTestId('lip-demo-tip')?.dataset.tip
  const take = screen.queryByTestId('lip-demo-take')?.dataset.take ?? null
  const now = performance.now()
  if (tip !== undefined) {
    if (!(tip in log.at)) {
      log.at[tip] = { phase: room().dataset.phase, take, lit: litShare() }
      log.shown[tip] = [now, now]
    }
    log.shown[tip][1] = now
  }
  push(log.tips, tip)
  push(
    log.takes,
    screen.queryByTestId('lip-demo-take')?.textContent ?? undefined,
  )
  if (lastTake !== null && marks.at.has(`${lastTake}:end`)) {
    log.litAtEnd[lastTake] ??= litShare()
  }
  if (demoMode() === 'playing') {
    const bubble = screen.queryByTestId('lip-bubble')?.textContent
    push(take === null ? log.bubbleAlone : log.bubbleInTakes, bubble)
    if (take !== null) {
      push(log.chipInTakes, screen.queryByTestId('lip-chip')?.textContent)
    }
  }
  return take ?? lastTake
}

/** Advance the fake clock a frame at a time, noting what showed. */
async function run(ms: number, log: Seen = watched()): Promise<Seen> {
  const step = 16
  let lastTake: string | null = null
  for (let t = 0; t < ms; t += step) {
    await vi.advanceTimersByTimeAsync(step)
    flushFrames()
    lastTake = note(log, lastTake)
  }
  return log
}

/** Open the room; the demo starts by itself on a first visit. */
async function open(): Promise<void> {
  render(() => <LipRollRoom onDone={() => undefined} />)
  await run(50)
}

/** The events a tooltip can wait for, without the on and off of the light. */
const notable = (list: readonly string[]): string[] =>
  list.filter((m) => !m.endsWith(':onPath') && !m.endsWith(':offPath'))

describe('the Lip roll demo', () => {
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
    // A 390 x 844 phone, so the bay is laid out and drawn.
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
    Object.assign(kept, { history: 0, bests: 0, haptics: 0, note: null })
    roomTones.played = 0
    glass.strips = []
    glass.resets = 0
    marks.list = []
    marks.at.clear()
    marks.zero.clear()
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

  it('plays by itself on a first visit: every event once and in order, each tooltip on its own, nothing kept', async () => {
    await open()
    expect(demoMode()).toBe('idle')

    const log = await run(26000)

    // The room reported each event a tooltip waits for, in the order sung.
    expect(notable(marks.list)).toEqual([
      'off:break',
      'off:archEnd',
      'off:end',
      'on:top',
      'on:archEnd',
      'on:end',
    ])
    // Take 1 left the path before its break; take 2 never did.
    expect(marks.list.indexOf('off:offPath')).toBeGreaterThan(-1)
    expect(marks.list.indexOf('off:offPath')).toBeLessThan(
      marks.list.indexOf('off:break'),
    )
    expect(marks.list).toContain('on:onPath')
    expect(marks.list.filter((m) => m === 'on:offPath')).toEqual([])
    // One tooltip an event, each once, in the cues' order.
    expect(log.tips).toEqual(['short', 'break', 'ride', 'turn', 'score'])
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])

    // What each tooltip explains is on the screen as it shows.
    expect(log.at.short).toMatchObject({ phase: 'run', take: 'off' })
    expect(log.at.break).toMatchObject({ phase: 'run', take: 'off' })
    expect(log.at.ride).toMatchObject({ phase: 'run', take: 'on' })
    expect(log.at.turn).toMatchObject({ phase: 'run', take: 'on' })
    expect(log.at.score).toMatchObject({ take: 'on' })
    // Take 1 left its top dark, short of Learning's lit share; take 2 lit
    // all of it.
    expect(log.litAtEnd.off).toBeGreaterThan(0.3)
    expect(log.litAtEnd.off).toBeLessThan(0.65)
    expect(log.at.score.lit).toBeGreaterThan(0.98)

    // Merc speaks once, before the takes; the takes' chip and bubble keep quiet.
    expect(log.bubbleAlone).toEqual([DEMO_COPY.watch])
    expect(log.bubbleInTakes).toEqual([])
    expect(log.chipInTakes).toEqual([])

    // The end card, the record, and nothing of a singer's.
    expect(demoMode()).toBe('end')
    expect(screen.getByTestId('lip-demo-end').textContent).toContain(
      DEMO_COPY.endTitle,
    )
    expect(seen.value).toBe(true)
    expect(sound.sung).toEqual(['off', 'on'])
    expect([fake.acquired, fake.windows, roomTones.played]).toEqual([0, 0, 0])
    expect([kept.history, kept.bests, kept.haptics, kept.note]).toEqual([
      0,
      0,
      0,
      null,
    ])
    // The end card stands over take 2's wave, lit as it left it.
    expect(litShare()).toBeGreaterThan(0.98)
  })

  it('reaches its end card in about 22 s, nothing played fast, every event when the script dates it', async () => {
    await open()
    await run(1200)
    expect(demoMode()).toBe('playing')
    const from = performance.now()
    while (demoMode() === 'playing' && performance.now() - from < 30000) {
      await run(100)
    }
    expect(demoMode()).toBe('end')
    const seconds = (performance.now() - from) / 1000
    const plan = planLipDemo(planLipDemo(0).note)
    expect(seconds).toBeGreaterThan(plan.total - 0.4)
    expect(seconds).toBeLessThan(plan.total + 0.4)
    // Each event came as far after its take's start as the script dates
    // it: the room played both takes at their own speed.
    for (const id of ['off', 'on'] as const) {
      const zero = marks.zero.get(id) ?? NaN
      for (const event of plan.takes[id].events) {
        const at = marks.at.get(`${id}:${event.type}`) ?? NaN
        if (plan.takes[id].events.find((e) => e.type === event.type) !== event)
          continue
        expect((at - zero) / 1000, `${id}:${event.type}`).toBeCloseTo(
          event.at,
          1,
        )
      }
    }
  })

  it('keeps every tooltip up long enough to read', async () => {
    await open()
    const log = await run(26000)

    for (const tip of ['short', 'break', 'ride', 'turn', 'score']) {
      const [shown, gone] = log.shown[tip]
      expect((gone - shown) / 1000, tip).toBeGreaterThanOrEqual(1.75)
    }
  })

  it('Skip ends it on the end card, with every sound off, and counts it seen', async () => {
    await open()
    await run(4000)
    expect(demoMode()).toBe('playing')

    fireEvent.click(screen.getByTestId('lip-demo-skip'))
    await run(50)

    expect(demoMode()).toBe('end')
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(true)
    expect(room().dataset.phase).toBe('intro')
    expect(glass.strips).toEqual([])
  })

  it('Watch again plays it from the start', async () => {
    await open()
    await run(4000)
    fireEvent.click(screen.getByTestId('lip-demo-skip'))
    await run(50)
    marks.list = []
    marks.at.clear()

    fireEvent.click(screen.getByTestId('lip-demo-again'))
    const log = await run(26000)

    expect(sound.made).toBe(2)
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])
    expect(notable(marks.list)[0]).toBe('off:break')
    expect(marks.list[marks.list.length - 1]).toBe('on:end')
    expect(demoMode()).toBe('end')
  })

  it('Try it hands the room back: the mic is pointed out, and a tap on it starts a run', async () => {
    await open()
    await run(26000)
    expect(demoMode()).toBe('end')

    fireEvent.click(screen.getByTestId('lip-demo-try'))
    await run(50)

    expect(demoMode()).toBe('idle')
    expect(room().dataset.phase).toBe('intro')
    expect(screen.getByTestId('lip-demo-tip').dataset.tip).toBe('mic')
    expect(screen.getByTestId('lip-demo-tip').textContent).toBe(
      DEMO_COPY.micHint,
    )

    fireEvent.click(screen.getByTestId('lip-mic'))
    await run(100)

    expect(fake.acquired).toBe(1)
    expect(room().dataset.phase).toBe('settle')
    expect(screen.queryByTestId('lip-demo-tip')).toBeNull()
  })

  it('points the mic out at rest, unsaid, and lets it go once a take starts', async () => {
    seen.value = true
    await open()
    await run(100)
    const tip = screen.getByTestId('lip-demo-tip')
    const atRest = [tip.dataset.tip, tip.textContent]
    const unsaid = screen.getByTestId('lip-demo-said').textContent

    fireEvent.click(screen.getByTestId('lip-mic'))
    await run(100)

    expect(atRest).toEqual(['mic', DEMO_COPY.micHint])
    expect(unsaid).toBe('')
    expect(screen.queryByTestId('lip-demo-tip')).toBeNull()
  })

  it('points nothing out while a first visit is about to play the demo', async () => {
    render(() => <LipRollRoom onDone={() => undefined} />)

    const pointed = screen.queryByTestId('lip-demo-tip')?.dataset.tip ?? null

    expect(pointed).not.toBe('mic')
  })

  it('never plays by itself in the Warm-up, even on a first visit; "?" still plays it', async () => {
    render(() => (
      <LipRollRoom
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

    fireEvent.click(screen.getByTestId('lip-ask'))
    await run(100)

    expect(demoMode()).toBe('playing')
    expect(screen.queryByTestId('lip-skip-stop')).toBeNull()
  })

  it('plays by itself only until it is seen; then "?" plays it', async () => {
    seen.value = true
    await open()
    await run(3000)
    expect(demoMode()).toBe('idle')
    expect(sound.made).toBe(0)

    fireEvent.click(screen.getByTestId('lip-ask'))
    await run(100)

    expect(demoMode()).toBe('playing')
    expect(screen.queryByTestId('lip-ask')).toBeNull()
    expect(screen.getByTestId('lip-demo-skip')).toBeTruthy()
  })

  it('plays by itself only on a first visit: not once a note is kept', async () => {
    kept.note = 57
    await open()
    await run(3000)

    expect(demoMode()).toBe('idle')
    expect(screen.getByTestId('lip-ask')).toBeTruthy()
  })

  it('offers no "?" while a run is on', async () => {
    seen.value = true
    await open()
    expect(screen.getByTestId('lip-ask')).toBeTruthy()

    fireEvent.click(screen.getByTestId('lip-mic'))
    await run(100)

    expect(room().dataset.phase).toBe('settle')
    expect(screen.queryByTestId('lip-ask')).toBeNull()
  })

  it('a cold first visit with no running audio clock offers the play card', async () => {
    fake.audio = 'none'
    await open()
    await run(2500)

    expect(demoMode()).toBe('card')
    expect(sound.made).toBe(0)
    expect(screen.getByTestId('lip-demo-card').textContent).toContain(
      DEMO_COPY.cardTitle,
    )

    fireEvent.click(screen.getByTestId('lip-demo-not-now'))
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
    fireEvent.click(screen.getByTestId('lip-demo-watch'))
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
    await run(26000)

    expect(demoMode()).toBe('end')
    expect(merc.states).not.toContain('hop')
    expect(merc.states).not.toContain('celebrate')
  })
})
