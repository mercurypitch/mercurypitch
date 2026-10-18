// ============================================================
// The onboarding's layer: a dialog on a dark stage, its beats in order,
// and the ways out
// ============================================================
//
// The beats run on the stand-in capture (onboarding-capture.test-fixtures),
// handed to the layer in place of the mic's: the one thing it reaches that
// jsdom has not got.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Capture from '@/components/room-kit/useExerciseCapture'
import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import type * as MicSentinel from '@/lib/mic-sentinel'
import { resetRoomArrivalHolds } from '@/stores/native-shell-store'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { onboardingShown, setOnboardingShown } from '../shell/run-shell-store'
import { NativeOnboarding, SKIP_BEAT_MS } from './NativeOnboarding'
import type { Stand } from './onboarding-capture.test-fixtures'
import { flushFrame, noteTake, settle, stand, stubFrames, } from './onboarding-capture.test-fixtures'
import { ONBOARDING_COPY } from './onboarding-copy'
import { ONBOARDING_KEY, resetOnboardingFlagForTests, settleOnboarding, } from './onboarding-flag'
import { LEAVE_MS, onboardingExit, onboardingMounted, openOnboarding, openRangeFinder, } from './onboarding-layer'
import { slideWindow } from './range-frames.test-fixtures'
import { GREET_MS } from './useFirstNote'

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

vi.mock('@/lib/mic-sentinel', async (importOriginal) => ({
  ...(await importOriginal<typeof MicSentinel>()),
  registerMicIndicator: () => () => undefined,
}))

const bench = vi.hoisted(() => ({ capture: null as ExerciseCapture | null }))

vi.mock('@/components/room-kit/useExerciseCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof Capture>()
  return {
    ...actual,
    useExerciseCapture: (
      ...args: Parameters<typeof actual.useExerciseCapture>
    ) => bench.capture ?? actual.useExerciseCapture(...args),
  }
})

let view: RenderedShell | null = null

/** The layer up for `entry`, on a stand-in capture. */
function mount(entry: 'onboarding' | 'range', then = () => undefined): Stand {
  const s = stand()
  bench.capture = s.capture
  if (entry === 'onboarding') openOnboarding()
  else openRangeFinder(then)
  view = renderShell(() => <NativeOnboarding />)
  return s
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  stubFrames()
  localStorage.clear()
  resetOnboardingFlagForTests()
  settleOnboarding(false)
})

afterEach(() => {
  view?.unmount()
  view = null
  bench.capture = null
  vi.advanceTimersByTime(LEAVE_MS)
  vi.unstubAllGlobals()
  vi.useRealTimers()
  setOnboardingShown(false)
  resetRoomArrivalHolds()
  localStorage.clear()
  resetOnboardingFlagForTests()
})

const layer = (): HTMLElement | null =>
  view?.container.querySelector('[data-testid="native-onboarding"]') ?? null
const q = (id: string): HTMLElement | null =>
  view?.container.querySelector(`[data-testid="${id}"]`) ?? null
const said = (): string | null => q('onboarding-said')?.textContent ?? null

/** Inert, or inside something inert. Solid sets the property, and jsdom
 *  does not reflect it to the attribute, so `[inert]` would not find it. */
function outOfReach(element: HTMLElement | null): boolean {
  for (let at = element; at !== null; at = at.parentElement) {
    if (at.inert) return true
  }
  return false
}

/** One note sung and named: the first beat's two ways on are up. */
async function nameNote(s: Stand): Promise<void> {
  q('onboarding-mic')?.click()
  await settle()
  s.frames = noteTake(220)
  flushFrame()
  expect(q('onboarding-find-range')).not.toBeNull()
}

/** Find my range, then both slides: the range is measured. */
async function measureRange(s: Stand): Promise<void> {
  q('onboarding-find-range')?.click()
  await settle()
  s.frames = slideWindow(52, 40)
  flushFrame()
  s.frames = slideWindow(45, 67)
  flushFrame()
  expect(q('onboarding-see-voice')).not.toBeNull()
}

