// Studio edit history tests — Undo and Redo name the lane change a control made, not a generic track edit, and new MIDI clips by the lanes they bring, a MIDI file's tempo riding with them.
import { describe, expect, it } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioNewMidiClip } from '@/lib/studio/model/new-midi-clips'
import { studioNewMidiClips } from '@/lib/studio/model/new-midi-clips'
import { createStudioEditHistory, executeStudioEdit, travelStudioHistory, } from './edit-history'

const options = { assets: [] }

function labelsFor(...commands: StudioCommand[]): readonly string[] {
  let history = createStudioEditHistory({
    ...createStudioProject({ id: 'song', title: 'Label song' }),
    tracks: [createStudioTrack({ id: 'keys', name: 'Keys', order: 0 })],
  })
  for (const command of commands)
    history = executeStudioEdit(history, command, options)
  return history.pastLabels
}

const lane = (
  changes: Extract<StudioCommand, { type: 'update-track' }>['changes'],
): StudioCommand => ({ type: 'update-track', trackId: 'keys', changes })

describe('Studio edit history', () => {
  it('names a lane edit by the control that made it', () => {
    expect(
      labelsFor(
        lane({ gainDb: -6 }),
        lane({ pan: 0.4 }),
        lane({ mute: true }),
        lane({ mute: false }),
        lane({ solo: true }),
        lane({ solo: false }),
        lane({ name: 'Rhodes' }),
        lane({ gainDb: -3, pan: 0 }),
      ),
    ).toEqual([
      'volume',
      'pan',
      'mute',
      'unmute',
      'solo',
      'unsolo',
      'rename lane',
      'change lane',
    ])
  })

  it('names a line edit by the line it drew', () => {
    // Arrange
    const line = (param: 'volume' | 'pan', value: number): StudioCommand => ({
      type: 'set-lane-automation',
      trackId: 'keys',
      param,
      points: [{ frame: 0, value }],
    })

    // Act
    const labels = labelsFor(line('volume', -6), line('pan', 0.5))

    // Assert
    expect(labels).toEqual(['volume line', 'pan line'])
  })

  it('names new MIDI clips by the lanes they bring, or as clips on lanes the song has', () => {
    // Arrange: the silence every new clip plays.
    const silence = {
      ...studioMidiFixture().assets[1],
      id: 'silence',
      projectId: 'song',
    }
    let serial = 0
    const createId = () => `new-${++serial}`
    const clip = (lane: StudioNewMidiClip['lane'], startFrame: number) => ({
      lane,
      startFrame,
      frames: 384_000,
    })
    let history = createStudioEditHistory({
      ...createStudioProject({ id: 'song', title: 'Label song' }),
      tracks: [createStudioTrack({ id: 'keys', name: 'Keys', order: 0 })],
    })
    const add = (clips: readonly StudioNewMidiClip[]) => {
      const made = studioNewMidiClips(
        history.state.present,
        clips,
        silence.id,
        createId,
      )
      history = executeStudioEdit(history, made.command, { assets: [silence] })
    }

    // Act
    add([clip({ name: 'Piano', role: 'piano' }, 0)])
    add([
      clip({ name: 'Drums', role: 'drums' }, 0),
      clip({ name: 'Bass', role: 'bass' }, 0),
    ])
    add([clip({ trackId: 'keys' }, 0), clip({ trackId: 'keys' }, 384_000)])

    // Assert
    expect(history.pastLabels).toEqual(['add lane', 'add lanes', 'add clips'])
  })

  it('names a MIDI file’s lanes by the lanes, with the tempo it gave a song of no clips', () => {
    // Arrange: the silence every new clip plays.
    const silence = {
      ...studioMidiFixture().assets[1],
      id: 'silence',
      projectId: 'song',
    }
    let serial = 0
    const empty = createStudioEditHistory(
      createStudioProject({ id: 'song', title: 'Label song' }),
    )
    const made = studioNewMidiClips(
      empty.state.present,
      [
        {
          lane: { name: 'Piano', role: 'keys' },
          startFrame: 0,
          frames: 96_000,
        },
        {
          lane: { name: 'Drums', role: 'drums' },
          startFrame: 0,
          frames: 96_000,
        },
      ],
      silence.id,
      () => `new-${++serial}`,
    )
    const edits =
      made.command.type === 'batch' ? made.command.commands : [made.command]

    // Act
    const history = executeStudioEdit(
      empty,
      {
        type: 'batch',
        commands: [
          { type: 'set-project-settings', changes: { tempoBpm: 96 } },
          ...edits,
        ],
      },
      { assets: [silence] },
    )

    // Assert
    expect(history.pastLabels).toEqual(['add lanes'])
    expect(
      labelsFor({ type: 'set-project-settings', changes: { tempoBpm: 96 } }),
    ).toEqual(['change song settings'])
  })

  it('keeps the name for Redo after an Undo', () => {
    let history = createStudioEditHistory({
      ...createStudioProject({ id: 'song', title: 'Label song' }),
      tracks: [createStudioTrack({ id: 'keys', name: 'Keys', order: 0 })],
    })
    history = executeStudioEdit(history, lane({ pan: -0.5 }), options)
    history = travelStudioHistory(history, 'undo', options)
    expect(history.futureLabels).toEqual(['pan'])
  })
})
