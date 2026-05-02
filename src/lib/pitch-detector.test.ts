import { describe, expect, it } from 'vitest'
import { PitchDetector } from './pitch-detector'

describe('PitchDetector', () => {
  it('should create with default options', () => {
    const detector = new PitchDetector()
    expect(detector.getSampleRate()).toBe(44100)
    expect(detector.getBufferSize()).toBe(2048)
  })

  it('should create with custom options', () => {
    const detector = new PitchDetector({ sampleRate: 48000, bufferSize: 4096 })
    expect(detector.getSampleRate()).toBe(48000)
    expect(detector.getBufferSize()).toBe(4096)
  })

  it('should return silence for a silent buffer', () => {
    const detector = new PitchDetector()
    const buffer = new Float32Array(2048)
    const result = detector.detect(buffer)
    expect(result.frequency).toBe(0)
    expect(result.clarity).toBe(0)
  })

  it('should set sensitivity', () => {
    const detector = new PitchDetector()
    detector.setSensitivity(8)
    // Should not throw
  })

  it('should reset history', () => {
    const detector = new PitchDetector()
    detector.resetHistory()
    // Should not throw
  })
})
