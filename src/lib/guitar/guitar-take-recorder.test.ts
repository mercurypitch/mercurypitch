// Capture v0 tests keep Guitar Night takes frame-stable, bounded, and ephemeral.
// ============================================================

import { describe, expect, it } from 'vitest'
import { createGuitarTakeRecorder } from './guitar-take-recorder'
import type { GuitarInputCapture, GuitarInputPitch } from './input-events'

const SAMPLE_RATE = 48_000

function exactCapture(
  capturedAtSeconds: number,
  overrides: Partial<GuitarInputCapture> = {},
): GuitarInputCapture {
  return {
    kind: 'attack',
    source: 'microphone',
    voiceId: null,
    level: 0.3,
    pitch: null,
    clock: {
      kind: 'audio-worklet',
      atFrame: Math.round(capturedAtSeconds * SAMPLE_RATE),
      sampleRate: SAMPLE_RATE,
    },
    ...overrides,
  }
}

function pitch(midi: number): GuitarInputPitch {
  return {
    midi,
    noteName: 'E4',
    cents: 2,
    clarity: 0.91,
  }
}

function recorder(
  overrides: Partial<Parameters<typeof createGuitarTakeRecorder>[0]> = {},
) {
  return createGuitarTakeRecorder({
    takeId: 'take-1',
    startedAtSeconds: 10,
    sampleRate: SAMPLE_RATE,
    input: {
      kind: 'microphone',
      requestedDeviceId: null,
      activeDeviceId: 'default-mic',
      activeDeviceLabel: 'Built-in microphone',
    },
    latency: {
      seconds: 0.04,
      provenance: 'stored-round-trip',
      uncertaintySeconds: null,
    },
    attackTimingSource: 'audio-clock',
    ...overrides,
  })
}

