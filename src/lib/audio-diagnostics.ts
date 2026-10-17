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
//
// FOR A SCENARIO TEST (owner, 17 Oct: "add some good console logging so I
// can test different scenarios and send logs"). Each line starts with the
// phone's own clock, so a tester's "it went quiet at 21:31" finds its
// place, and the report says the day before its first line and wherever
// the day changes. A test build keeps the newest entries across a restart
// (apps/mercurypitch audio-log-store.ts): `adoptAudioDiagnostics` puts the
// last launch's in front, and `clearAudioDiagnostics` starts a scenario
// clean. Subscribers are told which of the three happened.

/** Newest kept; older ones fall off, so a long session stays small. */
export const MAX_AUDIO_ENTRIES = 1000

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

/** What changed in the record: one entry, all of them gone, or older ones put in front. */
export type AudioDiagnosticChange =
  | { readonly kind: 'entry'; readonly entry: AudioDiagnosticEntry }
  | { readonly kind: 'cleared' }
  | { readonly kind: 'adopted'; readonly count: number }

type Listener = (change: AudioDiagnosticChange) => void

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

function notify(change: AudioDiagnosticChange): void {
  for (const listener of [...listeners]) {
    try {
      listener(change)
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
  notify({ kind: 'entry', entry })
}

/** Forget every entry, so a scenario starts clean. */
export function clearAudioDiagnostics(): void {
  entries = []
  origin = 0
  notify({ kind: 'cleared' })
}

/**
 * Put entries from before this launch in front of this launch's own, and
 * keep the newest MAX_AUDIO_ENTRIES of them all.
 */
export function adoptAudioDiagnostics(
  older: readonly AudioDiagnosticEntry[],
): void {
  if (older.length === 0) return
  entries = [...older, ...entries].slice(-MAX_AUDIO_ENTRIES)
  notify({ kind: 'adopted', count: older.length })
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

/** A value kept as it is where JSON keeps it, and as its words where not. */
function plainValue(value: unknown): unknown {
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    value === null
  ) {
    return value
  }
  return formatValue(value)
}

/** The entry with every detail a string, number, boolean or null: storable. */
export function plainAudioDiagnostic(
  entry: AudioDiagnosticEntry,
): AudioDiagnosticEntry {
  const detail: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entry.detail)) {
    detail[key] = plainValue(value)
  }
  return { ...entry, detail }
}

const two = (n: number): string => String(n).padStart(2, '0')

/** The phone's own clock at an entry: 21:31:05.120. */
function clockOf(date: Date): string {
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${ms}`
}

/** The phone's own day: 2026-10-17. */
function dayOf(date: Date): string {
  return `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}

/** One line: the time, source, event, detail, and [hidden] if the page was. */
export function formatAudioDiagnostic(entry: AudioDiagnosticEntry): string {
  const detail = Object.entries(entry.detail)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ')
  const behind = entry.visibility === 'visible' ? '' : ` [${entry.visibility}]`
  return `${clockOf(new Date(entry.wall))} ${entry.source} ${entry.event}${
    detail === '' ? '' : ` ${detail}`
  }${behind}`
}

/**
 * The whole record as text, for Copy and Share. `head` first (the device,
 * the session and the switches, as the caller sees them now), then when,
 * the browser and the count, then `live` (the panel's rows), then the
 * entries, oldest first, with the day before the first and at each change
 * of day.
 */
export function formatAudioDiagnostics(
  head: readonly string[] = [],
  live: readonly string[] = [],
): string {
  const now = new Date()
  const header = [
    'MercuryPitch audio diagnostics',
    ...head,
    `when: ${dayOf(now)} ${clockOf(now)} (${now.toISOString()})`,
    `agent: ${typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent}`,
    `entries: ${entries.length}${entries.length === MAX_AUDIO_ENTRIES ? ' (oldest dropped)' : ''}`,
    ...live,
    '',
  ]
  const lines: string[] = []
  let day = ''
  for (const entry of entries) {
    const today = dayOf(new Date(entry.wall))
    if (today !== day) lines.push(`-- ${today} --`)
    day = today
    lines.push(formatAudioDiagnostic(entry))
  }
  return [...header, ...lines].join('\n')
}

/** Test seam: forget every entry and subscriber. */
export function resetAudioDiagnosticsForTests(): void {
  entries = []
  listeners.clear()
  origin = 0
}
