// ============================================================
// The layer's last two beats: the sung line (8), then the Cloud offer (9)
// ============================================================
//
// The layer as the shell mounts it, on a stand-in capture and a clock that
// stands at zero, with Merc's call reduced to when its notes fall. The
// Cloud offer is its store (cloud-offer-store.ts): the shell draws the
// sheet, and the layer only answers to whether it is up. The server and
// the singer's identity are stood in for, so the asks before the offer
// can be counted.

import type { JSX } from 'solid-js'
import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Capture from '@/components/room-kit/useExerciseCapture'
import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { CaptureError } from '@/components/room-kit/useExerciseCapture'
import { setAuthToken } from '@/db/services/user-service'
import type { CallVoice } from '@/features/echo/merc-call'
import type * as Songs from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSongs } from '@/features/karaoke-room/karaoke-songs'
import type * as Funnel from '@/features/onboarding/funnel'
import type * as Analytics from '@/lib/analytics'
import type * as MicSentinel from '@/lib/mic-sentinel'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { RESPONSE_GATE_SECONDS } from '@/lib/sequence/sequence-engine'
import type { KaraokeSubscriptionApi } from '@/stores/native-shell-store'
import { registerShellApi, resetRoomArrivalHolds, } from '@/stores/native-shell-store'
import type * as Wiring from '../shell/premium-exercise-wiring'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { onboardingShown, pushed, resetRunShell, setOnboardingShown, } from '../shell/run-shell-store'
import { KEEP } from '../shell/settings/account-copy'
import { forgetAccountOffer, keepArrival, offerOpen, openKeep, } from '../shell/settings/account-offer'
import { AccountOfferSheet } from '../shell/settings/AccountOffer'
import { resetSignIn, signInOpen } from '../shell/settings/sign-in-state'
import { resetVoiceprintAsk } from '../shell/settings/voiceprint-ask'
import { performBack } from '../shell/shell-navigation'
import { NativeOnboarding, SKIP_BEAT_MS } from './NativeOnboarding'
import type { Stand } from './onboarding-capture.test-fixtures'
import { flushFrame, noteTake, settle, stand, stubFrames, } from './onboarding-capture.test-fixtures'
import { lineScoreText, ONBOARDING_COPY } from './onboarding-copy'
import { ONBOARDING_KEY, resetOnboardingFlagForTests, settleOnboarding, } from './onboarding-flag'
import { installNativeOnboarding, LEAVE_MS, onboardingExit, openOnboarding, } from './onboarding-layer'
import { OFFER_GROUP_KEY, OFFER_SHOWN_KEY, resetOnboardingOfferForTests, } from './onboarding-offer'
import { slideWindow } from './range-frames.test-fixtures'
import type { TimedNote } from './sung-line'
import { LINE_SEC, lineNotes } from './sung-line'
import { COUNT_IN_SEC, TURN_TAIL_SEC } from './useLine'

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

// The counts (S7b §7), heard on their way: the onboarding's own, and the
// app's, which the Cloud offer's are.
const funnel = vi.hoisted(() => ({ sent: [] as string[], app: [] as string[] }))

vi.mock('@/features/onboarding/funnel', async (importOriginal) => ({
  ...(await importOriginal<typeof Funnel>()),
  trackNativeOnboarding: (event: string) => funnel.sent.push(event),
}))

vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof Analytics>()),
  trackEvent: (event: string) => funnel.app.push(event),
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

/** Merc's call, minus the sound: the notes he sang, and when they fall. */
const voice = vi.hoisted(() => ({ sung: [] as number[][] }))

vi.mock('@/features/echo/merc-sampler', async (importOriginal) => {
  const { callTimes } = await import('@/features/echo/merc-call')
  const call: CallVoice = {
    sing: (_ctx, notes, startAt) => {
      voice.sung.push(notes.map((note) => note.midi))
      return { ...callTimes(notes, startAt), stop: () => undefined }
    },
  }
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    MERC_CALL: call,
    preloadMercVoice: async () => Promise.resolve(null),
  }
})

// A build with Cloud, as every build with the onboarding is.
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  KARAOKE_IMPORT: true,
}))

/** The singer's identity, made before the offer asks the server. */
const identity = vi.hoisted(() => ({
  made: 0,
  hold: null as Promise<void> | null,
}))
vi.mock('@/db/services/singer-identity', () => ({
  ensureSingerIdentity: vi.fn(async () => {
    identity.made += 1
    if (identity.hold !== null) await identity.hold
    return true
  }),
}))

/** What the server says of the singer's songs when it is asked. */
const server = vi.hoisted(() => ({ next: null as KaraokeSongs | null }))
vi.mock('@/features/karaoke-room/karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async () => {
      if (server.next !== null) actual.resetKaraokeSongsForTests(server.next)
      return Promise.resolve(actual.karaokeSongs())
    }),
  }
})

