// ============================================================
// Audio Route Store — where the app's sound goes, as the phone says
// ============================================================
//
// The route the phone plays the app's sound on (the speaker, headphones,
// Bluetooth, AirPlay to a TV, HDMI), for what depends on it for as long as
// the app runs: the latency offset (mic-latency-store.ts), since a TV on
// AirPlay plays the song well behind the phone's own speaker, and the
// Karaoke room's word when its song's clock stops.
//
// The native app follows it from its entry (`followAudioRoute`): one reading
// at launch, every change the phone reports, and a fresh reading whenever the
// page comes back into view, in case the route moved meanwhile. A reading
// that comes back after a newer change was heard is dropped. Null on the
// web, which cannot say where its sound goes, and before the first reading:
// what depends on the route treats null as the phone's own output.
//
// EACH ROUTE IS SAID in the console, at the routine level (console.log, kept
// when the console keeps routine logs): its kind and, on iOS, the reason
// iOS gave with the kinds of output before it:
//
//   [audio route] airplay, iOS: new device, was Speaker
//
// Never a port's own name. "Viki's AirPods" names a person, and a console's
// lines are copied off the phone, the crash card's into public bug reports.
// The port is kept (`audioRoutePort`) for the Karaoke room's notice, on the
// singer's own screen, and a test build's audio report names it as it
// always has (audio-census.ts, `output change`).
//
// One at launch, so a log starts from where the sound went. iOS reports the
// route again each time the app comes to the front, moved or not, so that,
// a reading on the way back and Android's report of each device it adds or
// removes are said only where the route moved. A change that carries iOS's
// reason is said even where it did not: the reason is the news.
//
// Tests: src/tests/audio-route-store.test.ts.

import { createSignal } from 'solid-js'
import type { NativeAudioOutput, NativeAudioRoute, NativeAudioRouteChange, } from '@/stores/native-shell-store'

const [route, setRoute] = createSignal<NativeAudioRoute | null>(null)
const [port, setPort] = createSignal<string | null>(null)

/** Where the sound goes now, or null where nobody can say. */
export const audioRoute = route

/**
 * The port it goes to, as the phone names it ("LG C2"), or null. For the
 * singer's own screen only, never a log line (see the header).
 */
export const audioRoutePort = port

const firstPort = (
  outputs: readonly { readonly name: string }[] | undefined,
): string | null => outputs?.[0]?.name ?? null

/** Why the route moved, in the change's words: iOS's reason where it gave one. */
function whyOf(change: NativeAudioRouteChange | undefined): string {
  if (change === undefined) return ''
  const words: string[] = []
  if (change.routeReason !== null) words.push(`iOS: ${change.routeReason}`)
  else if (change.reason !== null && change.reason !== 'route')
    words.push(change.reason)
  if (change.previousOutputs.length > 0)
    words.push(`was ${change.previousOutputs.join(', ')}`)
  return words.join(', ')
}

/** The console's line for a route: its kind, and why. No port's name. */
export function routeLine(next: NativeAudioRoute, why: string): string {
  return `[audio route] ${next}${why === '' ? '' : `, ${why}`}`
}

/**
 * Follow the phone's route: read it now and whenever the page comes back
 * into view, and hear every change. Returns the stop. Nothing to follow on
 * the web, which has no output to read.
 */
export function followAudioRoute(
  output: NativeAudioOutput | undefined,
): () => void {
  if (output === undefined) return () => undefined
  let following = true
  let changes = 0
  /** The route and port of the last line, though the line names no port. */
  let said: string | null = null

  const take = (
    next: NativeAudioRoute,
    portName: string | null,
    why: string,
    sayAnyway: boolean,
  ): void => {
    setRoute(next)
    setPort(portName)
    const heard = `${next} ${portName ?? ''}`
    if (!sayAnyway && heard === said) return
    said = heard
    console.log(routeLine(next, why))
  }

  const readNow = (why: string): void => {
    const heardBefore = changes
    void output.read().then(
      (reading) => {
        if (following && changes === heardBefore && reading !== null) {
          take(reading.route, firstPort(reading.outputs), why, false)
        }
      },
      () => undefined,
    )
  }
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') readNow('read on the way back')
  }

  readNow('at launch')
  document.addEventListener('visibilitychange', onVisible)
  const stopWatching =
    output.watchRoute?.((next, change) => {
      if (!following) return
      changes += 1
      // iOS's reason is said even on the same port: it is the news (a
      // category change as the mic opens). Android gives none, and reports
      // each device it adds or removes, inputs too, as a change of route.
      const withReason = (change?.routeReason ?? null) !== null
      take(next, firstPort(change?.outputs), whyOf(change), withReason)
    }) ?? (() => undefined)

  return () => {
    following = false
    document.removeEventListener('visibilitychange', onVisible)
    stopWatching()
  }
}

/** Tests only: set the route as if the phone had said it, or none. */
export function setAudioRouteForTests(
  next: NativeAudioRoute | null,
  portName: string | null = null,
): void {
  setRoute(next)
  setPort(portName)
}
