// ============================================================
// The First note demo, played through the room on a fake clock
// ============================================================
//
// The room with its demo: timers, performance.now() and animation frames
// advance together, so the two takes play through the room's own
// controller, entry rule and sequence engine exactly as they do on a
// phone. The demo kit's take clock is wrapped to record every moment the
// room reports, so each tooltip's moment is seen to happen once, in order,
// where the room really reached it. The mic, Merc's renderer, his voice,
// the demo's sound and band, his spoken lines and what a run keeps are
// stand-ins that count.

import { cleanup, fireEvent, render, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PlanModule from '@/components/demo-kit/demo-plan'
import type * as SpeechModule from '@/components/room-kit/merc-speech'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type * as FirstNoteStoreModule from '@/stores/first-note-store'
import { DEMO_COPY, demoCueText } from './demo-cues'
import type { FirstNoteDemoTake } from './demo-script'

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

// The singer's own songs: none, so the room plays the examples.
vi.mock('@/features/karaoke-room/karaoke-room-library', () => ({
  roomLibrary: () => [],
  hydrateSong: () => Promise.reject(new Error('no songs here')),
}))

// The song player: a run's band would go here, the demo's never.
const player = vi.hoisted(() => ({ made: 0 }))
vi.mock('../song-player', () => ({
  createSongPlayer: () => {
    player.made += 1
    return {
      leadIn: () => {
        throw new Error('the demo plays no song of its own')
      },
      line: () => {
        throw new Error('the demo plays no song of its own')
      },
      dispose: () => undefined,
    }
  },
}))

// Merc's voice in the room: a run's note would go here, the demo's never.
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

// ── The demo's band and sound, recorded rather than played ─────

const band = vi.hoisted(() => ({ loads: 0, buffer: { duration: 8 } }))
vi.mock('./demo-band', () => ({
  loadDemoBand: () => {
    band.loads += 1
    return Promise.resolve(band.buffer)
  },
  demoBand: () => (band.loads > 0 ? band.buffer : null),
}))

const sound = vi.hoisted(() => ({
  made: 0,
  sung: [] as string[],
  stops: 0,
  bands: [] as unknown[],
}))
vi.mock('./demo-sound', () => ({
  createDemoSound: (
    _ctx: AudioContext,
    _lead: number,
    _voice: unknown,
    clip: unknown,
  ) => {
    sound.made += 1
    sound.bands.push(clip)
    let stopped = false
    return {
      lead: 0.12,
      tone: () => undefined,
      sing: (take: FirstNoteDemoTake) => sound.sung.push(take.id),
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
vi.mock('@/stores/first-note-store', async () => ({
  ...(await vi.importActual<typeof FirstNoteStoreModule>(
    '@/stores/first-note-store',
  )),
  recordFirstNoteBest: () => {
    kept.bests += 1
    return { previous: null, improved: false }
  },
  firstNoteDemoSeen: () => seen.value,
  markFirstNoteDemoSeen: () => {
    seen.value = true
  },
  // The store's rule on this mock's records (no best is ever kept here).
  firstNoteDemoAutoPlays: () => !seen.value,
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

const { FirstNoteRoom } = await import('../FirstNoteRoom')

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

const room = (): HTMLElement => partThere('first-note-room')
const demoMode = (): string | undefined => room().dataset.demo
const phase = (): string | undefined => room().dataset.phase

/** The room the moment a tooltip showed. */
interface Moment {
  phase: string | undefined
  take: string | null
  text: string
  /** The lead-in's countdown is up. */
  countdown: boolean
  /** The note's line shows. */
  line: string | undefined
  /** The band of light is lit. */
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
  const tipEl = part('first-note-demo-tip')
  const tip = tipEl?.dataset.tip
  const take = part('first-note-demo-take')?.textContent ?? undefined
  if (tip !== undefined && !(tip in log.at)) {
    const scene = partThere('first-note-scene')
    log.at[tip] = {
      phase: phase(),
      take: take ?? null,
      text: tipEl?.textContent ?? '',
      countdown: part('first-note-countdown') !== null,
      line: scene.dataset.line,
      lit: /lit/u.test(scene.className),
    }
  }
  push(log.tips, tip)
  push(log.takes, take)
  push(log.phases, phase())
  if (take !== undefined)
    push(log.bubbleInTakes, part('first-note-bubble')?.textContent)
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
  render(() => <FirstNoteRoom onDone={() => undefined} />)
  await run(50)
}

/** The whole demo, from its first beat to its end card, ms. */
const WHOLE = 31000
/** Into take 1's turn: the demo's start, its first beat and the band's lead-in, ms. */
const TO_TURN = 1200 + 9600

describe('the First note demo', () => {
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
    // A 390 x 844 phone, so the stage is laid out and drawn.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844)
    Object.assign(fake, { acquired: 0, released: 0, windows: 0 })
    fake.audio = 'running'
    Object.assign(sound, { made: 0, sung: [], stops: 0, bands: [] })
    Object.assign(kept, { history: 0, bests: 0, haptics: 0 })
    band.loads = 0
    player.made = 0
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
      'off:entry',
      'off:miss:0',
      'off:outcome',
      'on:band',
      'on:turn',
      'on:entry',
      'on:land:0',
      'on:outcome',
    ])
    // One tooltip a moment, each once, in the cues' order.
    expect(log.tips).toEqual(['band', 'turn', 'low', 'sings', 'lands'])
    expect(log.takes).toEqual([DEMO_COPY.off, DEMO_COPY.on])

    // What each tooltip explains is on the screen as it shows.
    expect(log.at.band).toMatchObject({
      phase: 'band',
      take: DEMO_COPY.off,
      countdown: true,
      line: 'hidden',
      text: demoCueText('band'),
    })
    // The band has stopped and its countdown gone: the singer's turn.
    expect(log.at.turn).toMatchObject({ phase: 'sing', countdown: false })
    // Take 1 came in: the line shows over a voice under it, dark.
    expect(log.at.low).toMatchObject({
      phase: 'sing',
      line: 'shown',
      lit: false,
    })
    // The silence after it decides the round, and Merc sings the note.
    expect(log.at.sings).toMatchObject({ phase: 'missed', lit: false })
    expect(log.at.lands).toMatchObject({
      phase: 'landed',
      take: DEMO_COPY.on,
      line: 'shown',
      lit: true,
    })
    // His bubble keeps quiet while a take sings: the pill speaks.
    expect(log.bubbleInTakes).toEqual([])

    // The band's clip was loaded before the takes, and played with them.
    expect(band.loads).toBeGreaterThan(0)
    expect(sound.bands).toEqual([band.buffer])
    expect(sound.sung).toEqual(['off', 'on'])
    // The room played no song and sang nothing itself.
    expect(player.made).toBe(0)
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
    fireEvent.click(partThere('first-note-demo-try'))
    await run(50)
    expect(demoMode()).toBe('idle')
    expect(phase()).toBe('intro')
    expect(part('first-note-countdown')).toBeNull()
    expect(part('first-note-song')).toBeNull()
    expect(partThere('first-note-bubble').textContent).not.toBe('')
    expect(spoken.said).toEqual([])
    expect(partThere('first-note-mic').getAttribute('aria-label')).toBe(
      "Start: hear the band, then come in on the singer's first note",
    )
  })

  it('stops on Skip, its sound with it, and is seen', async () => {
    await open()
    await run(TO_TURN)
    expect(demoMode()).toBe('playing')
    expect(phase()).toBe('sing')
    fireEvent.click(partThere('first-note-demo-skip'))
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

  it('never plays by itself in the Warm-up, even on a first visit: his cue aloud, and "?" still plays it', async () => {
    render(() => (
      <FirstNoteRoom
        onDone={() => undefined}
        routine={{
          index: 4,
          count: 5,
          settledNote: null,
          finish: () => undefined,
          skip: () => undefined,
        }}
      />
    ))
    await run(3000)
    expect(demoMode()).toBe('idle')
    expect(spoken.said).toEqual(['routine-stop'])
    expect(seen.value).toBe(false)

    // The kit's "?" in a stop (RoomShell.tsx): straight to the demo, with
    // no sheet before it.
    expect(part('first-note-help')).toBeNull()
    fireEvent.click(partThere('first-note-ask'))
    await run(200)
    expect(demoMode()).toBe('playing')
    expect(part('first-note-skip-stop')).toBeNull()
  })

  it('leaves a run to the singer once seen: his line aloud, and the help plays it again', async () => {
    seen.value = true
    await open()
    expect(spoken.said).toHaveLength(1)
    await run(3000)
    expect(demoMode()).toBe('idle')
    // "?" opens the help first; the demo plays from it.
    expect(part('first-note-ask')).toBeNull()
    fireEvent.click(partThere('first-note-help'))
    const sheet = partThere('first-note-help-sheet')
    fireEvent.click(within(sheet).getByTestId('first-note-help-watch'))
    await run(200)
    expect(demoMode()).toBe('playing')
    expect(part('first-note-help-sheet')).toBeNull()
    // The demo's words take over from his.
    expect(spoken.hushed).toBeGreaterThan(0)
  })

  it('keeps the mic shut while it plays: a tap on it starts no run', async () => {
    await open()
    await run(TO_TURN)
    expect(demoMode()).toBe('playing')
    fireEvent.click(partThere('first-note-mic'))
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
