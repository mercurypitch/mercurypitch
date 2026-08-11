// ============================================================
// Piano Night track assignment tests — pitched choices and preserved drums
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoProject, PianoProjectTrack, } from '@/features/piano-project/piano-project'
import { PIANO_NIGHT_DEMO_PROJECT } from './piano-night-demo-project'
import { pianoProjectNeedsTrackAssignment, pianoProjectToTrackAssignment, } from './piano-night-track-assignment'

function clonedTrack(
  id: string,
  sourceTrackIndex: number,
  channel: number,
  isPercussion = false,
): PianoProjectTrack {
  const source = PIANO_NIGHT_DEMO_PROJECT.tracks[0]
  return {
    ...source,
    id,
    sourceTrackIndex,
    channel,
    isPercussion,
    name: isPercussion ? 'Studio Drums' : 'Warm Strings',
    instrumentName: isPercussion ? 'Standard Kit' : 'String Ensemble 1',
    events: source.events.map((event) => ({
      ...event,
      sourceTrackIndex,
      channel,
    })),
  }
}

function projectWithTracks(tracks: readonly PianoProjectTrack[]): PianoProject {
  return {
    ...PIANO_NIGHT_DEMO_PROJECT,
    tracks: [PIANO_NIGHT_DEMO_PROJECT.tracks[0], ...tracks],
    backingTrackIds: tracks.map((track) => track.id),
  }
}

describe('Piano Night canonical track assignment', () => {
  it('does not interrupt a one-part import only because it preserves drums', () => {
    const drums = clonedTrack('night-drums', 1, 9, true)
    const project = projectWithTracks([drums])
    const assignment = pianoProjectToTrackAssignment(project)

    expect(pianoProjectNeedsTrackAssignment(project)).toBe(false)
    expect(assignment).toMatchObject({
      scoreTrackId: 'afterglow-grand',
      backingTrackIds: [],
      pitchedTrackCount: 1,
      percussionTrackCount: 1,
    })
    expect(assignment.tracks.map((track) => track.id)).toEqual([
      'afterglow-grand',
      'night-drums',
    ])
  })

  it('offers a chooser for two pitched parts and keeps drums out of Hear', () => {
    const strings = clonedTrack('night-strings', 1, 1)
    const drums = clonedTrack('night-drums', 2, 9, true)
    const project = projectWithTracks([strings, drums])
    const assignment = pianoProjectToTrackAssignment(project)

    expect(pianoProjectNeedsTrackAssignment(project)).toBe(true)
    expect(assignment.backingTrackIds).toEqual(['night-strings'])
    expect(
      assignment.tracks.find((track) => track.id === 'night-drums'),
    ).toMatchObject({
      isPercussion: true,
      name: 'Studio Drums',
    })
  })

  it('offers the recoverable pitched lane when no canonical Score is selected', () => {
    const project = projectWithTracks([])
    project.scoreTrackId = null

    expect(pianoProjectNeedsTrackAssignment(project)).toBe(true)
    expect(pianoProjectToTrackAssignment(project)).toMatchObject({
      scoreTrackId: 'afterglow-grand',
      pitchedTrackCount: 1,
    })
  })
})
