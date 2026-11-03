// ============================================================
// The audio report: the Developer screen's, and a song on AirPlay's
// ============================================================
//
// What More > Developer > Audio copies or shares: the app's version and the
// phone, the app's session, the outputs, the page's session type and "One
// volume in rooms"; the live rows; then every entry of the audio record.
// Built here, apart from the panel that draws it (AudioDiagnosticsPanel.tsx),
// so a test build can write the same report into the console without the
// Developer screen. Leaving the Karaoke stage for Settings stops the song,
// so the owner could not send the report while the room's sound was lost on
// AirPlay (3 Nov 2026).
//
// AS A SONG STARTS ON AIRPLAY ALONE (`reportOnAirPlay`): once a launch, the
// first time a Karaoke song starts with its sound on AirPlay alone, seen by
// the route or suspected (airplay-suspicion.ts), the whole report goes into
// the console at the info level, which the console keeps with routine logs
// left out. A console line keeps 2000 characters (portable-console.ts), so
// the report goes in numbered parts of whole lines, each under that.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and a
// dynamic import (main.tsx), as the panel is: a store build has none of it.

import { sharedAudioContextOwners } from '@irchiinnuss/audio-io'
import { pageAudioSessionHolders, pageAudioSessionType, } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { roomOutputIfMade, roomOutputReadings, } from '@/components/room-kit/room-output'
import type { AudioDiagnosticEntry } from '@/lib/audio-diagnostics'
import { describeAudioError, formatAudioDiagnostics, lastAudioDiagnostic, } from '@/lib/audio-diagnostics'
import { micManager } from '@/lib/mic-manager'
import { onSongStartOnAirPlay } from '@/stores/airplay-suspicion'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { ambient } from '../alley/RoomsAlley'
import { censusContexts, censusCounts, censusTracks } from './audio-census'
import { contextsLine, hardwareLine, leasesLine, outputLine, roomOutputLine, sessionLine, tracksLine, volumeLine, } from './audio-readout'
import { oneVolumeInRooms } from './room-volume-switch'
import type { DeviceFacts } from './settings/device-facts'
import { loadDeviceFacts } from './settings/device-facts'
import { orientationRow, safeInsetsRow } from './viewport-diagnostics'

/** One live row: what the panel draws, and the report carries on top. */
export interface ReportRow {
  readonly label: string
  readonly value: string
}

/** What a report is read from, beside the record itself. */
export interface ReportFacts {
  /** The app's version, the phone and its system, once read. */
  readonly facts: DeviceFacts | null
  /** The phone's output, once read. */
  readonly output: NativeAudioOutputReading | null
  /** A phone is registered: the web has no reading of its output. */
  readonly native: boolean
  /** The alley's clock between two readings, where someone took two. */
  readonly clockMoving: boolean | null
}

/** A console line keeps 2000 characters; a part of the report stays under. */
export const CONSOLE_PART_MAX = 1900

/** The newest of a step's two outcomes: `fetched` or `fetch-failed`. */
const lastStep = (done: string, failed: string): AudioDiagnosticEntry | null =>
  lastAudioDiagnostic((e) => e.event === done || e.event === failed)

function fetchRow(): string {
  const entry = lastStep('fetched', 'fetch-failed')
  if (entry === null) return 'none yet'
  const d = entry.detail
  if (entry.failed) return `failed · ${describeAudioError(d.error)}`
  return `status ${String(d.status)} · ok ${String(d.ok)} · ${String(d.bytes)} B · ${String(d.ms)} ms`
}

function decodeRow(): string {
  const entry = lastStep('decoded', 'decode-failed')
  if (entry === null) return 'none yet'
  const d = entry.detail
  if (entry.failed) return `failed · ${describeAudioError(d.error)}`
  const seconds = Number(d.duration).toFixed(2)
  return `${seconds} s · ${String(d.channels)} ch · ${String(d.sampleRate)} Hz · ${String(d.ms)} ms`
}

/** The newest failure of any source, with the step it failed at. */
function errorRow(): string {
  const entry = lastAudioDiagnostic((e) => e.failed)
  if (entry === null) return 'none'
  const stage = entry.event.replace(/-failed$/u, '')
  const d = entry.detail
  const why = describeAudioError(d.error ?? d.reason ?? d.state)
  const age = Math.max(
    0,
    Math.round((Date.now() - Date.parse(entry.wall)) / 1000),
  )
  return `${stage} · ${entry.source} · ${why} · ${String(age)} s ago`
}

/** Whose a context is, where the panel can tell: the alley's or the rooms'. */
function whose(context: BaseAudioContext): string | null {
  if (context === ambient().context()) return 'alley'
  if (roomOutputIfMade(context) !== null) return 'rooms'
  return null
}

/** The page's session type, and who asked for it (page-audio-session.ts). */
export function audioSessionType(): string {
  const type = pageAudioSessionType()
  if (type === null) return 'not available'
  const holders = pageAudioSessionHolders()
  return holders.length === 0 ? type : `${type}, held by ${holders.join(', ')}`
}

