// ============================================================
// A room's first-visit demo and the app going away before it starts
// ============================================================
//
// The real chain from the OS to the demo: the shell's app-state handler
// (native-shell.ts), the one shared clock (packages/audio-io), a room's
// lease on it (room-kit useExerciseCapture.ts) and the demo kit
// (useExerciseDemo.ts). Only the platform's app-state event and the
// AudioContext are stand-ins, and the clocks are fake: a first visit's
// demo starts AUTO_PLAY_MS (1200 ms) after the room opens.
//
// The gap this pins (found by #1044's review, 17 Oct): on a first visit
// the clock does not exist yet when Control Center comes down, so the
// shell's park had nothing to park and the room never heard the app go.
// The timer then fired, the auto-play's unlock built and started the clock
// and the demo played behind Control Center.

import type { AppLifecycleState } from '@irchiinnuss/mobile-runtime/platform'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => {
  const handlers = new Set<(state: 'active' | 'background') => void>()
  return {
    handlers,
    onAppState: (handler: (state: 'active' | 'background') => void) => {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    onBackButton: () => () => undefined,
    minimizeApp: async () => true,
  }
})
vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

import { acquireSharedAudioContext, holdSharedAudioContextInBackground, resetSharedAudioContext, } from '@irchiinnuss/audio-io'
import type { DemoTakeShape } from '@/components/demo-kit/demo-plan'
import type { DemoScript, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import { installNativeShell } from '../infrastructure/native-shell'

const AUTO_PLAY_MS = 1200

/** An AudioContext with a state and nothing behind it. */
class FakeContext extends EventTarget {
  state: AudioContextState = 'suspended'
  readonly destination = {}
  readonly currentTime = 0
  readonly baseLatency = 0
  readonly outputLatency = 0
  readonly resume = vi.fn(async () => {
    if (resumeGate !== null) await resumeGate
    this.become('running')
  })
  readonly suspend = vi.fn(async () => {
    this.become('suspended')
  })
  readonly close = vi.fn(async () => {
    this.become('closed')
  })
  createGain() {
    return {
      gain: { value: 1 },
      connect: () => undefined,
      disconnect: () => undefined,
    }
  }
  private become(state: AudioContextState): void {
    if (this.state === 'closed') return
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

let made: FakeContext[] = []
/** When set, the platform starts the clock only once this resolves. */
let resumeGate: Promise<void> | null = null
/** The one clock, if anybody has built it. */
const clock = (): FakeContext | undefined => made[0]
const running = (): boolean => clock()?.state === 'running'

/** The OS, telling the app it is in front or behind. */
function app(state: AppLifecycleState): void {
  for (const handler of [...platform.handlers]) handler(state)
}

let pageHidden = false

/** The page hidden or shown, as WebKit tells it. */
function page(hidden: boolean): void {
  pageHidden = hidden
  document.dispatchEvent(new Event('visibilitychange'))
}

let reducedMotion = false

/** A take with nothing in it: these tests watch the start, not the takes. */
function emptyTake(id: 'off' | 'on'): DemoTakeShape<'end'> {
  return {
    id,
    frames: [],
    events: [],
    fast: [],
    engineAt: (wall: number) => wall,
    wallAt: (engine: number) => engine,
  } as unknown as DemoTakeShape<'end'>
}

interface Visit {
  readonly demo: ExerciseDemo<'cue', 'mic'>
  /** Demo soundtracks made: one per start with a running clock. */
  readonly sounds: () => number
  readonly tapMic: () => void
  readonly leave: () => void
}

/** A premium room on its first visit (or a later one), as a room wires it. */
function openRoom(firstVisit = true): Visit {
  let sounds = 0
  let demo: ExerciseDemo<'cue', 'mic'> | null = null
  const [moment, setMoment] = createSignal('start')
  const leave = createRoot((dispose) => {
    const capture = useExerciseCapture('demo-away-room', 'Demo away')
    const [active, setActive] = createSignal(false)
    const script: DemoScript<unknown> = {
      active,
      audio: () => capture.audio(),
      note: () => 57,
      enter: () => {
        setActive(true)
        return true
      },
      play: () => undefined,
      rest: () => undefined,
      leave: () => setActive(false),
      playing: () => undefined,
    }
    demo = useExerciseDemo<'cue', 'mic', 'end', DemoTakeShape<'end'>, unknown>({
      room: {
        script,
        phase: () => 'intro',
        noteName: () => 'A3',
        ownNote: () => false,
        moment,
      },
      plan: (note) => ({
        note,
        takes: { off: emptyTake('off'), on: emptyTake('on') },
        total: 20,
      }),
      cues: [],
      beats: { intro: 1, lead: 0.1, afterOff: 1, reset: 1, afterOn: 1 },
      cueText: () => '',
      copy: {
        watch: 'Watch',
        off: 'Not like this',
        on: 'Like this',
        endTitle: 'That is it',
        micHint: 'Tap the mic to start.',
      },
      micTarget: 'mic',
      endMark: 'end',
      clearTipOn: [],
      autoPlays: () => firstVisit,
      markSeen: () => undefined,
      sound: () => {
        sounds += 1
        return {
          lead: 0.1,
          tone: () => undefined,
          sing: () => undefined,
          stop: () => undefined,
        }
      },
      take: () => null,
    })
    return dispose
  })
  return {
    demo: demo as unknown as ExerciseDemo<'cue', 'mic'>,
    sounds: () => sounds,
    tapMic: () => setMoment('take'),
    leave,
  }
}

const run = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms)
}

const stops: (() => void)[] = []

beforeEach(() => {
  vi.useFakeTimers()
  made = []
  resumeGate = null
  pageHidden = false
  reducedMotion = false
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (pageHidden ? 'hidden' : 'visible'),
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: reducedMotion && query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
  resetSharedAudioContext({
    createContext: () => {
      const context = new FakeContext()
      made.push(context)
      return context as unknown as AudioContext
    },
  })
  stops.push(
    registerNativeDevice({
      acquireAudio: (owner: string, options?: object) =>
        acquireSharedAudioContext(owner, options),
      holdAudioInBackground: (owner: string) =>
        holdSharedAudioContextInBackground(owner),
      keepAwake: () => undefined,
    } as unknown as NativeDeviceApi),
    installNativeShell({ history: null }),
  )
})

afterEach(async () => {
  for (const stop of stops.splice(0)) stop()
  // The room's lease outlives its screen by its tail.
  await run(1000)
  resetSharedAudioContext()
  Reflect.deleteProperty(document, 'visibilityState')
  vi.useRealTimers()
})

describe('a first visit, the clock not built yet', () => {
  it('plays by itself after AUTO_PLAY_MS when nobody goes anywhere', async () => {
    const room = openRoom()
    stops.push(room.leave)

    await run(AUTO_PLAY_MS + 50)

    expect(room.demo.mode()).toBe('playing')
    expect(running()).toBe(true)
  })

  it('does not start behind Control Center when the app goes before AUTO_PLAY_MS', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(500)

    // Control Center: iOS says inactive, the page stays visible.
    app('background')
    await run(AUTO_PLAY_MS * 3)

    expect(room.demo.mode()).not.toBe('playing')
    expect(room.sounds()).toBe(0)
    expect(running()).toBe(false)
  })
})

