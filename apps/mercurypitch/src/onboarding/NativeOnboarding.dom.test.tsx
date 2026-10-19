// ============================================================
// The onboarding's layer: a dialog on a dark stage, its beats in order,
// and the ways out
// ============================================================
//
// The beats run on the stand-in capture (onboarding-capture.test-fixtures),
// handed to the layer in place of the mic's: the one thing it reaches that
// jsdom has not got. Keep (beat 7) is the shell's own sheet, drawn beside
// the layer as the shell draws it, with the shell's half of the onboarding
// installed, so its "Find your range first" is the shell's.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Capture from '@/components/room-kit/useExerciseCapture'
import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { CaptureError } from '@/components/room-kit/useExerciseCapture'
import { setAuthToken } from '@/db/services/user-service'
import type * as VoiceprintService from '@/db/services/voiceprint-service'
import type * as Funnel from '@/features/onboarding/funnel'
import type * as MicSentinel from '@/lib/mic-sentinel'
import { resetRoomArrivalHolds } from '@/stores/native-shell-store'
import type * as Wiring from '../shell/premium-exercise-wiring'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { onboardingShown, pushed, resetRunShell, setOnboardingShown, } from '../shell/run-shell-store'
import { KEEP } from '../shell/settings/account-copy'
import { closeOffer, forgetAccountOffer, keepArrival, offerOpen, } from '../shell/settings/account-offer'
import { AccountOfferSheet } from '../shell/settings/AccountOffer'
import { closeSignIn, resetSignIn, signInOpen, } from '../shell/settings/sign-in-state'
import { ASK_BEAT_MS, askAfterSignIn, resetVoiceprintAsk, voiceprintAskOpen, voiceprintAskUp, } from '../shell/settings/voiceprint-ask'
import { performBack } from '../shell/shell-navigation'
import { NativeOnboarding, SKIP_BEAT_MS } from './NativeOnboarding'
import type { Stand } from './onboarding-capture.test-fixtures'
import { flushFrame, noteTake, settle, stand, stubFrames, } from './onboarding-capture.test-fixtures'
import { ONBOARDING_COPY } from './onboarding-copy'
import { ONBOARDING_KEY, resetOnboardingFlagForTests, settleOnboarding, } from './onboarding-flag'
import { installNativeOnboarding, LEAVE_MS, onboardingExit, onboardingMounted, openOnboarding, openRangeFinder, } from './onboarding-layer'
import { slideWindow } from './range-frames.test-fixtures'
import { GREET_MS } from './useFirstNote'

/** The Rooms home, the alley, as the hash router names it. */
const ALLEY = '#/home'

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

// The landing's push, without the art its tap starts loading (the wiring's
// own test has that).
vi.mock('../shell/premium-exercise-wiring', async (importOriginal) => {
  const { pushScreen } = await import('../shell/run-shell-store')
  return {
    ...(await importOriginal<typeof Wiring>()),
    openPremiumExercise: () => pushScreen('warm-up'),
  }
})

// The onboarding's counts (S7b §7), heard on their way to the funnel.
const funnel = vi.hoisted(() => ({ sent: [] as string[] }))

vi.mock('@/features/onboarding/funnel', async (importOriginal) => ({
  ...(await importOriginal<typeof Funnel>()),
  trackNativeOnboarding: (event: string) => funnel.sent.push(event),
}))

vi.mock('@/lib/mic-sentinel', async (importOriginal) => ({
  ...(await importOriginal<typeof MicSentinel>()),
  registerMicIndicator: () => () => undefined,
}))

// The takes an account could adopt. The suites have no API, so the real
// list is always empty; a test that needs the voiceprint ask up fills it.
const adoption = vi.hoisted(() => ({
  takes: [] as ReturnType<typeof VoiceprintService.listAdoptableVoiceprints>,
  declined: false,
}))

