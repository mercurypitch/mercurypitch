// ============================================================
// latency-route-copy — what the latency wizard says on a TV or Bluetooth
// ============================================================
//
// The wizard's words for a run on a route with a delay of its own
// (REQ-TV-096), where the phone's own advice is wrong. More volume does not
// help a TV whose automatic volume plays every click after the first one
// quieter (the 0.8.41 test, at TV volume 100), and a round trip too late to
// keep usually means the sound alone goes to the TV, which AirPlay buffers
// for about two seconds, rather than the mirrored screen with it.
//
// Tests: src/features/mic-feedback/latency-route-copy.test.ts.

import type { RouteLatencyResult } from '@/lib/mic-latency-route'
import type { LatencyRoute } from '@/stores/mic-latency-store'

/** Said before a run on a TV: where to hold the phone, and what hides clicks. */
export const TV_RUN_NOTE =
  "On a TV, hold the phone near the TV's speaker, and turn off the TV's automatic volume if it has one: it can hide the clicks."

/** Whether the sound comes from a TV on this route, rather than a speaker. */
export function isTvRoute(route: LatencyRoute | null): boolean {
  return route === 'airplay' || route === 'hdmi'
}

/** What to try when the round trip is too late, by route. */
const TOO_LATE_TRY: Readonly<Record<LatencyRoute, string>> = {
  airplay:
    'If only the sound goes to the TV, use Screen Mirroring instead: it sends the picture with the sound, and much sooner.',
  hdmi: "Turn on the TV's game mode, if it has one, and try again.",
  bluetooth: "Use the phone's own speaker, or a wired one, instead.",
}

function tooLateCopy(heardMs: number, route: LatencyRoute): string {
  const from = isTvRoute(route) ? 'The TV' : 'The speaker'
  // Tenths of a second, rounded in whole numbers: 2050 ms says 2.1, where
  // `(2.05).toFixed(1)` would say 2.0.
  const seconds = (Math.round(heardMs / 100) / 10).toFixed(1)
  return `${from} plays the sound about ${seconds} s after the phone sends it, too late to sing along with, so no number was kept. ${TOO_LATE_TRY[route]}`
}

/**
 * A failed run on `route` in words, or null where the phone's own words
 * fit (a median at or below zero says the same thing anywhere).
 */
export function routeFailureCopy(
  result: RouteLatencyResult,
  route: LatencyRoute,
): string | null {
  const tv = isTvRoute(route)
  switch (result.failure) {
    case 'too-late':
      return tooLateCopy(result.heardMs ?? 0, route)
    case 'too-few-hits':
      return tv
        ? "Only a few clicks came back clearly from the TV. Hold the phone near the TV's speaker, turn off the TV's automatic volume (often called Auto Volume or AI Sound), and try again."
        : 'Only a few clicks came back clearly from the speaker. Hold the phone near it, turn it up a little, and try again.'
    case 'not-heard':
      return tv
        ? "The clicks never came back. Check that the sound plays from the TV with its volume up, hold the phone near the TV's speaker, and try again."
        : 'The clicks never came back. Check that the sound plays from the speaker with its volume up, and try again.'
    default:
      return null
  }
}
