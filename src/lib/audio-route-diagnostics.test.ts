// ============================================================
// Audio route diagnostics tests — units, privacy and observation boundaries
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createAudioRouteDiagnosticsReader } from './audio-route-diagnostics'

function harness(monitorInputChannel?: () => number | null) {
  const settings: Record<string, unknown> = {
    deviceId: 'private-input-id',
    groupId: 'private-serial',
    sampleRate: 48000,
    channelCount: 4,
    latency: 0.012,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  }
  const constraints: Record<string, unknown> = {
    deviceId: { exact: 'private-input-id' },
    sampleRate: { ideal: 48000 },
    channelCount: { min: 1, max: 4 },
    latency: { ideal: 0 },
    echoCancellation: false,
    noiseSuppression: { exact: false },
    autoGainControl: false,
  }
  const stats = {
    averageLatency: 0.018,
    minimumLatency: 0.012,
    maximumLatency: 0.027,
    totalDuration: 20,
    underrunEvents: 3,
    underrunDuration: 0.004,
  }
  const context: Record<string, unknown> = {
    state: 'running',
    sampleRate: 48000,
    baseLatency: 0.0027,
    outputLatency: 0.018,
    sinkId: 'private-output-id',
    playbackStats: stats,
  }
  const track = {
    label: 'private-device-label',
    id: 'private-track-id',
    readyState: 'live',
    muted: false,
    getSettings: () => settings,
    getConstraints: () => constraints,
  }
  const read = createAudioRouteDiagnosticsReader({
    context: context as unknown as AudioContext,
    track: track as unknown as MediaStreamTrack,
    requestedDeviceId: 'private-input-id',
    monitorInputChannel,
  })
  return { read, settings, constraints, context, track, stats }
}