import { BEFORE_OFFER_MS, closeCloudOffer, cloudOffer, cloudOfferGuest, cloudOfferOpen, resetCloudOfferForTests, } from '@/features/karaoke-room/cloud-offer-store'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'

const free: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

/** A clock that stands at zero, with no output latency. */
const CLOCK = {
  currentTime: 0,
  outputLatency: 0,
  baseLatency: 0,
} as unknown as AudioContext

/** The Rooms home, the alley, as the hash router names it. */
const ALLEY = '#/home'

/** Merc's call starts this far in: Echo's lead. */
const LEAD = 0.35
/** Merc's call is over, and the gate after it. */
const TURN_AT = LEAD + LINE_SEC + RESPONSE_GATE_SECONDS

let view: RenderedShell | null = null
let shell: (() => void) | null = null
let unregisterStore: (() => void) | null = null

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

/** A store here, with the month's plan to sell at its own price. */
function store(
  overrides: Partial<KaraokeSubscriptionApi> = {},
): KaraokeSubscriptionApi {
  return {
    subscribe: async () => Promise.resolve('cancelled' as const),
    restore: async () => Promise.resolve('nothing' as const),
    offer: async () =>
      Promise.resolve({
        priceText: '\u20ac4.99',
        title: 'Mercury Pitch Cloud',
      }),
    ...overrides,
  }
}

/** The shell's API, with `api` as its store (or none at all). */
function withStore(api: KaraokeSubscriptionApi | null): void {
  unregisterStore?.()
  unregisterStore =
    api === null
      ? null
      : registerShellApi({ pushSettings: vi.fn(), karaokeSubscription: api })
}

/** The onboarding up, on a stand-in capture with a clock, Keep beside it. */
function mount(): Stand {
  const s = stand()
  s.capture.audio = async () => Promise.resolve(CLOCK)
  bench.capture = s.capture
  createRoot((dispose) => {
    shell = dispose
    installNativeOnboarding()
  })
  openOnboarding()
  view = renderShell(
    (): JSX.Element => (
      <>
        <NativeOnboarding />
        <AccountOfferSheet />
      </>
    ),
  )
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
  resetOnboardingOfferForTests()
  resetCloudOfferForTests()
  resetKaraokeSongsForTests(free)
  // The nine installs in ten that are offered beat 9; a walk seeds it so.
  localStorage.setItem(OFFER_GROUP_KEY, 'offer')
  voice.sung.length = 0
  identity.made = 0
  identity.hold = null
  server.next = null
  funnel.sent = []
  funnel.app = []
  // A store with the plan priced, as beat 9 needs; a case may take it away.
  withStore(store())
})

afterEach(() => {
  withStore(null)
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
  setAuthToken(null)
  resetCloudOfferForTests()
  resetOnboardingOfferForTests()
  localStorage.clear()
  resetOnboardingFlagForTests()
})

const layer = (): HTMLElement | null =>
  view?.container.querySelector('[data-testid="native-onboarding"]') ?? null
const q = (id: string): HTMLElement | null =>
  view?.container.querySelector(`[data-testid="${id}"]`) ?? null
/** Keep is portalled to the document, as the shell's sheets are. */
const k = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const said = (): string | null => q('onboarding-said')?.textContent ?? null
const beat = (): string | null => layer()?.getAttribute('data-beat') ?? null

