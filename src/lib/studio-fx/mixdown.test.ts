import { describe, expect, it } from 'vitest'
import { normalizeChainSpec } from './chain-spec'
import { alignmentOffsets, measureTrackLatencies } from './mixdown'

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
