// ============================================================
// AirPlay suspected — where the page's sound likely goes, from its rate
// ============================================================
//
// The route (audio-route-store.ts) is the app's own AVAudioSession's, and
// WebKit plays the page from a session of its own, in its GPU process. With
// the owner's iPhone sending the sound to an LG TV over AirPlay (3 Nov
// 2026), every route the app's session reported was the speaker at 48 kHz,
// before and after the TV took the sound. So the route never says airplay,
// and nothing that waits for it to (the stopped-song notice's words) ever
// happened.
//
// The page sees one thing the app's session cannot: the rate its
// AudioContexts run at. A context takes the rate of the output WebKit's
// session has as the context is made, and AirPlay's is 44.1 kHz. The
// census said so (`context-made n=2 ... rate=44100`), where contexts made
// on the speaker earlier ran at 48 kHz. So the sound is likely on AirPlay
// when, all at once:
//
//   - the page's newest context runs at a rate other than the app's
//     session's (`audioSessionRate`);
//   - the app's session plays on the built-in speaker or the receiver.
//     Bluetooth, headphones, HDMI and an airplay route all show in the
//     app's session, so none of them is suspected;
//   - no screen is connected. Screen Mirroring, or a cable, is how a TV
//     gets the room and its sound properly, and it moves WebKit's rate too.
//
// The newest context the page made at the output's rate is the one read
// (`notePageAudioContext`): the shared clock, the moment the app makes it,
// and on a test build every context the census sees made without a rate
// asked for. A context keeps its rate for life, so a clock made before
// AirPlay was taken says nothing of it, and one made on AirPlay says it
// until a newer context is made.
//
// Each change is one line, shown by default (console.info):
//
//   [audio route] the page plays at 44100 Hz, the phone's session at 48000 Hz on Speaker: the sound is likely on AirPlay
//
// What follows from it, and from a route that says airplay (`airPlayAlone`):
// a song that starts says, once a launch, that AirPlay cannot carry the
// room's sound to a TV and Screen Mirroring can (KaraokeAirPlayHint.tsx),
// and the stopped-song notice says the same (sound-stopped.ts). On the
// owner's LG C2 the TV showed the song's name and a spinner, and no sound
// came from the TV or the phone, while the song's clock ran on. An iPhone
// 11's own session did say airplay, at 44.1 kHz like the page, where the
// rate alone could not have told: so the route counts as well.
//
// The room says each song it starts (`noteSongStart`); on AirPlay alone,
// whoever listens hears it (`onSongStartOnAirPlay`): a test build writes
// its audio report into the console then (audio-report.ts in the app),
// since leaving the room for the Developer screen stops the song.

import { createEffect, createRoot, createSignal } from 'solid-js'
import { audioRoute, audioSessionRate } from '@/stores/audio-route-store'
import type { NativeAudioRoute } from '@/stores/native-shell-store'

/** What the guess is made from. */
export interface AirPlayFacts {
  /** The app's own session's route. */
  readonly route: NativeAudioRoute | null
  /** The app's own session's sample rate, Hz. */
  readonly sessionRate: number | null
  /** The rate the page's newest context runs at, Hz. */
  readonly pageRate: number | null
  /** A screen connected: Screen Mirroring or a cable. */
  readonly screen: boolean
}

const [pageRate, setPageRate] = createSignal<number | null>(null)
const [screen, setScreen] = createSignal(false)
let seen = new WeakSet<object>()
const startListeners = new Set<() => void>()

/** The two routes the app's session reports while WebKit's is on AirPlay. */
const BUILT_IN: Partial<Record<NativeAudioRoute, string>> = {
  speaker: 'Speaker',
  receiver: 'Receiver',
}

/** Whether these facts put the page's sound on AirPlay, likely. Pure. */
export function suspectsAirPlay(facts: AirPlayFacts): boolean {
  if (facts.screen || facts.route === null) return false
  if (BUILT_IN[facts.route] === undefined) return false
  return (
    facts.pageRate !== null &&
    facts.sessionRate !== null &&
    Math.round(facts.pageRate) !== Math.round(facts.sessionRate)
  )
}