/** Inert, or inside something inert (Solid sets the property only). */
function outOfReach(element: HTMLElement | null): boolean {
  for (let at = element; at !== null; at = at.parentElement) {
    if (at.inert) return true
  }
  return false
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

/** One note sung and named: the first beat's two ways on are up. */
async function nameNote(s: Stand): Promise<void> {
  q('onboarding-mic')?.click()
  await settle()
  s.frames = noteTake(220)
  flushFrame()
  expect(q('onboarding-find-range')).not.toBeNull()
}

/** One note, then Skip for now, and Merc's word: the line. */
async function skipRange(s: Stand): Promise<void> {
  await nameNote(s)
  q('onboarding-skip')?.click()
  vi.advanceTimersByTime(SKIP_BEAT_MS)
  await settle()
}

/** One note, the range (E2 to G4), the reveal, and its Continue. */
async function measureRange(s: Stand): Promise<void> {
  await nameNote(s)
  q('onboarding-find-range')?.click()
  await settle()
  s.frames = slideWindow(52, 40)
  flushFrame()
  s.frames = slideWindow(45, 67)
  flushFrame()
  q('onboarding-see-voice')?.click()
  q('onboarding-continue')?.click()
  await settle()
}

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

/** The mic's frames to `until`, 100 a second: `notes` sung on pitch. */
function take(until: number, notes: readonly TimedNote[]): PitchFrame[] {
  const frames: PitchFrame[] = []
  for (let i = 0; i / 100 <= until; i++) {
    const t = i / 100
    const on = notes.find((note) => t >= note.from && t < note.to)
    frames.push(
      on === undefined
        ? { t, f0: 0, conf: 0, rms: 0.002 }
        : { t, f0: hz(on.midi), conf: 0.95, rms: 0.1 },
    )
  }
  return frames
}

/** Promises a few hops deep answered: the price, then the asks before the offer. */
async function settleAll(): Promise<void> {
  for (let i = 0; i < 10; i++) await settle()
}

/**
 * The line from `tonic`: the mic tapped, Merc's call through, then the
 * singer's turn sung on pitch to `until` on the line's clock (its end by
 * default), a screen frame drawn at each.
 */
async function singLine(
  s: Stand,
  tonic = 60,
  until = Number.POSITIVE_INFINITY,
): Promise<void> {
  q('onboarding-mic')?.click()
  // The mic's answer, then the clock's.
  await settle()
  await settle()
  const turn = lineNotes(tonic, TURN_AT + COUNT_IN_SEC)
  const end = turn[turn.length - 1].to + TURN_TAIL_SEC
  const frames = take(end, turn)
  s.frames = frames.filter((frame) => frame.t <= TURN_AT)
  flushFrame()
  s.frames = frames.filter((frame) => frame.t <= until)
  flushFrame()
  await settle()
}

/** The rest of the singer's turn, to its end, after singLine stopped short. */
async function finishLine(s: Stand, tonic = 60): Promise<void> {
  const turn = lineNotes(tonic, TURN_AT + COUNT_IN_SEC)
  s.frames = take(turn[turn.length - 1].to + TURN_TAIL_SEC, turn)
  flushFrame()
  await settle()
}

/** Continue on the line, and the asks before the offer answered. */
async function continueLine(): Promise<void> {
  q('onboarding-continue')?.click()
  await settleAll()
}

describe('beat 8, the sung line', () => {
  it("comes straight after Merc's word on a skipped range, sung from C4", async () => {
    const s = mount()
    await skipRange(s)
    // Keep waits until after the line: an account asked for after one
    // note sung is asked for too early.
    expect(offerOpen()).toBe(false)

    expect(beat()).toBe('line')
    expect(layer()?.getAttribute('aria-label')).toBe(ONBOARDING_COPY.lineTitle)
    expect(said()).toBe(ONBOARDING_COPY.lineAsk)
    await singLine(s)
    expect(voice.sung).toEqual([[60, 62, 64, 67, 65, 64, 62, 64, 62, 60]])
    expect(q('onboarding-sung-score')?.textContent).toBe(lineScoreText(10, 10))
  })

  it('is sung in the key of the range the reveal showed', async () => {
    setAuthToken(token('google'))
    const s = mount()
    await measureRange(s)
    expect(beat()).toBe('line')

    // A little under the middle of E2 to G4 as the exercises read it
    // (practiceRange: F#2 to F#4): D3.
    await singLine(s, 50)

    expect(voice.sung[0][0]).toBe(50)
    expect(q('onboarding-sung-score')?.textContent).toBe(lineScoreText(10, 10))
  })

  it('asks nothing of the server until its score shows', async () => {
    setAuthToken(token('apple'))
    const s = mount()
    await skipRange(s)

    // Merc's call, and the singer half way through the line.
    await singLine(s, 60, TURN_AT + COUNT_IN_SEC + 3)
    const duringTheLine = identity.made
    await finishLine(s)
    await settleAll()

    expect(duringTheLine).toBe(0)
    expect(q('onboarding-sung-score')?.getAttribute('data-shown')).toBe('on')
    expect(identity.made).toBe(1)
  })

  it('shuts its mic in the tap when Not now is tapped mid-line, then the offer comes', async () => {
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s, 60, TURN_AT + COUNT_IN_SEC + 2)
    const singing = q('onboarding-mic')?.getAttribute('data-state')
    const released = s.calls.release

    q('onboarding-not-now')?.click()
    const shut = s.calls.release
    await settleAll()

    // Shut in the tap; the offer comes once the asks have answered.
    expect(singing).toBe('sing')
    expect(shut).toBeGreaterThan(released)
    expect(cloudOffer()?.source).toBe('onboarding-exit')
  })
})

