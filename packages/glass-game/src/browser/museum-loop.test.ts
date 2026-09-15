// Museum loop tests — real sample continuity across authored and encoded buffer boundaries.
import { describe, expect, it } from 'vitest'
import { repairMuseumLoop } from './museum-loop'

function buffer(
  channels: number,
  length: number,
  sampleRate: number,
): AudioBuffer {
  const data = Array.from({ length: channels }, () => new Float32Array(length))
  return {
    length,
    numberOfChannels: channels,
    sampleRate,
    getChannelData: (channel: number) => data[channel],
  } as AudioBuffer
}

describe('decoded museum loop', () => {
  it('replaces a large wrap jump with adjacent source samples without altering the decoder buffer', () => {
    const source = buffer(2, 100, 100)
    for (let channel = 0; channel < 2; channel++)
      for (let frame = 0; frame < 100; frame++)
        source.getChannelData(channel)[frame] =
          (frame / 100) * (channel ? -1 : 1)
    const repaired = repairMuseumLoop({ createBuffer: buffer }, source, 0.1)
    expect(repaired.length).toBe(90)
    for (let channel = 0; channel < 2; channel++) {
      const samples = repaired.getChannelData(channel)
      expect(Math.abs(samples[0] - samples.at(-1)!)).toBeCloseTo(0.01)
      expect(samples[79]).toBe(source.getChannelData(channel)[89])
      expect(samples[80]).toBe(source.getChannelData(channel)[90])
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1)
    }
    expect(source.getChannelData(0)[99]).toBeCloseTo(0.99)
  })

  it('smooths actual decoder padding without assuming any fixed codec trim', () => {
    const source = buffer(1, 1000, 1000)
    source.getChannelData(0).fill(0.2, 17, 987)
    const repaired = repairMuseumLoop({ createBuffer: buffer }, source)
    const samples = repaired.getChannelData(0)
    expect(samples[0]).toBeCloseTo(0.2)
    expect(samples.at(-1)).toBeCloseTo(0.2)
    let maxStep = 0
    for (let n = 1; n < samples.length; n++)
      maxStep = Math.max(maxStep, Math.abs(samples[n] - samples[n - 1]))
    expect(maxStep).toBeLessThan(0.04)
  })

  it('bounds overlap for short sounds and rejects unusable buffers', () => {
    expect(
      repairMuseumLoop({ createBuffer: buffer }, buffer(1, 40, 48000)).length,
    ).toBe(30)
    expect(() =>
      repairMuseumLoop({ createBuffer: buffer }, buffer(1, 4, 48000)),
    ).toThrow('too short')
  })
})
