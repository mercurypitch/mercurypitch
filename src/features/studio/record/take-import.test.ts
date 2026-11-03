// Studio take import tests — a plain take keeps its trim, a punch its range, and a loop take every pass at exactly the range's length.
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioCapturedTake } from '@/lib/studio/record/recorder-types'
import type { StudioPassesImport, StudioRecordingImport, } from '../controller/imports'
import { studioTakeImport } from './take-import'

const RANGE = { startFrame: 96000, endFrame: 144000 }

// Node's Blob reads its bytes back; the test DOM's does not.
beforeEach(() => vi.stubGlobal('Blob', NodeBlob))
afterEach(() => vi.unstubAllGlobals())

/** Frames in a mono 16-bit WAV: its data after the 44-byte header. */
const wavFrames = (wav: Blob) => (wav.size - 44) / 2

/** A take whose sample i holds i, so each pass's first sample says where it was cut. */
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
    const kept = studioTakeImport(take(48000)) as StudioRecordingImport
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
    ) as StudioRecordingImport
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

  it('cuts a loop take into passes of exactly the range, heard pass the newest whole one', () => {
    // 6000 frames before the range, three whole passes and a second of the fourth.
    const kept = studioTakeImport(
      take(6000 + 3 * 48000 + 48000, { cut: { mode: 'loop', range: RANGE } }),
    ) as StudioPassesImport
    expect(kept.passes.map((pass) => pass.title)).toEqual([
      'Take 9, pass 1',
      'Take 9, pass 2',
      'Take 9, pass 3',
      'Take 9, pass 4',
    ])
    expect(kept.passes.map((pass) => pass.assetId)).toEqual([
      'take-9-pass-1',
      'take-9-pass-2',
      'take-9-pass-3',
      'take-9-pass-4',
    ])
    expect(kept.passes.map((pass) => wavFrames(pass.wav))).toEqual([
      48000, 48000, 48000, 48000,
    ])
    expect(kept).toMatchObject({
      heard: 3,
      startFrame: 96000,
      frames: 48000,
      trackId: 'lane-1',
    })
  })

  it('keeps every finished pass and the one cut short when a tab closed mid-loop', async () => {
    // Two whole passes and 30000 frames of the third, read back from the journal.
    const kept = studioTakeImport(
      take(6000 + 2 * 48000 + 30000, { cut: { mode: 'loop', range: RANGE } }),
    ) as StudioPassesImport
    expect(kept.passes).toHaveLength(3)
    expect(kept.heard).toBe(1)
    // The third pass starts on the frame the second ended, and is padded to the range.
    const third = new DataView(await kept.passes[2].wav.arrayBuffer())
    expect(third.byteLength - 44).toBe(2 * 48000)
    const first = third.getInt16(44, true)
    expect(first).toBe(Math.round(((6000 + 96000) / 2 ** 20) * 0x7fff))
    expect(third.getInt16(44 + 2 * 29999, true)).not.toBe(0)
    expect(third.getInt16(44 + 2 * 30000, true)).toBe(0)
  })
})