describe('Not now: the Cloud offer when it is due, then the alley (owner, 20 Oct)', () => {
  /** The first note's mic tapped, and refused or failed. */
  async function refuse(
    s: Stand,
    why: 'denied' | 'unavailable',
  ): Promise<void> {
    s.answer = async () => Promise.reject(new CaptureError(why))
    q('onboarding-mic')?.click()
    await settle()
    expect(q('onboarding-retry')).not.toBeNull()
  }

  it('opens the offer from the first note, the layer up under it and Merc by its art', async () => {
    const s = mount()
    await nameNote(s)
    const released = s.calls.release

    q('onboarding-not-now')?.click()
    const shut = s.calls.release
    await settleAll()

    expect(cloudOffer()).toEqual({ source: 'onboarding-exit', view: 'offer' })
    expect(beat()).toBe('offer')
    expect(onboardingShown()).toBe(true)
    // The mic shut in the tap; the offer marked shown; Not now said for good.
    expect(shut).toBeGreaterThan(released)
    expect(localStorage.getItem(OFFER_SHOWN_KEY)).toBe('shown')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    // The sheet's Not now is the way out now, and the sheet says it all.
    expect(outOfReach(q('onboarding-not-now'))).toBe(true)
    expect(said()).toBe('')
    expect(layer()?.getAttribute('aria-label')).toBe(ONBOARDING_COPY.title)
    expect((cloudOfferGuest() as HTMLElement | null)?.dataset.testid).toBe(
      'onboarding-merc',
    )
    expect(window.location.hash).toBe('')
  })

  it('closes onto the alley by its own Not now, the onboarding left as Not now, nothing pushed', async () => {
    const s = mount()
    await nameNote(s)
    q('onboarding-not-now')?.click()
    await settleAll()

    closeCloudOffer('not-now')
    await settle()

    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(window.location.hash).toBe(ALLEY)
    expect(pushed()).toBeNull()
    expect(cloudOfferGuest()).toBeNull()
  })

  it("takes Back as Not now, then Back as the offer's Not now, onto the alley", async () => {
    const s = mount()
    await nameNote(s)
    const host = {
      canGoBack: false,
      back: () => undefined,
      minimize: () => undefined,
    }

    const first = performBack(host)
    await settleAll()
    const offered = cloudOffer()?.source
    const second = performBack(host)
    await settle()

    expect(first).toBe('onboarding')
    expect(offered).toBe('onboarding-exit')
    expect(second).toBe('sheet')
    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(window.location.hash).toBe(ALLEY)
  })

  it('counts its offer apart from the one at the end, and Not now once', async () => {
    const s = mount()
    await nameNote(s)
    q('onboarding-not-now')?.click()
    await settleAll()
    closeCloudOffer('not-now')
    await settle()

    expect(funnel.app).toEqual(['cloud_view_onboarding_exit'])
    expect(
      funnel.sent.filter((event) => event === 'native_onboarding_not_now'),
    ).toHaveLength(1)
    expect(funnel.sent).not.toContain('native_onboarding_done')
  })

  it('goes straight to the alley for an install held out of it, asking nothing', async () => {
    localStorage.setItem(OFFER_GROUP_KEY, 'holdout')
    const s = mount()
    await nameNote(s)

    q('onboarding-not-now')?.click()

    expect(onboardingShown()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
    await settleAll()
    expect(cloudOfferOpen()).toBe(false)
    expect(identity.made).toBe(0)
  })

  it('goes straight to the alley where nothing can be bought, asking nothing', async () => {
    withStore(null)
    const s = mount()
    await nameNote(s)

    q('onboarding-not-now')?.click()

    expect(onboardingShown()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
    await settleAll()
    expect(cloudOfferOpen()).toBe(false)
    expect(identity.made).toBe(0)
  })

  it('goes to the alley without it when the store has no price for the plan', async () => {
    withStore(store({ offer: async () => Promise.resolve(null) }))
    const s = mount()
    await nameNote(s)

    q('onboarding-not-now')?.click()
    await settleAll()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(window.location.hash).toBe(ALLEY)
    expect(identity.made).toBe(0)
  })

  it('goes straight to the alley once the offer has been shown on this install', async () => {
    localStorage.setItem(OFFER_SHOWN_KEY, 'shown')
    const s = mount()
    await nameNote(s)

    q('onboarding-not-now')?.click()
    await settleAll()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
  })

  it('goes on to the alley without it for a subscriber, once the asks have answered', async () => {
    server.next = { ...free, subscribed: true, left: 20 }
    const s = mount()
    await nameNote(s)

    q('onboarding-not-now')?.click()
    await settleAll()

    expect(identity.made).toBe(1)
    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(window.location.hash).toBe(ALLEY)
  })

  it('never comes after a refused mic (S7b E5)', async () => {
    const s = mount()
    await refuse(s, 'denied')

    q('onboarding-not-now')?.click()
    await settleAll()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
    expect(identity.made).toBe(0)
  })

  it('never comes after a mic that would not open (S7b E5)', async () => {
    const s = mount()
    await refuse(s, 'unavailable')

    q('onboarding-not-now')?.click()
    await settleAll()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
  })

  it('comes once the mic has been granted after a refusal', async () => {
    const s = mount()
    await refuse(s, 'denied')
    s.answer = async () => Promise.resolve()
    q('onboarding-retry')?.click()
    await settle()
    s.frames = noteTake(220)
    flushFrame()
    expect(q('onboarding-find-range')).not.toBeNull()

    q('onboarding-not-now')?.click()
    await settleAll()

    expect(cloudOffer()?.source).toBe('onboarding-exit')
  })

  it('leaves at once on a second Not now while the asks are out, and offers nothing after', async () => {
    let answer = (): void => undefined
    identity.hold = new Promise<void>((resolve) => {
      answer = resolve
    })
    const s = mount()
    await nameNote(s)

    q('onboarding-not-now')?.click()
    await settle()
    const busy = q('onboarding-not-now')?.getAttribute('aria-busy')
    const findRange = q('onboarding-find-range')
    const stillUp = onboardingShown()
    // Nothing read out over the way out while its asks are out.
    const quiet = said()
    q('onboarding-not-now')?.click()
    answer()
    await settleAll()

    expect(busy).toBe('true')
    expect(quiet).toBe('')
    expect(outOfReach(findRange)).toBe(true)
    expect(stillUp).toBe(true)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(cloudOfferOpen()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
  })

  it("brings no Keep after Merc's word on a skip", async () => {
    const s = mount()
    await nameNote(s)
    q('onboarding-skip')?.click()

    q('onboarding-not-now')?.click()
    await settleAll()
    vi.advanceTimersByTime(SKIP_BEAT_MS)
    await settle()

    expect(cloudOffer()?.source).toBe('onboarding-exit')
    expect(offerOpen()).toBe(false)
    expect(beat()).toBe('offer')
  })

  it('closes onto the alley after its free account hands over to Keep', async () => {
    const s = mount()
    await nameNote(s)
    q('onboarding-not-now')?.click()
    await settleAll()

    // The offer's "Sign up and confirm your email": it closes, and Keep
    // opens in the same tap (ShellCloudOffer.tsx).
    closeCloudOffer('done')
    openKeep()
    await settle()
    const stayed = onboardingShown()
    k('keep-not-now')?.click()
    await settle()

    expect(stayed).toBe(true)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(window.location.hash).toBe(ALLEY)
    expect(pushed()).toBeNull()
  })

  it("finishes with the end's offer when Not now comes while Continue waits on the asks", async () => {
    // The line's Continue has finished the onboarding: its Not now no
    // longer ends it as a Not now, nor in the alley.
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    let answer = (): void => undefined
    identity.hold = new Promise<void>((resolve) => {
      answer = resolve
    })
    await singLine(s)
    await continueLine()

    q('onboarding-not-now')?.click()
    await settle()
    const busy = q('onboarding-not-now')?.getAttribute('aria-busy')
    answer()
    await settleAll()

    expect(busy).toBe('true')
    expect(cloudOffer()?.source).toBe('onboarding')
    expect(funnel.app).toEqual(['cloud_view_onboarding'])
    closeCloudOffer('not-now')
    await settle()
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
    expect(funnel.sent).toContain('native_onboarding_done')
    expect(funnel.sent).not.toContain('native_onboarding_not_now')
  })

  it('waits three seconds in all on a store slow to price the plan, not three for the price and three more', async () => {
    withStore(
      store({
        offer: async () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ priceText: '\u20ac4.99', title: 'Mercury Pitch Cloud' })
            }, BEFORE_OFFER_MS - 100)
          }),
      }),
    )
    // The server never answers.
    identity.hold = new Promise<void>(() => undefined)
    const s = mount()
    await nameNote(s)

    q('onboarding-not-now')?.click()
    await settleAll()
    vi.advanceTimersByTime(BEFORE_OFFER_MS - 1)
    await settleAll()
    const waiting = cloudOfferOpen()
    vi.advanceTimersByTime(1)
    await settleAll()

    expect(waiting).toBe(false)
    expect(cloudOffer()?.source).toBe('onboarding-exit')
  })

  it("leaves Keep's own Not now going on to the line, after a reveal", async () => {
    const s = mount()
    await measureRange(s)
    expect(beat()).toBe('keep')

    k('keep-not-now')?.click()
    await settle()

    expect(beat()).toBe('line')
    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(true)
  })
})

