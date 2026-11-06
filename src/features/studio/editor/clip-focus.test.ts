// Studio clip focus — Up and Down find the nearest clip in the next lane with one, in the lanes' own order, and leave the edges to the page.
import { describe, expect, it } from 'vitest'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'
import { studioAdjacentLaneClip } from './clip-focus'

/** Lanes drawn in the order Upper, Empty, Lower, whatever order the song keeps them in. */
function song(): StudioProject {
  const { project, clip } = studioFixture()
  const at = (id: string, trackId: string, startFrame: number): StudioClip => ({
    ...clip,
    id,
    trackId,
    startFrame,
  })
  return {
    ...project,
    tracks: [
      createStudioTrack({ id: 'lower', name: 'Lower', order: 2 }),
      createStudioTrack({ id: 'upper', name: 'Upper', order: 0 }),
      createStudioTrack({ id: 'empty', name: 'Empty', order: 1 }),
    ],
    // Each clip is 1000 frames long.
    clips: [
      at('upper-late', 'upper', 5000),
      at('lower-late', 'lower', 4500),
      at('upper-early', 'upper', 0),
      at('lower-early', 'lower', 0),
    ],
  }
}

describe('studioAdjacentLaneClip', () => {
  it('passes over a lane with no clip to the clip playing across the focused one’s start', () => {
    expect(studioAdjacentLaneClip(song(), 'upper-late', 1)?.id).toBe(
      'lower-late',
    )
  })

  it('takes the clip nearest the focused one’s start where none plays across it', () => {
    // Lower's late clip starts 4500 and ends 5500; Upper's late starts 5000.
    expect(studioAdjacentLaneClip(song(), 'lower-late', -1)?.id).toBe(
      'upper-late',
    )
    expect(studioAdjacentLaneClip(song(), 'lower-early', -1)?.id).toBe(
      'upper-early',
    )
  })

  it('takes the earlier of two clips as near', () => {
    const project = song()
    const [late] = project.clips
    // From a lower clip at 3000: one upper clip ends 1000 frames before it
    // (1001 to 2001), the other starts 1000 after it.
    const tied = {
      ...project,
      clips: [
        { ...late, id: 'upper-after', startFrame: 4000 },
        { ...late, id: 'upper-before', startFrame: 1001 },
        { ...late, id: 'lower-middle', trackId: 'lower', startFrame: 3000 },
      ],
    }
    expect(studioAdjacentLaneClip(tied, 'lower-middle', -1)?.id).toBe(
      'upper-before',
    )
  })

  it('finds nothing past the first or the last lane, or for a clip the song lost', () => {
    expect(studioAdjacentLaneClip(song(), 'upper-late', -1)).toBeNull()
    expect(studioAdjacentLaneClip(song(), 'lower-late', 1)).toBeNull()
    expect(studioAdjacentLaneClip(song(), 'gone', 1)).toBeNull()
  })
})
