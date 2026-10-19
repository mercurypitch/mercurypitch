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
import { setAuthToken } from '@/db/services/user-service'
import type { CallVoice } from '@/features/echo/merc-call'
import type * as Songs from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSongs } from '@/features/karaoke-room/karaoke-songs'
import type * as Funnel from '@/features/onboarding/funnel'
import type * as Analytics from '@/lib/analytics'
import type * as MicSentinel from '@/lib/mic-sentinel'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { RESPONSE_GATE_SECONDS } from '@/lib/sequence/sequence-engine'
import { resetRoomArrivalHolds } from '@/stores/native-shell-store'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { onboardingShown, setOnboardingShown } from '../shell/run-shell-store'
import { forgetAccountOffer, offerOpen, openKeep, } from '../shell/settings/account-offer'
import { AccountOfferSheet } from '../shell/settings/AccountOffer'
import { resetSignIn } from '../shell/settings/sign-in-state'
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

import { closeCloudOffer, cloudOffer, cloudOfferGuest, cloudOfferOpen, resetCloudOfferForTests, } from '@/features/karaoke-room/cloud-offer-store'
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

/** Merc's call starts this far in: Echo's lead. */
const LEAD = 0.35
/** Merc's call is over, and the gate after it. */
const TURN_AT = LEAD + LINE_SEC + RESPONSE_GATE_SECONDS

let view: RenderedShell | null = null
let shell: (() => void) | null = null

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
})

afterEach(() => {
  view?.unmount()
  view = null
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

/** One note, then Skip for now, and Merc's word: Keep, or the line. */
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

/** Promises a few hops deep answered: the asks before the offer. */
async function settleAll(): Promise<void> {
  for (let i = 0; i < 6; i++) await settle()
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
  it("comes after Keep's Not now, and is sung from C4 after a skipped range", async () => {
    const s = mount()
    await skipRange(s)
    expect(offerOpen()).toBe(true)

    k('keep-not-now')?.click()
    await settle()

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

    // A little under the middle of E2 to G4: C sharp 3.
    await singLine(s, 49)

    expect(voice.sung[0][0]).toBe(49)
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

  it('shuts its mic at once when Not now is tapped mid-line', async () => {
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s, 60, TURN_AT + COUNT_IN_SEC + 2)
    const singing = q('onboarding-mic')?.getAttribute('data-state')
    const released = s.calls.release

    q('onboarding-not-now')?.click()

    expect(singing).toBe('sing')
    expect(s.calls.release).toBeGreaterThan(released)
    expect(onboardingShown()).toBe(false)
    expect(cloudOfferOpen()).toBe(false)
  })

  it('leaves on Not now with no offer, and marks none shown', async () => {
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)

    q('onboarding-not-now')?.click()
    await settle()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(localStorage.getItem(OFFER_SHOWN_KEY)).toBeNull()
  })
})

describe('beat 9, the Cloud offer', () => {
  it('opens on Continue, a skipped range and all, over the layer', async () => {
    const s = mount()
    await skipRange(s)
    k('keep-not-now')?.click()
    await settle()
    await singLine(s)

    await continueLine()

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

  it("goes on to the Sing room once the offer's Not now closes it, the onboarding done", async () => {
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)
    await continueLine()
    expect(beat()).toBe('offer')

    closeCloudOffer('not-now')
    await settle()

    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    expect(cloudOfferGuest()).toBeNull()
  })

  it("takes Back as the offer's Not now, then goes on to the Sing room", async () => {
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
  })

  it('stays up while its free account hands over to Keep, then lands in the Sing room', async () => {
    const s = mount()
    await skipRange(s)
    k('keep-not-now')?.click()
    await settle()
    await singLine(s)
    await continueLine()

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
    expect(voice.sung).toHaveLength(1)
  })

  it("runs the range from that Keep's Find your range first, then lands in the Sing room, not on a second line", async () => {
    const s = mount()
    await skipRange(s)
    k('keep-not-now')?.click()
    await settle()
    await singLine(s)
    await continueLine()
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

  it('is not opened for the install held out: on to the Sing room, nothing asked', async () => {
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
  })

  it('is not opened for a subscriber: on to the Sing room', async () => {
    server.next = { ...free, subscribed: true, left: 20 }
    setAuthToken(token('google'))
    const s = mount()
    await skipRange(s)
    await singLine(s)

    await continueLine()

    expect(cloudOfferOpen()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('finished')
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
  it('counts the line as it shows, once scored, and its band, then the offer it opens and the end', async () => {
    const s = mount()
    await skipRange(s)
    k('keep-not-now')?.click()
    await settle()
    await singLine(s)
    await continueLine()
    expect(beat()).toBe('offer')

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
    expect(funnel.sent.at(-1)).toBe('native_onboarding_done')
  })

  it('counts a line half sung in its band', async () => {
    const s = mount()
    await skipRange(s)
    k('keep-not-now')?.click()
    await settle()
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
