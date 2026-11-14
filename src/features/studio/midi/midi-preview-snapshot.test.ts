// Studio MIDI preview snapshot tests — a clip with a preview plays it in the transport's song, the assets list holding it; a preview too short for its clip's window is passed over; and a song with no preview is handed back as the very objects given.
import { describe, expect, it } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset } from '@/lib/studio/model/types'
import { studioMidiPreviewSnapshot } from './midi-preview-snapshot'

const { project, assets } = studioMidiFixture()

/** A preview of the MIDI clip's notes, `frames` long. */
const preview = (frames: number): StudioAsset => ({
  ...assets[1],
  id: 'midi-render-0123456789abcdef',
  normalizedFrameCount: frames,
  canonicalPcmByteLength: 32 + frames * 4,
})

describe('the song the transport plays', () => {
  it('plays a MIDI clip from its preview, and lists the preview with the song’s audio', () => {
    // Arrange
    const ready = preview(120_000)

    // Act
    const played = studioMidiPreviewSnapshot(project, assets, (clip) =>
      clip.id === 'clip-midi' ? ready : undefined,
    )

    // Assert
    expect(played.project.clips.map((clip) => clip.assetId)).toEqual([
      'asset-1',
      ready.id,
    ])
    expect(played.assets).toEqual([...assets, ready])
    expect(played.project.revision).toBe(project.revision)
  })

  it("passes over a preview too short for its clip's window", () => {
    // Act
    const played = studioMidiPreviewSnapshot(project, assets, () =>
      preview(90_000),
    )

    // Assert
    expect(played.project).toBe(project)
    expect(played.assets).toBe(assets)
  })

  it('hands back the very song and assets when no clip has a preview', () => {
    // Act
    const played = studioMidiPreviewSnapshot(project, assets, () => undefined)

    // Assert
    expect(played.project).toBe(project)
    expect(played.assets).toBe(assets)
  })
})
