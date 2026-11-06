// ============================================================
// Cast receiver capabilities — what this device can do, read once
// ============================================================
//
// The spike before Google Cast is built out (P6, step 6.0) asks what a Cast
// device gives the stage: Web Audio, memory, a WebSocket and a WebRTC data
// channel, on a Google TV Streamer, an older Chromecast with Google TV and a
// TV with Cast built in. The receiver reads it here and answers a sender's
// `probe` with it (control.ts).
//
// REQ-TV-117: some older Cast devices have Web Audio without
// `AudioContext.outputLatency`. The receiver must then use the stored
// calibration for the device rather than fail, so the probe says where the
// TV's audio delay will come from: measured, calibration, or nowhere (no Web
// Audio at all, as on the newer audio-only Cast devices).
//
// Only presence is read for WebSocket and the data channel: whether a
// channel to the phone actually opens is the spike's to try on the device.
//
// Tests: src/lib/cast-receiver/capabilities.test.ts.

/** Where the TV's own audio delay comes from (REQ-TV-117). */
export type CastLatencySource = 'measured' | 'calibration' | 'none'

export interface CastCapabilities {
  readonly userAgent: string
  readonly screen: {
    readonly width: number
    readonly height: number
    readonly pixelRatio: number
  }
  readonly cores: number | null
  /** `navigator.deviceMemory`, in GB, where the device reports it. */
  readonly deviceMemoryGb: number | null
  readonly audio: {
    readonly context: boolean
    readonly sampleRate: number | null
    readonly baseLatencyMs: number | null
    /** Null where the device has none, or its audio would not start to read it. */
    readonly outputLatencyMs: number | null
    readonly latencySource: CastLatencySource
  }
  readonly network: {
    readonly webSocket: boolean
    readonly dataChannel: boolean
  }
}

/** The parts of an AudioContext the probe reads. */
export interface ProbeAudioContext {
  readonly sampleRate: number
  readonly baseLatency?: number
  readonly outputLatency?: number
  readonly state?: string
  resume?(): Promise<void>
  close(): Promise<void>
}

/** How long the probe waits for a context to start before it reads. */
const RESUME_WAIT_MS = 500

/**
 * Starts `context` if it can, waiting no longer than RESUME_WAIT_MS: a
 * context that is not running reads its output latency as 0, which is not
 * the TV's delay. A Cast device lets audio start without a press; a
 * browser tab may not.
 */
async function running(context: ProbeAudioContext): Promise<boolean> {
  if (context.state === 'running') return true
  if (context.resume === undefined) return false
  await Promise.race([
    context.resume().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, RESUME_WAIT_MS)),
  ])
  return context.state === 'running'
}

/** The parts of the page the probe reads, so a test can hand it any device. */
export interface CapabilityScope {
  readonly navigator: {
    readonly userAgent: string
    readonly hardwareConcurrency?: number
    readonly deviceMemory?: number
  }
  readonly screen: { readonly width: number; readonly height: number }
  readonly devicePixelRatio?: number
  readonly AudioContext?: {
    new (): ProbeAudioContext
    readonly prototype: object
  }
  readonly WebSocket?: unknown
  readonly RTCPeerConnection?: unknown
}

/** Whether `peer` is a constructor whose connections open data channels. */
function opensDataChannels(peer: unknown): boolean {
  if (typeof peer !== 'function') return false
  const prototype: unknown = peer.prototype
  return (
    typeof prototype === 'object' &&
    prototype !== null &&
    'createDataChannel' in prototype
  )
}

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const ms = (seconds: unknown): number | null => {
  const value = finite(seconds)
  return value === null ? null : Math.round(value * 10_000) / 10
}

async function probeAudio(
  scope: CapabilityScope,
): Promise<CastCapabilities['audio']> {
  const Context = scope.AudioContext
  const none = {
    context: false,
    sampleRate: null,
    baseLatencyMs: null,
    outputLatencyMs: null,
    latencySource: 'none',
  } as const
  if (Context === undefined) return none
  let context: ProbeAudioContext
  try {
    context = new Context()
  } catch {
    return none
  }
  try {
    const hasOutputLatency = 'outputLatency' in Context.prototype
    const read = hasOutputLatency && (await running(context))
    return {
      context: true,
      sampleRate: finite(context.sampleRate),
      baseLatencyMs: ms(context.baseLatency),
      outputLatencyMs: read ? ms(context.outputLatency) : null,
      latencySource: hasOutputLatency ? 'measured' : 'calibration',
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}

/** What this device gives the stage. */
export async function probeCastCapabilities(
  scope: CapabilityScope,
): Promise<CastCapabilities> {
  return {
    userAgent: scope.navigator.userAgent,
    screen: {
      width: scope.screen.width,
      height: scope.screen.height,
      pixelRatio: finite(scope.devicePixelRatio) ?? 1,
    },
    cores: finite(scope.navigator.hardwareConcurrency),
    deviceMemoryGb: finite(scope.navigator.deviceMemory),
    audio: await probeAudio(scope),
    network: {
      webSocket: typeof scope.WebSocket === 'function',
      dataChannel: opensDataChannels(scope.RTCPeerConnection),
    },
  }
}
