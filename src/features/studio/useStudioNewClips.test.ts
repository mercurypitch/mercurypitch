// Studio new clip tests — New lane's Audio makes an empty lane, selected; Piano and Drums make a lane of that role, named so no two lanes share a name, with an empty clip four bars long from the playhead's bar, opened in Draw and said; a clip asked for in a lane comes there and opens in Draw; and a clip the song refused opens nothing.
import { describe, expect, it, vi } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { StudioNewMidiClip } from '@/lib/studio/model/new-midi-clips'
import type { StudioProject } from '@/lib/studio/model/types'
import { studioNewLaneName, useStudioNewClips } from './useStudioNewClips'

/** A song at 120 bpm with a Piano lane, the playhead at `playhead` frames, its clips refused when `refuse` says. */
function harness(playhead = 0, refuse = false) {
  const project: StudioProject = {
    ...createStudioProject({ id: 'song', title: 'Song' }),
    tracks: [
      createStudioTrack({
        id: 'piano',
        name: 'Piano',
        order: 0,
        role: 'piano',
      }),
    ],
  }
  const asked: StudioNewMidiClip[][] = []
  const commands: StudioCommand[] = []
  const calls = {
    lanes: [] as string[],
    opened: [] as [string, string][],
    said: [] as string[],
  }
  const clips = useStudioNewClips({
    studio: () => ({
      project: () => project,
      dispatch: (command) => {
        commands.push(command)
        return true
      },
      addMidiClips: vi.fn(async (wanted: readonly StudioNewMidiClip[]) => {
        asked.push([...wanted])
        return refuse ? null : wanted.map((_, index) => `clip-${index + 1}`)
      }),
    }),
    playheadFrame: () => playhead,
    selectLane: (trackId) => calls.lanes.push(trackId),
    openNotes: (clipId, tool) => calls.opened.push([clipId, tool]),
    announce: (words) => calls.said.push(words),
  })
  return { project, clips, asked, commands, calls }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('New lane', () => {
  it('makes an empty audio lane below the others, selected', () => {
    // Arrange
    const { clips, commands, calls } = harness()

    // Act
    clips.newLane('audio')

    // Assert
    expect(commands).toEqual([
      {
        type: 'add-track',
        track: expect.objectContaining({ name: 'Lane 2', order: 1 }),
      },
    ])
    expect(calls.lanes).toHaveLength(1)
    expect(calls.said).toEqual(['Lane 2 added and selected.'])
  })

  it('makes a Drums lane with an empty clip four bars long from the playhead’s bar, opened in Draw', async () => {
    // Arrange: the playhead at 5 s, in bar 3, which starts at 4 s.
    const { clips, asked, calls } = harness(240_000)

    // Act
    clips.newLane('drums')
    await settle()

    // Assert
    expect(asked).toEqual([
      [
        {
          lane: { name: 'Drums', role: 'drums' },
          startFrame: 192_000,
          frames: 384_000,
        },
      ],
    ])
    expect(calls.opened).toEqual([['clip-1', 'draw']])
    expect(calls.said).toEqual(['Drums added, its empty clip open to draw in.'])
  })

  it('names a Piano lane so no two lanes share a name', () => {
    // Arrange
    const { project } = harness()
    const two = {
      ...project,
      tracks: [
        ...project.tracks,
        createStudioTrack({ id: 'piano-2', name: 'Piano 2', order: 1 }),
      ],
    }

    // Act, Assert
    expect(studioNewLaneName(project, 'Drums')).toBe('Drums')
    expect(studioNewLaneName(two, 'Piano')).toBe('Piano 3')
  })
})

describe('a clip asked for in a lane', () => {
  it('comes where it was asked for and opens in Draw', async () => {
    // Arrange
    const { clips, asked, calls } = harness()

    // Act
    clips.newClip('piano', { startFrame: 96_000, frames: 384_000 })
    await settle()

    // Assert
    expect(asked).toEqual([
      [{ lane: { trackId: 'piano' }, startFrame: 96_000, frames: 384_000 }],
    ])
    expect(calls.opened).toEqual([['clip-1', 'draw']])
    expect(calls.said).toEqual(['A new clip on Piano, open to draw in.'])
  })

  it('opens nothing when the song refused it', async () => {
    // Arrange
    const { clips, calls } = harness(0, true)

    // Act
    clips.newClip('piano', { startFrame: 96_000, frames: 384_000 })
    await settle()

    // Assert
    expect(calls.opened).toEqual([])
    expect(calls.said).toEqual([])
  })
})
