// ============================================================
// The output check: where the page's sound goes now, read fresh
// ============================================================
//
// A context runs for life at the rate WebKit's output had as it was made,
// and the AirPlay guess reads AirPlay from that rate (airplay-suspicion.ts).
// The app's one shared clock is made once and never closed, so a clock made
// at launch, before WebKit's output took the AirPlay route, reads the
// speaker's 48 kHz for good, and a store build read no other context. On a
// cold start with AirPlay already on (TestFlight mp-v0.8.57, an iPhone 11 Pro
// and a 13 Pro, an LG C2) nothing said AirPlay: the lock screen's carrier and
// the unlock clip played beside the song, and the song reached neither the
// TV nor the phone, until the Developer screen's button 3 made a fresh
// context at 44.1 kHz. And once AirPlay went, the page's rate stayed at 44.1
// until a context was made, so the guess, and the words that follow it,
// stayed on AirPlay.
//
// So the app checks: a throwaway `new AudioContext()` with no rate asked
// for, its `sampleRate` read, closed at once, and the rate handed to the
// guess as the page's newest context's. Never resumed: a context's rate is
// set as it is made, and a clock resumed before the element that takes the
// session is the order that left WebKit's clock running in silence after
// another app had the sound (audio-unlock.ts, `unlockForPlayback`). When:
//
//   - a room shown (the app's shell/room-shown.ts): a tab, the way back to
//     it from a pushed screen, a premium room's door;
//   - a start, inside its gesture and before the clip or the carrier decide
//     anything: a press of play, or a tap that would play the unlock clip
//     (`checkForStart`, which audio-unlock.ts asks through the app);
//   - the app in front again (iOS's active, which closing Control Center,
//     where AirPlay is chosen, gives as well) and the page shown again;
//   - every change of route the phone reports;
//   - a song playing a moment (SONG_SETTLE_MS, the Karaoke room's): with
//     WebKit's session idle at the press, the press's check may read where
//     the sound was rather than where it goes.
//
// FAIL SAFE AT A START. The clip and the carrier play beside the room's Web
// Audio only where the start's own check says the sound stays here, or a
// screen is connected (Screen Mirroring carries the room as it always has).
// Where it says AirPlay, or cannot run (no context, WebKit's limit, the last
// one still closing), nothing plays beside the song (`webAudioAlone`): the
// song is always heard, and at worst the lock screen goes without it. A
// later check that says the sound stays here brings both back.
//
// LIMITS. iOS caps the contexts a page holds, so one at a time: none is made
// while the last is closing (up to CLOSE_WAIT_MS). A start takes the check
// its own tap made a moment before (START_REUSE_MS), or the one still
// closing, rather than wait in its gesture; the other moments wait for the
// close.
//
// UNVERIFIED: whether a context made outside a gesture, WebKit's session
// idle, reads the output's rate. "In a gesture" is the page's own word
// (`navigator.userActivation.isActive`), or where the page gives none, true
// for a start alone. One line a check, shown by default, with the route's
// kind and never a port's name (audio-route-store.ts says why):
//
//   [audio route] check (play, in a gesture): a fresh context at 44100 Hz, the phone's session at 48000 Hz on speaker: AirPlay alone

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { AirPlayFacts } from '@/stores/airplay-suspicion'
import { airPlayAlone, airPlayFacts, notePageAudioContext, } from '@/stores/airplay-suspicion'
import type { NativeAudioOutput } from '@/stores/native-shell-store'

/** The moment a check was made for. */
export type OutputCheckWhy =
  | 'play'
  | 'tap'
  | 'room'
  | 'page'
  | 'app'
  | 'route'
  | 'song'

/** A start: a press of play, or a tap that would play the unlock clip. */
export type OutputStart = Extract<OutputCheckWhy, 'play' | 'tap'>

/** The sound stays here, goes to AirPlay alone, or the check cannot tell. */
export type OutputVerdict = 'local' | 'airplay' | 'unknown'

export interface OutputCheck {
  readonly why: OutputCheckWhy
  /** Made inside a user's gesture (see the header). */
  readonly gesture: boolean
  /** When, by the phone's clock, in ms since the epoch. */
  readonly at: number
  /** The fresh context's rate in Hz, or null where none could be made. */
  readonly rate: number | null
  /** Why none was made, or null. */
  readonly failure: string | null
  readonly verdict: OutputVerdict
}

/** The throwaway context: a rate to read, and a close. */
export interface OutputProbe {
  readonly sampleRate: number
  close(): Promise<void>
}

/** What a check reaches: the page, or a test's stand-ins. */
export interface OutputCheckHost {
  /** A fresh context with no rate asked for; null without Web Audio. May throw. */
  readonly makeProbe: () => OutputProbe | null
  /** Whether the page has a user's gesture now; null where it cannot say. */
  readonly inGesture: () => boolean | null
  readonly now: () => number
  readonly say: (line: string) => void
}