describe("beat 9's price, asked as the onboarding opens", () => {
  it('asks the store for the plan and its price at once, and makes no identity for it', async () => {
    const offer = vi.fn(async () =>
      Promise.resolve({
        priceText: '\u20ac4.99',
        title: 'Mercury Pitch Cloud',
      }),
    )
    withStore(store({ offer }))

    mount()
    await settleAll()

    expect(offer).toHaveBeenCalledTimes(1)
    expect(identity.made).toBe(0)
  })

  it('asks nothing for an install held out of beat 9', async () => {
    localStorage.setItem(OFFER_GROUP_KEY, 'holdout')
    const offer = vi.fn(async () =>
      Promise.resolve({
        priceText: '\u20ac4.99',
        title: 'Mercury Pitch Cloud',
      }),
    )
    withStore(store({ offer }))

    mount()
    await settleAll()

    expect(offer).not.toHaveBeenCalled()
  })
})

describe("after the line's Continue: the onboarding finished, whatever comes after it", () => {
  /** Skip, sing, Continue: Keep after the line is up. */
  async function sungThenKeep(s: Stand): Promise<void> {
    await skipRange(s)
    await singLine(s)
    await continueLine()
    expect(beat()).toBe('keep')
  }

  it('goes back to the line as Keep closes, its Continue working while beat 9 is decided', async () => {
    const s = mount()
    let answer = (): void => undefined
    identity.hold = new Promise<void>((resolve) => {
      answer = resolve
    })
    await sungThenKeep(s)

    k('keep-not-now')?.click()
    await settleAll()

    // The line as it was left, not the empty stage under Keep, its Not now
    // out of reach and nothing read, for as long as the asks were out.
    expect(beat()).toBe('line')
    expect(q('onboarding-continue')?.getAttribute('aria-busy')).toBe('true')
    expect(outOfReach(q('onboarding-not-now'))).toBe(false)
    expect(said()).not.toBe('')
    answer()
    await settleAll()
    expect(beat()).toBe('offer')
    expect(cloudOffer()?.source).toBe('onboarding')
  })

  it("finishes on Not now from the range Keep's Find your range first runs: counted done, the end's offer, the Warm-up's path", async () => {
    const s = mount()
    await sungThenKeep(s)
    k('keep-find-range')?.click()
    await settle()
    expect(beat()).toBe('range')
    const released = s.calls.release

    q('onboarding-not-now')?.click()
    const shut = s.calls.release
    await settleAll()

    expect(shut).toBeGreaterThan(released)
    expect(cloudOffer()?.source).toBe('onboarding')
    closeCloudOffer('not-now')
    await settle()
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
    expect(funnel.sent).toContain('native_onboarding_done')
    expect(funnel.sent).not.toContain('native_onboarding_not_now')
  })

  it.each(['range', 'reveal'] as const)(
    'takes Back on the %s it brings as finishing too',
    async (where) => {
      const s = mount()
      await sungThenKeep(s)
      k('keep-find-range')?.click()
      await settle()
      if (where === 'reveal') {
        s.frames = slideWindow(52, 40)
        flushFrame()
        s.frames = slideWindow(45, 67)
        flushFrame()
        q('onboarding-see-voice')?.click()
        await settle()
      }
      expect(beat()).toBe(where)

      performBack({
        canGoBack: false,
        back: () => undefined,
        minimize: () => undefined,
      })
      await settleAll()

      expect(cloudOffer()?.source).toBe('onboarding')
      closeCloudOffer('not-now')
      await settle()
      expect(onboardingExit()).toBe('finished')
      expect(pushed()).toBe('warm-up')
      expect(funnel.sent).not.toContain('native_onboarding_not_now')
    },
  )

  it('goes on at once, finished, on a second Not now while the asks are out', async () => {
    const s = mount()
    identity.hold = new Promise<void>(() => undefined)
    await sungThenKeep(s)
    k('keep-find-range')?.click()
    await settle()

    q('onboarding-not-now')?.click()
    await settle()
    const stillUp = onboardingShown()
    q('onboarding-not-now')?.click()
    await settleAll()

    expect(stillUp).toBe(true)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(cloudOfferOpen()).toBe(false)
    expect(pushed()).toBe('warm-up')
  })
})

