// ============================================================
// The range, on screen: two slides, the pins, and the ways it does not
// go to plan
// ============================================================
//
// Driven through the stand-in capture and a hand-cranked screen frame
// (onboarding-capture.test-fixtures.ts), so each case says exactly which
// frames the mic gave each slide.

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MercView } from '@/components/room-kit/MercView'
import { CaptureError } from '@/components/room-kit/useExerciseCapture'
import type * as MicSentinel from '@/lib/mic-sentinel'
import type { RangeResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { keepableVoiceprint } from '../shell/settings/keep-voiceprint'
import type { Stand } from './onboarding-capture.test-fixtures'
import { flushFrame, settle, stand, stubFrames, } from './onboarding-capture.test-fixtures'
import { ONBOARDING_COPY } from './onboarding-copy'
import { glide, heldWindow, noiseWindow, room, slideWindow, } from './range-frames.test-fixtures'
import { SLIDE_MAX_SEC } from './range-take'
import { rangeSays, RangeView } from './RangeView'
import type { RangeController, RangeOptions } from './useRange'
import { useRange } from './useRange'

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
let controller: RangeController | null = null

interface Show {
  /** The note the first beat held, MIDI, as it stands when read. */
  anchor?: () => number | null
  onMeasured?: RangeOptions['onMeasured']
  onSkip?: () => void
  onSee?: () => void
}

function show(s: Stand, opts: Show = {}): void {
  const Harness = (): JSX.Element => {
    const range = useRange({
      capture: s.capture,
      still: () => false,
      anchor: opts.anchor,
      onMeasured: opts.onMeasured,
    })
    controller = range
    return (
      <RangeView
        controller={range}
        line={rangeSays(range)}
        onSee={() => opts.onSee?.()}
        onSkip={opts.onSkip}
        skipped={false}
        merc={
          <MercView
            state={range.mercState}
            voice={range.mercVoice}
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
const midis = (selector: string): number[] =>
  [...(view?.container.querySelectorAll(selector) ?? [])].map((rung) =>
    Number(rung.getAttribute('data-midi')),
  )
/** Every rung, bottom to top, as the note it stands at. */
const rungs = (): number[] => midis('[data-midi]')
/** The rungs lit. */
const lit = (): number[] => midis('[data-midi][data-lit="on"]')

/** The mic tapped and open: the first slide is read. */
async function listen(): Promise<void> {
  q('onboarding-mic')?.click()
  await settle()
  expect(controller?.state().phase).toBe('down')
}

/** Both slides, E3 down to E2 and A2 up to G4. */
function slideBoth(s: Stand): void {
  s.frames = slideWindow(52, 40)
  flushFrame()
  s.frames = slideWindow(45, 67)
  flushFrame()
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

describe('the range', () => {
  it('asks for the slide down and waits for a tap, with nothing captured', () => {
    const s = stand()

    show(s)

    expect(line()).toBe(ONBOARDING_COPY.slideDown)
    expect(micState()).toBe('ready')
    expect(q('onboarding-mic')?.getAttribute('aria-label')).toBe(
      ONBOARDING_COPY.findRange,
    )
    expect(q('onboarding-priming')?.textContent).toBe(ONBOARDING_COPY.listens)
    expect(q('onboarding-skip')).toBeNull()
    expect(s.calls.acquire).toBe(0)
    expect(localStorage.getItem(GRANT)).toBeNull()
  })

  it('opens the mic inside start, and reads the slide down once it is open', async () => {
    const s = stand()
    show(s)

    controller?.start()
    // Inside the call itself, as Find my range's tap makes it (REQ-NFL-028).
    expect(s.calls.acquire).toBe(1)
    expect(micState()).toBe('wait')
    await settle()

    expect(micState()).toBe('sing')
    expect(s.calls.startWindow).toBe(1)
    expect(localStorage.getItem(GRANT)).toBe('true')
  })

  it('has Merc climb with the voice: his reach, high on the ladder for a high note, low for a low one', async () => {
    const s = stand()
    show(s)
    await listen()
    expect(controller?.mercState()).toBe('reach')

    s.frames = [...room(0, 1), ...glide(1, 64, 64, 1)]
    flushFrame()
    const high = controller?.mercVoice()
    s.frames = [...room(0, 1), ...glide(1, 47, 47, 1)]
    flushFrame()
    const low = controller?.mercVoice()

    expect(controller?.state().phase).toBe('down')
    expect(high?.voiced).toBe(true)
    expect(high?.cents ?? 0).toBeGreaterThan(200)
    expect(low?.voiced).toBe(true)
    expect(low?.cents ?? 0).toBeLessThan(-200)
  })

  it('measures the two slides: E2 to G4, the pins locked and See my voice', async () => {
    const s = stand()
    const onSee = vi.fn()
    show(s, { onMeasured: () => undefined, onSee })
    await listen()

    s.frames = slideWindow(52, 40)
    flushFrame()
    // The second slide in a window of its own, the low pin already down.
    expect(controller?.state().phase).toBe('up')
    expect(s.calls.startWindow).toBe(2)
    expect(line()).toBe(ONBOARDING_COPY.slideUp)
    expect(q('onboarding-pin-low')?.textContent).toBe('E2')
    s.frames = slideWindow(45, 67)
    flushFrame()

    expect(controller?.state().phase).toBe('done')
    expect(line()).toBe("E2 to G4. That's your range today.")
    expect(q('onboarding-pin-low')?.textContent).toBe('E2')
    expect(q('onboarding-pin-high')?.textContent).toBe('G4')
    expect(q('onboarding-ladder')?.getAttribute('data-locked')).toBe('on')
    // Every rung from the low pin's to the high pin's, and no other.
    expect(lit()).toEqual(rungs().filter((midi) => midi >= 39 && midi <= 67))
    expect(q('onboarding-mic')).toBeNull()
    expect(s.calls.release).toBeGreaterThan(0)
    q('onboarding-see-voice')?.click()
    expect(onSee).toHaveBeenCalledTimes(1)
  })

  it('keeps a measured range as the voiceprint Keep shows, twin and all', async () => {
    const s = stand()
    show(s)
    await listen()

    slideBoth(s)
    await settle()

    const range = controller?.state().range as RangeResult
    expect(keepableVoiceprint()).toEqual({
      lowMidi: 40,
      highMidi: 67,
      twin: singerForRange(range),
    })
  })

  it('calls one held note narrow: the mic shut, and a tap slides again', async () => {
    const s = stand()
    const onMeasured = vi.fn()
    show(s, { onMeasured })
    await listen()

    s.frames = heldWindow(57)
    flushFrame()
    s.frames = heldWindow(57)
    flushFrame()

    expect(controller?.state()).toMatchObject({
      phase: 'missed',
      miss: 'narrow',
    })
    expect(line()).toBe(ONBOARDING_COPY.narrow)
    expect(micState()).toBe('ready')
    expect(onMeasured).not.toHaveBeenCalled()
    q('onboarding-mic')?.click()
    expect(s.calls.acquire).toBe(2)
  })

  it('finds no range in sound with no pitch in it, and says it could not follow', async () => {
    const s = stand()
    show(s)
    await listen()

    s.frames = noiseWindow(SLIDE_MAX_SEC + 0.2)
    flushFrame()
    s.frames = noiseWindow(SLIDE_MAX_SEC + 0.2)
    flushFrame()

    expect(controller?.state()).toMatchObject({
      phase: 'missed',
      miss: 'unheard',
    })
    expect(line()).toBe(ONBOARDING_COPY.unheard)
  })

  it('nudges a slide that has waited nine seconds for a voice', async () => {
    const s = stand()
    show(s)
    await listen()

    s.frames = room(0, 9.2)
    flushFrame()

    expect(line()).toBe(ONBOARDING_COPY.slideDownNudge)
  })

  it('centres the ladder on the note the first beat held, named after it was made', () => {
    const s = stand()
    const [held, setHeld] = createSignal<number | null>(null)
    show(s, { anchor: held })

    setHeld(40)
    controller?.start()

    expect(rungs()[0]).toBe(28)
    expect(rungs().at(-1)).toBe(52)
  })

  it('stops on a second tap: back to ready, the mic shut, nothing lit', async () => {
    const s = stand()
    show(s)
    await listen()
    s.frames = [...room(0, 1), ...glide(1, 52, 44, 1.5)]
    flushFrame()
    // On the way down, only the low pin: the high one waits for the slide up.
    expect(q('onboarding-pin-low')).not.toBeNull()
    expect(q('onboarding-pin-high')).toBeNull()
    expect(lit().length).toBeGreaterThan(0)

    q('onboarding-mic')?.click()

    expect(controller?.state().phase).toBe('ready')
    expect(s.calls.release).toBeGreaterThan(0)
    expect(q('onboarding-pin-low')).toBeNull()
    expect(lit()).toEqual([])
  })

  it('goes back to ready when the page hides mid-slide', async () => {
    const s = stand()
    show(s)
    await listen()

    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockRestore()

    expect(controller?.state().phase).toBe('ready')
    expect(s.calls.release).toBeGreaterThan(0)
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
    s.answer = async () => Promise.resolve()
    q('onboarding-retry')?.click()
    expect(s.calls.acquire).toBe(2)
  })

  it('offers Skip for now while the mic is down, and not while it listens', async () => {
    const s = stand()
    const onSkip = vi.fn()
    show(s, { onSkip })

    q('onboarding-skip')?.click()
    await listen()

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(q('onboarding-skip')).toBeNull()
  })

  it('shuts the mic at once when the onboarding leaves', async () => {
    const s = stand()
    show(s)
    await listen()
    const released = s.calls.release

    controller?.leave()

    expect(s.calls.release).toBe(released + 1)
    expect(controller?.state().phase).toBe('ready')
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
    open()
    await settle()

    expect(controller?.state().phase).toBe('ready')
    expect(s.calls.startWindow).toBe(0)
  })
})
