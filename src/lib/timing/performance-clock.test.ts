// Performance clock tests — an event's timestamp lands on the audio clock by the offset between the two clocks at one moment read on both.
import { describe, expect, it } from 'vitest'
import { performanceToAudioSeconds } from './performance-clock'

describe('performanceToAudioSeconds', () => {
  it('places an event earlier or later than the moment read by its distance from it', () => {
    // Arrange: both clocks read at one moment, 2,000 ms and 10 s.
    const observedMs = 2_000
    const audioSeconds = 10

    // Act
    const before = performanceToAudioSeconds(1_988, observedMs, audioSeconds)
    const at = performanceToAudioSeconds(2_000, observedMs, audioSeconds)
    const after = performanceToAudioSeconds(2_250, observedMs, audioSeconds)

    // Assert
    expect(before).toBeCloseTo(9.988, 9)
    expect(at).toBe(10)
    expect(after).toBeCloseTo(10.25, 9)
  })
})