/** The facts as they stand. */
export const airPlayFacts = (): AirPlayFacts => ({
  route: audioRoute(),
  sessionRate: audioSessionRate(),
  pageRate: pageRate(),
  screen: screen(),
})

/** Whether the page's sound is likely on AirPlay now. */
export const airPlaySuspected = (): boolean => suspectsAirPlay(airPlayFacts())

/**
 * Whether the page's sound goes to AirPlay alone: the route says airplay,
 * or the page's rate says it, and no screen is connected. On the owner's
 * LG C2 the room's sound reached neither the TV nor the phone that way,
 * while Screen Mirroring carried the room and its sound (3 Nov 2026): what
 * the Karaoke room says turns on this.
 */
export const airPlayAlone = (): boolean =>
  !screen() && (audioRoute() === 'airplay' || airPlaySuspected())

/** Hear each Karaoke song that starts on AirPlay alone. Returns the stop. */
export function onSongStartOnAirPlay(listener: () => void): () => void {
  startListeners.add(listener)
  return () => {
    startListeners.delete(listener)
  }
}

/** A Karaoke song started: told to whoever listens, on AirPlay alone. */
export function noteSongStart(): void {
  if (!airPlayAlone()) return
  for (const listener of [...startListeners]) {
    try {
      listener()
    } catch {
      // A report that broke must not stop the song.
    }
  }
}

/**
 * A context the page made at the rate its output runs at: no rate was asked
 * for. Read once, as it is first seen: the newest context tells.
 */
export function notePageAudioContext(context: {
  readonly sampleRate: number
}): void {
  if (seen.has(context)) return
  seen.add(context)
  const rate = context.sampleRate
  if (Number.isFinite(rate) && rate > 0) setPageRate(rate)
}

const hz = (rate: number | null): string => `${Math.round(rate ?? 0)} Hz`

/** Why AirPlay is not suspected (any more), in a few words. */
function whyNot(facts: AirPlayFacts): string {
  if (facts.screen) return 'a screen is connected (Screen Mirroring or a cable)'
  if (facts.route === null || BUILT_IN[facts.route] === undefined) {
    return `the phone's session plays on ${facts.route ?? 'an unknown route'}`
  }
  if (facts.pageRate === null || facts.sessionRate === null) {
    return 'the rates are not known'
  }
  return `the page plays at ${hz(facts.pageRate)}, as the phone's session does`
}

/** The console's line for a change of the guess: its facts, and no port's name. */
export function airPlayLine(facts: AirPlayFacts, suspected: boolean): string {
  if (!suspected)
    return `[audio route] ${whyNot(facts)}: AirPlay no longer suspected`
  const on = facts.route === null ? '' : (BUILT_IN[facts.route] ?? '')
  return `[audio route] the page plays at ${hz(facts.pageRate)}, the phone's session at ${hz(facts.sessionRate)} on ${on}: the sound is likely on AirPlay`
}

/**
 * Follow whether a screen is connected to the phone (Screen Mirroring or a
 * cable), from the device's watch. Returns the stop. Nothing to follow on
 * the web, or on a phone that cannot say.
 */
export function followExternalScreen(
  watch: ((handler: (connected: boolean) => void) => () => void) | undefined,
): () => void {
  if (watch === undefined) return () => undefined
  let following = true
  const stop = watch((connected) => {
    if (following) setScreen(connected)
  })
  return () => {
    following = false
    stop()
  }
}

/**
 * Say each change of the guess in the console, from now on: one line as
 * AirPlay comes to be suspected, and one as it stops being. Returns the stop.
 */
export function followAirPlaySuspicion(): () => void {
  return createRoot((dispose) => {
    let said = false
    createEffect(() => {
      const facts = airPlayFacts()
      const now = suspectsAirPlay(facts)
      if (now === said) return
      said = now
      console.info(airPlayLine(facts, now))
    })
    return dispose
  })
}

/** Tests only: no page rate, no screen, no context seen, no listener. */
export function resetAirPlaySuspicionForTests(): void {
  setPageRate(null)
  setScreen(false)
  seen = new WeakSet<object>()
  startListeners.clear()
}
