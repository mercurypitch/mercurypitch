// Key-shift timing: the heard song position and the heard reference pitch.
import { describe, expect, it } from 'vitest'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { audibleSongTime, shiftDetectedPitch } from './stem-key-timing'

const A4: DetectedPitch = {
  frequency: 440,
  clarity: 0.9,
  noteName: 'A',
  octave: 4,
  cents: 0,
}

describe('audibleSongTime', () => {
  it('takes the shifter latency off the heard position', () => {
    expect(audibleSongTime(10, 5.2, 5, 1, 0.1)).toBeCloseTo(10.1, 9)
  })

  it('removes the latency in real time, before the speed scales it', () => {
    expect(audibleSongTime(10, 5.2, 5, 2, 0.1)).toBeCloseTo(10 + 0.1 * 2, 9)
  })

  it('never reports a position before the one playback started from', () => {
    expect(audibleSongTime(10, 5.05, 5, 1, 0.12)).toBe(10)
  })

  it('matches the unshifted position with no latency', () => {
    expect(audibleSongTime(3, 7.5, 7, 0.5, 0)).toBeCloseTo(3.25, 9)
  })
})

describe('shiftDetectedPitch', () => {
  it('moves the reference by the shift and renames the note', () => {
    const shifted = shiftDetectedPitch(A4, 2)

    expect(shifted.frequency).toBeCloseTo(493.88, 2)
    expect(shifted.noteName).toBe('B')
    expect(shifted.octave).toBe(4)
    expect(shifted.cents).toBe(0)
    expect(shifted.clarity).toBe(0.9)
  })

  it('carries a fractional shift into the cents', () => {
    const shifted = shiftDetectedPitch(A4, -0.25)

    expect(shifted.noteName).toBe('A')
    expect(shifted.cents).toBe(-25)
  })

  it('returns the same reading at 0', () => {
    expect(shiftDetectedPitch(A4, 0)).toBe(A4)
  })
})
