// ============================================================
// Audio output — the phone's volume, and where its sound goes
// ============================================================
//
// The app's own plugin on both phones, under one name, `AudioOutput`: on iOS
// ios/App/App/AudioOutputPlugin.swift (ViewController registers it), on
// Android AudioOutputPlugin.java (MainActivity registers it). It reads the
// volume the page's sound plays at, the route it takes (the speaker, the
// receiver at the ear, headphones, Bluetooth, AirPlay, HDMI) and, for a test
// build's readout, the rest of what the phone says: iOS's own session
// (category, mode and options of the app's session; WebKit plays from a
// session of its own), Android's audio mode and stream. It answers on demand
// and again on every change: a volume key, a headset, a call.
//
// A change of route also goes out on its own (`onAudioRoute`), for what
// depends on where the sound goes for as long as the app runs: the latency
// offset, since a TV on AirPlay or HDMI plays the song well behind the
// phone's own speaker. Hearing it costs nothing between changes, unlike
// `onAudioOutput`, whose listener keeps an iPhone looking at its volume.
//
// Read only: nothing here changes the phone's audio. An app without the
// plugin answers `Unimplemented`, read as no reading at all; the web has
// none either, and never registers the plugin.

import type { PluginListenerHandle } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'
import type { Unsubscribe } from './native-calls'
import { isNative, lazyListener } from './native-calls'

/**
 * Where the sound goes, by kind. AirPlay and HDMI take it to a TV or a
 * receiver, which plays it with a delay of its own.
 */
export type AudioRoute =
  | 'speaker'
  | 'receiver'
  | 'headphones'
  | 'bluetooth'
  | 'airplay'
  | 'hdmi'
  | 'other'
  | 'none'

/** An output port, as the phone names it. */
export interface AudioOutputPort {
  readonly type: string
  readonly name: string
}

/**
 * How far a reading's volume can be taken at its word.
 *
 *   live     it follows the volume keys: Android's stream volume, and an
 *            iPhone's volume view once it has been seen to move
 *   agreed   an iPhone's two readings say the same: the app's session and a
 *            volume view settled in its window, not yet seen to move
 *   session  an iPhone's own session alone, which can read 0 while the room
 *            plays out loud (build 880) or keep an old value (iOS 18 on)
 */
export type VolumeKnown = 'live' | 'agreed' | 'session'

/** The phone's output at one moment. */
export interface AudioOutputReading {
  /** The volume the page's sound plays at, 0 to 1. */
  readonly volume: number
  /** Whether `volume` follows the keys; a room says "zero" only if so. */
  readonly volumeKnown: VolumeKnown
  /** Android: the volume in the phone's own steps, and how many there are. */
  readonly step: number | null
  readonly steps: number | null
  readonly route: AudioRoute
  readonly outputs: readonly AudioOutputPort[]
  /** Everything else the phone reported, as it reported it. */
  readonly detail: Readonly<Record<string, unknown>>
  /** On a change, what moved it: 'volume', 'route', 'interruption'... */
  readonly reason: string | null
}

/** The plugin's answer, before it is checked. */
type RawOutput = Record<string, unknown>

interface AudioOutputPlugin {
  read(): Promise<RawOutput>
  addListener(
    eventName: 'audioOutputChange' | 'audioRouteChange',
    listener: (event: RawOutput) => void,
  ): Promise<PluginListenerHandle>
}

/** Port types, iOS's (AVAudioSession.Port) and Android's (the plugin's). */
const ROUTES: Readonly<Record<string, AudioRoute>> = {
  Speaker: 'speaker',
  Receiver: 'receiver',
  Headphones: 'headphones',
  LineOut: 'headphones',
  USBAudio: 'headphones',
  BluetoothA2DPOutput: 'bluetooth',
  BluetoothHFP: 'bluetooth',
  BluetoothLE: 'bluetooth',
  AirPlay: 'airplay',
  HDMI: 'hdmi',
  hdmi: 'hdmi',
  'builtin-speaker': 'speaker',
  'builtin-earpiece': 'receiver',
  'wired-headset': 'headphones',
  'wired-headphones': 'headphones',
  'usb-headset': 'headphones',
  'bluetooth-a2dp': 'bluetooth',
  'bluetooth-sco': 'bluetooth',
  'ble-headset': 'bluetooth',
  'ble-speaker': 'bluetooth',
  'hearing-aid': 'bluetooth',
}

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** Two volumes this close are one reading: a sixteenth is a key's step. */
const AGREE_WITHIN = 0.01

function ports(value: unknown): AudioOutputPort[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return []
    const { type, name } = entry as Record<string, unknown>
    return typeof type === 'string'
      ? [{ type, name: typeof name === 'string' ? name : type }]
      : []
  })
}