describe('Keep after the line, once a range was skipped (beat 7)', () => {
  /** A skipped range, the line sung, and its Continue: Keep. */
  async function keepAfterLine(s: Stand): Promise<void> {
    await skipRange(s)
    await singLine(s)
    await continueLine()
  }

  it("comes on the line's Continue: Save your progress, with Find your range first and no card", async () => {
    const s = mount()
    await keepAfterLine(s)

    expect(beat()).toBe('keep')
    expect(offerOpen()).toBe(true)
    expect(k('account-offer')?.dataset.variant).toBe('progress')
    expect(k('keep-voiceprint')).toBeNull()
    expect(k('keep-find-range')?.textContent).toBe(KEEP.findRange)
    // Done for good at the line's Continue, Keep or no Keep.
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    expect(layer()?.getAttribute('aria-label')).toBe(ONBOARDING_COPY.lineTitle)
    expect(said()).toBe('')
    expect(cloudOfferOpen()).toBe(false)
  })

  it('runs the range here from its Find your range first, the mic opened in that tap, then Keep again, then the offer', async () => {
    const s = mount()
    await keepAfterLine(s)
    const acquired = s.calls.acquire

    k('keep-find-range')?.click()

    expect(beat()).toBe('range')
    expect(s.calls.acquire).toBe(acquired + 1)
    expect(said()).toBe(ONBOARDING_COPY.slideDown)
    await settle()
    s.frames = slideWindow(52, 40)
    flushFrame()
    s.frames = slideWindow(45, 67)
    flushFrame()
    q('onboarding-see-voice')?.click()
    q('onboarding-continue')?.click()
    await settle()
    expect(beat()).toBe('keep')
    expect(k('account-offer')?.dataset.variant).toBe('voiceprint')
    expect(keepArrival()).toBe('reveal')

    k('keep-not-now')?.click()
    await settleAll()

    // Not a second line: the line was sung; on to beat 9.
    expect(beat()).toBe('offer')
    expect(voice.sung).toHaveLength(1)
  })

  it('runs the range from its Find your range first where a View Transition draws it a frame later, and nothing else', async () => {
    const s = mount()
    await keepAfterLine(s)
    const acquired = s.calls.acquire
    const draw = standInViewTransitions()

    k('keep-find-range')?.click()
    // Keep's close is checked once its tap is over, before the frame that
    // draws the range: it must see the range coming, not the end.
    await settleAll()
    draw()
    await settle()

    expect(beat()).toBe('range')
    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(true)
    expect(s.calls.acquire).toBe(acquired + 1)
    expect(said()).toBe(ONBOARDING_COPY.slideDown)
  })

  it("brings Keep back from the range's own Skip for now, when Keep ran it", async () => {
    const s = mount()
    await keepAfterLine(s)
    k('keep-find-range')?.click()
    await settle()
    // Stopped mid-slide: the mic is down, and Skip for now is back.
    q('onboarding-mic')?.click()

    q('onboarding-skip')?.click()
    // Keep, with its Find your range first, is what comes back.
    expect(said()).toBe(ONBOARDING_COPY.skippedToKeep)
    vi.advanceTimersByTime(SKIP_BEAT_MS)
    await settle()

    expect(beat()).toBe('keep')
    expect(offerOpen()).toBe(true)
    expect(k('account-offer')?.dataset.variant).toBe('progress')
    expect(voice.sung).toHaveLength(1)
  })

  it('stays on Keep while it hands over to the sign-in sheet, and goes on to the end when that closes', async () => {
    const s = mount()
    await keepAfterLine(s)

    k('keep-email')?.click()
    await settle()
    const handedOver = signInOpen()
    const stayed = beat()
    resetSignIn()
    await settleAll()

    expect(handedOver).toBe(true)
    expect(stayed).toBe('keep')
    expect(beat()).toBe('offer')
    expect(voice.sung).toHaveLength(1)
  })

  it('is not asked for on a phone with an account: the line goes on to the end', async () => {
    setAuthToken(token('google'))
    const s = mount()
    await keepAfterLine(s)

    expect(offerOpen()).toBe(false)
    expect(beat()).toBe('offer')
  })
})

