// ============================================================
// Audio census: every context and mic track a test build makes
// ============================================================
//
// A room's sound went quiet on an iPhone after a few room switches and mic
// toggles, and only a relaunch brought it back (TestFlight build 842). The
// first questions are what the page still held open: a microphone track
// nobody stopped (iOS turns playback down while a voice-processing input is
// open), a context left running or a second one beside it. The rooms' own
// code cannot say: what leaked is by definition what no code kept track
// of. So a test build counts at the source, every AudioContext constructed
// and every audio track getUserMedia hands out, with the settings it was
// opened with and when it ended, and every change the phone reports to its
// output (AudioOutput: the route, the volume, iOS's session). Each step
// goes to the audio record (src/lib/audio-diagnostics.ts), so a copied
// report carries the timeline; the Developer screen's Audio rows read the
// live state from here.
//
// AROUND EACH START AND STOP. On the owner's iPhone the volume followed the
// keys after a fresh launch and stopped the moment a room opened (build
// 880, 16 Oct). A room opening is a mic and a context starting, and WebKit
// switches its own session as they do: so the output is read as each mic
// opens and stops and as each context changes state, and once more
// OUTPUT_SETTLE_MS later, beside the session type the page asked WebKit for
// (`navigator.audioSession.type`: read here, and set only through
// page-audio-session.ts in packages/mobile-runtime). The report then
// shows the app's session, the route and both volumes before and after.
//
// TRANSPARENT. The constructor is wrapped in a Proxy whose construct trap
// builds the real context and returns it: `instanceof`, the prototype and
// every method are the platform's. getUserMedia is wrapped on the one
// MediaDevices object and hands back the stream it was given; only each
// track's own `stop` is wrapped, to record the stop. Contexts are held
// weakly, so counting one never keeps it alive. A track is held until it
// ends: a live one is never collected anyway. A module that took the
// constructor before this was installed is not counted, which no room does
// (they build the context on a tap, long after launch).
//
// AND WHAT THE ROOMS SENT. The Developer screen is a screen of its own, so
// no room plays while it is open: a live meter there would read silence.
// Instead every sound the rooms send through their output (room-output.ts)
// is one entry, `room-sound`, with its loudest peak and RMS: a report that
// shows a note sent at -10 dBFS while the phone played it faintly puts the
// fault below the page (the route, the session, the volume). The output is
// read only while a premium room is open (audio-record.ts starts and stops
// `watchRoomLevels` with each visit), so nothing polls between rooms.
//
// Installed by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), as the panel is: a store build wraps
// nothing.

import type { RoomOutputReading } from '@/components/room-kit/room-output'
import type { AudioReport } from '@/lib/audio-diagnostics'
import { audioReporter, describeAudioError } from '@/lib/audio-diagnostics'
import type { NativeAudioOutput, NativeAudioOutputReading, } from '@/stores/native-shell-store'

/** A context the census saw made and has not seen close. */
export interface CensusContext {
  /** Its place in the order contexts were made, from 1. */
  readonly n: number
  readonly context: BaseAudioContext
}

/** A live mic track the census saw opened. */
export interface CensusTrack {
  readonly n: number
  readonly track: MediaStreamTrack
}

export interface CensusCounts {
  /** Contexts made since launch, and how many of those have closed. */
  readonly contexts: number
  readonly closed: number
  /** Mic tracks opened since launch, and how many of those have ended. */
  readonly tracks: number
  readonly ended: number
}

interface ContextEntry {
  readonly n: number
  readonly ref: { deref: () => BaseAudioContext | undefined }
  closed: boolean
}

interface TrackEntry {
  readonly n: number
  readonly track: MediaStreamTrack
  done: boolean
}

export interface AudioCensusOptions {
  /** The window to count in; the page's own when not given. */
  readonly win?: Window
  /** The phone's output, whose readings go to the record. */
  readonly output?: NativeAudioOutput
}

/** Above this the rooms' output is sounding, dBFS. */
export const SOUND_FLOOR_DB = -60
/** A sound has ended after this long under the floor. */
export const SOUND_GAP_MS = 1000
/** How often the rooms' output is read. */
export const LEVEL_POLL_MS = 100
/** The output is read again this long after a mic or a context changes. */
export const OUTPUT_SETTLE_MS = 1000

const census: AudioReport = audioReporter('census')
const outputReport: AudioReport = audioReporter('output')

let contexts: ContextEntry[] = []
let tracks: TrackEntry[] = []
let contextsMade = 0
let contextsClosed = 0
let tracksOpened = 0
let tracksEnded = 0
let installed = new WeakSet<object>()
/** The phone's output and the page's window, once installed with them. */
let outputSource: NativeAudioOutput | null = null
let pageWindow: Window | null = null
/** Second readings still to come, dropped on a reset. */
let settling: ReturnType<typeof setTimeout>[] = []