vi.mock('@/db/services/voiceprint-service', async (importOriginal) => ({
  ...(await importOriginal<typeof VoiceprintService>()),
  listAdoptableVoiceprints: () => adoption.takes,
  adoptionNoticeDue: () => adoption.takes.length > 0 && !adoption.declined,
  declineAdoption: () => {
    adoption.declined = true
  },
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
let shell: (() => void) | null = null

/** The layer up for `entry`, on a stand-in capture, with Keep beside it. */
function mount(entry: 'onboarding' | 'range', then = () => undefined): Stand {
  const s = stand()
  bench.capture = s.capture
  createRoot((dispose) => {
    shell = dispose
    installNativeOnboarding()
  })
  if (entry === 'onboarding') openOnboarding()
  else openRangeFinder(then)
  view = renderShell(() => (
    <>
      <NativeOnboarding />
      <AccountOfferSheet />
    </>
  ))
  return s
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  stubFrames()
  localStorage.clear()
  window.location.hash = ''
  resetOnboardingFlagForTests()
  settleOnboarding(false)
  funnel.sent = []
})

/** jsdom's own: none, so a swap cuts unless a case stands one in. */
const ANIMATE = Element.prototype.animate

/**
 * A WebView with View Transitions: element.animate, and a transition whose
 * update waits for the frame the case draws with the returned call.
 */
function standInViewTransitions(): () => void {
  const updates: (() => void)[] = []
  const never = new Promise<void>(() => undefined)
  Element.prototype.animate = function animate(): Animation {
    return { finished: never, cancel: () => undefined } as unknown as Animation
  }
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: (update: () => void) => {
      updates.push(update)
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: never,
      }
    },
  })
  return () => {
    for (const update of updates.splice(0)) update()
  }
}

afterEach(() => {
  Element.prototype.animate = ANIMATE
  Reflect.deleteProperty(document, 'startViewTransition')
  view?.unmount()
  view = null
  resetRunShell()
  shell?.()
  shell = null
  bench.capture = null
  vi.advanceTimersByTime(LEAVE_MS)
  vi.unstubAllGlobals()
  vi.useRealTimers()
  setOnboardingShown(false)
  resetRoomArrivalHolds()
  forgetAccountOffer()
  resetSignIn()
  resetVoiceprintAsk()
  adoption.takes = []
  adoption.declined = false
  setAuthToken(null)
  localStorage.clear()
  resetOnboardingFlagForTests()
})

const layer = (): HTMLElement | null =>
  view?.container.querySelector('[data-testid="native-onboarding"]') ?? null
const q = (id: string): HTMLElement | null =>
  view?.container.querySelector(`[data-testid="${id}"]`) ?? null
const said = (): string | null => q('onboarding-said')?.textContent ?? null
/** Keep is portalled to the document, as the shell's sheets are. */
const k = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const beat = (): string | null => layer()?.getAttribute('data-beat') ?? null

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

/** Both slides, with the mic open: the range is measured, E2 to G4. */
async function slideBoth(s: Stand): Promise<void> {
  await settle()
  s.frames = slideWindow(52, 40)
  flushFrame()
  s.frames = slideWindow(45, 67)
  flushFrame()
  expect(q('onboarding-see-voice')).not.toBeNull()
}

/** Find my range, then both slides: the range is measured. */
async function measureRange(s: Stand): Promise<void> {
  q('onboarding-find-range')?.click()
  await slideBoth(s)
}

/** One note, the range, the reveal, and Continue. */
async function continueFromReveal(s: Stand): Promise<void> {
  await nameNote(s)
  await measureRange(s)
  q('onboarding-see-voice')?.click()
  q('onboarding-continue')?.click()
  await settle()
}

/** One note, then Skip for now, and Merc's word: Keep comes after it. */
async function skipToKeep(s: Stand): Promise<void> {
  await nameNote(s)
  q('onboarding-skip')?.click()
  vi.advanceTimersByTime(SKIP_BEAT_MS)
  await settle()
}

