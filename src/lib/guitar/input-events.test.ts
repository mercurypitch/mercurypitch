// Input-event tests hold the line between "when it happened" and "what it was".
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarInputEvent, GuitarInputPitch } from './input-events'
import { attachPitchToLatestAttack, createNoiseFloorFollower, describeInputHealth, frameToSeconds, } from './input-events'

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

describe('describeInputHealth', () => {
  it('calls a clipped signal unusable before anything else', () => {
    // Loud and noisy at once: clipping is the one the player must fix first.
    expect(describeInputHealth(0.999, 0.6).state).toBe('clipping')
  })

  it('says nothing is coming in rather than guessing at a level', () => {
    expect(describeInputHealth(0.004, 0).state).toBe('silent')
  })

  it('calls out a room as loud as the guitar', () => {
    expect(describeInputHealth(0.2, 0.12).state).toBe('noisy')
  })

  it('warns before clipping, not only after', () => {
    expect(describeInputHealth(0.85, 0.01).state).toBe('hot')
  })

  it('asks for more signal when there is barely any', () => {
    expect(describeInputHealth(0.03, 0.002).state).toBe('quiet')
  })

  it('stays out of the way when the level is fine', () => {
    const reading = describeInputHealth(0.4, 0.01)
    expect(reading.state).toBe('good')
    expect(reading.hint).not.toBe('')
  })

  it('keeps an uncertain note distinct from silence', () => {
    const uncertain = {
      state: 'uncertain' as const,
      hint: 'Signal is present, but the note is not stable enough to name.',
    }
    expect(uncertain.state).not.toBe('silent')
    expect(uncertain.hint).toContain('not stable enough')
  })
})

describe('createNoiseFloorFollower', () => {
  it('drops to a quieter moment immediately', () => {
    const follower = createNoiseFloorFollower()
    follower.push(0.3, 0.003)
    expect(follower.push(0.02, 0.003)).toBeCloseTo(0.02, 6)
  })

  it('takes seconds to accept that the room got louder', () => {
    const follower = createNoiseFloorFollower(3)
    follower.push(0.01, 0.003)
    // A second of loud playing barely moves it — that is the point: this
    // measures the room, not the guitar.
    for (let block = 0; block < 333; block += 1) follower.push(0.5, 0.003)
    expect(follower.value()).toBeLessThan(0.2)

    for (let block = 0; block < 3000; block += 1) follower.push(0.5, 0.003)
    expect(follower.value()).toBeGreaterThan(0.45)
  })

  it('starts from what it first hears instead of from silence', () => {
    const follower = createNoiseFloorFollower()
    expect(follower.push(0.08, 0.003)).toBeCloseTo(0.08, 6)
    follower.reset()
    expect(follower.value()).toBe(0)
  })
})
