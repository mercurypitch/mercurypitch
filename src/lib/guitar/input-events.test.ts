// Input-event tests hold the line between "when it happened" and "what it was".
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarInputEvent, GuitarInputPitch } from './input-events'
import { attachPitchToLatestAttack, frameToSeconds } from './input-events'

function attack(
  at: number,
  pitch: GuitarInputPitch | null = null,
): GuitarInputEvent {
  return {
    id: `attack-${at}`,
    kind: 'attack',
    source: 'microphone',
    voiceId: null,
    at,
    capturedAt: at + 0.04,
    level: 0.4,
    clock: {
      kind: 'audio-worklet',
      atFrame: Math.round((at + 0.04) * 48_000),
      sampleRate: 48_000,
    },
    pitch,
  }
}

function pitch(midi: number, clarity: number): GuitarInputPitch {
  return { midi, noteName: 'E4', cents: 3, clarity }
}

describe('frameToSeconds', () => {
  it('converts an absolute frame count to audio-clock seconds', () => {
    expect(frameToSeconds(48000, 48000)).toBe(1)
    expect(frameToSeconds(22050, 44100)).toBe(0.5)
  })

  it('refuses to divide by a sample rate that cannot be real', () => {
    expect(frameToSeconds(48000, 0)).toBe(0)
  })
})

describe('attachPitchToLatestAttack', () => {
  it('gives a strike the note that was identified just after it', () => {
    const events = attachPitchToLatestAttack([attack(2)], pitch(64, 0.8), 2.03)
    expect(events[0]?.pitch?.midi).toBe(64)
  })

  it('leaves a strike alone once the reading is too late to be its own', () => {
    const events = [attack(2)]
    expect(attachPitchToLatestAttack(events, pitch(64, 0.8), 2.4)).toBe(events)
  })

  it('keeps the clearer of two readings for the same note', () => {
    const first = attachPitchToLatestAttack([attack(2)], pitch(64, 0.9), 2.01)
    const second = attachPitchToLatestAttack(first, pitch(64, 0.5), 2.05)
    expect(second[0]?.pitch?.midi).toBe(64)
    expect(second[0]?.pitch?.clarity).toBe(0.9)
  })

  it('corrects a clearer ringing note when the new strike settles elsewhere', () => {
    const ringing = attachPitchToLatestAttack(
      [attack(2)],
      pitch(64, 0.95),
      2.01,
    )
    const corrected = attachPitchToLatestAttack(ringing, pitch(67, 0.62), 2.05)

    expect(corrected[0]?.pitch?.midi).toBe(67)
    expect(corrected[0]?.pitch?.clarity).toBe(0.62)
  })

  it('has nothing to attach a reading to before the first strike', () => {
    expect(attachPitchToLatestAttack([], pitch(64, 0.8), 2)).toEqual([])
  })
})
