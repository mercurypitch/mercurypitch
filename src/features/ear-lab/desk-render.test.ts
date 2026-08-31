import { describe, expect, it, vi } from 'vitest'
import { faultChain, houseLoopSeconds, matchLoudness, randomSliceStart, rmsOf, scaleBuffer, songExcerptStart, } from './desk-render'

function fakeBuffer(...channels: number[][]): AudioBuffer {
  const data = channels.map((c) => new Float32Array(c))
  return {
    numberOfChannels: data.length,
    sampleRate: 4,
    length: data[0].length,
    duration: data[0].length / 4,
    getChannelData: (i: number) => data[i],
  } as unknown as AudioBuffer
}

function fakeContext() {
  const made: { type: string; node: Record<string, unknown> }[] = []
  const param = () => ({ value: 0 })
  const node = (type: string, extra: Record<string, unknown> = {}) => {
    const created = { connect: vi.fn(), ...extra }
    made.push({ type, node: created })
    return created
  }
  const ctx = {
    createGain: () => node('gain', { gain: param() }),
    createBiquadFilter: () =>
      node('biquad', {
        type: '',
        frequency: param(),
        Q: param(),
        gain: param(),
      }),
    createDynamicsCompressor: () =>
      node('compressor', {
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      }),
    createChannelSplitter: () => node('splitter'),
    createChannelMerger: () => node('merger'),
  } as unknown as BaseAudioContext
  return { ctx, made }
}

describe('the desk renders', () => {
  it('measures and matches loudness in place', () => {
    const reference = fakeBuffer([0.5, -0.5, 0.5, -0.5])
    const target = fakeBuffer([0.25, -0.25], [0.25, -0.25])
    expect(rmsOf(reference)).toBeCloseTo(0.5, 6)
    matchLoudness(reference, target)
    expect(rmsOf(target)).toBeCloseTo(0.5, 6)
    scaleBuffer(target, 0)
    expect(rmsOf(target)).toBe(0)
    matchLoudness(reference, target)
    expect(rmsOf(target)).toBe(0)
  })

  it('places the excerpt and the slice inside the source', () => {
    expect(houseLoopSeconds()).toBeCloseTo(9.6, 6)
    expect(songExcerptStart(200, 8)).toBe(60)
    expect(songExcerptStart(10, 8)).toBe(2)
    expect(songExcerptStart(6, 8)).toBe(0)
    expect(randomSliceStart(9.6, 3.2, () => 0.5)).toBeCloseTo(3.2, 2)
    expect(randomSliceStart(2, 3.2)).toBe(0)
  })

  it('builds each fault as the nodes a mixer would reach for', () => {
    const { ctx, made } = fakeContext()
    const peak = faultChain(ctx, { kind: 'peak', hz: 500, q: 1.1, db: 6 })
    expect(peak.input).toBe(peak.output)
    expect(made[0].node).toMatchObject({ type: 'peaking' })
    expect((made[0].node.frequency as { value: number }).value).toBe(500)
    expect((made[0].node.gain as { value: number }).value).toBe(6)

    faultChain(ctx, { kind: 'shelf', hz: 120, db: 3 })
    expect(made[1].node).toMatchObject({ type: 'lowshelf' })

    const pump = faultChain(ctx, { kind: 'pump' })
    expect(made[2].type).toBe('compressor')
    expect((made[2].node.ratio as { value: number }).value).toBe(12)
    expect(pump.output).toBe(made[3].node)

    const narrow = faultChain(ctx, { kind: 'narrow' })
    expect(made.slice(4).map((entry) => entry.type)).toEqual([
      'splitter',
      'merger',
      'gain',
      'gain',
    ])
    expect(narrow.input).toBe(made[4].node)
    expect(narrow.output).toBe(made[5].node)

    const straight = faultChain(ctx, null)
    expect(straight.input).toBe(straight.output)
  })
})