/** The app's version and build, the phone and its system, as far as read. */
function appLine(facts: DeviceFacts | null): string {
  return [
    facts?.version ?? 'version not read',
    facts?.model ?? 'model not read',
    facts?.system ?? 'system not read',
  ].join(' · ')
}

/** The report's head: what a reader needs before the first entry. */
export function reportHead(at: ReportFacts): string[] {
  const types = at.output?.outputs.map((port) => port.type).join(', ') ?? ''
  return [
    `App: ${appLine(at.facts)}`,
    `App session: ${sessionLine(at.output)}`,
    `Outputs: ${outputLine(at.output, at.native)}${types === '' ? '' : ` (${types})`}`,
    `Page session type: ${audioSessionType()}`,
    `One volume in rooms: ${oneVolumeInRooms() ? 'on' : 'off'}`,
  ]
}

/** The alley's clock: where it is, and whether it moved, where that is known. */
function clockRow(moving: boolean | null): string {
  const view = ambient().context()
  if (view === null) return 'none yet'
  const at = `${view.currentTime.toFixed(3)} s`
  if (moving === null) return at
  return `${at} · ${moving ? 'moving' : 'stalled'}`
}

/** The live rows, as the panel draws them and the report carries them. */
export function reportRows(at: ReportFacts): ReportRow[] {
  const alley = ambient()
  const view = alley.context()
  return [
    {
      label: 'Context',
      value:
        view === null
          ? 'none yet: tap a door, or Play below'
          : `${view.state} · ${String(view.sampleRate)} Hz`,
    },
    { label: 'Clock', value: clockRow(at.clockMoving) },
    {
      label: 'Ambient',
      value: `${alley.sounding() ?? 'silent'} · level ${alley.level().toFixed(2)} · ${String(alley.sourcesStarted())} started`,
    },
    { label: 'Last fetch', value: fetchRow() },
    { label: 'Last decode', value: decodeRow() },
    { label: 'Last error', value: errorRow() },
    { label: 'Audio session', value: audioSessionType() },
    { label: 'Page', value: document.visibilityState },
    { label: 'Orientation', value: orientationRow() },
    { label: 'Safe insets', value: safeInsetsRow() },
    { label: 'Output', value: outputLine(at.output, at.native) },
    { label: 'Volume', value: volumeLine(at.output) },
    { label: 'Phone session', value: sessionLine(at.output) },
    { label: 'Phone audio', value: hardwareLine(at.output) },
    {
      label: 'Mic tracks',
      value: tracksLine(censusTracks(), censusCounts(), {
        stream: micManager.getStream() !== null,
        consumers: micManager.getConsumers(),
      }),
    },
    {
      label: 'Contexts',
      value: contextsLine(censusContexts(), censusCounts(), whose),
    },
    { label: 'Shared clock', value: leasesLine(sharedAudioContextOwners()) },
    { label: 'Room output', value: roomOutputLine(roomOutputReadings()) },
  ]
}

/** The whole report as text: the head, the rows, then every entry. */
export function reportText(at: ReportFacts): string {
  return formatAudioDiagnostics(
    reportHead(at),
    reportRows(at).map((row) => `${row.label}: ${row.value}`),
  )
}

/** The report as it stands now, the phone's output and facts read afresh. */
export async function buildAudioReport(): Promise<string> {
  const phone = nativeDeviceApi()
  const [facts, output] = await Promise.all([
    loadDeviceFacts().catch(() => null),
    phone?.audioOutput?.read().catch(() => null) ?? Promise.resolve(null),
  ])
  return reportText({
    facts,
    output,
    native: phone !== null,
    clockMoving: null,
  })
}

/** One long line cut at `max`, a piece each. */
function cut(line: string, max: number): string[] {
  const pieces: string[] = []
  for (let from = 0; from < line.length; from += max) {
    pieces.push(line.slice(from, from + max))
  }
  return pieces
}

/**
 * The report in parts of whole lines, each at most `max` characters, so that
 * a console that keeps 2000 to a line keeps all of it. A single line longer
 * than that is cut.
 */
export function reportParts(text: string, max = CONSOLE_PART_MAX): string[] {
  const parts: string[] = []
  let part = ''
  for (const line of text.split('\n').flatMap((l) => cut(l, max))) {
    const next = part === '' ? line : `${part}\n${line}`
    if (next.length > max && part !== '') {
      parts.push(part)
      part = line
    } else {
      part = next
    }
  }
  if (part !== '') parts.push(part)
  return parts
}

/** Write the report into the console at the info level, in numbered parts. */
export function writeReportToConsole(text: string, why: string): void {
  const parts = reportParts(text)
  parts.forEach((part, index) => {
    console.info(
      `[audio report ${String(index + 1)}/${String(parts.length)}] ${why}\n${part}`,
    )
  })
}

/**
 * Once a launch, the report into the console as a Karaoke song first starts
 * with its sound on AirPlay alone. Returns the stop.
 */
export function reportOnAirPlay(
  build: () => Promise<string> = buildAudioReport,
): () => void {
  let written = false
  return onSongStartOnAirPlay(() => {
    if (written) return
    written = true
    void build().then(
      (text) => {
        writeReportToConsole(text, 'a song started on AirPlay')
      },
      () => undefined,
    )
  })
}
