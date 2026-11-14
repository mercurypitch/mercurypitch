// Studio MIDI preview audio tests — a preview is prepared as the asset it becomes once kept: the loudness gain a take of the same samples gets, a hashed canonical copy every reader accepts and that reads back to the samples, an id of its render key, and memory held until it is released; a render past the Studio's longest take is cut there.
import { afterEach, describe, expect, it } from 'vitest'
import { checkCanonicalPcm } from '@/lib/studio/audio/canonical-pcm'
import { DEFAULT_STUDIO_IMPORT_LIMITS } from '@/lib/studio/audio/import-limits'
import { sourcePreparation } from '@/lib/studio/audio/preparation-gain'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import { validateStudioAsset } from '@/lib/studio/model/validation'
import { createStudioMidiPreview, studioMidiKeptLength, studioMidiPreviewSamples, } from './midi-preview-audio'

afterEach(() => setStudioWorkingBytes(null))

/** Half a second of a 440 Hz tone at -12 dBFS, then silence. */
function tone(frames: number): Float32Array {
  return Float32Array.from({ length: frames }, (_, frame) =>
    frame < 24_000 ? 0.25 * Math.sin((2 * Math.PI * 440 * frame) / 48_000) : 0,
  )
}

describe('a MIDI preview', () => {
  it('is prepared as its kept asset is, and its canonical copy reads back to its samples', async () => {
    // Arrange
    const samples = tone(48_000)
    const before = studioReservedMemoryBytes()

    // Act
    const preview = await createStudioMidiPreview(
      samples,
      '0123456789abcdef',
      'project-1',
      '2026-11-14T10:00:00.000Z',
    )
    const held = studioReservedMemoryBytes() - before
    const read = studioMidiPreviewSamples(preview)
    preview.release()

    // Assert
    expect(preview.asset.id).toBe('midi-render-0123456789abcdef')
    expect(validateStudioAsset(preview.asset)).toEqual(preview.asset)
    expect(preview.asset.preparation).toEqual(
      await sourcePreparation({
        sampleRate: 48_000,
        numberOfChannels: 1,
        length: samples.length,
        getChannelData: () => samples,
      }),
    )
    expect(preview.asset.provenance).toEqual({
      kind: 'recording',
      importedAt: '2026-11-14T10:00:00.000Z',
    })
    await expect(
      checkCanonicalPcm(preview.bytes, preview.asset),
    ).resolves.toBeUndefined()
    expect(read).toEqual(samples)
    expect(held).toBe(preview.bytes.byteLength)
    expect(studioReservedMemoryBytes()).toBe(before)
  })

  it('is refused when the memory cannot hold it, and holds nothing', async () => {
    // Arrange
    const before = studioReservedMemoryBytes()
    setStudioWorkingBytes(before + 1000)

    // Act
    const made = createStudioMidiPreview(
      tone(48_000),
      'feedfacefeedface',
      'project-1',
      '2026-11-14T10:00:00.000Z',
    )

    // Assert
    await expect(made).rejects.toThrow(/more memory/)
    expect(studioReservedMemoryBytes()).toBe(before)
  })

  it('cuts a render past the longest take the Studio keeps', () => {
    // Arrange
    const most = DEFAULT_STUDIO_IMPORT_LIMITS.maxFrames
    const long = new Float32Array(most + 72_000)

    // Act, Assert
    expect(studioMidiKeptLength(long)).toHaveLength(most)
    const short = new Float32Array(96_000)
    expect(studioMidiKeptLength(short)).toBe(short)
  })
})
