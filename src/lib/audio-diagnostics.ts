// ============================================================
// Audio diagnostics — what the app's sound did, readable on the device
// ============================================================
//
// The alley's ambient was silent on an iPhone for two device rounds and
// nothing anywhere said why: the loader threw on a status-0 response and an
// empty catch swallowed it. This is the record that would have said so in one
// line. Every step a sound takes is an entry — context made, activated,
// fetched, decoded, started, each state change, stale, retired, stopped —
// with the facts that tell the steps apart: status and bytes, duration and
// rate, state and clock.
//
// Shaped like the voice recorder (src/features/voice-control/
// voice-diagnostics.ts): a bounded ring, one console line per entry so the
// portable console's Copy button carries it off the phone, and a formatted
// report for the Developer screen's Audio section. Two differences, both on
// purpose:
//
//   ALWAYS ON. The voice recorder is opt-in because it sits on the
//   recognizer's hot path. This one writes a handful of entries per door
//   tap, and the failure it exists for happens on a phone nobody is
//   watching: a switch the tester must remember to flip first is how a
//   device round comes back with nothing.
//   FAILURES WARN. A failed step goes to console.warn and everything else to
//   console.info, so filtering the portable console on "warn" lists what
//   went wrong and nothing else.
//
// Nothing here imports a store or a feature. A module that makes sound is
// handed `audioReporter(source)` as a dep (the alley's ambient is), which
// keeps it testable and keeps this file out of its graph.

/** Newest kept; older ones fall off, so a long session stays small. */
export const MAX_AUDIO_ENTRIES = 200

export interface AudioDiagnosticEntry {
  /** Milliseconds since the first entry. */
  at: number
  /** Wall clock, to line an entry up against a device's own log. */
  wall: string
  /** Who reported it: 'alley', 'tone'. */
  source: string
  /** The step: 'context', 'fetched', 'decode-failed', 'statechange', … */
  event: string
  detail: Record<string, unknown>
  failed: boolean
  /** `visible` | `hidden`: iOS suspends a backgrounded page's audio. */
  visibility: string
}

/** What a module that makes sound is handed. */
export type AudioReport = (
  event: string,
  detail?: Record<string, unknown>,
  failed?: boolean,
) => void

type Listener = () => void

const listeners = new Set<Listener>()
let entries: AudioDiagnosticEntry[] = []
let origin = 0

function visibility(): string {
  try {
    return document.visibilityState
  } catch {
    return 'unknown'
  }
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      // One bad subscriber must not stop the panel updating.
    }
  }
}

/** Record one step. A failed one is warned, everything else is info. */
export function recordAudioDiagnostic(
  source: string,
  event: string,
  detail: Record<string, unknown> = {},
  failed = false,
): void {
  const now = Date.now()
  if (origin === 0) origin = now
  const entry: AudioDiagnosticEntry = {
    at: now - origin,
    wall: new Date(now).toISOString(),
    source,
    event,
    detail,
    failed,
    visibility: visibility(),
  }
  entries.push(entry)
  if (entries.length > MAX_AUDIO_ENTRIES) {
    entries = entries.slice(-MAX_AUDIO_ENTRIES)
  }
  const line = `[audio] ${formatAudioDiagnostic(entry)}`
  if (failed) console.warn(line)
  else console.info(line)
  notify()
}

/** A reporter bound to one source, for a module that takes one as a dep. */
export function audioReporter(source: string): AudioReport {
  return (event, detail, failed) =>
    recordAudioDiagnostic(source, event, detail, failed)
}

export function audioDiagnosticEntries(): readonly AudioDiagnosticEntry[] {
  return entries
}

/** The newest entry that matches, or null. */
export function lastAudioDiagnostic(
  match: (entry: AudioDiagnosticEntry) => boolean,
): AudioDiagnosticEntry | null {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (match(entries[i])) return entries[i]
  }
  return null
}

export function onAudioDiagnostic(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** An error as one readable phrase: `NotSupportedError: …`. */
export function describeAudioError(error: unknown): string {
  if (error instanceof Error || error instanceof DOMException) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

function formatValue(value: unknown): string {
  if (value instanceof Error || value instanceof DOMException) {
    return describeAudioError(value)
  }
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return String(Math.round(value * 1000) / 1000)
  }
  return String(value)
}

/** One line: elapsed, source, event, detail, and the page's visibility. */
export function formatAudioDiagnostic(entry: AudioDiagnosticEntry): string {
  const seconds = (entry.at / 1000).toFixed(2).padStart(7, ' ')
  const detail = Object.entries(entry.detail)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ')
  return `${seconds}s ${entry.source} ${entry.event}${
    detail === '' ? '' : ` ${detail}`
  } [${entry.visibility}]`
}

/**
 * The whole record as text, headed with the device, for the Copy button.
 * `live` is whatever the caller can see right now (the panel's rows).
 */
export function formatAudioDiagnostics(live: readonly string[] = []): string {
  const header = [
    'MercuryPitch audio diagnostics',
    `when: ${new Date().toISOString()}`,
    `agent: ${typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent}`,
    `entries: ${entries.length}${entries.length === MAX_AUDIO_ENTRIES ? ' (oldest dropped)' : ''}`,
    ...live,
    '',
  ]
  return [...header, ...entries.map(formatAudioDiagnostic)].join('\n')
}

/** Test seam: forget every entry and subscriber. */
export function resetAudioDiagnosticsForTests(): void {
  entries = []
  listeners.clear()
  origin = 0
}
