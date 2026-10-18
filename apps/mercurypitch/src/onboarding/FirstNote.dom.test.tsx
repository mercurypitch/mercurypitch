// ============================================================
// The first note, on screen: hello, one take, a named note, and the ways
// it does not go to plan
// ============================================================
//
// Driven through a stand-in for the room kit's capture and a hand-cranked
// screen frame, so each case says exactly which frames the mic gave.

import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MercView } from '@/components/room-kit/MercView'
import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { CaptureError } from '@/components/room-kit/useExerciseCapture'
import type * as MicSentinel from '@/lib/mic-sentinel'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { TAKE_MAX_SEC, TAKE_SEC } from './first-note'
import { FirstNoteView } from './FirstNoteView'
import { ONBOARDING_COPY } from './onboarding-copy'
import type { FirstNoteController } from './useFirstNote'
import { GREET_MS, useFirstNote } from './useFirstNote'

vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: false,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    setStill: () => undefined,
    destroy: () => undefined,
  }),
}))

// The app's mic watchdog compares the icon with a real stream, and a
// stand-in has none.
vi.mock('@/lib/mic-sentinel', async (importOriginal) => ({
  ...(await importOriginal<typeof MicSentinel>()),
  registerMicIndicator: () => () => undefined,
}))

const GRANT = 'pitchperfect_sing_mic_granted'

// ── A hand-cranked screen frame ──────────────────────────────
let queued = new Map<number, FrameRequestCallback>()
let nextFrame = 1

function flushFrame(): void {
  const now = queued
  queued = new Map()
  for (const callback of now.values()) callback(performance.now())
}

// ── A stand-in for the room kit's capture ────────────────────
interface Stand {
  capture: ExerciseCapture
  calls: { acquire: number; release: number; startWindow: number }
  frames: PitchFrame[]
  answer: () => Promise<void>
}

function stand(): Stand {
  const s: Stand = {
    calls: { acquire: 0, release: 0, startWindow: 0 },
    frames: [],
    answer: async () => Promise.resolve(),
    capture: {
      acquire: async () => {
        s.calls.acquire += 1
        return s.answer()
      },
      release: () => {
        s.calls.release += 1
      },
      held: () => false,
      startWindow: () => {
        s.calls.startWindow += 1
        s.frames = []
      },
      peekFrames: () => [...s.frames],
      takeFrames: () => [...s.frames],
      playTone: async () => Promise.resolve(),
      audio: async () => Promise.resolve(null),
    },
  }
  return s
}

const RATE = 100

/**
 * A take: a second of room, then `hz` to its end. An unvoiced noise (0)
 * runs to the longest take there is: too little voice keeps it open.
 */
function take(hz: number): PitchFrame[] {
  const frames: PitchFrame[] = []
  const end = 1 + (hz > 0 ? TAKE_SEC : TAKE_MAX_SEC) + 0.05
  for (let i = 0; i < end * RATE; i++) {
    const t = i / RATE
    frames.push(
      t < 1
        ? { t, f0: 0, conf: 0, rms: 0.002 }
        : { t, f0: hz, conf: hz > 0 ? 0.95 : 0, rms: 0.12 },
    )
  }
  return frames
}

let view: RenderedShell | null = null
let controller: FirstNoteController | null = null

function show(s: Stand, onFinish: () => void = () => undefined): void {
  const Harness = (): JSX.Element => {
    const note = useFirstNote({ capture: s.capture, still: () => false })
    controller = note
    return (
      <FirstNoteView
        controller={note}
        onFinish={onFinish}
        merc={
          <MercView
            state={note.mercState}
            voice={note.mercVoice}
            testId="onboarding-merc"
          />
        }
      />
    )
  }
  view = renderShell(() => <Harness />)
}

const q = (id: string): HTMLElement | null =>
  view?.container.querySelector(`[data-testid="${id}"]`) ?? null

const line = (): string | null => q('onboarding-line')?.textContent ?? null
const micState = (): string | null =>
  q('onboarding-mic')?.getAttribute('data-state') ?? null