describe('NativeOnboarding', () => {
  it('is a modal dialog on a dark stage, with Not now at its top', () => {
    mount('onboarding')

    const root = layer()
    expect(root?.getAttribute('role')).toBe('dialog')
    expect(root?.getAttribute('aria-modal')).toBe('true')
    expect(root?.getAttribute('aria-label')).toBe(ONBOARDING_COPY.title)
    expect(root?.classList.contains('mp-dark-stage')).toBe(true)
    expect(root?.getAttribute('data-leaving')).toBe('off')
    expect(root?.inert).not.toBe(true)
    const notNow = root?.querySelector('[data-testid="onboarding-not-now"]')
    expect(notNow?.textContent).toBe(ONBOARDING_COPY.notNow)
    // The first beat, Merc and all.
    expect(root?.getAttribute('data-beat')).toBe('first-note')
    expect(q('onboarding-merc')).not.toBeNull()
  })

  it('reads Merc lines from one live region, the bubble hidden from it', () => {
    mount('onboarding')

    vi.advanceTimersByTime(GREET_MS)

    expect(said()).toBe(ONBOARDING_COPY.ask)
    expect(q('onboarding-said')?.getAttribute('aria-live')).toBe('polite')
    expect(q('onboarding-line')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves on Not now: done for good, out of reach while it fades', () => {
    mount('onboarding')

    q('onboarding-not-now')?.click()

    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    expect(layer()?.getAttribute('data-leaving')).toBe('on')
    // A property in Solid; a browser reflects it to the attribute.
    expect(layer()?.inert).toBe(true)
    expect(onboardingMounted()).toBe(true)
    vi.advanceTimersByTime(LEAVE_MS)
    expect(onboardingMounted()).toBe(false)
  })

  it('opens the range on Find my range, its mic opened in that tap, Merc and all', async () => {
    const s = mount('onboarding')
    await nameNote(s)
    const merc = q('onboarding-merc')

    q('onboarding-find-range')?.click()

    expect(layer()?.getAttribute('data-beat')).toBe('range')
    expect(layer()?.getAttribute('aria-label')).toBe(ONBOARDING_COPY.rangeTitle)
    // The first note's mic, then the range's, inside the tap.
    expect(s.calls.acquire).toBe(2)
    expect(said()).toBe(ONBOARDING_COPY.slideDown)
    // One Merc, moved from beat to beat rather than made again.
    expect(q('onboarding-merc')).toBe(merc)
  })

  it('skips the range: Merc says it is there for later, then the onboarding goes', async () => {
    const s = mount('onboarding')
    await nameNote(s)

    q('onboarding-skip')?.click()

    expect(said()).toBe(ONBOARDING_COPY.skipped)
    expect(outOfReach(q('onboarding-skip'))).toBe(true)
    expect(onboardingShown()).toBe(true)
    vi.advanceTimersByTime(SKIP_BEAT_MS)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
  })

  it('reveals the voice a range measures, and Continue ends the onboarding', async () => {
    const s = mount('onboarding')
    await nameNote(s)
    await measureRange(s)

    q('onboarding-see-voice')?.click()

    expect(layer()?.getAttribute('data-beat')).toBe('reveal')
    expect(layer()?.getAttribute('aria-label')).toBe(
      ONBOARDING_COPY.revealTitle,
    )
    expect(q('onboarding-card-range')?.textContent).toBe('E2 to G4')
    expect(said()).toBe(ONBOARDING_COPY.voiceprint)
    q('onboarding-continue')?.click()
    expect(onboardingExit()).toBe('finished')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
  })

  it('shuts the range mic at once when Not now is tapped mid-slide', async () => {
    const s = mount('onboarding')
    await nameNote(s)
    q('onboarding-find-range')?.click()
    await settle()
    const released = s.calls.release

    q('onboarding-not-now')?.click()

    expect(s.calls.release).toBeGreaterThan(released)
  })

  it('starts on the range, waiting for a tap, when Keep opens it on its own', () => {
    const then = vi.fn()

    const s = mount('range', then)

    expect(layer()?.getAttribute('data-beat')).toBe('range')
    expect(layer()?.getAttribute('data-entry')).toBe('range')
    expect(q('onboarding-mic')?.getAttribute('data-state')).toBe('ready')
    expect(q('onboarding-priming')?.textContent).toBe(ONBOARDING_COPY.listens)
    expect(q('onboarding-skip')).toBeNull()
    expect(s.calls.acquire).toBe(0)
    q('onboarding-not-now')?.click()
    expect(then).toHaveBeenCalledTimes(1)
  })
})
