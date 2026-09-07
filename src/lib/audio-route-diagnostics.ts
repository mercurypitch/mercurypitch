// ============================================================
// Audio route diagnostics — passive, redacted browser estimates
// ============================================================
// All durations stay in seconds. None is a measured input-to-output total.

export type AudioNumericRequest =
  | number
  | {
      exact?: number
      ideal?: number
      min?: number
      max?: number
    }

export type AudioBooleanRequest =
  | boolean
  | {
      exact?: boolean
      ideal?: boolean
    }

export interface AudioCaptureSettings {
  sampleRate: number | null
  channelCount: number | null
  latencySeconds: number | null
  echoCancellation: boolean | null
  noiseSuppression: boolean | null
  autoGainControl: boolean | null
}

export interface AudioCaptureRequest {
  sampleRate: AudioNumericRequest | null
  channelCount: AudioNumericRequest | null
  latencySeconds: AudioNumericRequest | null
  echoCancellation: AudioBooleanRequest | null
  noiseSuppression: AudioBooleanRequest | null
  autoGainControl: AudioBooleanRequest | null
}

export interface AudioPlaybackDiagnostics {
  supported: boolean
  /** These distribution values are not scoped to our observation interval. */
  latencyScope: 'context-since-last-browser-reset'
  averageLatencySeconds: number | null
  minimumLatencySeconds: number | null
  maximumLatencySeconds: number | null
  totalDurationSeconds: number | null
  underrunCount: number | null
  underrunDurationSeconds: number | null
  intervalSeconds: number | null
  intervalUnderrunCount: number | null
  intervalUnderrunDurationSeconds: number | null
  counterReset: boolean
}

export interface AudioRouteDiagnosticsSnapshot {
  capturedAt: string
  /** Elapsed wall time in this route/state epoch, including hidden-page time. */
  observationSeconds: number
  routeRevision: number
  capture: {
    requested: AudioCaptureRequest
    actual: AudioCaptureSettings
    trackState: 'live' | 'ended' | 'unavailable'
    muted: boolean | null
    deviceSelection: 'default' | 'explicit'
    deviceMatch: boolean | null
    monitorChannelMode: 'browser-multichannel' | 'selected-mono'
    /** Zero-based browser channel, not a hardware port claim. */
    monitorInputChannel: number | null
  }
  context: {
    state: 'running' | 'suspended' | 'interrupted' | 'closed' | 'unavailable'
    sampleRate: number | null
    baseLatencySeconds: number | null
    outputLatencySeconds: number | null
    outputSelection: 'default' | 'explicit' | 'silent' | 'unavailable'
  }
  playback: AudioPlaybackDiagnostics
  /** Fixed codes only: browser errors can contain device names or identifiers. */
  issues: string[]
}

export interface AudioRouteDiagnosticsSource {
  context: AudioContext
  track: MediaStreamTrack
  /** Private comparison only; neither this ID nor browser labels are exported. */
  requestedDeviceId: string | null
  monitorInputChannel?(): number | null
}

function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null
}

