// ============================================================
// How late a take's audio is against what the player heard
// ============================================================
//
// The drummer's hits are scheduled on the output clock: a hit written for
// context time T leaves the speaker at T + output latency. The guitar travels
// the other way — what the player strikes on hearing that hit reaches the
// capture graph one input delay later still. Both delays fall between the
// drums and the guitar inside a take, so writing a hit at its scheduling time
// lands the whole drum lane a round trip early on replay and in the exported
// mix: tens of milliseconds on a wired desktop, a fifth of a second over
// Bluetooth.
//
// Nothing here is measured, and none of it is a physical round trip — the
// browser reports estimates, and some of it reports nothing at all (Safari
// has no `outputLatency`; only Chromium fills the capture track's `latency`
// hint). So this stays deliberately short: a term nobody reports counts as
// zero, an implausible reading counts as zero, and the total is capped. The
// correction can move the lane part of the way back toward the guitar, never
// past it.

import type { GuitarRecordingInput } from './recording-capture'

/** Past this it is a broken reading, not a slow device. */
const MAX_CAPTURE_LATENCY_SECONDS = 0.4

function reported(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_CAPTURE_LATENCY_SECONDS
    ? value
    : null
}

/**
 * The output-plus-input delay to move a scheduled event by, so it sits where
 * the player heard it in the captured audio. Zero when nothing is reported.
 */
export function guitarCaptureLatencySeconds(
  input: Pick<GuitarRecordingInput, 'context' | 'stream'>,
): number {
  // `baseLatency` is only the graph's own share, so it stands in when the
  // device figure is missing rather than adding to it.
  const output =
    reported(input.context.outputLatency) ??
    reported(input.context.baseLatency) ??
    0
  // `latency` is a Chromium addition to MediaTrackSettings and is not in the
  // DOM types; the route diagnostics read it off an untyped record the same
  // way, and `reported` rejects whatever a browser without it hands back.
  const settings = input.stream.getAudioTracks()[0]?.getSettings?.() as
    | Record<string, unknown>
    | undefined
  const capture = reported(settings?.latency) ?? 0
  return Math.min(output + capture, MAX_CAPTURE_LATENCY_SECONDS)
}