/** Lets the mic's answer land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

async function listen(): Promise<void> {
  q('onboarding-mic')?.click()
  await settle()
  expect(controller?.state().phase).toBe('listen')
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  queued = new Map()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame++
    queued.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queued.delete(id)
  })
  localStorage.clear()
})

afterEach(() => {
  view?.unmount()
  view = null
  controller = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

describe('the first note', () => {
  it('says hello, then asks, with the example labelled and nothing captured', () => {
    const s = stand()
    show(s)
    expect(line()).toBe(ONBOARDING_COPY.hello)
    expect(q('onboarding-example')?.textContent).toBe(ONBOARDING_COPY.example)
    expect(q('onboarding-priming')?.textContent).toBe(ONBOARDING_COPY.listens)
    expect(micState()).toBe('ready')
    expect(q('onboarding-mic')?.getAttribute('aria-label')).toBe(
      ONBOARDING_COPY.sing,
    )
    vi.advanceTimersByTime(GREET_MS)
    expect(line()).toBe(ONBOARDING_COPY.ask)
    expect(q('onboarding-said')?.textContent).toBe(ONBOARDING_COPY.ask)
    // No mic, no clock, no prompt before the tap (REQ-NFL-020).
    expect(s.calls.acquire).toBe(0)
    expect(localStorage.getItem(GRANT)).toBeNull()
  })

  it('opens the mic inside the tap, and remembers the grant', async () => {
    const s = stand()
    show(s)
    q('onboarding-mic')?.click()
    // Inside the tap itself, before anything else runs (REQ-NFL-028).
    expect(s.calls.acquire).toBe(1)
    expect(micState()).toBe('wait')
    await settle()
    expect(micState()).toBe('sing')
    expect(s.calls.startWindow).toBe(1)
    expect(localStorage.getItem(GRANT)).toBe('true')
    // The example gives the lane to the voice.
    expect(q('onboarding-example')).toBeNull()
  })

  it('names the note it heard settle, and Start singing ends the beat', async () => {
    const s = stand()
    const onFinish = vi.fn()
    show(s, onFinish)
    await listen()
    s.frames = take(220)
    flushFrame()
    expect(controller?.state().phase).toBe('heard')
    expect(q('onboarding-note')?.textContent).toBe('A3')
    expect(line()).toBe("That's an A3.")
    expect(s.calls.release).toBeGreaterThan(0)
    expect(q('onboarding-mic')).toBeNull()
    q('onboarding-start-singing')?.click()
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('listens again by itself once, then asks for a tap', async () => {
    const s = stand()
    show(s)
    await listen()
    s.frames = take(0)
    flushFrame()
    // A new window, and Merc says the take wandered.
    expect(controller?.state()).toMatchObject({ phase: 'listen', misses: 1 })
    expect(s.calls.startWindow).toBe(2)
    expect(line()).toBe(ONBOARDING_COPY.wandered)
    s.frames = take(0)
    flushFrame()
    expect(controller?.state().phase).toBe('missed')
    expect(line()).toBe(ONBOARDING_COPY.missed)
    expect(micState()).toBe('ready')
    expect(s.calls.release).toBeGreaterThan(0)
    // The tap tries again.
    q('onboarding-mic')?.click()
    expect(s.calls.acquire).toBe(2)
  })

  it('says why a refused mic did not open, takes the grant back, and tries again', async () => {
    const s = stand()
    localStorage.setItem(GRANT, 'true')
    s.answer = async () => Promise.reject(new CaptureError('denied'))
    show(s)
    q('onboarding-mic')?.click()
    await settle()
    expect(controller?.state()).toMatchObject({
      phase: 'blocked',
      block: 'denied',
    })
    const notice = view?.container.querySelector('[role="alert"]')
    expect(notice?.textContent).toContain('Merc needs the microphone')
    expect(localStorage.getItem(GRANT)).toBe('false')
    // The example line is back, labelled (REQ-NFL-042).
    expect(q('onboarding-example')).not.toBeNull()
    s.answer = async () => Promise.resolve()
    q('onboarding-retry')?.click()
    expect(s.calls.acquire).toBe(2)
    await settle()
    expect(controller?.state().phase).toBe('listen')
  })

  it('stops on a second tap, and goes back to hello', async () => {
    const s = stand()
    show(s)
    await listen()
    q('onboarding-mic')?.click()
    expect(controller?.state().phase).toBe('hello')
    expect(s.calls.release).toBeGreaterThan(0)
    expect(micState()).toBe('ready')
    expect(q('onboarding-example')).not.toBeNull()
  })

  it('goes back to hello when the page hides mid-take', async () => {
    const s = stand()
    show(s)
    await listen()
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockRestore()
    expect(controller?.state().phase).toBe('hello')
    expect(s.calls.release).toBeGreaterThan(0)
  })

  it('shuts the mic at once when the onboarding leaves', async () => {
    const s = stand()
    show(s)
    await listen()
    const released = s.calls.release
    controller?.leave()
    expect(s.calls.release).toBe(released + 1)
  })
})
