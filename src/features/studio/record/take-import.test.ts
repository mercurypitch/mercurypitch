// Studio take import tests — every take keeps its whole capture as one file: a plain take trimmed, a punch to its range, a loop take on its newest whole pass.
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STUDIO_IMPORT_LIMITS } from '@/lib/studio/audio/import-limits'
import type { StudioCapturedTake } from '@/lib/studio/record/recorder-types'
import { studioTakeImport } from './take-import'

const RANGE = { startFrame: 96000, endFrame: 144000 }

// Node's Blob reads its bytes back; the test DOM's does not.
beforeEach(() => vi.stubGlobal('Blob', NodeBlob))
afterEach(() => vi.unstubAllGlobals())

/** Frames in a mono 16-bit WAV: its data after the 44-byte header. */
const wavFrames = (wav: Blob) => (wav.size - 44) / 2

/** A take whose sample i holds i, so a sample says where it was cut. */
function take(
  frames: number,
  patch: Partial<StudioCapturedTake> = {},
): StudioCapturedTake {
  return {
    id: 'take-9',
    title: 'Take 9',
    trackId: 'lane-1',
    sampleRate: 48000,
    samples: Float32Array.from({ length: frames }, (_, i) => i / 2 ** 20),
    heardFirst: 90000,
    fromFrame: 96000,
    ...patch,
  }
}

describe('studioTakeImport', () => {
  it('trims a plain take to the frame the singer heard, keeping all its audio', () => {
    const kept = studioTakeImport(take(48000))!
    expect(kept).toMatchObject({
      title: 'Take 9',
      startFrame: 96000,
      sourceInFrame: 6000,
      assetId: 'take-9',
    })
    expect(kept.sourceOutFrame).toBeUndefined()
    expect(wavFrames(kept.wav)).toBe(48000)
  })

  it('keeps a punch to its range with fades, the whole capture as its file', () => {
    const kept = studioTakeImport(
      take(96000, { cut: { mode: 'punch', range: RANGE } }),
    )!
    expect(kept).toMatchObject({
      startFrame: 96000,
      sourceInFrame: 6000,
      sourceOutFrame: 54000,
      fadeFrames: 240,
    })
    expect(wavFrames(kept.wav)).toBe(96000)
  })

  it('keeps nothing of a punch stopped before its range', () => {
    expect(
      studioTakeImport(take(5000, { cut: { mode: 'punch', range: RANGE } })),
    ).toBeNull()
  })

  it('keeps a loop take as one file of the whole capture, its clip on the newest whole pass', () => {
    // 6000 frames before the range, three whole passes and half of a fourth.
    const captured = 6000 + 3 * 48000 + 24000
    const kept = studioTakeImport(
      take(captured, { cut: { mode: 'loop', range: RANGE } }),
    )!
    expect(kept).toMatchObject({
      title: 'Take 9',
      assetId: 'take-9',
      startFrame: 96000,
      sourceInFrame: 6000 + 2 * 48000,
      sourceOutFrame: 6000 + 3 * 48000,
      passes: { firstFrame: 6000, frames: 48000, count: 3 },
      trackId: 'lane-1',
    })
    // Not a frame of silence added, and not a pass copied.
    expect(wavFrames(kept.wav)).toBe(captured)
  })

  it('finds the passes of a 44.1 kHz capture in the 48 kHz frames its import stores', () => {
    const at48 = 6000 + 3 * 48000 + 10000
    const kept = studioTakeImport(
      take(Math.round((at48 * 44100) / 48000), {
        sampleRate: 44100,
        cut: { mode: 'loop', range: RANGE },
      }),
    )!
    expect(kept.passes).toEqual({ firstFrame: 6000, frames: 48000, count: 3 })
    expect(kept.sourceInFrame).toBe(6000 + 2 * 48000)
  })

  it('keeps what was sung over a range longer than a take can be, in a file the import takes', () => {
    const long = { startFrame: 96000, endFrame: 96000 + 6 * 60 * 48000 }
    const kept = studioTakeImport(
      take(6000 + 10 * 48000, { cut: { mode: 'loop', range: long } }),
    )!
    expect(kept).toMatchObject({ startFrame: 96000, sourceInFrame: 6000 })
    expect(kept.passes).toBeUndefined()
    expect(kept.sourceOutFrame).toBeUndefined()
    expect(wavFrames(kept.wav)).toBe(6000 + 10 * 48000)
    expect(wavFrames(kept.wav)).toBeLessThanOrEqual(
      DEFAULT_STUDIO_IMPORT_LIMITS.maxFrames,
    )
  })

  it('keeps nothing of a loop stopped before its one-second first pass was half sung', () => {
    const loop = { cut: { mode: 'loop' as const, range: RANGE } }
    expect(studioTakeImport(take(6000 + 23999, loop))).toBeNull()
    expect(studioTakeImport(take(6000 + 24000, loop))).toMatchObject({
      startFrame: 96000,
      sourceInFrame: 6000,
    })
  })
})