/** Held weakly where the platform can, so the census keeps nothing alive. */
function weakly<T extends object>(value: T): { deref: () => T | undefined } {
  return typeof WeakRef === 'function'
    ? new WeakRef(value)
    : { deref: () => value }
}

function noteContext(context: BaseAudioContext, options: unknown): void {
  contextsMade += 1
  const entry: ContextEntry = {
    n: contextsMade,
    ref: weakly(context),
    closed: false,
  }
  contexts.push(entry)
  const asked = (options ?? {}) as {
    latencyHint?: unknown
    sampleRate?: unknown
  }
  census('context-made', {
    n: entry.n,
    state: context.state,
    rate: context.sampleRate,
    ...(asked.latencyHint === undefined ? {} : { latency: asked.latencyHint }),
  })
  context.addEventListener('statechange', () => {
    census('context-state', { n: entry.n, state: context.state })
    readOutputAround(`context ${String(entry.n)} ${context.state}`)
    if (context.state === 'closed') closeContext(entry)
  })
}

function closeContext(entry: ContextEntry): void {
  if (entry.closed) return
  entry.closed = true
  contextsClosed += 1
  contexts = contexts.filter((known) => known !== entry)
}

function finishTrack(
  entry: TrackEntry,
  event: 'mic-stopped' | 'mic-ended',
): void {
  if (entry.done) return
  entry.done = true
  tracksEnded += 1
  tracks = tracks.filter((known) => known !== entry)
  census(event, { n: entry.n })
  readOutputAround(
    `mic ${String(entry.n)} ${event === 'mic-stopped' ? 'stopped' : 'ended'}`,
  )
}

function noteTrack(track: MediaStreamTrack): void {
  tracksOpened += 1
  const entry: TrackEntry = { n: tracksOpened, track, done: false }
  tracks.push(entry)
  const settings = track.getSettings()
  census('mic-opened', {
    n: entry.n,
    label: track.label,
    echoCancellation: settings.echoCancellation ?? 'unset',
    noiseSuppression: settings.noiseSuppression ?? 'unset',
    autoGainControl: settings.autoGainControl ?? 'unset',
    rate: settings.sampleRate ?? 'unset',
    channels: settings.channelCount ?? 'unset',
  })
  readOutputAround(`mic ${String(entry.n)} opened`)
  const stop = track.stop.bind(track)
  track.stop = () => {
    stop()
    finishTrack(entry, 'mic-stopped')
  }
  track.addEventListener('ended', () => finishTrack(entry, 'mic-ended'))
}

function wrapConstructor(win: Window, name: string): void {
  const holder = win as unknown as Record<string, unknown>
  const Original = holder[name]
  if (typeof Original !== 'function') return
  holder[name] = new Proxy(Original, {
    construct(target, args: unknown[], newTarget) {
      const context = Reflect.construct(
        target,
        args,
        newTarget,
      ) as BaseAudioContext
      noteContext(context, args[0])
      return context
    },
  })
}

function wrapGetUserMedia(win: Window): void {
  const devices = win.navigator.mediaDevices as MediaDevices | undefined
  if (devices === undefined || typeof devices.getUserMedia !== 'function') {
    return
  }
  const open = devices.getUserMedia.bind(devices)
  devices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    let stream: MediaStream
    try {
      stream = await open(constraints)
    } catch (error) {
      census('mic-failed', { error: describeAudioError(error) }, true)
      throw error
    }
    for (const track of stream.getAudioTracks()) noteTrack(track)
    return stream
  }
}

/** A reading in the record's terms: the route, the volume, the session. */
export function describeOutput(
  reading: NativeAudioOutputReading,
): Record<string, unknown> {
  const detail: Record<string, unknown> = {
    route: reading.route,
    volume: reading.volume,
    known: reading.volumeKnown,
    outputs: reading.outputs.map((port) => port.type).join(', ') || 'none',
    ports: reading.outputs.map((port) => port.name).join(', ') || 'none',
  }
  if (reading.reason !== null) detail.reason = reading.reason
  if (reading.step !== null)
    detail.step = `${String(reading.step)}/${String(reading.steps)}`
  for (const [key, value] of Object.entries(reading.detail)) {
    if (key === 'inputs') continue
    detail[key] = Array.isArray(value) ? value.join(',') : value
  }
  return detail
}

/**
 * WebKit's session for the page as the page asked for it (Safari 16.4):
 * 'auto' unless something set it. Its state is not exposed in a shipping
 * WebKit, and is named only where it is.
 */
function pageSession(): Record<string, unknown> {
  const navigator = pageWindow?.navigator as
    | { audioSession?: { type?: unknown; state?: unknown } }
    | undefined
  const session = navigator?.audioSession
  if (session === undefined) return {}
  return {
    pageSession: typeof session.type === 'string' ? session.type : 'unknown',
    ...(typeof session.state === 'string'
      ? { pageSessionState: session.state }
      : {}),
  }
}