describe('createGuitarTakeRecorder', () => {
  it('pins latency and clock provenance when the take starts', () => {
    const options = {
      takeId: 'take-1',
      startedAtSeconds: 10,
      sampleRate: SAMPLE_RATE,
      input: {
        kind: 'microphone' as const,
        requestedDeviceId: null,
        activeDeviceId: 'default-mic',
        activeDeviceLabel: 'Built-in microphone',
      },
      latency: {
        seconds: 0.04,
        provenance: 'stored-round-trip' as const,
        uncertaintySeconds: null,
      },
      attackTimingSource: 'audio-clock' as const,
    }
    const take = createGuitarTakeRecorder(options)

    const first = take.append(exactCapture(10.14))
    options.takeId = 'changed-outside-the-take'
    options.latency.seconds = 0.2
    const second = take.append(exactCapture(10.64))

    expect(first?.capturedAt).toBeCloseTo(10.14, 6)
    expect(first?.at).toBeCloseTo(10.1, 6)
    expect(first?.rawTransportFrame).toBe(6_720)
    expect(first?.compensatedTransportFrame).toBe(4_800)
    expect(second?.at).toBeCloseTo(10.6, 6)
    expect(second?.rawTransportFrame).toBe(30_720)
    expect(second?.compensatedTransportFrame).toBe(28_800)
    expect(second?.id).toBe('take-1:event-2')
    expect(take.snapshot().id).toBe('take-1')
    expect(take.snapshot().clock).toEqual({
      startedAtFrame: 480_000,
      sampleRate: SAMPLE_RATE,
      attack: {
        timingSource: 'audio-clock',
        precision: 'sample-exact',
      },
      latency: {
        seconds: 0.04,
        frames: 1_920,
        provenance: 'stored-round-trip',
        uncertaintySeconds: null,
      },
    })
  })

  it('replaces a provisional attack instead of appending late pitch', () => {
    const take = recorder()
    const provisional = take.append(exactCapture(10.14))
    if (provisional === null) throw new Error('Expected an admitted attack')

    take.replace(provisional.id, {
      ...provisional,
      kind: 'pitch-change',
      source: 'midi',
      level: 1,
      pitch: pitch(64),
    })

    const events = take.snapshot().events
    expect(events).toHaveLength(1)
    expect(events[0]?.id).toBe(provisional.id)
    expect(events[0]?.kind).toBe('attack')
    expect(events[0]?.source).toBe('microphone')
    expect(events[0]?.level).toBe(0.3)
    expect(events[0]?.pitch?.midi).toBe(64)
    expect(events[0]?.rawTransportFrame).toBe(provisional.rawTransportFrame)
    expect(events[0]?.compensatedTransportFrame).toBe(
      provisional.compensatedTransportFrame,
    )
  })

  it('retains explicit coarse frame-loop provenance', () => {
    const take = recorder({ attackTimingSource: 'frame-loop' })
    const event = take.append({
      kind: 'pitch-change',
      source: 'microphone',
      voiceId: null,
      level: 0.2,
      pitch: pitch(67),
      clock: {
        kind: 'frame-loop',
        observedAt: 10.19,
        windowStartAt: 10.147_333_333,
        sampleRate: SAMPLE_RATE,
        windowFrames: 2_048,
      },
    })

    expect(event?.clock).toEqual({
      kind: 'frame-loop',
      observedAt: 10.19,
      windowStartAt: 10.147_333_333,
      sampleRate: SAMPLE_RATE,
      windowFrames: 2_048,
    })
    expect(event?.capturedAt).toBeCloseTo(10.147_333_333, 6)
    expect(take.snapshot().clock.attack).toEqual({
      timingSource: 'frame-loop',
      precision: 'coarse-frame-loop',
    })
  })

  it('degrades an exact take when an admitted attack is only coarse', () => {
    const take = recorder()

    take.append({
      kind: 'attack',
      source: 'microphone',
      voiceId: null,
      level: 0.2,
      pitch: pitch(67),
      clock: {
        kind: 'frame-loop',
        observedAt: 10.19,
        windowStartAt: 10.147_333_333,
        sampleRate: SAMPLE_RATE,
        windowFrames: 2_048,
      },
    })

    expect(take.snapshot().clock.attack).toEqual({
      timingSource: 'frame-loop',
      precision: 'coarse-frame-loop',
    })
  })

  it('keeps exact attack precision when only pitch changes are coarse', () => {
    const take = recorder()

    take.append({
      kind: 'pitch-change',
      source: 'microphone',
      voiceId: null,
      level: 0.2,
      pitch: pitch(67),
      clock: {
        kind: 'frame-loop',
        observedAt: 10.19,
        windowStartAt: 10.147_333_333,
        sampleRate: SAMPLE_RATE,
        windowFrames: 2_048,
      },
    })

    expect(take.snapshot().clock.attack).toEqual({
      timingSource: 'audio-clock',
      precision: 'sample-exact',
    })
  })

  it('marks an uncompensated take as having no latency evidence', () => {
    const take = recorder({
      latency: {
        seconds: 0,
        provenance: 'none',
        uncertaintySeconds: null,
      },
    })

    expect(take.snapshot().clock.latency).toEqual({
      seconds: 0,
      frames: 0,
      provenance: 'none',
      uncertaintySeconds: null,
    })
  })

  it('pins MIDI event-clock provenance without inventing route correction', () => {
    const take = recorder({
      attackTimingSource: 'midi-clock',
      input: {
        kind: 'midi',
        requestedDeviceId: 'midi-1',
        activeDeviceId: 'midi-1',
        activeDeviceLabel: 'Guitar MIDI',
      },
      latency: {
        seconds: 0,
        provenance: 'midi-route-unmeasured',
        uncertaintySeconds: null,
      },
    })
    const event = take.append({
      kind: 'release',
      source: 'midi',
      voiceId: 'midi-1:0:64',
      level: 0,
      pitch: pitch(64),
      clock: {
        kind: 'web-midi',
        eventTimestampMs: 10_200,
        observedPerformanceMs: 10_210,
        mappedAudioTime: 10.2,
        inputId: 'midi-1',
        channel: 0,
      },
    })

    expect(event?.voiceId).toBe('midi-1:0:64')
    expect(event?.capturedAt).toBe(10.2)
    expect(take.snapshot().input.kind).toBe('midi')
    expect(take.snapshot().clock.attack).toEqual({
      timingSource: 'midi-clock',
      precision: 'high-resolution-midi',
    })
    expect(take.snapshot().clock.latency.provenance).toBe(
      'midi-route-unmeasured',
    )
  })

  it('filters evidence before start and after completion', () => {
    const take = recorder()

    expect(take.append(exactCapture(10.02))).toBeNull()
    expect(take.append(exactCapture(10.5))).not.toBeNull()
    expect(take.append(exactCapture(12.04))).not.toBeNull()
    expect(take.append(exactCapture(12.2))).not.toBeNull()

    const completed = take.complete(12)
    expect(completed.lifecycle).toBe('completed')
    expect(completed.durationFrames).toBe(96_000)
    expect(completed.events).toHaveLength(1)
    expect(completed.filteredBeforeStart).toBe(1)
    expect(completed.filteredAfterEnd).toBe(2)
    expect(take.append(exactCapture(11))).toBeNull()
  })

  it('bounds long takes and reports truncation', () => {
    const take = recorder({ maxEvents: 2 })
    take.append(exactCapture(10.1))
    const second = take.append(exactCapture(10.2))
    const third = take.append(exactCapture(10.3))

    const snapshot = take.snapshot()
    expect(snapshot.events.map((event) => event.id)).toEqual([
      second?.id,
      third?.id,
    ])
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.droppedEventCount).toBe(1)
  })

  it('aggregates a fixed set of health states only inside its own take', () => {
    const take = recorder()

    take.observeHealth('good')
    take.observeHealth('noisy')
    take.observeHealth('good')
    take.observeHealth('clipping')

    expect(take.snapshot().inputHealth).toEqual({
      readings: 4,
      states: {
        silent: 0,
        quiet: 0,
        good: 2,
        hot: 0,
        clipping: 1,
        noisy: 1,
        uncertain: 0,
      },
    })

    take.complete(11)
    take.observeHealth('noisy')
    expect(take.snapshot().inputHealth.readings).toBe(4)

    const nextTake = recorder({ takeId: 'take-2' })
    expect(nextTake.snapshot().inputHealth).toEqual({
      readings: 0,
      states: {
        silent: 0,
        quiet: 0,
        good: 0,
        hot: 0,
        clipping: 0,
        noisy: 0,
        uncertain: 0,
      },
    })
  })

  it('refuses an unbounded event limit', () => {
    expect(() => recorder({ maxEvents: Number.POSITIVE_INFINITY })).toThrow(
      'maxEvents must be a finite number.',
    )
  })

  it('cancels without publishing a partial take', () => {
    const take = recorder()
    take.append(exactCapture(10.2))

    const cancelled = take.cancel()
    expect(cancelled.lifecycle).toBe('cancelled')
    expect(cancelled.events).toEqual([])
    expect(take.append(exactCapture(10.3))).toBeNull()
  })
})
