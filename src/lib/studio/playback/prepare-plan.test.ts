// Studio playable-from tests — Play refuses only a song with no clips, in words that hold for a muted take; an empty Piano or Drums clip still plays its silent render.
import { describe, expect, it } from 'vitest'
import { StudioRefusal } from '../failure-copy'
import { studioFixture, studioMidiFixture } from '../model/model.test-fixtures'
import { playableStudioFrom } from './prepare-plan'

describe('playableStudioFrom', () => {
  it('refuses a song whose only lane is an empty Audio lane, asking for a take or some notes', () => {
    const { project } = studioFixture()
    const empty = { ...project, clips: [] }

    const play = () => playableStudioFrom(empty, [], 0, false)

    expect(play).toThrow(StudioRefusal)
    expect(play).toThrow('Add a take or draw some notes before playing.')
  })

  it('plays a song whose only clip is a Piano clip with no notes: its render is a clip like any other', () => {
    const { project, assets, clip, sequence } = studioMidiFixture()
    const song = {
      ...project,
      clips: [clip],
      sequences: [{ ...sequence, notes: [] }],
    }

    expect(playableStudioFrom(song, assets, 0, false)).toBe(0)
  })
})