function positive(value: unknown): number | null {
  const number = nonNegative(value)
  return number !== null && number > 0 ? number : null
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function numericRequest(value: unknown): AudioNumericRequest | null {
  if (typeof value === 'number') return nonNegative(value)
  const source = record(value)
  if (source === null) return null
  const result: Exclude<AudioNumericRequest, number> = {}
  for (const key of ['exact', 'ideal', 'min', 'max'] as const) {
    const numeric = nonNegative(source[key])
    if (numeric !== null) result[key] = numeric
  }
  return Object.keys(result).length > 0 ? result : null
}

function booleanRequest(value: unknown): AudioBooleanRequest | null {
  if (typeof value === 'boolean') return value
  const source = record(value)
  if (source === null) return null
  const result: Exclude<AudioBooleanRequest, boolean> = {}
  for (const key of ['exact', 'ideal'] as const) {
    const boolean = booleanValue(source[key])
    if (boolean !== null) result[key] = boolean
  }
  return Object.keys(result).length > 0 ? result : null
}

function contextState(
  value: unknown,
): AudioRouteDiagnosticsSnapshot['context']['state'] {
  return value === 'running' ||
    value === 'suspended' ||
    value === 'interrupted' ||
    value === 'closed'
    ? value
    : 'unavailable'
}

function outputSelection(
  value: unknown,
): AudioRouteDiagnosticsSnapshot['context']['outputSelection'] {
  if (value === '' || value === 'default') return 'default'
  if (typeof value === 'string') return 'explicit'
  return record(value)?.type === 'none' ? 'silent' : 'unavailable'
}

function delta(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null ? current - previous : null
}

/** Observe only already-owned browser objects; never reset their shared statistics. */
export function createAudioRouteDiagnosticsReader(
  source: AudioRouteDiagnosticsSource,
) {
  let routeKey: string | null = null
  let routeRevision = 0
  let startedAt = 0
  let previousAt = 0
  let previousPlayback: AudioPlaybackDiagnostics | null = null

  return (
    nowMilliseconds = performance.now(),
  ): AudioRouteDiagnosticsSnapshot => {
    const issues: string[] = []
    const read = <T>(get: () => T, issue: string): T | null => {
      try {
        return get()
      } catch {
        issues.push(issue)
        return null
      }
    }
    const settings =
      record(
        read(
          () => source.track.getSettings?.(),
          'capture-settings-unavailable',
        ),
      ) ?? {}
    const constraints =
      record(
        read(
          () => source.track.getConstraints?.(),
          'capture-constraints-unavailable',
        ),
      ) ?? {}
    const context = source.context as unknown as Record<string, unknown>
    const sink = read(() => context.sinkId, 'output-selection-unavailable')
    const state = contextState(context.state)
    const actual: AudioCaptureSettings = {
      sampleRate: positive(settings.sampleRate),
      channelCount: positive(settings.channelCount),
      latencySeconds: nonNegative(settings.latency),
      echoCancellation: booleanValue(settings.echoCancellation),
      noiseSuppression: booleanValue(settings.noiseSuppression),
      autoGainControl: booleanValue(settings.autoGainControl),
    }
    const requestedChannel = read(
      () => source.monitorInputChannel?.(),
      'monitor-channel-unavailable',
    )
    const monitorInputChannel =
      typeof requestedChannel === 'number' &&
      Number.isInteger(requestedChannel) &&
      requestedChannel >= 0 &&
      requestedChannel < 32 &&
      (actual.channelCount === null || requestedChannel < actual.channelCount)
        ? requestedChannel
        : null
    // The fingerprint stays private and detects in-place device/rate/topology
    // changes. State transitions also start a fresh observation baseline.
    const nextRouteKey = JSON.stringify([
      settings.deviceId,
      settings.groupId,
      actual,
      monitorInputChannel,
      sink,
      context.sampleRate,
      state,
    ])
    const routeChanged = routeKey !== nextRouteKey
    if (routeChanged) {
      routeKey = nextRouteKey
      routeRevision += 1
      startedAt = nowMilliseconds
      previousPlayback = null
    }

    // Modern playbackStats uses seconds. Legacy playoutStats used milliseconds
    // and is deliberately not aliased. Chromium's IDL and implementation:
    // https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/webaudio/audio_playback_stats.cc
    const stats = record(
      read(() => context.playbackStats, 'playback-stats-unavailable'),
    )
    const stat = (key: string): number | null =>
      nonNegative(read(() => stats?.[key], 'playback-value-unavailable'))
    const playback: AudioPlaybackDiagnostics = {
      supported: stats !== null,
      latencyScope: 'context-since-last-browser-reset',
      averageLatencySeconds: stat('averageLatency'),
      minimumLatencySeconds: stat('minimumLatency'),
      maximumLatencySeconds: stat('maximumLatency'),
      totalDurationSeconds: stat('totalDuration'),
      underrunCount: stat('underrunEvents'),
      underrunDurationSeconds: stat('underrunDuration'),
      intervalSeconds: null,
      intervalUnderrunCount: null,
      intervalUnderrunDurationSeconds: null,
      counterReset: false,
    }
    if (previousPlayback !== null && nowMilliseconds >= previousAt) {
      const countDelta = delta(
        playback.underrunCount,
        previousPlayback.underrunCount,
      )
      const durationDelta = delta(
        playback.underrunDurationSeconds,
        previousPlayback.underrunDurationSeconds,
      )
      const totalDelta = delta(
        playback.totalDurationSeconds,
        previousPlayback.totalDurationSeconds,
      )
      playback.counterReset = [countDelta, durationDelta, totalDelta].some(
        (value) => value !== null && value < 0,
      )
      if (!playback.counterReset) {
        playback.intervalSeconds = (nowMilliseconds - previousAt) / 1000
        playback.intervalUnderrunCount = countDelta
        playback.intervalUnderrunDurationSeconds = durationDelta
      }
    }
    previousAt = nowMilliseconds
    previousPlayback = playback

    return {
      capturedAt: new Date().toISOString(),
      observationSeconds: Math.max(0, nowMilliseconds - startedAt) / 1000,
      routeRevision,
      capture: {
        requested: {
          sampleRate: numericRequest(constraints.sampleRate),
          channelCount: numericRequest(constraints.channelCount),
          latencySeconds: numericRequest(constraints.latency),
          echoCancellation: booleanRequest(constraints.echoCancellation),
          noiseSuppression: booleanRequest(constraints.noiseSuppression),
          autoGainControl: booleanRequest(constraints.autoGainControl),
        },
        actual,
        trackState:
          source.track.readyState === 'live' ||
          source.track.readyState === 'ended'
            ? source.track.readyState
            : 'unavailable',
        muted: booleanValue(source.track.muted),
        deviceSelection:
          source.requestedDeviceId === null ? 'default' : 'explicit',
        deviceMatch:
          source.requestedDeviceId !== null &&
          typeof settings.deviceId === 'string' &&
          settings.deviceId.length > 0
            ? settings.deviceId === source.requestedDeviceId
            : null,
        monitorChannelMode:
          monitorInputChannel === null
            ? 'browser-multichannel'
            : 'selected-mono',
        monitorInputChannel,
      },
      context: {
        state,
        sampleRate: positive(context.sampleRate),
        baseLatencySeconds: nonNegative(
          read(() => context.baseLatency, 'base-latency-unavailable'),
        ),
        outputLatencySeconds: nonNegative(
          read(() => context.outputLatency, 'output-latency-unavailable'),
        ),
        outputSelection: outputSelection(sink),
      },
      playback,
      issues: [...new Set(issues)],
    }
  }
}