/** The moments a check is made at, beside a start and a song. */
export interface OutputCheckMoments {
  /** Test seam: the page's own context, clock and console otherwise. */
  readonly host?: Partial<OutputCheckHost>
  /** The phone's output, each change of route a moment. */
  readonly output?: NativeAudioOutput
  /** The app in front or behind, as iOS says. */
  readonly appState?: (
    handler: (state: 'active' | 'background') => void,
  ) => () => void
  /** Each room the shell shows. */
  readonly roomShown?: (handler: () => void) => () => void
  /** The page whose return to view is a moment; this one when not given. */
  readonly page?: Pick<
    Document,
    'visibilityState' | 'addEventListener' | 'removeEventListener'
  >
}

/** A route that moved, or the app back, settles this long before a check. */
export const CHECK_SETTLE_MS = 400
/** A song plays this long before its output is read again. */
export const SONG_SETTLE_MS = 1500
/** A start takes its own tap's check younger than this. */
export const START_REUSE_MS = 1000
/** A context whose close has not settled by then no longer holds the place. */
export const CLOSE_WAIT_MS = 2000

/** Each moment as the line and the Developer screen say it. */
export const OUTPUT_CHECK_MOMENTS: Readonly<Record<OutputCheckWhy, string>> = {
  play: 'play',
  tap: 'a tap',
  room: 'a room shown',
  page: 'the page shown',
  app: 'the app in front',
  route: 'a route change',
  song: 'a song playing',
}

let host: OutputCheckHost | null = null
/** The last probe, until its close has settled, with the check it made. */
let closing: { readonly check: OutputCheck } | null = null
let soonTimer: ReturnType<typeof setTimeout> | undefined
let soonWhy: OutputCheckWhy | null = null
const [last, setLast] = createSignal<OutputCheck | null>(null)
const [unconfirmed, setUnconfirmed] = createSignal(false)

/** The last check made, for the Developer screen's readout. */
export const lastOutputCheck: Accessor<OutputCheck | null> = last

/**
 * Whether nothing may play beside the page's Web Audio: the sound goes to
 * AirPlay alone, or a start could not check that it stays here and no check
 * has said so since. The lock screen's carrier and the unlock clip follow it
 * (native-device.ts in the app).
 */
export const webAudioAlone = (): boolean =>
  airPlayAlone() || (unconfirmed() && !airPlayFacts().screen)

const isStart = (why: OutputCheckWhy): boolean =>
  why === 'play' || why === 'tap'

const nameOf = (error: unknown): string =>
  error instanceof Error || error instanceof DOMException
    ? error.name
    : String(error)

const rateOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null

const hz = (rate: number): string => `${String(Math.round(rate))} Hz`

