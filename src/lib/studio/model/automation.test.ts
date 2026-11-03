// Studio lane automation tests — a line reads straight between its points, edits keep it in time order, and history carries it.
import { describe, expect, it } from 'vitest'
import { studioAutomationValueAt, studioLaneValueAt, withStudioAutomation, } from './automation'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, redoStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioAutomationPoint, StudioProject } from './types'
import { validateStudioProject } from './validation'
import { StudioValidationError } from './validation-values'

const line: StudioAutomationPoint[] = [
  { frame: 48000, value: -12 },
  { frame: 96000, value: 0 },
  { frame: 144000, value: -6 },
]

function withLine(
  param: 'volume' | 'pan',
  points: readonly StudioAutomationPoint[],
): StudioProject {
  const { project, asset } = studioFixture()
  return applyStudioCommand(
    project,
    { type: 'set-lane-automation', trackId: 'track-1', param, points },
    { assets: [asset], now: TEST_NOW },
  )
}

describe('Studio lane automation', () => {
  it('reads a line straight between its points and flat beyond its ends', () => {
    // Arrange
    const frames = [0, 48000, 72000, 96000, 120000, 200000]

    // Act
    const values = frames.map((frame) => studioAutomationValueAt(line, frame))

    // Assert
    expect(values).toEqual([-12, -12, -6, 0, -3, -6])
  })

  it('leaves a lane with no line at its fader and knob', () => {
    // Arrange
    const { project } = studioFixture()
    const track = { ...project.tracks[0], gainDb: -4, pan: 0.25 }

    // Act
    const read = [
      studioLaneValueAt(track, 'volume', 96000),
      studioLaneValueAt(track, 'pan', 96000),
    ]

    // Assert
    expect(read).toEqual([-4, 0.25])
  })

  it('stores a line in time order, keeping the last point given for a frame', () => {
    // Arrange
    const given = [
      { frame: 96000, value: 0.5 },
      { frame: 0, value: -1 },
      { frame: 96000, value: 1 },
    ]

    // Act
    const project = withLine('pan', given)

    // Assert
    expect(project.tracks[0].automation).toEqual({
      pan: [
        { frame: 0, value: -1 },
        { frame: 96000, value: 1 },
      ],
    })
    expect(project.revision).toBe(1)
  })

  it('drops the lane automation entirely once its last line is cleared', () => {
    // Arrange
    const { asset } = studioFixture()
    const drawn = withLine('volume', line)

    // Act
    const cleared = applyStudioCommand(
      drawn,
      {
        type: 'set-lane-automation',
        trackId: 'track-1',
        param: 'volume',
        points: [],
      },
      { assets: [asset], now: TEST_NOW },
    )

    // Assert
    expect(Object.hasOwn(cleared.tracks[0], 'automation')).toBe(false)
    expect(cleared.revision).toBe(2)
  })

  it('keeps one line when the other is cleared', () => {
    // Arrange
    const { project } = studioFixture()
    const both = withStudioAutomation(
      withStudioAutomation(project.tracks[0], 'volume', line),
      'pan',
      [{ frame: 0, value: 0.5 }],
    )

    // Act
    const track = withStudioAutomation(both, 'volume', [])

    // Assert
    expect(track.automation).toEqual({ pan: [{ frame: 0, value: 0.5 }] })
  })

  it('refuses a point past the fader travel without saving the line', () => {
    // Arrange
    const { project, asset } = studioFixture()

    // Act
    const edit = () =>
      applyStudioCommand(
        project,
        {
          type: 'set-lane-automation',
          trackId: 'track-1',
          param: 'volume',
          points: [{ frame: 0, value: 13 }],
        },
        { assets: [asset], now: TEST_NOW },
      )

    // Assert
    expect(edit).toThrow(StudioValidationError)
    expect(project.tracks[0].automation).toBeUndefined()
  })

  it('refuses a line for a lane the song does not have', () => {
    // Arrange
    const { project, asset } = studioFixture()

    // Act
    const edit = () =>
      applyStudioCommand(
        project,
        {
          type: 'set-lane-automation',
          trackId: 'missing',
          param: 'pan',
          points: [{ frame: 0, value: 0 }],
        },
        { assets: [asset], now: TEST_NOW },
      )

    // Assert
    expect(edit).toThrow('Lane does not exist')
  })

  it('takes a line away on undo and brings it back on redo', () => {
    // Arrange
    const { project, asset } = studioFixture()
    const options = { assets: [asset], now: TEST_NOW }
    const drawn = executeStudioCommand(
      createStudioHistory(project),
      {
        type: 'set-lane-automation',
        trackId: 'track-1',
        param: 'volume',
        points: line,
      },
      options,
    )

    // Act
    const undone = undoStudioCommand(drawn, options)
    const redone = redoStudioCommand(undone, options)

    // Assert
    expect(undone.present.tracks[0].automation).toBeUndefined()
    expect(redone.present.tracks[0].automation).toEqual({ volume: line })
  })

  it('opens a song saved before lines existed exactly as it was saved', () => {
    // Arrange
    const { project, asset } = studioFixture()
    const saved = JSON.parse(JSON.stringify(project)) as StudioProject

    // Act
    const opened = validateStudioProject(saved, [asset])

    // Assert
    expect(opened).toEqual(project)
    expect(Object.hasOwn(opened.tracks[0], 'automation')).toBe(false)
  })
})
