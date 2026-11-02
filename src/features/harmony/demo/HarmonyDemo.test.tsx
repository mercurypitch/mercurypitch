// ============================================================
// The Harmony demo, played through the room on a fake clock
// ============================================================
//
// The room with its demo: timers, performance.now() and animation frames
// advance together, so the two takes play through the room's own
// controller and sequence engine exactly as they do on a phone. The demo
// kit's take clock is wrapped to record every moment the room reports, so
// each tooltip's moment is seen to happen once, in order, where the room
// really reached it. The mic, Merc's renderer, his voice, the demo's
// sound, his spoken lines and what a run keeps are stand-ins that count.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PlanModule from '@/components/demo-kit/demo-plan'
import type * as SpeechModule from '@/components/room-kit/merc-speech'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type * as HarmonyStoreModule from '@/stores/harmony-store'
import { DEMO_COPY, demoCueText } from './demo-cues'
import type { HarmonyDemoTake } from './demo-script'

// ── A capture the test controls ─────────────────────────────────

const fake = vi.hoisted(() => ({
  acquired: 0,
  released: 0,
  windows: 0,
  /** What asking for the audio clock answers: running, or no clock. */
  audio: 'running' as 'running' | 'none',
}))

vi.mock('@/components/room-kit/useExerciseCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>(
    '@/components/room-kit/useExerciseCapture',
  )
  const ctx = {
    currentTime: 0,
    outputLatency: 0,
    baseLatency: 0,
    state: 'running',
  } as unknown as AudioContext
  return {
    ...actual,
    useExerciseCapture: () => ({
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
      runningAudio: () => (fake.audio === 'running' ? ctx : null),
    }),
  }
})

// Merc's voice in the room: a run's calls would go here, the demo's never.
const voice = vi.hoisted(() => ({ sung: [] as number[][] }))
vi.mock('@/components/room-kit/round-voice', () => ({
  SYNTH_VOICE: {
    sing: (_ctx: AudioContext, notes: readonly PhraseNote[], at: number) => {
      voice.sung.push(notes.map((note) => note.midi))
      return { onsets: [at], endAt: at + 1, stop: () => undefined }
    },
  },
  outputLatency: () => 0,
}))

// ── The demo's sound, recorded rather than played ──────────────

const sound = vi.hoisted(() => ({ made: 0, sung: [] as string[], stops: 0 }))
vi.mock('./demo-sound', () => ({
  createDemoSound: () => {
    sound.made += 1
    let stopped = false
    return {
      lead: 0.12,
      tone: () => undefined,
      sing: (take: HarmonyDemoTake) => sound.sung.push(take.id),
      stop: () => {
        if (!stopped) sound.stops += 1
        stopped = true
      },
    }
  },
}))

// ── Every moment the room reports to the demo ──────────────────

const marks = vi.hoisted(() => ({ list: [] as string[] }))
vi.mock('@/components/demo-kit/demo-plan', async () => {
  const actual = await vi.importActual<typeof PlanModule>(
    '@/components/demo-kit/demo-plan',
  )
  return {
    ...actual,
    takeClock: ((take, startsAt, onMark) =>
      actual.takeClock(take, startsAt, (mark) => {
        marks.list.push(`${take.id}:${mark}`)
        onMark(mark)
      })) as typeof actual.takeClock,
  }
})

// ── Merc's lines aloud, what a run keeps, and what a phone feels ──

const spoken = vi.hoisted(() => ({ said: [] as string[], hushed: 0 }))
vi.mock('@/components/room-kit/merc-speech', async () => ({
  ...(await vi.importActual<typeof SpeechModule>(
    '@/components/room-kit/merc-speech',
  )),
  createMercSpeech: () => ({
    say: (id: string) => {
      spoken.said.push(id)
    },
    hush: () => {
      spoken.hushed += 1
    },
    speaking: () => false,
    dispose: () => undefined,
  }),
}))

