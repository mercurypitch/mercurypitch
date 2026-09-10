// ============================================================
// Voice diagnostics — what the ear was doing, readable on the device
// ============================================================
//
// VC-1 says voice control dies on iOS after a stretch of silence, with no
// `error` and no `end`. The listener already handles several shapes of that
// (see the header of webspeech-listener.ts), so the question is not "add a
// watchdog" but "which of the things it already does actually happened".
// Today's logs cannot answer that: a dead recognizer and a live one hearing
// silence look identical from outside.
//
// So every transition is recorded here, stamped with the few facts that
// separate those two, and the record is readable in three ways:
//
//   1. `console.info('[voice] …')`, which `MP_DEV_LOGS=1` relays to
//      `.dev-logs/` on the dev server — the LAN case, iPhone included.
//   2. `VoiceDiagnosticsPanel`, on the device itself, with a Copy button —
//      for a phone that is not on our network, or is pointed at dev.
//   3. `voiceDiagnosticEntries()` from a console or a test.
//
// Off unless asked for: `?voicelog=1` turns it on and remembers, `?voicelog=0`
// turns it off. It has to be remembered, because Karaoke Night is a separate
// document and walking into it is a fresh page load that would otherwise
// drop the recording halfway through the thing being measured.
//
// ── One correction to the plan ──
//
// docs/plans/ios-voice-control-investigation.md asks for
// `MediaStreamTrack.readyState` and `.muted`. For the Web Speech path there
// is no such track to read: capture happens inside the browser's recognizer
// and never through MicManager. What we CAN see is the mic the APP holds,
// which is the other half of the same question — one documented failure
// shape is another consumer taking the microphone — so that is what
// `mic` reports here.

import { micManager } from '@/lib/mic-manager'

/** Newest kept; older ones fall off. Bounded so a long session cannot grow
 *  without limit on a phone. */
const MAX_ENTRIES = 500

const STORAGE_KEY = 'mp:voiceDiagnostics'
const QUERY_KEY = 'voicelog'

export interface VoiceDiagnosticEntry {
  /** Milliseconds since the first entry, which reads far better than epochs
   *  when the question is "how long until it went quiet". */
  at: number
  /** Wall clock, so a panel entry can be lined up against the relay's file. */
  wall: string
  /** Which session this belongs to; a phantom and its replacement are
   *  different numbers, and confusing them is how this gets misread. */
  session: number
  event: string
  detail: Record<string, unknown>
  env: VoiceDiagnosticEnv
}

export interface VoiceDiagnosticEnv {
  /** `visible` | `hidden` — iOS suspends a backgrounded page's capture. */
  visibility: string
  /** Whether the APP holds a microphone, and how that track looks. Not the
   *  recognizer's own capture, which is not ours to inspect. */
  mic: string
}

type Listener = () => void

const listeners = new Set<Listener>()
let entries: VoiceDiagnosticEntry[] = []
let enabled = false
let origin = 0

function readStoredPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Private mode, or storage disabled. Diagnostics are opt-in anyway.
    return false
  }
}

function storePreference(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not being able to remember it is survivable; the URL still works.
  }
}

/**
 * Read `?voicelog=1` / `?voicelog=0` and remember the answer.
 *
 * Called once at startup. The query parameter wins over what was stored, so
 * a device can be turned on and off again without clearing site data — which
 * on a phone is the difference between a two-second change and a lost login.
 */
export function initVoiceDiagnostics(search = window.location.search): void {
  let asked: string | null = null
  try {
    asked = new URLSearchParams(search).get(QUERY_KEY)
  } catch {
    asked = null
  }
  if (asked === '1' || asked === 'true') storePreference(true)
  else if (asked === '0' || asked === 'false') storePreference(false)
  enabled = readStoredPreference()
  if (enabled) {
    // Announced so a relayed log says which build produced it, and so a
    // device that was meant to be recording says so before the first event.
    console.info(`[voice] diagnostics on — ${navigator.userAgent}`)
  }
}

export function voiceDiagnosticsEnabled(): boolean {
  return enabled
}

export function setVoiceDiagnosticsEnabled(on: boolean): void {
  enabled = on
  storePreference(on)
  notify()
}

function sampleEnv(): VoiceDiagnosticEnv {
  let visibility = 'unknown'
  try {
    visibility = document.visibilityState
  } catch {
    // A document that cannot answer is worth recording as such.
  }
  return { visibility, mic: sampleMic() }
}

function sampleMic(): string {
  try {
    if (!micManager.isActive()) return 'idle'
    const stream = micManager.getStream()
    if (stream === null) return 'active,no-stream'
    const tracks = stream.getAudioTracks()
    if (tracks.length === 0) return 'active,no-track'
    return tracks
      .map((track) => `${track.readyState}${track.muted ? ',muted' : ''}`)
      .join(' ')
  } catch {
    return 'unreadable'
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

/**
 * Record one thing the ear did.
 *
 * Cheap and silent when off: a single boolean test, no sampling, no
 * allocation. It sits on the recognizer's hot path, including every interim
 * result, so that matters.
 */
export function recordVoiceDiagnostic(
  event: string,
  session: number,
  detail: Record<string, unknown> = {},
): void {
  if (!enabled) return
  const now = Date.now()
  if (origin === 0) origin = now
  const entry: VoiceDiagnosticEntry = {
    at: now - origin,
    wall: new Date(now).toISOString(),
    session,
    event,
    detail,
    env: sampleEnv(),
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
  // The relay reads console, so this line is what reaches `.dev-logs/`.
  console.info(`[voice] ${formatEntry(entry)}`)
  notify()
}

export function voiceDiagnosticEntries(): readonly VoiceDiagnosticEntry[] {
  return entries
}

export function onVoiceDiagnostic(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function clearVoiceDiagnostics(): void {
  entries = []
  origin = 0
  notify()
}

/** One line per entry: elapsed, session, event, detail, environment. */
export function formatEntry(entry: VoiceDiagnosticEntry): string {
  const seconds = (entry.at / 1000).toFixed(2).padStart(8, ' ')
  const detail = Object.entries(entry.detail)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ')
  return `${seconds}s s${entry.session} ${entry.event}${
    detail === '' ? '' : ` ${detail}`
  } [${entry.env.visibility} mic:${entry.env.mic}]`
}

/**
 * The whole recording as text, with a header naming the device.
 *
 * This is what the Copy button puts on the clipboard, so it has to survive
 * being pasted into a chat message and still say which phone it came from.
 */
export function formatVoiceDiagnostics(): string {
  const header = [
    `MercuryPitch voice diagnostics`,
    `when: ${new Date().toISOString()}`,
    `agent: ${navigator.userAgent}`,
    `entries: ${entries.length}${entries.length === MAX_ENTRIES ? ' (oldest dropped)' : ''}`,
    '',
  ]
  return [...header, ...entries.map(formatEntry)].join('\n')
}

/** Test seam: forget everything, including the enabled flag. */
export function resetVoiceDiagnosticsForTests(): void {
  entries = []
  listeners.clear()
  enabled = false
  origin = 0
}
