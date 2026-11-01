// ============================================================
// useLongNoteController: a mic that answers after the singer moved on
// ============================================================
//
// In a browser the mic's permission prompt does not hold the page: while
// it is up the singer can tap Stop, watch the demo or start again, and
// answer it later. That answer belongs to a start that no longer stands,
// and the room must not act on it: not on the demo's take, not on Merc,
// and not on the take the singer started since. (The iOS prompt is modal,
// so a phone never gets this far.)
//
// The room runs on a capture whose mic waits until the test answers it,
// one promise per acquisition. The demo's take is the room's own take 1
// (demo-script.ts) on the demo kit's clock, as useLongNoteDemo builds it.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { takeClock } from '@/components/demo-kit/demo-plan'
import { setExerciseLevel } from '@/stores/exercise-level'
import { demoTake } from './demo/demo-script'
import type { LongNoteController } from './long-note-controller-types'
import type { ScriptedTake } from './scripted-take'
import type * as CaptureModule from './useLongNoteCapture'

const fake = vi.hoisted(() => ({
  /** Each acquisition of the mic, answered by the test. */
  mics: [] as {
    resolve: () => void
    reject: (error: unknown) => void
  }[],
  /** Takes opened on the mic's frames (`startWindow`). */
  windows: 0,
}))

vi.mock('./useLongNoteCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>(
    './useLongNoteCapture',
  )
  return {
    ...actual,
    useLongNoteCapture: () => ({
      acquire: () =>
        new Promise<void>((resolve, reject) => {
          fake.mics.push({ resolve, reject })
        }),
      release: () => undefined,
      held: () => true,
      startWindow: () => {
        fake.windows += 1
      },
      peekFrames: () => [],
      takeFrames: () => [],
      playTone: () => Promise.resolve(),
      audio: () => Promise.resolve(null),
    }),
  }
})

// A3 from a voiceprint, and nothing held before: the room opens on A3, so
// every start plays its note before the mic opens.
vi.mock('@/lib/hold/load-hold-target', () => ({
  loadHoldTarget: () => ({ midi: 57, source: 'voiceprint' }),
}))
vi.mock('./remembered-note', () => ({
  rememberedLongNote: () => null,
  chosenLongNote: () => null,
  rememberLongNote: () => undefined,
}))

const { useLongNoteController } = await import('./useLongNoteController')
const { CaptureError } = await import('./useLongNoteCapture')

let frames: FrameRequestCallback[] = []
let screens: (() => void)[] = []

/** The room's controller, mounted as its screen would mount it. */
function mountRoom(): LongNoteController {
  let room: LongNoteController | null = null
  screens.push(
    createRoot((dispose) => {
      room = useLongNoteController()
      return dispose
    }),
  )
  if (room === null) throw new Error('the room did not mount')
  return room
}

/** Every promise step settled, the note's and the mic's. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

/** `ms` of screen frames, 60 a second, on the fake clock. */
function playFor(ms: number): void {
  for (let i = 0; i < Math.round((ms * 60) / 1000); i++) {
    const due = frames
    frames = []
    for (const frame of due) frame(performance.now())
    vi.advanceTimersByTime(1000 / 60)
  }
}

/** The demo's take 1 on A3, starting now. */
function demoTakeNow(): ScriptedTake {
  const take = demoTake('off', 57)
  return {
    targetMidi: 57,
    preset: take.preset,
    toResult: false,
    after: 'idle',
    still: false,
    ...takeClock(take, performance.now(), () => undefined),
  }
}

/** Start, the mic's prompt up, then Stop: the start no longer stands. */
async function startThenStop(room: LongNoteController): Promise<void> {
  room.start()
  await settle()
  room.stop()
}

beforeEach(() => {
  localStorage.clear()
  setExerciseLevel('singer')
  fake.mics = []
  fake.windows = 0
  frames = []
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

afterEach(() => {
  for (const dispose of screens) dispose()
  screens = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useLongNoteController: a mic answer for a start the singer left', () => {
  it("leaves the demo's take as it is when the mic of a stopped start opens", async () => {
    const room = mountRoom()
    await startThenStop(room)
    room.script.enter('How it works')
    room.script.play(demoTakeNow())
    // The take's breath before its note: the demo's take listens.
    playFor(300)
    const held = room.hold()
    const traced = room.trace.all().length

    fake.mics[0].resolve()
    await settle()

    expect(held.clock).toBeGreaterThan(0.2)
    expect(traced).toBeGreaterThan(0)
    expect(room.state().phase).toBe('listen')
    expect(room.line()).toBe('How it works')
    expect(room.hold()).toBe(held)
    expect(room.trace.all()).toHaveLength(traced)
  })

  it('leaves Merc as the demo has him when the mic of a stopped start is refused', async () => {
    const room = mountRoom()
    await startThenStop(room)
    room.script.enter('How it works')
    room.script.play(demoTakeNow())
    const face = room.mercState()

    fake.mics[0].reject(new CaptureError('denied', 'Long note'))
    await settle()

    expect(face).toBe('listen')
    expect(room.mercState()).toBe('listen')
  })

  it("opens the singer's next take once when the start before it gets its mic late", async () => {
    const room = mountRoom()
    await startThenStop(room)
    room.start()
    await settle()
    fake.mics[1].resolve()
    await settle()
    playFor(2000)

    fake.mics[0].resolve()
    await settle()

    expect(room.state().phase).toBe('listen')
    expect(fake.windows).toBe(1)
    expect(room.now()).toBeCloseTo(2, 1)
  })
})