/** The beats' counts, without the beat 9 group drawn as the layer opens. */
const counted = (): string[] =>
  funnel.sent.filter((event) => !event.startsWith('native_onboarding_group'))

/** E2 to G4, kept on this phone before, with nobody signed in. */
function keepRangeBefore(): void {
  localStorage.setItem(
    'mercurypitch.voiceprints.v1',
    JSON.stringify([
      {
        id: 'kept-before',
        summary: {
          lowMidi: 40,
          highMidi: 67,
          semitones: 27,
          accuracy: null,
          steadiness: null,
        },
        twin: 'Paul Robeson',
        source: 'onboarding',
        takenAt: '2026-10-18T09:00:00.000Z',
        madeBy: 'anonymous',
      },
    ]),
  )
}

/** A token for an account of `provider`'s, signed in on this phone. */
function token(provider: string): string {
  const body = btoa(
    JSON.stringify({
      sub: 'user-1',
      provider,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
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
    // A build without Cloud has no offer to bring: the alley, at once.
    expect(window.location.hash).toBe(ALLEY)
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

  it('skips the range: Merc says it is there for later, then Keep comes', async () => {
    const s = mount('onboarding')
    await nameNote(s)

    q('onboarding-skip')?.click()

    expect(said()).toBe(ONBOARDING_COPY.skipped)
    expect(outOfReach(q('onboarding-skip'))).toBe(true)
    expect(offerOpen()).toBe(false)
    vi.advanceTimersByTime(SKIP_BEAT_MS)
    expect(beat()).toBe('keep')
    expect(offerOpen()).toBe(true)
    expect(onboardingShown()).toBe(true)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('due')
  })

  it('reveals the voice a range measures, and Continue brings Keep', async () => {
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
    expect(beat()).toBe('keep')
    expect(offerOpen()).toBe(true)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('due')
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

describe('Keep, beat 7', () => {
  it('comes over the layer after the reveal: the voiceprint, its card flown in, and the layer still up', async () => {
    const s = mount('onboarding')

    await continueFromReveal(s)

    expect(beat()).toBe('keep')
    expect(k('account-offer')?.dataset.variant).toBe('voiceprint')
    expect(k('account-offer')?.dataset.arrival).toBe('reveal')
    expect(keepArrival()).toBe('reveal')
    expect(k('keep-voiceprint')?.textContent).toContain('E2–G4')
    expect(onboardingShown()).toBe(true)
    // Nothing of the layer is in reach under Keep, and Merc says nothing.
    expect(outOfReach(q('onboarding-not-now'))).toBe(true)
    expect(outOfReach(q('onboarding-keep'))).toBe(true)
    expect(said()).toBe('')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('due')
  })

  it("goes on to the sung line once Keep's Not now closes it, the layer still up", async () => {
    const s = mount('onboarding')
    await continueFromReveal(s)

    k('keep-not-now')?.click()
    expect(onboardingShown()).toBe(true)
    await settle()

    expect(offerOpen()).toBe(false)
    expect(beat()).toBe('line')
    expect(q('onboarding-sung-line')).not.toBeNull()
    expect(said()).toBe(ONBOARDING_COPY.lineAsk)
    expect(outOfReach(q('onboarding-not-now'))).toBe(false)
    expect(onboardingShown()).toBe(true)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('due')
  })

  it('is Save your progress after a skipped range, with Find your range first and no card', async () => {
    const s = mount('onboarding')

    await skipToKeep(s)

    expect(k('account-offer')?.dataset.variant).toBe('progress')
    expect(keepArrival()).toBe('plain')
    expect(k('keep-voiceprint')).toBeNull()
    expect(k('keep-find-range')?.textContent).toBe(KEEP.findRange)
    // Merc's word on the skip has had its moment.
    expect(said()).toBe('')
  })

  it("runs the range here from Keep's Find your range first, the mic opened in that tap, then comes back to Keep", async () => {
    const s = mount('onboarding')
    await skipToKeep(s)
    const acquired = s.calls.acquire

    k('keep-find-range')?.click()

    expect(beat()).toBe('range')
    expect(s.calls.acquire).toBe(acquired + 1)
    expect(offerOpen()).toBe(false)
    expect(said()).toBe(ONBOARDING_COPY.slideDown)
    await slideBoth(s)
    expect(onboardingShown()).toBe(true)
    q('onboarding-see-voice')?.click()
    q('onboarding-continue')?.click()
    await settle()
    expect(beat()).toBe('keep')
    expect(k('account-offer')?.dataset.variant).toBe('voiceprint')
    expect(keepArrival()).toBe('reveal')
    expect(k('keep-find-range')).toBeNull()
  })

  it("runs the range from Keep's Find your range first where a View Transition draws it a frame later, and not the line", async () => {
    const s = mount('onboarding')
    await skipToKeep(s)
    const acquired = s.calls.acquire
    const draw = standInViewTransitions()

    k('keep-find-range')?.click()
    // Keep's close is checked once its tap is over, before the frame that
    // draws the range.
    await settle()
    draw()
    await settle()

    expect(beat()).toBe('range')
    expect(q('onboarding-sung-line')).toBeNull()
    expect(s.calls.acquire).toBe(acquired + 1)
    expect(said()).toBe(ONBOARDING_COPY.slideDown)
  })

  it("brings Keep back from the range's own Skip for now, when Keep ran it", async () => {
    const s = mount('onboarding')
    await skipToKeep(s)
    k('keep-find-range')?.click()
    await settle()
    // Stopped mid-slide: the mic is down, and Skip for now is back.
    q('onboarding-mic')?.click()

    q('onboarding-skip')?.click()
    expect(said()).toBe(ONBOARDING_COPY.skipped)
    vi.advanceTimersByTime(SKIP_BEAT_MS)
    await settle()

    expect(beat()).toBe('keep')
    expect(offerOpen()).toBe(true)
    expect(k('account-offer')?.dataset.variant).toBe('progress')
  })

  it('stays on Keep while it hands over to the sign-in sheet, and goes on to the line when that closes', async () => {
    const s = mount('onboarding')
    await skipToKeep(s)

    k('keep-email')?.click()
    await settle()
    const handedOver = signInOpen()
    const stayed = beat()
    closeSignIn()
    await settle()

    expect(handedOver).toBe(true)
    expect(stayed).toBe('keep')
    expect(beat()).toBe('line')
    expect(onboardingShown()).toBe(true)
  })

  it('stays on Keep for the voiceprint ask a sign-in brings, and goes on to the line once it is over', async () => {
    const s = mount('onboarding')
    await continueFromReveal(s)

    // As a sign-in to an account that already existed ends: Keep closes,
    // and the ask is due a beat later, in the same turn.
    closeOffer()
    askAfterSignIn('user-1')
    await settle()
    const stayed = beat()
    vi.advanceTimersByTime(ASK_BEAT_MS)
    await settle()

    expect(stayed).toBe('keep')
    expect(beat()).toBe('line')
    expect(onboardingShown()).toBe(true)
  })

  it('closes the voiceprint ask on Back before anything under it, then goes on to the sung line', async () => {
    const s = mount('onboarding')
    await continueFromReveal(s)

    // A sign-in from Keep to an account that already existed: Keep closes,
    // and a beat later the ask rises for the voiceprint just measured.
    setAuthToken(token('google'))
    adoption.takes = [
      {
        id: 'measured',
        summary: {
          lowMidi: 40,
          highMidi: 67,
          semitones: 27,
          accuracy: null,
          steadiness: null,
        },
        twin: 'Paul Robeson',
        source: 'onboarding',
        takenAt: '2026-10-19T09:00:00.000Z',
        madeBy: 'anonymous',
      },
    ]
    closeOffer()
    askAfterSignIn('user-1')
    vi.advanceTimersByTime(ASK_BEAT_MS)
    await settle()
    const askUp = voiceprintAskUp()
    const stayed = onboardingShown()

    const outcome = performBack({
      canGoBack: true,
      back: vi.fn(),
      minimize: vi.fn(),
    })
    await settle()

    expect(askUp).toBe(true)
    expect(stayed).toBe(true)
    expect(outcome).toBe('sheet')
    expect(voiceprintAskOpen()).toBe(false)
    expect(adoption.declined).toBe(true)
    // The ask was the last of what Keep handed over to: the layer goes on.
    expect(onboardingShown()).toBe(true)
    expect(beat()).toBe('line')
  })

  it('is skipped on a phone signed in to an account: Continue goes on to the sung line', async () => {
    setAuthToken(token('google'))
    const s = mount('onboarding')

    await continueFromReveal(s)

    expect(offerOpen()).toBe(false)
    expect(beat()).toBe('line')
    expect(onboardingShown()).toBe(true)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('due')
  })

  it('is skipped after a skipped range too, on a phone signed in', async () => {
    setAuthToken(token('apple'))
    const s = mount('onboarding')

    await skipToKeep(s)

    expect(offerOpen()).toBe(false)
    expect(beat()).toBe('line')
  })

  it("does not come over a layer left by Not now during Merc's word on a skip", async () => {
    const s = mount('onboarding')
    await nameNote(s)
    q('onboarding-skip')?.click()

    q('onboarding-not-now')?.click()
    vi.advanceTimersByTime(SKIP_BEAT_MS)
    await settle()

    expect(offerOpen()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
  })

  it('never comes after a refused mic: Not now leaves with no offer (S7b E5)', async () => {
    const s = mount('onboarding')
    s.answer = async () => Promise.reject(new CaptureError('denied'))
    q('onboarding-mic')?.click()
    await settle()
    expect(q('onboarding-retry')).not.toBeNull()

    q('onboarding-not-now')?.click()
    await settle()

    expect(offerOpen()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
  })
})

describe('a refused mic (REQ-NFL-043, S7b E5)', () => {
  /** The first note's mic tapped, and refused. */
  async function refuse(
    s: Stand,
    why: 'denied' | 'unavailable',
  ): Promise<void> {
    s.answer = async () => Promise.reject(new CaptureError(why))
    q('onboarding-mic')?.click()
    await settle()
  }

  it("goes on in one tap: Continue without the mic lands on the Warm-up's path, with no offer", async () => {
    const s = mount('onboarding')
    await refuse(s, 'denied')
    expect(q('onboarding-retry')).not.toBeNull()
    expect(q('onboarding-without-mic')?.textContent).toBe(
      ONBOARDING_COPY.withoutMic,
    )

    q('onboarding-without-mic')?.click()
    await settle()

    expect(offerOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    expect(pushed()).toBe('warm-up')
    expect(counted()).toEqual([
      'native_onboarding_first_note_view',
      'native_onboarding_mic_denied',
      'native_onboarding_without_mic',
      'native_onboarding_done',
      'native_onboarding_path_view',
    ])
  })

  it('goes on the same way from a mic that would not open', async () => {
    const s = mount('onboarding')
    await refuse(s, 'unavailable')

    q('onboarding-without-mic')?.click()
    await settle()

    expect(pushed()).toBe('warm-up')
  })

  it('has no way on without the mic for the range on its own: its Not now goes back to Keep', async () => {
    const s = mount('range')
    s.answer = async () => Promise.reject(new CaptureError('denied'))
    q('onboarding-mic')?.click()
    await settle()

    expect(q('onboarding-retry')).not.toBeNull()
    expect(q('onboarding-without-mic')).toBeNull()
  })

  it('lands Not now on the alley, with nothing pushed (owner, 20 Oct)', async () => {
    const s = mount('onboarding')
    await refuse(s, 'denied')

    q('onboarding-not-now')?.click()
    await settle()

    expect(pushed()).toBeNull()
    expect(window.location.hash).toBe(ALLEY)
  })
})

describe('a range this phone already keeps', () => {
  it('ends the first note on See my voice and Find my range again, with no Skip for now', async () => {
    keepRangeBefore()
    const s = mount('onboarding')

    await nameNote(s)

    expect(q('onboarding-see-saved')?.textContent).toBe(
      ONBOARDING_COPY.seeVoice,
    )
    expect(q('onboarding-find-range')?.textContent).toBe(
      ONBOARDING_COPY.findRangeAgain,
    )
    expect(q('onboarding-skip')).toBeNull()
  })

  it('reveals the range kept, its twin the one it was kept with, then Keep', async () => {
    keepRangeBefore()
    const s = mount('onboarding')
    await nameNote(s)

    q('onboarding-see-saved')?.click()
    q('onboarding-find-twin')?.click()

    expect(beat()).toBe('reveal')
    expect(q('onboarding-card-range')?.textContent).toBe('E2 to G4')
    expect(q('onboarding-twin')?.textContent).toBe('Paul Robeson')
    expect(s.calls.acquire).toBe(1)
    q('onboarding-continue')?.click()
    await settle()
    expect(beat()).toBe('keep')
    expect(k('account-offer')?.dataset.variant).toBe('voiceprint')
  })

  it('measures anew on Find my range again, its mic opened in that tap', async () => {
    keepRangeBefore()
    const s = mount('onboarding')
    await nameNote(s)

    q('onboarding-find-range')?.click()

    expect(beat()).toBe('range')
    expect(s.calls.acquire).toBe(2)
    expect(said()).toBe(ONBOARDING_COPY.slideDown)
  })

  it('is not offered by the range on its own, which measures one', () => {
    keepRangeBefore()

    mount('range')

    expect(beat()).toBe('range')
    expect(q('onboarding-see-saved')).toBeNull()
  })
})

describe('counted (S7b §7)', () => {
  it('counts each beat once as it shows and once as it is done, and what was chosen on Keep', async () => {
    const s = mount('onboarding')
    await continueFromReveal(s)
    k('keep-not-now')?.click()
    await settle()

    expect(counted()).toEqual([
      'native_onboarding_first_note_view',
      'native_onboarding_mic_granted',
      'native_onboarding_first_note_complete',
      'native_onboarding_range_view',
      'native_onboarding_range_complete',
      'native_onboarding_reveal_view',
      'native_onboarding_reveal_complete',
      'native_onboarding_keep_view_voiceprint',
      'native_onboarding_keep_not_now',
      'native_onboarding_line_view',
    ])
  })

  it('counts a skipped range, and Keep as Save your progress', async () => {
    const s = mount('onboarding')
    await skipToKeep(s)

    expect(counted()).toEqual([
      'native_onboarding_first_note_view',
      'native_onboarding_mic_granted',
      'native_onboarding_first_note_complete',
      'native_onboarding_range_skipped',
      'native_onboarding_keep_view_progress',
    ])
  })

  it('counts a refused mic once, however often it is asked again, and Not now', async () => {
    const s = mount('onboarding')
    s.answer = async () => Promise.reject(new CaptureError('denied'))
    q('onboarding-mic')?.click()
    await settle()
    q('onboarding-retry')?.click()
    await settle()

    q('onboarding-not-now')?.click()
    await settle()

    expect(counted()).toEqual([
      'native_onboarding_first_note_view',
      'native_onboarding_mic_denied',
      'native_onboarding_not_now',
    ])
  })

  it('counts nothing for the range on its own, run from Keep', async () => {
    const s = mount('range')
    q('onboarding-mic')?.click()
    await slideBoth(s)
    q('onboarding-see-voice')?.click()
    q('onboarding-continue')?.click()
    await settle()

    expect(funnel.sent).toEqual([])
  })
})
