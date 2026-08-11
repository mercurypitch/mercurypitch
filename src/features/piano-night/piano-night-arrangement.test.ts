// ============================================================
// Piano Night arrangement tests — canonical Score/Hear playback boundaries
// ============================================================

import { describe, expect, it } from 'vitest'
import { validatePianoProject } from '@/features/piano-project/piano-project'
import { createPianoNightArrangement } from './piano-night-arrangement'
import { PIANO_NIGHT_DEMO_PROJECT } from './piano-night-demo-project'
import { pianoProjectToPianoNightSource } from './piano-night-source'

function projectWithBacking(options: { percussion?: boolean } = {}) {
  const scoreTrack = PIANO_NIGHT_DEMO_PROJECT.tracks[0]
  const backingId =
    options.percussion === true ? 'afterglow-drums' : 'afterglow-bass'
  const backingTrack = {
    ...scoreTrack,
    id: backingId,
    sourceTrackIndex: 1,
    channel: options.percussion === true ? 9 : 1,
    isPercussion: options.percussion === true,
    name: options.percussion === true ? 'Drums' : 'Bass',
    instrumentName:
      options.percussion === true ? 'Standard Kit' : 'Fingered Bass',
    events: scoreTrack.events.map((event) => ({
      ...event,
      sourceTrackIndex: 1,
      channel: options.percussion === true ? 9 : 1,
    })),
  }
  return validatePianoProject({
    ...PIANO_NIGHT_DEMO_PROJECT,
    id: `arrangement-${backingId}`,
    tracks: [scoreTrack, backingTrack],
    backingTrackIds: [backingId],
  })
}

describe('createPianoNightArrangement', () => {
  it('adds selected pitched backing notes without turning them into score notes', () => {
    const project = projectWithBacking()
    const arrangement = createPianoNightArrangement(
      pianoProjectToPianoNightSource(project),
    )

    expect(arrangement.backingTrackIds).toEqual(['afterglow-bass'])
    expect(arrangement.scoreNotes).toHaveLength(
      PIANO_NIGHT_DEMO_PROJECT.tracks[0].events.filter(
        (event) => event.type === 'note-on',
      ).length,
    )
    expect(arrangement.backingNotes).toHaveLength(arrangement.scoreNotes.length)
    expect(
      arrangement.backingNotes.every((note) => note.isBacking === true),
    ).toBe(true)
    expect(arrangement.audibleNotes).toHaveLength(
      arrangement.scoreNotes.length + arrangement.backingNotes.length,
    )
    expect(arrangement.backingNotes[0].velocity).toBeLessThan(
      arrangement.scoreNotes[0].velocity,
    )
  })

  it('keeps selected percussion out of the pitched fallback synth', () => {
    const arrangement = createPianoNightArrangement(
      pianoProjectToPianoNightSource(projectWithBacking({ percussion: true })),
    )

    expect(arrangement.backingTrackIds).toEqual([])
    expect(arrangement.backingNotes).toEqual([])
    expect(arrangement.audibleNotes).toBe(arrangement.scoreNotes)
  })
})
