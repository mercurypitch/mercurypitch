// Studio MIDI preview snapshot tests — a clip with a preview plays it in the transport's song, the assets list holding it, and plays one shorter than its window, silent past it; a preview too short for a loop take's passes is passed over; and a song with no preview is handed back as the very objects given.
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

  it("plays a preview shorter than its clip's window, the window silent past it", () => {
    // Arrange: the window runs to 96,000 frames.
    const short = preview(90_000)

    // Act
    const played = studioMidiPreviewSnapshot(project, assets, (clip) =>
      clip.id === 'clip-midi' ? short : undefined,
    )

    // Assert
    expect(played.project.clips[1].assetId).toBe(short.id)
    expect(played.assets).toEqual([...assets, short])
  })

  it("passes over a preview too short for a loop take's passes", () => {
    // Arrange: two passes of 48,000 frames, the clip on the second.
    const looped = {
      ...project,
      clips: project.clips.map((clip) =>
        clip.id === 'clip-midi'
          ? {
              ...clip,
              sourceInFrame: 48_000,
              sourceOutFrame: 96_000,
              passes: { firstFrame: 0, frames: 48_000, count: 2 },
            }
          : clip,
      ),
    }

    // Act
    const played = studioMidiPreviewSnapshot(looped, assets, () =>
      preview(90_000),
    )

    // Assert
    expect(played.project).toBe(looped)
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