describe('beat 9, the Cloud offer', () => {
  it('opens on Continue, a skipped range and all, over the layer, once Keep after the line has closed', async () => {
    const s = mount()
    await skipRange(s)
    await singLine(s)

    await continueLine()
    expect(beat()).toBe('keep')
    k('keep-not-now')?.click()
    await settleAll()

    expect(beat()).toBe('offer')
    expect(cloudOffer()?.source).toBe('onboarding')
    expect(localStorage.getItem(OFFER_SHOWN_KEY)).toBe('shown')
    // The sheet's Not now is the way out, and the sheet says it all.
    expect(outOfReach(q('onboarding-not-now'))).toBe(true)
    expect(q('onboarding-offer')).not.toBeNull()
    expect(said()).toBe('')
    expect(onboardingShown()).toBe(true)
    // Merc goes with the offer, small by its art (S7b beat 9): handed to
    // the sheet, and not left on the stage under it.
    expect((cloudOfferGuest() as HTMLElement | null)?.dataset.testid).toBe(
      'onboarding-merc',
    )
    expect(
      q('onboarding-offer')?.querySelector('[data-testid="onboarding-merc"]'),
    ).toBeNull()
  })

  it("lands on the Warm-up's path once the offer's Not now closes it, the onboarding done", async () => {
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)
    await continueLine()
    expect(beat()).toBe('offer')
    // Done already, and counted: an app closed on the offer never opens the
    // onboarding again, nor comes back to count it.
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    const doneCount = (): number =>
      funnel.sent.filter((event) => event === 'native_onboarding_done').length
    expect(doneCount()).toBe(1)

    closeCloudOffer('not-now')
    await settle()
    expect(doneCount()).toBe(1)

    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    expect(cloudOfferGuest()).toBeNull()
  })

  it("takes Back as the offer's Not now, then lands on the Warm-up's path", async () => {
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)
    await continueLine()

    const outcome = performBack({
      canGoBack: false,
      back: () => undefined,
      minimize: () => undefined,
    })
    await settle()

    expect(outcome).toBe('sheet')
    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
  })

  it("stays up while its free account hands over to Keep, then lands on the Warm-up's path", async () => {
    const s = mount()
    await skipRange(s)
    await singLine(s)
    await continueLine()
    k('keep-not-now')?.click()
    await settleAll()

    // The offer's "Sign up and confirm your email": it closes, and Keep
    // opens in the same tap (ShellCloudOffer.tsx).
    closeCloudOffer('done')
    openKeep()
    await settle()
    const stayed = beat()
    k('keep-not-now')?.click()
    await settle()

    expect(stayed).toBe('offer')
    expect(beat()).toBe('offer')
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
    expect(voice.sung).toHaveLength(1)
  })

  it("runs the range from that Keep's Find your range first, then lands on the Warm-up's path, not on a second line", async () => {
    const s = mount()
    await skipRange(s)
    await singLine(s)
    await continueLine()
    k('keep-not-now')?.click()
    await settleAll()
    closeCloudOffer('done')
    openKeep()
    await settle()

    k('keep-find-range')?.click()
    expect(beat()).toBe('range')
    await settle()
    s.frames = slideWindow(52, 40)
    flushFrame()
    s.frames = slideWindow(45, 67)
    flushFrame()
    q('onboarding-see-voice')?.click()
    q('onboarding-continue')?.click()
    await settle()
    expect(beat()).toBe('keep')
    k('keep-not-now')?.click()
    await settle()

    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
    expect(voice.sung).toHaveLength(1)
  })

  it('holds Continue while the asks are out, then opens', async () => {
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    let answer = (): void => undefined
    identity.hold = new Promise<void>((resolve) => {
      answer = resolve
    })
    await singLine(s)

    await continueLine()
    const busy = q('onboarding-continue')?.getAttribute('aria-busy')
    const before = cloudOfferOpen()
    answer()
    await settleAll()

    expect(busy).toBe('true')
    expect(before).toBe(false)
    expect(beat()).toBe('offer')
  })

  it("is not opened for the install held out: on to the Warm-up's path, nothing asked", async () => {
    localStorage.setItem(OFFER_GROUP_KEY, 'holdout')
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)

    await continueLine()

    expect(cloudOfferOpen()).toBe(false)
    expect(identity.made).toBe(0)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
  })

  it("is not opened for a subscriber: on to the Warm-up's path", async () => {
    server.next = { ...free, subscribed: true, left: 20 }
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)

    await continueLine()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
  })

  it("is not opened where nothing can be bought: on to the Warm-up's path, nothing asked", async () => {
    withStore(null)
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)

    await continueLine()

    expect(cloudOfferOpen()).toBe(false)
    expect(identity.made).toBe(0)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
  })

  it("is not opened when the store has no price for the plan: on to the Warm-up's path", async () => {
    withStore(store({ offer: async () => Promise.resolve(null) }))
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)

    await continueLine()

    expect(cloudOfferOpen()).toBe(false)
    expect(identity.made).toBe(0)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
  })

  it('is not opened twice on one install', async () => {
    localStorage.setItem(OFFER_SHOWN_KEY, 'shown')
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)

    await continueLine()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(pushed()).toBe('warm-up')
  })

  it('draws the install its group as the onboarding opens', () => {
    localStorage.removeItem(OFFER_GROUP_KEY)

    mount()

    expect(['offer', 'holdout']).toContain(
      localStorage.getItem(OFFER_GROUP_KEY),
    )
  })
})

