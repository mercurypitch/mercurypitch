import { describe, expect, it } from 'vitest'
import { frameTime } from '@/lib/studio/playback/whole-frame'
import { EMPTY_CHAIN, normalizeChainSpec } from './chain-spec'
import { FakeBuffer, FakeNode, FakeOfflineAudioContext, } from './fake-audio-graph.test-fixtures'
import { alignmentOffsets, measureTrackLatencies, renderMixdown, } from './mixdown'

describe('alignmentOffsets', () => {
  it('starts every track early by how much faster its chain is than the slowest', () => {
    expect(alignmentOffsets([2112, 288, 0, 1680])).toEqual([0, 1824, 2112, 432])
  })

  it('needs no offsets when nothing delays', () => {
    expect(alignmentOffsets([0, 0])).toEqual([0, 0])
    expect(alignmentOffsets([])).toEqual([])
  })
})

describe('measureTrackLatencies', () => {
  it('reports no latency for empty chains without rendering anything', async () => {
    const createContext = () => {
      throw new Error('should not render empty chains')
    }
    const empty = normalizeChainSpec({ effects: [] })
    await expect(
      measureTrackLatencies([empty, empty], 48000, createContext),
    ).resolves.toEqual([0, 0])
  })
})

describe('renderMixdown', () => {
  it('starts a clip on its frame where plain division lands a hair before it', async () => {
    // Arrange: the half-second pre-roll and 7 frames is frame 24007, and
    // 24007 / 48000 * 48000 reads 24006.999999999996, a hair before the
    // frame, where a browser interpolates (whole-frame.ts).
    const starts: number[] = []
    const createContext = (options: OfflineAudioContextOptions) =>
      Object.assign(new FakeOfflineAudioContext(options.sampleRate), {
        createBufferSource: () =>
          Object.assign(new FakeNode('source'), {
            buffer: null,
            start: (when: number) => starts.push(when),
          }),
        startRendering: () =>
          Promise.resolve(
            new FakeBuffer(2, options.length, options.sampleRate),
          ),
      }) as unknown as OfflineAudioContext
    const buffer = Object.assign(new FakeBuffer(1, 480, 48000), {
      duration: 0.01,
    }) as unknown as AudioBuffer

    // Act
    await renderMixdown(
      [{ buffer, spec: EMPTY_CHAIN, startSeconds: 7 / 48000 }],
      {
        createContext,
        tailSeconds: 0,
      },
    )

    // Assert
    expect(starts).toEqual([frameTime(24007, 48000)])
    expect(starts[0] * 48000).toBeGreaterThanOrEqual(24007)
  })
})
