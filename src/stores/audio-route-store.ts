// ============================================================
// Audio Route Store — where the app's sound goes, as the phone says
// ============================================================
//
// The route the phone plays the app's sound on (the speaker, headphones,
// Bluetooth, AirPlay to a TV, HDMI), for what depends on it for as long as
// the app runs: the latency offset (mic-latency-store.ts), since a TV on
// AirPlay plays the song well behind the phone's own speaker.
//
// The native app follows it from its entry (`followAudioRoute`): one reading
// at launch, every change the phone reports, and a fresh reading whenever the
// page comes back into view, in case the route moved meanwhile. A reading
// that comes back after a newer change was heard is dropped. Null on the
// web, which cannot say where its sound goes, and before the first reading:
// what depends on the route treats null as the phone's own output.
//
// Tests: src/tests/audio-route-store.test.ts.

import { createSignal } from 'solid-js'
import type { NativeAudioOutput, NativeAudioRoute, } from '@/stores/native-shell-store'

const [route, setRoute] = createSignal<NativeAudioRoute | null>(null)

/** Where the sound goes now, or null where nobody can say. */
export const audioRoute = route

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

  const readNow = (): void => {
    const heardBefore = changes
    void output.read().then(
      (reading) => {
        if (following && changes === heardBefore && reading !== null) {
          setRoute(reading.route)
        }
      },
      () => undefined,
    )
  }
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') readNow()
  }

  readNow()
  document.addEventListener('visibilitychange', onVisible)
  const stopWatching =
    output.watchRoute?.((next) => {
      if (!following) return
      changes += 1
      setRoute(next)
    }) ?? (() => undefined)

  return () => {
    following = false
    document.removeEventListener('visibilitychange', onVisible)
    stopWatching()
  }
}

/** Tests only: set the route as if the phone had said it, or none. */
export function setAudioRouteForTests(next: NativeAudioRoute | null): void {
  setRoute(next)
}