describe('beats 8 and 9, counted (S7b §7)', () => {
  it('counts the line as it shows, once scored, and its band, then Keep, the offer it opens and the end', async () => {
    const s = mount()
    await skipRange(s)
    await singLine(s)
    await continueLine()
    expect(beat()).toBe('keep')
    k('keep-not-now')?.click()
    await settleAll()
    expect(beat()).toBe('offer')
    // Keep after the line is Save your progress, counted on its beat 7.
    expect(funnel.sent).toContain('native_onboarding_keep_view_progress')
    expect(funnel.sent).toContain('native_onboarding_keep_not_now')

    closeCloudOffer('not-now')
    await settle()

    expect(
      funnel.sent.filter((event) => event.startsWith('native_onboarding_line')),
    ).toEqual([
      'native_onboarding_line_view',
      'native_onboarding_line_complete',
      'native_onboarding_line_sung_all',
    ])
    expect(funnel.app).toEqual(['cloud_view_onboarding'])
    expect(funnel.sent.slice(-2)).toEqual([
      'native_onboarding_done',
      'native_onboarding_path_view',
    ])
  })

  it('counts a line half sung in its band', async () => {
    const s = mount()
    await skipRange(s)
    q('onboarding-mic')?.click()
    await settle()
    await settle()
    // The first five notes on pitch, then nothing to the turn's end.
    const turn = lineNotes(60, TURN_AT + COUNT_IN_SEC)
    const frames = take(
      turn[turn.length - 1].to + TURN_TAIL_SEC,
      turn.slice(0, 5),
    )
    s.frames = frames.filter((frame) => frame.t <= TURN_AT)
    flushFrame()
    s.frames = frames
    flushFrame()
    await settle()
    expect(q('onboarding-sung-score')?.textContent).toBe(lineScoreText(5, 10))

    expect(
      funnel.sent.filter((event) =>
        event.startsWith('native_onboarding_line_sung'),
      ),
    ).toEqual(['native_onboarding_line_sung_4_6'])
  })
})
