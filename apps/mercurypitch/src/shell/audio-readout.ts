// ============================================================
// Audio readout: the Developer screen's sound rows, as words
// ============================================================
//
// What the phone says about its output (AudioOutput), what the census
// counted (audio-census.ts) and what the rooms send to the speakers
// (room-output.ts), each as one line a tester can read off a phone and
// paste into a bug. Pure, so the wording is tested without a phone; the
// panel (AudioDiagnosticsPanel.tsx) reads the sources and calls these.

import type { RoomOutputReading } from '@/components/room-kit/room-output'
import type { NativeAudioOutputReading, NativeAudioRoute, } from '@/stores/native-shell-store'
import type { CensusContext, CensusCounts, CensusTrack } from './audio-census'
import { isLowVolume } from './volume-hint'

/** Where the sound goes, as a tester names it. */
export const ROUTE_NAMES: Readonly<Record<NativeAudioRoute, string>> = {
  speaker: 'Speaker',
  receiver: 'Receiver (the earpiece)',
  headphones: 'Headphones',
  bluetooth: 'Bluetooth',
  airplay: 'AirPlay',
  hdmi: 'HDMI',
  other: 'Other',
  none: 'Nothing',
}

type Reading = NativeAudioOutputReading | null

/** The route and the ports the phone names. */
export function outputLine(reading: Reading, native: boolean): string {
  if (reading === null) {
    return native
      ? 'no reading: this build has no AudioOutput'
      : 'not read on the web'
  }
  const ports = reading.outputs.map((port) => port.name).join(', ')
  const route = ROUTE_NAMES[reading.route]
  return ports === '' ? route : `${route} · ${ports}`
}

/**
 * The volume, how far it is taken at its word (a room says "zero" only
 * from a live or agreed one, volume-hint.ts), Android's steps, and whether
 * the rooms count it as low. An iPhone's two readings follow: the system's
 * (a volume view nobody sees), which counts once it has moved, and the
 * app's session's.
 */
export function volumeLine(reading: Reading): string {
  if (reading === null) return 'not read'
  const parts = [reading.volume.toFixed(2), `known: ${reading.volumeKnown}`]
  if (reading.step !== null && reading.steps !== null) {
    parts.push(`step ${String(reading.step)} of ${String(reading.steps)}`)
  }
  const d = reading.detail
  if (typeof d.systemVolume === 'number') {
    const still = d.systemVolumeLive === true ? '' : ', not seen to move yet'
    parts.push(`system ${d.systemVolume.toFixed(2)}${still}`)
  }
  if (typeof d.sessionVolume === 'number') {
    parts.push(`session ${d.sessionVolume.toFixed(2)}`)
  }
  if (isLowVolume(reading)) parts.push('low: the rooms ask for more')
  return parts.join(' · ')
}

const word = (value: unknown, prefix: string): string =>
  typeof value === 'string' ? value.replace(prefix, '') : 'unknown'

/**
 * iOS: the app's own session, category, mode and options (WebKit plays
 * from a session of its own, which no app can read), how the app last made
 * it active, and an interruption iOS reported: from one that began and has
 * not ended, the session is not active, which iOS has no property to say.
 * Android: the audio mode and the stream the page plays on.
 */
export function sessionLine(reading: Reading): string {
  if (reading === null) return 'not read'
  const d = reading.detail
  if (typeof d.category === 'string') {
    const options =
      Array.isArray(d.options) && d.options.length > 0
        ? d.options.join(', ')
        : 'no options'
    const parts = [
      word(d.category, 'AVAudioSessionCategory'),
      word(d.mode, 'AVAudioSessionMode'),
      options,
    ]
    if (typeof d.activation === 'string') parts.push(d.activation)
    if (typeof d.lastInterruption === 'string') {
      parts.push(
        d.interrupted === true
          ? `interrupted (${d.lastInterruption})`
          : `last interruption ${d.lastInterruption}`,
      )
    }
    return parts.join(' · ')
  }
  if (typeof d.stream === 'string') {
    const parts = [`mode ${String(d.mode)}`, `${d.stream} stream`]
    if (d.streamMuted === true) parts.push('muted')
    if (d.musicActive === true) parts.push('music playing')
    return parts.join(' · ')
  }
  return 'not reported'
}

const ms = (seconds: unknown): string =>
  typeof seconds === 'number' ? `${(seconds * 1000).toFixed(1)} ms` : 'unknown'

/** iOS: other apps' sound and the hardware's rate and latency. Android: both volumes. */
export function hardwareLine(reading: Reading): string {
  if (reading === null) return 'not read'
  const d = reading.detail
  if (typeof d.otherAudioPlaying === 'boolean') {
    return [
      `other audio ${d.otherAudioPlaying ? 'playing' : 'none'}`,
      `silence hint ${d.silenceHint === true ? 'on' : 'off'}`,
      `${String(d.sampleRate)} Hz`,
      `buffer ${ms(d.ioBufferDuration)}`,
      `out ${ms(d.outputLatency)}`,
    ].join(' · ')
  }
  if (typeof d.musicVolume === 'number' && typeof d.callVolume === 'number') {
    return `music ${d.musicVolume.toFixed(2)} · call ${d.callVolume.toFixed(2)}`
  }
  return 'not reported'
}

const onOff = (value: unknown): string =>
  value === true ? 'on' : value === false ? 'off' : '?'

/** Echo cancellation, noise suppression and gain control, as opened. */
function processing(track: MediaStreamTrack): string {
  const s = track.getSettings()
  return `echo ${onOff(s.echoCancellation)} noise ${onOff(s.noiseSuppression)} gain ${onOff(s.autoGainControl)}`
}

/** The page's mic: live tracks, how many came and went, and who holds it. */
export function tracksLine(
  live: readonly CensusTrack[],
  counts: CensusCounts,
  manager: { readonly stream: boolean; readonly consumers: readonly string[] },
): string {
  const now =
    live.length === 0
      ? '0 live'
      : `${String(live.length)} live (${live.map((t) => `#${String(t.n)} ${processing(t.track)}`).join('; ')})`
  const holder = `mic manager ${manager.stream ? 'holds a stream' : 'holds none'}, ${
    manager.consumers.length === 0
      ? 'no one using it'
      : manager.consumers.join(', ')
  }`
  return `${now} · ${String(counts.tracks)} opened, ${String(counts.ended)} ended · ${holder}`
}

/** Every context still open, its state and rate, and whose it is. */
export function contextsLine(
  open: readonly CensusContext[],
  counts: CensusCounts,
  whose: (context: BaseAudioContext) => string | null,
): string {
  if (counts.contexts === 0) return 'none made yet'
  const each = open.map(({ n, context }) => {
    const owner = whose(context)
    return `#${String(n)} ${context.state} ${String(context.sampleRate)} Hz${owner === null ? '' : ` (${owner})`}`
  })
  return [...each, `${String(counts.closed)} closed`].join(' · ')
}

/** The shared clock's leases: who holds the rooms' context now. */
export function leasesLine(owners: readonly string[]): string {
  return owners.length === 0 ? 'none' : owners.join(', ')
}

const dbfs = (db: number | null): string =>
  db === null ? 'silent' : `${db.toFixed(1)} dBFS`

/** The rooms' output: its gain (1.00 always) and what it sends now. */
export function roomOutputLine(readings: readonly RoomOutputReading[]): string {
  if (readings.length === 0) return 'none yet: open a room'
  return readings
    .map(
      (r) =>
        `gain ${r.gain.toFixed(2)} · now ${dbfs(r.peakDb)} peak, ${dbfs(r.rmsDb)} RMS`,
    )
    .join(' | ')
}
