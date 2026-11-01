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
import { CaptureError } from '@/components/room-kit/useExerciseCapture'
import type * as MicSentinel from '@/lib/mic-sentinel'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { FirstNoteView, noteSays } from './FirstNoteView'
import type { Stand } from './onboarding-capture.test-fixtures'
import { flushFrame, noteTake, settle, stand, stubFrames, } from './onboarding-capture.test-fixtures'
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

let view: RenderedShell | null = null
let controller: FirstNoteController | null = null

interface Ways {
  onRange: () => void
  onSkip: () => void
  onWithoutMic?: () => void
}

function show(
  s: Stand,
  ways: Ways = { onRange: () => undefined, onSkip: () => undefined },
  greeted = false,
): void {
  const Harness = (): JSX.Element => {
    const note = useFirstNote({
      capture: s.capture,
      still: () => false,
      greeted,
    })
    controller = note
    return (
      <FirstNoteView
        controller={note}
        line={noteSays(note)}
        onRange={() => ways.onRange()}
        onSkip={() => ways.onSkip()}
        onWithoutMic={ways.onWithoutMic}
        skipped={false}
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

async function listen(): Promise<void> {
  q('onboarding-mic')?.click()
  await settle()
  expect(controller?.state().phase).toBe('listen')
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  stubFrames()
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
  it("asks at once after Merc's hello in the alley: no second drop, no second hello", () => {
    const s = stand()
    show(s, undefined, true)

    expect(line()).toBe(ONBOARDING_COPY.ask)
    expect(controller?.mercState()).toBe('idle')
    vi.advanceTimersByTime(GREET_MS)
    expect(line()).toBe(ONBOARDING_COPY.ask)
    expect(s.calls.acquire).toBe(0)
  })

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

  it('names the note it heard settle, and offers Find my range or Skip for now', async () => {
    const s = stand()
    const ways = { onRange: vi.fn(), onSkip: vi.fn() }
    show(s, ways)
    await listen()
    s.frames = noteTake(220)
    flushFrame()
    expect(controller?.state().phase).toBe('heard')
    expect(q('onboarding-note')?.textContent).toBe('A3')
    expect(line()).toBe("That's an A3.")
    expect(s.calls.release).toBeGreaterThan(0)
    expect(q('onboarding-mic')).toBeNull()
    expect(q('onboarding-find-range')?.textContent).toBe(
      ONBOARDING_COPY.findRange,
    )
    expect(q('onboarding-skip')?.textContent).toBe(ONBOARDING_COPY.skip)
    // What the name means, and what Find my range is, before either is asked.
    expect(q('onboarding-note-meaning')?.textContent).toBe(
      'A3 is the name of the note you sang. Higher notes get higher numbers.',
    )
    expect(q('onboarding-range-how')?.textContent).toBe(
      ONBOARDING_COPY.findRangeHow,
    )
    expect(q('onboarding-find-range')?.getAttribute('aria-describedby')).toBe(
      q('onboarding-range-how')?.id,
    )
    q('onboarding-find-range')?.click()
    q('onboarding-skip')?.click()
    expect(ways.onRange).toHaveBeenCalledTimes(1)
    expect(ways.onSkip).toHaveBeenCalledTimes(1)
  })

  it('listens again by itself once, then asks for a tap', async () => {
    const s = stand()
    const withoutMic = vi.fn()
    show(s, {
      onRange: () => undefined,
      onSkip: () => undefined,
      onWithoutMic: withoutMic,
    })
    await listen()
    s.frames = noteTake(0)
    flushFrame()
    // A new window, and Merc says the take wandered.
    expect(controller?.state()).toMatchObject({ phase: 'listen', misses: 1 })
    expect(s.calls.startWindow).toBe(2)
    expect(line()).toBe(ONBOARDING_COPY.wandered)
    s.frames = noteTake(0)
    flushFrame()
    expect(controller?.state().phase).toBe('missed')
    expect(line()).toBe(ONBOARDING_COPY.missed)
    expect(micState()).toBe('ready')
    expect(s.calls.release).toBeGreaterThan(0)
    // A mic that opens and cannot hear the singer is no dead end: on
    // without it, as a refused mic goes, and only while the mic is down.
    expect(q('onboarding-without-mic')?.textContent).toBe(
      ONBOARDING_COPY.withoutMic,
    )
    q('onboarding-without-mic')?.click()
    expect(withoutMic).toHaveBeenCalledTimes(1)
    // The tap tries again, and the way on without the mic stands aside.
    q('onboarding-mic')?.click()
    expect(s.calls.acquire).toBe(2)
    expect(q('onboarding-without-mic')).toBeNull()
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
    // Merc says why himself; the notice under him is only its ways back.
    expect(line()).toBe(ONBOARDING_COPY.micOff)
    expect(view?.container.querySelector('[role="alert"]')).toBeNull()
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
    expect(controller?.state().phase).toBe('hello')
  })

  it('drops a mic still opening when the onboarding leaves', async () => {
    const s = stand()
    let open = (): void => undefined
    s.answer = async () =>
      new Promise<void>((resolve) => {
        open = resolve
      })
    show(s)
    q('onboarding-mic')?.click()
    await settle()
    expect(controller?.state().phase).toBe('starting')

    controller?.leave()
    expect(controller?.state().phase).toBe('hello')
    open()
    await settle()

    expect(controller?.state().phase).toBe('hello')
    expect(s.calls.startWindow).toBe(0)
  })
})