/** The first output's kind: a phone plays the page's sound on one route at a time. */
function routeOf(outputs: readonly AudioOutputPort[]): AudioRoute {
  const first = outputs[0]
  return first === undefined ? 'none' : (ROUTES[first.type] ?? 'other')
}

/**
 * The plugin's answer as a reading, or null where it does not say how loud
 * the phone is. The route is the first output's kind: a phone plays the
 * page's sound on one route at a time.
 *
 * An iPhone sends two volumes. `outputVolume` is the app's own session's,
 * and it stopped following the volume keys the moment a room opened (build
 * 880). `systemVolume` is the system's, off a volume view nobody sees
 * (AudioOutputPlugin.swift), and counts once the plugin has seen it move,
 * which a volume view that reads nothing never does. Until then the
 * session's stands, as it always has; the readout shows both.
 *
 * Standing is not being believed. Until the view has moved, the session's
 * volume is taken at its word only where the view agrees with it, and only
 * once the view has settled in its window (`systemVolumeSettled`): a view
 * reads 0 until it fills, and two zeros then would be one stale reading
 * twice. Android's volume is the stream's own and always follows the keys.
 */
export function toAudioOutputReading(raw: unknown): AudioOutputReading | null {
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as RawOutput
  const session = finite(data.outputVolume)
  if (session === null) return null
  const view = finite(data.systemVolume)
  const system = data.systemVolumeLive === true ? view : null
  const volume = system ?? session
  let volumeKnown: VolumeKnown = 'session'
  if (finite(data.volumeStep) !== null || system !== null) {
    volumeKnown = 'live'
  } else if (
    view !== null &&
    data.systemVolumeSettled === true &&
    Math.abs(view - session) <= AGREE_WITHIN
  ) {
    volumeKnown = 'agreed'
  }
  const outputs = ports(data.outputs)
  const route = routeOf(outputs)
  const detail: Record<string, unknown> = { ...data }
  for (const key of [
    'outputVolume',
    'outputs',
    'volumeStep',
    'volumeSteps',
    'reason',
  ]) {
    delete detail[key]
  }
  if ('systemVolume' in data) detail.sessionVolume = session
  return {
    volume: Math.min(1, Math.max(0, volume)),
    volumeKnown,
    step: finite(data.volumeStep),
    steps: finite(data.volumeSteps),
    route,
    outputs,
    detail,
    reason: typeof data.reason === 'string' ? data.reason : null,
  }
}

// Registered on first use, once: Capacitor warns on a second registration.
// A plain variable, never a promise's value: the proxy answers every
// property, `then` included, so resolving a promise with it would hang.
let plugin: AudioOutputPlugin | null = null

function audioOutput(): AudioOutputPlugin {
  plugin ??= registerPlugin<AudioOutputPlugin>('AudioOutput')
  return plugin
}

/** The phone's output now; null on the web or without the plugin. */
export async function readAudioOutput(): Promise<AudioOutputReading | null> {
  if (!isNative()) return null
  try {
    return toAudioOutputReading(await audioOutput().read())
  } catch {
    // No plugin behind the name in this build: no reading.
    return null
  }
}

/** Every change to the phone's output. Returns the unsubscribe. */
export function onAudioOutput(
  handler: (reading: AudioOutputReading) => void,
): Unsubscribe {
  if (!isNative()) return () => undefined
  return lazyListener((dispose) => {
    void (async () => {
      try {
        dispose(
          await audioOutput().addListener('audioOutputChange', (event) => {
            const reading = toAudioOutputReading(event)
            if (reading !== null) handler(reading)
          }),
        )
      } catch {
        // No plugin behind the name in this build: no changes to hear.
      }
    })()
  })
}

/**
 * Every change of route, alone: the plugin sends it as the route moves, and
 * on iOS as the app comes back to the front, where the route may have moved
 * meanwhile. Unlike `onAudioOutput`, a listener here keeps nothing running
 * between changes (AudioOutputPlugin.swift, needsLooking), so it can listen
 * for as long as the app runs. Returns the unsubscribe.
 */
export function onAudioRoute(
  handler: (route: AudioRoute) => void,
): Unsubscribe {
  if (!isNative()) return () => undefined
  return lazyListener((dispose) => {
    void (async () => {
      try {
        dispose(
          await audioOutput().addListener('audioRouteChange', (event) => {
            handler(routeOf(ports(event.outputs)))
          }),
        )
      } catch {
        // No plugin behind the name in this build: no changes to hear.
      }
    })()
  })
}

/** Tests only: forget the registration. */
export function resetAudioOutputForTests(): void {
  plugin = null
}
