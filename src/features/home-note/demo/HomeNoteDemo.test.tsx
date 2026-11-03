// ============================================================
// The Home note demo, played through the room on a fake clock
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
import type * as HomeNoteStoreModule from '@/stores/home-note-store'
import { DEMO_COPY, demoCueText } from './demo-cues'
import type { HomeNoteDemoTake } from './demo-script'

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

// Merc's voice in the room: a run's home would go here, the demo's never.
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
      sing: (take: HomeNoteDemoTake) => sound.sung.push(take.id),
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
vi.mock('@/stores/home-note-store', async () => ({
  ...(await vi.importActual<typeof HomeNoteStoreModule>(
    '@/stores/home-note-store',
  )),
  recordHomeNoteBest: () => {
    kept.bests += 1
    return { previous: null, improved: false }
  },
  homeNoteBest: () => null,
  homeNoteDemoSeen: () => seen.value,
  markHomeNoteDemoSeen: () => {
    seen.value = true
  },
  // The store's rule on this mock's records (no best is ever kept here).
  homeNoteDemoAutoPlays: () => !seen.value,
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

const { HomeNoteRoom } = await import('../HomeNoteRoom')

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

const room = (): HTMLElement => partThere('home-note-room')
const demoMode = (): string | undefined => room().dataset.demo
const phase = (): string | undefined => room().dataset.phase

/** The room the moment a tooltip showed. */
interface Moment {
  phase: string | undefined
  take: string | null
  text: string
  /** The intro's chord lamps under the chip. */
  chords: boolean
  /** The lighthouse's lamp is lit. */
  lit: boolean
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
  const tipEl = part('home-note-demo-tip')
  const tip = tipEl?.dataset.tip
  const take = part('home-note-demo-take')?.textContent ?? undefined
  if (tip !== undefined && !(tip in log.at)) {
    log.at[tip] = {
      phase: phase(),
      take: take ?? null,
      text: tipEl?.textContent ?? '',
      chords: part('home-note-chords') !== null,
      lit: /lit/u.test(partThere('home-note-scene').className),
    }
  }
  push(log.tips, tip)
  push(log.takes, take)
  push(log.phases, phase())
  if (take !== undefined)
    push(log.bubbleInTakes, part('home-note-bubble')?.textContent)
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
  render(() => <HomeNoteRoom onDone={() => undefined} />)
  await run(50)
}

/** The ids of Merc's opening lines, said aloud. */
const OPENING = ['intro-feels', 'intro-karaoke', 'match-after']

/** The whole demo, from its first beat to its end card, ms. */
const WHOLE = 22000
/** Into take 1's turn: the demo's start, its first beat and the band's intro, ms. */
const TO_TURN = 1200 + 4500

describe('the Home note demo', () => {
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
    // A 390 x 844 phone, so the harbour is laid out and drawn.
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
      'off:band',
      'off:turn',
      'off:miss:0',
      'off:outcome',
      'on:band',
      'on:turn',
      'on:land:0',
      'on:outcome',
    ])
    // One tooltip a moment, each once, in the cues' order.
    expect(log.tips).toEqual(['band', 'turn', 'chord', 'home'])
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])

    // What each tooltip explains is on the screen as it shows.
    expect(log.at.band).toMatchObject({
      phase: 'band',
      take: DEMO_COPY.off,
      chords: true,
      text: demoCueText('band'),
    })
    // The band has stopped and its lamps gone: the singer's turn.
    expect(log.at.turn).toMatchObject({ phase: 'sing', chords: false })
    // Take 1 sang the last chord's note: no home, the lamp dark, and Merc
    // sings home.
    expect(log.at.chord).toMatchObject({ phase: 'missed', lit: false })
    expect(log.at.home).toMatchObject({
      phase: 'landed',
      take: DEMO_COPY.on,
      lit: true,
    })
    // His bubble keeps quiet while a take sings: the pill speaks.
    expect(log.bubbleInTakes).toEqual([])

    // The demo's sound played both takes; the room sang nothing itself.
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
    fireEvent.click(partThere('home-note-demo-try'))
    await run(50)
    expect(demoMode()).toBe('idle')
    expect(phase()).toBe('intro')
    expect(part('home-note-chords')).toBeNull()
    expect(partThere('home-note-bubble').textContent).not.toBe('')
    expect(spoken.said).toEqual([])
    expect(partThere('home-note-mic').getAttribute('aria-label')).toBe(
      'Start: hear the band, then sing home',
    )
  })

  it('stops on Skip, its sound with it, and is seen', async () => {
    await open()
    await run(TO_TURN)
    expect(demoMode()).toBe('playing')
    expect(phase()).toBe('sing')
    fireEvent.click(partThere('home-note-demo-skip'))
    await run(50)
    expect(demoMode()).toBe('end')
    expect(phase()).toBe('intro')
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(true)
  })

  it('stops when the app goes away and offers itself again, unseen', async () => {
    await open()
    await run(TO_TURN)
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
    fireEvent.click(partThere('home-note-ask'))
    await run(200)
    expect(demoMode()).toBe('playing')
    // The demo's words take over from his.
    expect(spoken.hushed).toBeGreaterThan(0)
  })

  it('keeps the mic shut while it plays: a tap on it starts no run', async () => {
    await open()
    await run(TO_TURN)
    expect(demoMode()).toBe('playing')
    fireEvent.click(partThere('home-note-mic'))
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