const kept = vi.hoisted(() => ({ history: 0, bests: 0, haptics: 0 }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: () => {
    kept.history += 1
  },
}))
const seen = vi.hoisted(() => ({ value: false }))
vi.mock('@/stores/harmony-store', async () => ({
  ...(await vi.importActual<typeof HarmonyStoreModule>(
    '@/stores/harmony-store',
  )),
  recordHarmonyBest: () => {
    kept.bests += 1
    return { previous: null, improved: false }
  },
  harmonyBest: () => null,
  harmonyDemoSeen: () => seen.value,
  markHarmonyDemoSeen: () => {
    seen.value = true
  },
  // The store's rule on this mock's records (no best is ever kept here).
  harmonyDemoAutoPlays: () => !seen.value,
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
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

const { HarmonyRoom } = await import('../HarmonyRoom')

// ── The clock ──────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushFrames(): void {
  const due = rafQueue
  rafQueue = []
  for (const callback of due) callback(performance.now())
}

// ── The room's parts ───────────────────────────────────────────

const part = (testId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)

function partThere(testId: string): HTMLElement {
  const found = part(testId)
  if (found === null) throw new Error(`no part with the test id ${testId}`)
  return found
}

const room = (): HTMLElement => partThere('harmony-room')
const demoMode = (): string | undefined => room().dataset.demo
const phase = (): string | undefined => room().dataset.phase
/** The harmony's lamps, as the lake draws them. */
const lampStates = (): string[] =>
  [
    ...document.querySelectorAll<SVGElement>('[data-testid="harmony-lamp"]'),
  ].map((lamp) => lamp.dataset.state ?? '')

/** The room the moment a tooltip showed. */
interface Moment {
  phase: string | undefined
  take: string | null
  lamps: string[]
  text: string
  answering: boolean
}

interface Seen {
  tips: string[]
  takes: string[]
  phases: string[]
  at: Record<string, Moment>
  /** Merc's bubble while a take sings. */
  bubbleInTakes: string[]
}

const watched = (): Seen => ({
  tips: [],
  takes: [],
  phases: [],
  at: {},
  bubbleInTakes: [],
})

const push = (list: string[], value: string | null | undefined): void => {
  if (value === null || value === undefined || value === '') return
  if (list[list.length - 1] !== value) list.push(value)
}

/** Note what the room shows this frame. */
function note(log: Seen): void {
  const tipEl = part('harmony-demo-tip')
  const tip = tipEl?.dataset.tip
  const take = part('harmony-demo-take')?.textContent ?? undefined
  if (tip !== undefined && !(tip in log.at)) {
    log.at[tip] = {
      phase: phase(),
      take: take ?? null,
      lamps: lampStates(),
      text: tipEl?.textContent ?? '',
      answering: /answering/u.test(partThere('harmony-scene').className),
    }
  }
  push(log.tips, tip)
  push(log.takes, take)
  push(log.phases, phase())
  if (take !== undefined)
    push(log.bubbleInTakes, part('harmony-bubble')?.textContent)
}

/** Advance the fake clock a frame at a time, noting what showed. */
async function run(ms: number, log: Seen = watched()): Promise<Seen> {
  const step = 16
  for (let t = 0; t < ms; t += step) {
    await vi.advanceTimersByTimeAsync(step)
    flushFrames()
    note(log)
  }
  return log
}

/** Open the room; the demo starts by itself on a first visit. */
async function open(): Promise<void> {
  render(() => <HarmonyRoom onDone={() => undefined} />)
  await run(50)
}

/** The ids of Merc's opening lines, said aloud. */
const OPENING = [
  'intro-third',
  'intro-lamps',
  'both-first',
  'together-first',
  'both-together-first',
]

/** The whole demo, played out, with time to spare. */
const WHOLE = 22000

describe('the Harmony demo', () => {
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
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    // A 390 x 844 phone, so the lake is laid out and drawn.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844)
    Object.assign(fake, { acquired: 0, released: 0, windows: 0 })
    fake.audio = 'running'
    Object.assign(sound, { made: 0, sung: [], stops: 0 })
    Object.assign(kept, { history: 0, bests: 0, haptics: 0 })
    voice.sung = []
    marks.list = []
    spoken.said = []
    spoken.hushed = 0
    seen.value = false
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('plays by itself on a first visit: every moment once and in order, each tooltip on its own, nothing kept', async () => {
    await open()
    expect(demoMode()).toBe('idle')
    // The demo says it all: his opening line waits, unsaid.
    expect(spoken.said).toEqual([])

    const log = await run(WHOLE)

    // The room reported each moment exactly once, in the order it sang.
    expect(marks.list).toEqual([
      'off:call',
      'off:land:0',
      'off:miss:1',
      'off:miss:2',
      'off:phraseEnd',
      'off:outcome',
      'on:call',
      'on:land:0',
      'on:land:1',
      'on:land:2',
      'on:phraseEnd',
      'on:outcome',
    ])
    // One tooltip a moment, each once, in the cues' order.
    expect(log.tips).toEqual(['call', 'yours', 'unison', 'harmony'])
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])

    // What each tooltip explains is on the screen as it shows.
    expect(log.at.call).toMatchObject({
      phase: 'call',
      take: DEMO_COPY.off,
      lamps: ['waiting', 'waiting', 'waiting'],
      text: demoCueText('call'),
    })
    expect(log.at.yours).toMatchObject({
      phase: 'sing',
      lamps: ['lit', 'waiting', 'waiting'],
    })
    // Take 1 sang his note: that lamp went dark and Merc sings the pair.
    expect(log.at.unison).toMatchObject({
      phase: 'missed',
      lamps: ['lit', 'missed', 'missed'],
      answering: true,
    })
    expect(log.at.harmony).toMatchObject({
      phase: 'landed',
      take: DEMO_COPY.on,
      lamps: ['lit', 'lit', 'lit'],
      answering: false,
    })
    // His bubble keeps quiet while a take sings: the pill speaks.
    expect(log.bubbleInTakes).toEqual([])

    // The demo's sound sang both takes; the room sang nothing itself.
    expect(sound.sung).toEqual(['off', 'on'])
    expect(voice.sung).toEqual([])
    // It ends on its card, seen, the mic never opened and nothing kept.
    expect(demoMode()).toBe('end')
    expect(seen.value).toBe(true)
    expect([fake.acquired, fake.windows]).toEqual([0, 0])
    expect(kept).toEqual({ history: 0, bests: 0, haptics: 0 })
    expect(spoken.said).toEqual([])
  })

  it('Try it leaves the room at rest, his line shown and unsaid, the mic ready', async () => {
    await open()
    await run(WHOLE)
    expect(demoMode()).toBe('end')
    fireEvent.click(partThere('harmony-demo-try'))
    await run(50)
    expect(demoMode()).toBe('idle')
    expect(phase()).toBe('intro')
    expect(lampStates()).toEqual(['waiting', 'waiting', 'waiting', 'waiting'])
    expect(partThere('harmony-bubble').textContent).not.toBe('')
    expect(spoken.said).toEqual([])
    expect(partThere('harmony-mic').getAttribute('aria-label')).toBe(
      'Start: Merc sings his line, then it is your turn',
    )
  })

  it('stops on Skip, its sound with it, and is seen', async () => {
    await open()
    await run(1200 + 5000)
    expect(demoMode()).toBe('playing')
    expect(phase()).toBe('sing')
    fireEvent.click(partThere('harmony-demo-skip'))
    await run(50)
    expect(demoMode()).toBe('end')
    expect(phase()).toBe('intro')
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(true)
  })

  it('stops when the app goes away and offers itself again, unseen', async () => {
    await open()
    await run(1200 + 5000)
    expect(demoMode()).toBe('playing')
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await run(50)
    expect(demoMode()).toBe('card')
    expect(phase()).toBe('intro')
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(false)
    expect(spoken.said).toEqual([])
  })

  it('leaves a run to the singer once seen: his line aloud, and "?" plays it again', async () => {
    seen.value = true
    await open()
    expect(OPENING).toContain(spoken.said[0])
    await run(3000)
    expect(demoMode()).toBe('idle')
    fireEvent.click(partThere('harmony-ask'))
    await run(200)
    expect(demoMode()).toBe('playing')
    // The demo's words take over from his.
    expect(spoken.hushed).toBeGreaterThan(0)
  })

  it('keeps the mic shut while it plays: a tap on it starts no run', async () => {
    await open()
    await run(1200 + 5000)
    expect(demoMode()).toBe('playing')
    fireEvent.click(partThere('harmony-mic'))
    await run(200)
    expect(demoMode()).toBe('playing')
    expect(fake.acquired).toBe(0)
    // Nor is Merc heard again in the demo's turn.
    expect(part('harmony-hear-again')).toBeNull()
  })

  it('offers a play card when the clock cannot start without a tap', async () => {
    fake.audio = 'none'
    await open()
    await run(3000)
    expect(demoMode()).toBe('card')
    expect(sound.made).toBe(0)
  })
})