/** One reading of the output into the record, marked with when it was. */
function readOutput(output: NativeAudioOutput, at: string): void {
  void output
    .read()
    .then((reading) => {
      if (reading === null) return
      outputReport('read', { at, ...describeOutput(reading), ...pageSession() })
    })
    .catch(() => undefined)
}

/**
 * The output now, and once more after WebKit has had time to switch: as a
 * mic or a context starts and stops here, and as a room opens and closes,
 * the app comes back or WebKit's session changes state (audio-record.ts).
 * Nothing without the phone's output.
 */
export function readOutputAround(at: string): void {
  const output = outputSource
  if (output === null) return
  readOutput(output, at)
  const later = setTimeout(() => {
    settling = settling.filter((timer) => timer !== later)
    readOutput(output, `${at}, settled`)
  }, OUTPUT_SETTLE_MS)
  settling.push(later)
}

function watchOutput(output: NativeAudioOutput): void {
  outputSource = output
  readOutput(output, 'launch')
  output.watch((reading) =>
    outputReport('change', { ...describeOutput(reading), ...pageSession() }),
  )
}

interface Sound {
  readonly start: number
  peak: number
  rms: number
  gain: number
  quietSince: number | null
}

const tenth = (db: number): number => Math.round(db * 10) / 10

function recordSound(sound: Sound, end: number, cut: boolean): void {
  census('room-sound', {
    peak: tenth(sound.peak),
    rms: tenth(sound.rms),
    ms: end - sound.start,
    gain: sound.gain,
    ...(cut ? { cut: true } : {}),
  })
}

/**
 * Read the rooms' output every LEVEL_POLL_MS and record each sound once it
 * ends: its loudest peak and RMS, how long it ran and the output's gain.
 * Returns the stop, which records a sound still sounding as `cut`.
 */
export function watchRoomLevels(
  read: () => readonly RoomOutputReading[],
): () => void {
  let sound: Sound | null = null
  let clock = 0
  const timer = setInterval(() => {
    clock += LEVEL_POLL_MS
    let peak = -Infinity
    let rms = -Infinity
    let gain = 1
    for (const reading of read()) {
      if (reading.peakDb !== null) peak = Math.max(peak, reading.peakDb)
      if (reading.rmsDb !== null) rms = Math.max(rms, reading.rmsDb)
      gain = reading.gain
    }
    if (peak > SOUND_FLOOR_DB) {
      if (sound === null) {
        sound = { start: clock, peak, rms, gain, quietSince: null }
      } else {
        sound.peak = Math.max(sound.peak, peak)
        sound.rms = Math.max(sound.rms, rms)
        sound.gain = gain
        sound.quietSince = null
      }
      return
    }
    if (sound === null) return
    sound.quietSince ??= clock
    if (clock - sound.quietSince < SOUND_GAP_MS) return
    recordSound(sound, sound.quietSince, false)
    sound = null
  }, LEVEL_POLL_MS)
  return () => {
    clearInterval(timer)
    if (sound !== null) recordSound(sound, sound.quietSince ?? clock, true)
    sound = null
  }
}

/** Count every context and mic track from now on. Once per window. */
export function installAudioCensus(options: AudioCensusOptions = {}): void {
  const win = options.win ?? window
  if (installed.has(win)) return
  installed.add(win)
  pageWindow = win
  wrapConstructor(win, 'AudioContext')
  const holder = win as unknown as Record<string, unknown>
  if (holder.webkitAudioContext !== holder.AudioContext) {
    wrapConstructor(win, 'webkitAudioContext')
  }
  wrapGetUserMedia(win)
  if (options.output !== undefined) watchOutput(options.output)
}

/** The contexts made and not yet closed, oldest first. */
export function censusContexts(): CensusContext[] {
  const open: CensusContext[] = []
  for (const entry of [...contexts]) {
    const context = entry.ref.deref()
    if (context === undefined) {
      contexts = contexts.filter((known) => known !== entry)
    } else if (context.state === 'closed') {
      closeContext(entry)
    } else {
      open.push({ n: entry.n, context })
    }
  }
  return open
}

/** The mic tracks still live, oldest first. */
export function censusTracks(): CensusTrack[] {
  for (const entry of [...tracks]) {
    if (entry.track.readyState === 'ended') finishTrack(entry, 'mic-ended')
  }
  return tracks.map(({ n, track }) => ({ n, track }))
}

export function censusCounts(): CensusCounts {
  return {
    contexts: contextsMade,
    closed: contextsClosed,
    tracks: tracksOpened,
    ended: tracksEnded,
  }
}

/** Tests only: forget what was counted and where it was installed. */
export function resetAudioCensusForTests(): void {
  contexts = []
  tracks = []
  contextsMade = 0
  contextsClosed = 0
  tracksOpened = 0
  tracksEnded = 0
  installed = new WeakSet<object>()
  outputSource = null
  pageWindow = null
  for (const timer of settling) clearTimeout(timer)
  settling = []
}
