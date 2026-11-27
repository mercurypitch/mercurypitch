// Studio timeline rows tests — the takes or passes a song has open under a lane close as the song is left, as StudioPage opens each song anew, so a song with no lanes, or the same song opened again, starts with none.
import { cleanup, render } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioClipWithTakes } from '@/lib/studio/model/clip-takes'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'
import { closeStudioComp, closeStudioTakes, openStudioComp, openStudioTakes, studioCompClipId, studioTakesClipId, } from './comp-editor'
import { StudioTimeline } from './StudioTimeline'

afterEach(() => {
  cleanup()
  closeStudioTakes()
  closeStudioComp()
})

const PASS = 96_000
const clip = (id: string, assetId: string, startFrame: number): StudioClip => ({
  id,
  trackId: 'voice',
  assetId,
  startFrame,
  sourceInFrame: 0,
  sourceOutFrame: PASS,
  gainDb: 0,
  fades: { curve: 'linear-amplitude' },
})

/** One lane: a clip of two takes, and after it a loop take of two passes. */
const song: StudioProject = {
  ...createStudioProject({ id: 'song' }),
  tracks: [createStudioTrack({ id: 'voice', name: 'Voice', order: 0 })],
  clips: [
    studioClipWithTakes(
      [clip('stack', 'take-1', 0), clip('stack', 'take-2', 0)],
      1,
    ),
    {
      ...clip('loop', 'take-3', 2 * PASS),
      sourceInFrame: PASS,
      sourceOutFrame: 2 * PASS,
      passes: { firstFrame: 0, frames: PASS, count: 2 },
    },
  ],
}
/** A new song: no lanes, so nothing under a lane can close the rows. */
const empty = createStudioProject({ id: 'empty' })

/** The timeline of the open song, opened anew for each song as StudioPage does. */
function studio() {
  const [open, setOpen] = createSignal(song)
  const { container } = render(() => (
    <Show when={open().id} keyed>
      {(_id) => (
        <StudioTimeline
          project={open()}
          assets={[]}
          selectedClipId={null}
          playheadFrame={0}
          pixelsPerSecond={20}
          writable
          phone={false}
          onSelectClip={vi.fn()}
          onSeek={vi.fn()}
          onCommand={vi.fn(() => true)}
          onClipDetails={vi.fn()}
          onTrackDetails={vi.fn()}
          readCanonicalAsset={() => Promise.reject(new Error('Missing'))}
        />
      )}
    </Show>
  ))
  return {
    rows: (selector: string) => container.querySelectorAll(selector).length,
    /** To a song with no lanes and back. */
    leaveAndReturn() {
      setOpen(empty)
      setOpen(song)
    },
  }
}

describe('rows under a lane', () => {
  it('close a clip’s takes as the song is left, so they do not stand open again when it comes back', () => {
    // Arrange
    const timeline = studio()
    openStudioTakes('stack')
    expect(timeline.rows('[data-studio-take-row]')).toBe(2)

    // Act
    timeline.leaveAndReturn()

    // Assert
    expect(studioTakesClipId()).toBeNull()
    expect(timeline.rows('[data-studio-take-row]')).toBe(0)
  })

  it('close a loop take’s passes as the song is left, so they do not stand open again when it comes back', () => {
    // Arrange
    const timeline = studio()
    openStudioComp('loop')
    expect(timeline.rows('[data-studio-comp-pass]')).toBe(2)

    // Act
    timeline.leaveAndReturn()

    // Assert
    expect(studioCompClipId()).toBeNull()
    expect(timeline.rows('[data-studio-comp-pass]')).toBe(0)
  })
})