describe('coming back to a demo that had not started', () => {
  it('waits for the singer while the app is away, with no card and no hint', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(500)

    app('background')
    await run(AUTO_PLAY_MS * 3)

    // The room as it was before the pull: the demo is still to come.
    expect(room.demo.mode()).toBe('idle')
    expect(room.demo.tip()).toBeNull()
  })

  it('starts AUTO_PLAY_MS after the app is back, when it went before the timer and came back after it', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(500)
    app('background')
    await run(3000)

    app('active')
    await run(AUTO_PLAY_MS - 1)
    const early = room.demo.mode()
    await run(1)

    expect(early).toBe('idle')
    expect(room.demo.mode()).toBe('playing')
    expect(room.sounds()).toBe(1)
    expect(running()).toBe(true)
  })

  it('starts AUTO_PLAY_MS after the app is back, when it went and came back before the timer', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(300)
    app('background')
    await run(300)
    app('active')

    // The first timer would have fired at 1200 ms: it is gone.
    await run(AUTO_PLAY_MS - 1)
    const early = room.demo.mode()
    await run(1)

    expect(early).toBe('idle')
    expect(room.demo.mode()).toBe('playing')
    expect(running()).toBe(true)
  })

  it('drops a start already waiting for the clock when the app goes, and starts again once back', async () => {
    let platformStarts: () => void = () => undefined
    resumeGate = new Promise((resolve) => {
      platformStarts = resolve
    })
    const room = openRoom()
    stops.push(room.leave)
    // The timer has fired: the auto-play has asked for the clock.
    await run(AUTO_PLAY_MS + 10)
    expect(made).toHaveLength(1)

    app('background')
    platformStarts()
    await run(AUTO_PLAY_MS * 3)
    const away = [room.demo.mode(), room.sounds(), running()]

    resumeGate = null
    app('active')
    await run(AUTO_PLAY_MS)

    // The clock the late answer started was parked again at once.
    expect(away).toEqual(['idle', 0, false])
    expect(room.demo.mode()).toBe('playing')
    expect(running()).toBe(true)
  })

  it('does not start once the singer has moved first after coming back', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(500)
    app('background')
    await run(500)
    app('active')
    await run(300)

    room.tapMic()
    await run(AUTO_PLAY_MS * 3)

    expect(room.demo.mode()).toBe('idle')
    expect(room.sounds()).toBe(0)
  })

  it('behaves the same with reduced motion', async () => {
    reducedMotion = true
    const room = openRoom()
    stops.push(room.leave)
    expect(room.demo.still).toBe(true)
    await run(500)

    app('background')
    await run(AUTO_PLAY_MS * 3)
    const away = room.demo.mode()
    const clockAway = running()
    app('active')
    await run(AUTO_PLAY_MS)

    expect([away, clockAway]).toEqual(['idle', false])
    expect(room.demo.mode()).toBe('playing')
  })
})

