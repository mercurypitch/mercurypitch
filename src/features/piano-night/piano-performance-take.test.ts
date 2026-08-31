// ============================================================
// Piano performance take tests — normalized lifetimes and active-time truth
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoInputEvent } from '@/features/piano/input/piano-input-state'
import { createPianoInputState } from '@/features/piano/input/piano-input-state'
import { createPianoPerformanceTakeRecorder, PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS, } from './piano-performance-take'

const touchSource = Object.freeze({
  kind: 'touch' as const,
  id: 'keys',
  name: 'Piano Night keys',
})
const midiSource = Object.freeze({
  kind: 'midi' as const,
  id: 'private-device-id',
  name: 'Private device name',
})

function captureInput(
  recorder: ReturnType<typeof createPianoPerformanceTakeRecorder>,
  events: readonly PianoInputEvent[],
): void {
  const input = createPianoInputState()
  for (const event of events) recorder.record(input.apply(event))
}

describe('createPianoPerformanceTakeRecorder', () => {
  it('captures touch and MIDI polyphony without retaining device identity', () => {
    const recorder = createPianoPerformanceTakeRecorder()
    recorder.begin(1_000)
    captureInput(recorder, [
      {
        type: 'note-on',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0.7,
        timestampMs: 1_010,
      },
      {
        type: 'note-on',
        source: midiSource,
        channel: 1,
        midi: 67,
        velocity: 0.9,
        timestampMs: 1_020,
      },
      {
        type: 'note-off',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0.2,
        timestampMs: 1_110,
      },
      {
        type: 'note-off',
        source: midiSource,
        channel: 1,
        midi: 67,
        velocity: 0.4,
        timestampMs: 1_140,
      },
    ])

    const finished = recorder.finish(1_150)

    expect(finished.ok).toBe(true)
    if (!finished.ok) return
    expect(finished.capture.inputKinds).toEqual(['midi', 'touch'])
    expect(finished.capture.notes).toMatchObject([
      {
        midi: 60,
        inputKind: 'touch',
        startMs: 10,
        endMs: 110,
        releaseVelocity: 0.2,
      },
      {
        midi: 67,
        inputKind: 'midi',
        startMs: 20,
        endMs: 140,
        releaseVelocity: 0.4,
      },
    ])
    expect(JSON.stringify(finished.capture)).not.toContain('private-device')
    expect(JSON.stringify(finished.capture)).not.toContain('Private device')
  })

  it('uses the pedal-resolved sounding end rather than physical key-up', () => {
    const recorder = createPianoPerformanceTakeRecorder()
    recorder.begin(0)
    captureInput(recorder, [
      {
        type: 'pedal',
        source: midiSource,
        channel: 0,
        pedal: 'sustain',
        value: 1,
        timestampMs: 5,
      },
      {
        type: 'note-on',
        source: midiSource,
        channel: 0,
        midi: 64,
        velocity: 0.8,
        timestampMs: 10,
      },
      {
        type: 'note-off',
        source: midiSource,
        channel: 0,
        midi: 64,
        velocity: 0.35,
        timestampMs: 80,
      },
      {
        type: 'pedal',
        source: midiSource,
        channel: 0,
        pedal: 'sustain',
        value: 0,
        timestampMs: 240,
      },
    ])

    const finished = recorder.finish(250)

    expect(finished.ok).toBe(true)
    if (!finished.ok) return
    expect(finished.capture.notes[0]).toMatchObject({
      startMs: 10,
      endMs: 240,
      releaseVelocity: 0.35,
    })
  })

  it('removes paused wall time and resets earlier repeated passes', () => {
    const recorder = createPianoPerformanceTakeRecorder()
    recorder.begin(0)
    captureInput(recorder, [
      {
        type: 'note-on',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0.8,
        timestampMs: 10,
      },
      {
        type: 'note-off',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0,
        timestampMs: 90,
      },
    ])
    expect(recorder.pause(100)).toBe(true)
    expect(recorder.resume(1_100)).toBe(true)
    captureInput(recorder, [
      {
        type: 'note-on',
        source: touchSource,
        channel: 0,
        midi: 62,
        velocity: 0.8,
        timestampMs: 1_110,
      },
      {
        type: 'note-off',
        source: touchSource,
        channel: 0,
        midi: 62,
        velocity: 0,
        timestampMs: 1_190,
      },
    ])
    const paused = recorder.finish(1_200)

    expect(paused.ok).toBe(true)
    if (!paused.ok) return
    expect(paused.capture.durationMs).toBe(200)
    expect(paused.capture.notes[1]).toMatchObject({
      midi: 62,
      startMs: 110,
      endMs: 190,
    })

    recorder.begin(2_000)
    captureInput(recorder, [
      {
        type: 'note-on',
        source: touchSource,
        channel: 0,
        midi: 72,
        velocity: 0.8,
        timestampMs: 2_010,
      },
      {
        type: 'note-off',
        source: touchSource,
        channel: 0,
        midi: 72,
        velocity: 0,
        timestampMs: 2_050,
      },
    ])
    const finalPass = recorder.finish(2_060)

    expect(finalPass.ok).toBe(true)
    if (!finalPass.ok) return
    expect(finalPass.capture.notes.map((note) => note.midi)).toEqual([72])
  })

  it('rejects empty and over-duration passes without allocating replay PCM', () => {
    const recorder = createPianoPerformanceTakeRecorder()
    recorder.begin(0)
    expect(recorder.finish(20)).toEqual({ ok: false, reason: 'empty' })

    recorder.begin(0)
    captureInput(recorder, [
      {
        type: 'note-on',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0.8,
        timestampMs: 1,
      },
      {
        type: 'note-off',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0,
        timestampMs: PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + 1,
      },
    ])
    expect(recorder.finish(PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + 1)).toEqual(
      { ok: false, reason: 'duration-limit' },
    )
  })

  it('rejects a pass that finishes over the limit without a late input event', () => {
    const recorder = createPianoPerformanceTakeRecorder()
    recorder.begin(0)
    captureInput(recorder, [
      {
        type: 'note-on',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0.8,
        timestampMs: 1,
      },
      {
        type: 'note-off',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0,
        timestampMs: 20,
      },
    ])

    expect(recorder.finish(PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + 1)).toEqual(
      { ok: false, reason: 'duration-limit' },
    )
  })

  it('rejects over-limit active time accumulated across pause and resume', () => {
    const recorder = createPianoPerformanceTakeRecorder()
    recorder.begin(0)
    captureInput(recorder, [
      {
        type: 'note-on',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0.8,
        timestampMs: 1,
      },
      {
        type: 'note-off',
        source: touchSource,
        channel: 0,
        midi: 60,
        velocity: 0,
        timestampMs: 20,
      },
    ])
    expect(recorder.pause(PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS - 5)).toBe(
      true,
    )
    expect(
      recorder.resume(PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + 10_000),
    ).toBe(true)

    expect(
      recorder.pause(PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + 10_006),
    ).toBe(false)
    expect(
      recorder.finish(PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + 10_006),
    ).toEqual({ ok: false, reason: 'duration-limit' })
  })
})
