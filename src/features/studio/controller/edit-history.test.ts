// Studio edit history tests — Undo and Redo name the lane change a control made, not a generic track edit.
import { describe, expect, it } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
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