/** The page's own context, clock and console. */
function pageHost(): OutputCheckHost {
  return {
    makeProbe: () => {
      const Made =
        typeof AudioContext === 'function'
          ? AudioContext
          : (globalThis as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
      return Made === undefined ? null : new Made()
    },
    inGesture: () => {
      const active = (
        globalThis.navigator as
          | { userActivation?: { readonly isActive?: unknown } }
          | undefined
      )?.userActivation?.isActive
      return typeof active === 'boolean' ? active : null
    },
    now: () => Date.now(),
    say: (line) => {
      console.info(line)
    },
  }
}

const busy = (using: OutputCheckHost): boolean =>
  closing !== null && using.now() - closing.check.at < CLOSE_WAIT_MS

/** Close the probe; it holds the one place until its close has settled. */
function close(probe: OutputProbe, check: OutputCheck): void {
  const held = { check }
  closing = held
  const settle = (): void => {
    if (closing === held) closing = null
  }
  try {
    void probe.close().then(settle, settle)
  } catch {
    settle()
  }
}

/** What the check says, in the line's last words. */
function verdictWords(check: OutputCheck): string {
  if (check.verdict === 'airplay') return 'AirPlay alone'
  if (check.verdict === 'local') return 'local'
  return isStart(check.why)
    ? "unknown, so nothing plays beside the room's sound"
    : 'unknown'
}

/** The console's line for a check: the moment, both rates, the route's kind. */
export function outputCheckLine(
  check: OutputCheck,
  facts: AirPlayFacts,
): string {
  const moment = `${OUTPUT_CHECK_MOMENTS[check.why]}, ${check.gesture ? 'in a gesture' : 'outside a gesture'}`
  const fresh =
    check.rate === null
      ? `no fresh context (${check.failure ?? 'none made'})`
      : `a fresh context at ${hz(check.rate)}`
  const session =
    facts.route === null
      ? "the phone's session not read"
      : `the phone's session at ${facts.sessionRate === null ? 'an unknown rate' : hz(facts.sessionRate)} on ${facts.route}`
  const screen = facts.screen ? ', a screen connected' : ''
  return `[audio route] check (${moment}): ${fresh}, ${session}${screen}: ${verdictWords(check)}`
}

/** A fresh context with its rate, or why there is none. */
function freshProbe(using: OutputCheckHost): {
  readonly probe: OutputProbe | null
  readonly rate: number | null
  readonly failure: string | null
} {
  if (busy(using)) {
    return {
      probe: null,
      rate: null,
      failure: "the last check's context is still closing",
    }
  }
  let probe: OutputProbe | null
  try {
    probe = using.makeProbe()
  } catch (error) {
    return { probe: null, rate: null, failure: nameOf(error) }
  }
  if (probe === null) return { probe, rate: null, failure: 'no Web Audio' }
  const rate = rateOf(probe.sampleRate)
  return { probe, rate, failure: rate === null ? 'no rate' : null }
}

/** What the guess says now: the route's word, or the rates', or nothing. */
function verdictNow(rate: number | null, facts: AirPlayFacts): OutputVerdict {
  if (airPlayAlone()) return 'airplay'
  return facts.screen || rate !== null ? 'local' : 'unknown'
}

/**
 * Check now: a fresh context, its rate to the guess, and what that says.
 * Null where the app does not follow the moments (the web). With the last
 * context still closing none is made, and the check says so.
 */
export function checkOutput(
  why: OutputCheckWhy,
  gesture?: boolean,
): OutputCheck | null {
  const using = host
  if (using === null) return null
  const at = using.now()
  const { probe, rate, failure } = freshProbe(using)
  // The newest context the page made at its output's rate.
  if (probe !== null && rate !== null) notePageAudioContext(probe)
  const facts = airPlayFacts()
  const check: OutputCheck = {
    why,
    gesture: using.inGesture() ?? gesture ?? isStart(why),
    at,
    rate,
    failure,
    verdict: verdictNow(rate, facts),
  }
  if (probe !== null) close(probe, check)
  if (check.verdict === 'local') setUnconfirmed(false)
  setLast(check)
  using.say(outputCheckLine(check, facts))
  return check
}

function checkWhenFree(): void {
  soonTimer = undefined
  const using = host
  const why = soonWhy
  if (using === null || why === null) return
  if (busy(using)) {
    soonTimer = setTimeout(checkWhenFree, CHECK_SETTLE_MS)
    return
  }
  soonWhy = null
  checkOutput(why, false)
}

/**
 * Check once the moment has settled: the newest of several asked for within
 * `delayMs` is made, after any context still closing.
 */
export function checkOutputSoon(
  why: OutputCheckWhy,
  delayMs = CHECK_SETTLE_MS,
): void {
  if (host === null) return
  soonWhy = why
  clearTimeout(soonTimer)
  soonTimer = setTimeout(checkWhenFree, delayMs)
}

/**
 * A start's check, inside its gesture and before the clip or the carrier
 * decide: true where they may play, false where they stand aside. Its own
 * tap's check of a moment before answers for it, and so does one whose
 * context is still closing; otherwise it makes its own. True where the app
 * does not check (the web), as it always was.
 */
export function checkForStart(start: OutputStart): boolean {
  const using = host
  if (using === null) return true
  const recent = last()
  const fresh =
    recent !== null &&
    using.now() - recent.at < START_REUSE_MS &&
    (recent === closing?.check || (recent.gesture && isStart(recent.why)))
  const check = fresh ? recent : checkOutput(start)
  if (check === null) return true
  if (check.verdict === 'unknown') setUnconfirmed(true)
  return check.verdict === 'local'
}

/** A room shown: checked at once, or once the last context has closed. */
function checkRoom(): void {
  const using = host
  if (using === null) return
  if (busy(using)) checkOutputSoon('room')
  else checkOutput('room')
}

/**
 * Check where the sound goes at each moment that matters, from now on (see
 * the header), and at every start the app asks about. Once, from the app's
 * entry; returns the stop.
 */
export function followOutputChecks(
  moments: OutputCheckMoments = {},
): () => void {
  host = { ...pageHost(), ...moments.host }
  const stops: (() => void)[] = []
  const watchRoute = moments.output?.watchRoute
  if (watchRoute !== undefined) {
    stops.push(
      watchRoute(() => {
        checkOutputSoon('route')
      }),
    )
  }
  if (moments.appState !== undefined) {
    stops.push(
      moments.appState((state) => {
        if (state === 'active') checkOutputSoon('app')
      }),
    )
  }
  const page =
    moments.page ?? (typeof document === 'undefined' ? undefined : document)
  if (page !== undefined) {
    const onVisibility = (): void => {
      if (page.visibilityState === 'visible') checkOutputSoon('page')
    }
    page.addEventListener('visibilitychange', onVisibility)
    stops.push(() => {
      page.removeEventListener('visibilitychange', onVisibility)
    })
  }
  if (moments.roomShown !== undefined) stops.push(moments.roomShown(checkRoom))
  return () => {
    for (const stop of stops) stop()
    clearTimeout(soonTimer)
    soonTimer = undefined
    soonWhy = null
    host = null
  }
}

/** Tests only: no host, no check, nothing closing or waiting. */
export function resetOutputCheckForTests(): void {
  clearTimeout(soonTimer)
  soonTimer = undefined
  soonWhy = null
  host = null
  closing = null
  setLast(null)
  setUnconfirmed(false)
}