describe('audio route diagnostics', () => {
  it('reports selected mono input and resets the observation when that selection changes', () => {
    let selected = 0
    const { read } = harness(() => selected)
    expect(read(0).capture).toMatchObject({
      monitorChannelMode: 'selected-mono',
      monitorInputChannel: 0,
    })
    expect(read(1000).observationSeconds).toBe(1)
    selected = 2
    const next = read(2000)
    expect(next.capture.monitorInputChannel).toBe(2)
    expect(next.routeRevision).toBe(2)
    expect(next.observationSeconds).toBe(0)
    expect(next.playback.intervalUnderrunCount).toBeNull()
  })

  it.each([-1, 4, 32, 1.5, Number.NaN])(
    'does not report invalid channel %s as a selected mono route',
    (channel) => {
      const { read } = harness(() => channel)
      expect(read(0).capture).toMatchObject({
        monitorChannelMode: 'browser-multichannel',
        monitorInputChannel: null,
      })
    },
  )

  it('keeps requested and actual capture values separate without leaking device identity', () => {
    const { read } = harness()

    const snapshot = read(100)

    expect(snapshot.capture).toEqual({
      requested: {
        sampleRate: { ideal: 48000 },
        channelCount: { min: 1, max: 4 },
        latencySeconds: { ideal: 0 },
        echoCancellation: false,
        noiseSuppression: { exact: false },
        autoGainControl: false,
      },
      actual: {
        sampleRate: 48000,
        channelCount: 4,
        latencySeconds: 0.012,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      trackState: 'live',
      muted: false,
      deviceSelection: 'explicit',
      deviceMatch: true,
      monitorChannelMode: 'browser-multichannel',
      monitorInputChannel: null,
    })
    expect(JSON.stringify(snapshot)).not.toContain('private-')
    expect(snapshot.context.outputSelection).toBe('explicit')
    expect(snapshot.observationSeconds).toBe(0)
  })

  it('preserves reported zero while unavailable APIs and invalid numbers stay null', () => {
    const { read, context, settings, constraints } = harness()
    delete context.playbackStats
    delete context.outputLatency
    delete context.sinkId
    context.baseLatency = 0
    settings.latency = 0
    settings.channelCount = Number.NaN
    delete settings.echoCancellation
    constraints.sampleRate = { ideal: Infinity }

    const snapshot = read()

    expect(snapshot.context.baseLatencySeconds).toBe(0)
    expect(snapshot.context.outputLatencySeconds).toBeNull()
    expect(snapshot.context.outputSelection).toBe('unavailable')
    expect(snapshot.capture.actual.latencySeconds).toBe(0)
    expect(snapshot.capture.actual.channelCount).toBeNull()
    expect(snapshot.capture.actual.echoCancellation).toBeNull()
    expect(snapshot.capture.requested.sampleRate).toBeNull()
    expect(snapshot.playback.supported).toBe(false)
    expect(snapshot.playback.underrunCount).toBeNull()
  })

  it('reads modern playback seconds without aliasing legacy milliseconds or summing overlapping estimates', () => {
    const { read, context } = harness()
    const resetLatency = vi.fn()
    Object.assign(context.playbackStats as object, { resetLatency })
    context.playoutStats = { averageLatency: 999, fallbackFramesEvents: 99 }

    const snapshot = read()

    expect(snapshot.playback.averageLatencySeconds).toBe(0.018)
    expect(snapshot.playback.minimumLatencySeconds).toBe(0.012)
    expect(snapshot.playback.maximumLatencySeconds).toBe(0.027)
    expect(snapshot.playback.latencyScope).toBe(
      'context-since-last-browser-reset',
    )
    expect(snapshot.context.outputLatencySeconds).toBe(0.018)
    expect(snapshot).not.toHaveProperty('totalLatencySeconds')
    expect(resetLatency).not.toHaveBeenCalled()
    delete context.playbackStats
    expect(read().playback.averageLatencySeconds).toBeNull()
  })

  it('reports elapsed observation and underrun deltas rather than counting earlier context history', () => {
    const { read, stats } = harness()
    read(500)
    stats.underrunEvents = 5
    stats.underrunDuration = 0.008
    stats.totalDuration = 22

    const snapshot = read(2500)

    expect(snapshot.observationSeconds).toBe(2)
    expect(snapshot.playback.intervalSeconds).toBe(2)
    expect(snapshot.playback.intervalUnderrunCount).toBe(2)
    expect(snapshot.playback.intervalUnderrunDurationSeconds).toBeCloseTo(
      0.004,
      8,
    )
    expect(snapshot.playback.underrunCount).toBe(5)
    expect(snapshot.playback.counterReset).toBe(false)
  })

  it('discards deltas when browser counters reset and establishes a new counter baseline', () => {
    const { read, stats } = harness()
    read(0)
    stats.totalDuration = 0
    stats.underrunEvents = 0
    stats.underrunDuration = 0

    const reset = read(1000)

    expect(reset.playback.counterReset).toBe(true)
    expect(reset.playback.intervalSeconds).toBeNull()
    expect(reset.playback.intervalUnderrunCount).toBeNull()
    expect(reset.playback.intervalUnderrunDurationSeconds).toBeNull()
    stats.underrunEvents = 1
    expect(read(2000).playback.intervalUnderrunCount).toBe(1)
  })

  it.each([
    'device',
    'sample-rate',
    'channels',
    'output',
    'interrupted',
    'suspended',
    'closed',
  ])('invalidates the observation interval after %s changes', (change) => {
    const { read, settings, context } = harness()
    read(0)
    if (change === 'device') settings.deviceId = 'private-new-input'
    else if (change === 'sample-rate') settings.sampleRate = 44100
    else if (change === 'channels') settings.channelCount = 2
    else if (change === 'output') context.sinkId = 'private-new-output'
    else context.state = change

    const next = read(1000)

    expect(next.routeRevision).toBe(2)
    expect(next.observationSeconds).toBe(0)
    expect(next.playback.intervalUnderrunCount).toBeNull()
    if (change === 'device') expect(next.capture.deviceMatch).toBe(false)
    if (change === 'interrupted') expect(next.context.state).toBe('interrupted')
  })

  it('reports failures as fixed redacted codes without throwing or exposing browser error text', () => {
    const { read, track, context } = harness()
    track.getSettings = () => {
      throw new Error('private-serial')
    }
    Object.defineProperty(context, 'playbackStats', {
      get() {
        throw new Error('private-output-label')
      },
    })

    const snapshot = read()

    expect(snapshot.issues).toEqual([
      'capture-settings-unavailable',
      'playback-stats-unavailable',
    ])
    expect(snapshot.capture.actual.sampleRate).toBeNull()
    expect(snapshot.playback.supported).toBe(false)
    expect(JSON.stringify(snapshot)).not.toContain('private-')
  })
})
