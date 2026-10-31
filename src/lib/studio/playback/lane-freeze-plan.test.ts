// Studio lane freeze plan — nothing for a song that fits; the heaviest settled lanes first, within memory.
import { describe, expect, it } from 'vitest'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioPlannedSegment } from '../model/arrangement-plan'
import { FREEZE_CHUNK_FRAMES, frozenChunkBytes } from './lane-freeze'
import type { StudioFreezeCandidate } from './lane-freeze-plan'
import { chooseLaneFreezes, frozenLaneBytes } from './lane-freeze-plan'
import { freezeTailFrames } from './lane-freeze-render'

function chain(...kinds: string[]): ChainSpec {
  return {
    version: 1,
    effects: kinds.map((kind, index) => ({
      id: `${kind}-${index}`,
      kind,
      enabled: true,
      params: kind === 'reverb' ? { decayS: 2, duck: 0 } : {},
    })),
  } as unknown as ChainSpec
}

const HEAVY = chain('limiter', 'saturation', 'exciter', 'transient')
const LIGHT = chain('eq')

function lane(
  trackId: string,
  spec: ChainSpec,
  more: Partial<StudioFreezeCandidate> = {},
): StudioFreezeCandidate {
  return { trackId, spec, bytes: 10, ready: false, settled: true, ...more }
}

describe('Studio lane freeze plan', () => {
  it('freezes nothing while the song fits', () => {
    const lanes = [lane('a', HEAVY), lane('b', LIGHT)]
    expect(
      chooseLaneFreezes(lanes, {
        tier: 'best',
        voiceChainUs: 50,
        memoryBytes: 1e9,
      }),
    ).toEqual([])
  })

  it('freezes the heaviest settled lanes first, until the song fits', () => {
    const lanes = [
      lane('light', LIGHT),
      lane('heavy', HEAVY),
      lane('edited', HEAVY, { settled: false }),
      lane('heavy-2', HEAVY),
    ]
    // At 400 us a voice chain, the master and realtime alone are 42 % of the thread.
    const order = chooseLaneFreezes(lanes, {
      tier: 'best',
      voiceChainUs: 400,
      memoryBytes: 1e9,
    })
    expect(order[0]).toMatch(/^heavy/)
    expect(order).not.toContain('edited')
    expect(order.indexOf('light')).toBe(
      order.includes('light') ? order.length - 1 : -1,
    )
  })

  it('counts lanes rendered already as frozen, and stops at the memory renders may hold', () => {
    const lanes = [
      lane('ready', HEAVY, { ready: true, bytes: 60 }),
      lane('a', HEAVY, { bytes: 30 }),
      lane('b', HEAVY, { bytes: 30 }),
    ]
    const order = chooseLaneFreezes(lanes, {
      tier: 'best',
      voiceChainUs: 2000,
      memoryBytes: 100,
    })
    expect(order).toHaveLength(1)
    expect(order).not.toContain('ready')
  })

  it('estimates a lane’s render from its runs of clips and their tails, in whole chunks', () => {
    const spec = LIGHT
    const tail = freezeTailFrames(spec)
    const segment = (startFrame: number, frames: number) =>
      ({
        startFrame,
        sourceInFrame: 0,
        sourceOutFrame: frames,
      }) as StudioPlannedSegment
    // Two clips that overlap with their tails make one run; the third is apart.
    const segments = [
      segment(0, 48000),
      segment(48000 + tail - 10, 48000),
      segment(48000 * 60, 1000),
    ]
    // Each run is rendered on its own, in whole chunks from its first clip.
    const chunks =
      Math.ceil((48000 + tail - 10 + 48000 + tail) / FREEZE_CHUNK_FRAMES) +
      Math.ceil((1000 + tail) / FREEZE_CHUNK_FRAMES)
    expect(frozenLaneBytes({ segments, spec })).toBe(
      chunks * frozenChunkBytes(FREEZE_CHUNK_FRAMES),
    )
  })
})