describe('the lock screen and the app switcher: the page hides as well', () => {
  it('does not start while away, and starts AUTO_PLAY_MS after the app is active and the page shows', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(500)

    // iOS: inactive first, then the page hides.
    app('background')
    page(true)
    await run(AUTO_PLAY_MS * 3)
    const away = [room.demo.mode(), room.sounds(), running()]

    // Back: active, but the page is not showing yet.
    app('active')
    await run(AUTO_PLAY_MS * 2)
    const activeHidden = room.demo.mode()
    page(false)
    await run(AUTO_PLAY_MS - 1)
    const early = room.demo.mode()
    await run(1)

    expect(away).toEqual(['idle', 0, false])
    expect([activeHidden, early]).toEqual(['idle', 'idle'])
    expect(room.demo.mode()).toBe('playing')
  })

  it('waits for the app to be active when the page shows first', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(500)
    app('background')
    page(true)
    await run(3000)

    page(false)
    await run(AUTO_PLAY_MS * 2)
    const visibleInactive = room.demo.mode()
    app('active')
    await run(AUTO_PLAY_MS)

    expect(visibleInactive).toBe('idle')
    expect(room.demo.mode()).toBe('playing')
  })
})

describe('a later visit: the clock already built', () => {
  it('does not start behind Control Center, nor wake the parked clock, and starts once back', async () => {
    // Another room had the clock and gave it back: it exists, parked.
    const before = acquireSharedAudioContext('earlier-room')
    await before.unlock()
    before.release()
    await run(500)
    expect(clock()?.state).toBe('suspended')

    const room = openRoom()
    stops.push(room.leave)
    await run(500)
    app('background')
    await run(AUTO_PLAY_MS * 3)
    const away = [room.demo.mode(), room.sounds(), clock()?.state]

    app('active')
    await run(AUTO_PLAY_MS)

    expect(away).toEqual(['idle', 0, 'suspended'])
    expect(made).toHaveLength(1)
    expect(room.demo.mode()).toBe('playing')
    expect(running()).toBe(true)
  })
})

describe('a demo that had started', () => {
  it('ends on its card when the app goes, and nothing plays by itself on the way back', async () => {
    const room = openRoom()
    stops.push(room.leave)
    await run(AUTO_PLAY_MS + 50)
    expect(room.demo.mode()).toBe('playing')

    app('background')
    await run(500)
    const away = room.demo.mode()
    app('active')
    await run(AUTO_PLAY_MS * 3)

    expect(away).toBe('card')
    expect(room.demo.mode()).toBe('card')
    expect(room.sounds()).toBe(1)
  })
})
