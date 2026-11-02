// ============================================================
// The Leap demo, played through the room on a fake clock
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
import type * as LeapStoreModule from '@/stores/leap-store'
import { DEMO_COPY, demoCueText } from './demo-cues'
import type { LeapDemoTake } from './demo-script'

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
      sing: (take: LeapDemoTake) => sound.sung.push(take.id),
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
vi.mock('@/stores/leap-store', async () => ({
  ...(await vi.importActual<typeof LeapStoreModule>('@/stores/leap-store')),
  recordLeapBest: () => {
    kept.bests += 1
    return { previous: null, improved: false }
  },
  leapBest: () => null,
  leapDemoSeen: () => seen.value,
  markLeapDemoSeen: () => {
    seen.value = true
  },
  // The store's rule on this mock's records (no best is ever kept here).
  leapDemoAutoPlays: () => !seen.value,
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

const { LeapRoom } = await import('../LeapRoom')

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

const room = (): HTMLElement => partThere('leap-room')
const demoMode = (): string | undefined => room().dataset.demo
const phase = (): string | undefined => room().dataset.phase

/** The room the moment a tooltip showed. */
interface Moment {
  phase: string | undefined
  take: string | null
  lamp: string | null
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
  const tipEl = part('leap-demo-tip')
  const tip = tipEl?.dataset.tip
  const take = part('leap-demo-take')?.textContent ?? undefined
  if (tip !== undefined && !(tip in log.at)) {
    log.at[tip] = {
      phase: phase(),
      take: take ?? null,
      lamp: part('leap-lamp')?.dataset.lamp ?? null,
      text: tipEl?.textContent ?? '',
      answering: /answering/u.test(partThere('leap-scene').className),
    }
  }
  push(log.tips, tip)
  push(log.takes, take)
  push(log.phases, phase())
  if (take !== undefined)
    push(log.bubbleInTakes, part('leap-bubble')?.textContent)
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
  render(() => <LeapRoom onDone={() => undefined} />)
  await run(50)
}

/** The ids of Merc's opening lines, said aloud. */
const OPENING = ['intro-ledges', 'intro-lantern']

describe('the Leap demo', () => {
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
    // A 390 x 844 phone, so the cliffs are laid out and drawn.
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

    const log = await run(19000)

    // The room reported each moment exactly once, in the order it sang.
    expect(marks.list).toEqual([
      'off:call',
      'off:land:0',
      'off:miss:1',
      'off:outcome',
      'on:call',
      'on:land:0',
      'on:land:1',
      'on:outcome',
    ])
    // One tooltip a moment, each once, in the cues' order.
    expect(log.tips).toEqual(['call', 'leap', 'short', 'lands'])
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])

    // What each tooltip explains is on the screen as it shows.
    expect(log.at.call).toMatchObject({
      phase: 'call',
      take: DEMO_COPY.off,
      lamp: 'toCome',
      text: demoCueText('call'),
    })
    expect(log.at.leap).toMatchObject({ phase: 'sing', lamp: 'toCome' })
    // Take 1 fell short: the lamp went out and Merc sings both notes.
    expect(log.at.short).toMatchObject({
      phase: 'missed',
      lamp: 'missed',
      answering: true,
    })
    expect(log.at.lands).toMatchObject({
      phase: 'landed',
      take: DEMO_COPY.on,
      lamp: 'landed',
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
    await run(19000)
    expect(demoMode()).toBe('end')
    fireEvent.click(partThere('leap-demo-try'))
    await run(50)
    expect(demoMode()).toBe('idle')
    expect(phase()).toBe('intro')
    expect(part('leap-lamp')).toBeNull()
    expect(partThere('leap-bubble').textContent).not.toBe('')
    expect(spoken.said).toEqual([])
    expect(partThere('leap-mic').getAttribute('aria-label')).toBe(
      "Start: hear Merc's note, then leap",
    )
  })

  it('stops on Skip, its sound with it, and is seen', async () => {
    await open()
    await run(1200 + 3000)
    expect(demoMode()).toBe('playing')
    expect(phase()).toBe('sing')
    fireEvent.click(partThere('leap-demo-skip'))
    await run(50)
    expect(demoMode()).toBe('end')
    expect(phase()).toBe('intro')
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(true)
  })

  it('stops when the app goes away and offers itself again, unseen', async () => {
    await open()
    await run(1200 + 3000)
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
    fireEvent.click(partThere('leap-ask'))
    await run(200)
    expect(demoMode()).toBe('playing')
    // The demo's words take over from his.
    expect(spoken.hushed).toBeGreaterThan(0)
  })

  it('keeps the mic shut while it plays: a tap on it starts no run', async () => {
    await open()
    await run(1200 + 3000)
    expect(demoMode()).toBe('playing')
    fireEvent.click(partThere('leap-mic'))
    await run(200)
    expect(demoMode()).toBe('playing')
    expect(fake.acquired).toBe(0)
  })

  it('offers a play card when the clock cannot start without a tap', async () => {
    fake.audio = 'none'
    await open()
    await run(3000)
    expect(demoMode()).toBe('card')
    expect(sound.made).toBe(0)
  })
})
