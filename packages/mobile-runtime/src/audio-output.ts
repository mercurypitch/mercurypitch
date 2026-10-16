// ============================================================
// Audio output — the phone's volume, and where its sound goes
// ============================================================
//
// The app's own plugin on both phones, under one name, `AudioOutput`: on iOS
// ios/App/App/AudioOutputPlugin.swift (ViewController registers it), on
// Android AudioOutputPlugin.java (MainActivity registers it). It reads the
// volume the page's sound plays at, the route it takes (the speaker, the
// receiver at the ear, headphones, Bluetooth) and, for a test build's
// readout, the rest of what the phone says: iOS's own session (category,
// mode and options of the app's session; WebKit plays from a session of its
// own), Android's audio mode and stream. It answers on demand and again on
// every change: a volume key, a headset, a call.
//
// Read only: nothing here changes the phone's audio. An app without the
// plugin answers `Unimplemented`, read as no reading at all; the web has
// none either, and never registers the plugin.

import type { PluginListenerHandle } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'
import type { Unsubscribe } from './native-calls'
import { isNative, lazyListener } from './native-calls'

/** Where the sound goes, by kind. */
export type AudioRoute =
  | 'speaker'
  | 'receiver'
  | 'headphones'
  | 'bluetooth'
  | 'other'
  | 'none'

/** An output port, as the phone names it. */
export interface AudioOutputPort {
  readonly type: string
  readonly name: string
}

/** The phone's output at one moment. */
export interface AudioOutputReading {
  /** The volume the page's sound plays at, 0 to 1. */
  readonly volume: number
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
    eventName: 'audioOutputChange',
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
 */
export function toAudioOutputReading(raw: unknown): AudioOutputReading | null {
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as RawOutput
  const session = finite(data.outputVolume)
  if (session === null) return null
  const system =
    data.systemVolumeLive === true ? finite(data.systemVolume) : null
  const volume = system ?? session
  const outputs = ports(data.outputs)
  const first = outputs[0]
  const route: AudioRoute =
    first === undefined ? 'none' : (ROUTES[first.type] ?? 'other')
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

/** Tests only: forget the registration. */
export function resetAudioOutputForTests(): void {
  plugin = null
}
