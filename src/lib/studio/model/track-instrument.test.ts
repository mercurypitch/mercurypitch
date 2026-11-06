// Studio lane instrument tests — a lane keeps the instrument the singer picks apart from its mix role, clears it back to automatic, and a song keeps a well-formed pick it cannot draw.
import { describe, expect, it } from 'vitest'
import { applyStudioCommand } from './commands'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioProject } from './types'
import { validateStudioProject } from './validation'

function withInstrument(project: StudioProject, instrument: unknown): unknown {
  return {
    ...project,
    tracks: project.tracks.map((track) => ({ ...track, instrument })),
  }
}

describe('a lane’s instrument', () => {
  it('is set apart from the role, which keeps the lane’s chain', () => {
    // Arrange
    const { project, asset } = studioFixture()
    const before = project.tracks[0]

    // Act
    const next = applyStudioCommand(
      project,
      {
        type: 'set-track-instrument',
        trackId: before.id,
        instrument: 'trumpet',
      },
      { assets: [asset], now: TEST_NOW },
    )

    // Assert
    expect(next.tracks[0].instrument).toBe('trumpet')
    expect(next.tracks[0].role).toBe(before.role)
    expect(next.tracks[0].fx).toEqual(before.fx)
    expect(next.revision).toBe(project.revision + 1)
  })

  it('goes back to automatic, leaving no field behind', () => {
    // Arrange
    const { project, asset } = studioFixture()
    const options = { assets: [asset], now: TEST_NOW }
    const picked = applyStudioCommand(
      project,
      { type: 'set-track-instrument', trackId: 'track-1', instrument: 'cello' },
      options,
    )

    // Act
    const cleared = applyStudioCommand(
      picked,
      { type: 'set-track-instrument', trackId: 'track-1', instrument: null },
      options,
    )

    // Assert
    expect(Object.hasOwn(cleared.tracks[0], 'instrument')).toBe(false)
    expect(cleared.tracks[0]).toEqual(project.tracks[0])
  })

  it('refuses an instrument the pack does not draw', () => {
    const { project, asset } = studioFixture()

    expect(() =>
      applyStudioCommand(
        project,
        {
          type: 'set-track-instrument',
          trackId: 'track-1',
          instrument: 'theremin' as 'trumpet',
        },
        { assets: [asset], now: TEST_NOW },
      ),
    ).toThrow('track.track-1.instrument')
  })

  it('opens from a save with its pick, and with a well-formed pick from a newer pack', () => {
    const { project, asset } = studioFixture()

    expect(
      validateStudioProject(withInstrument(project, 'violin'), [asset])
        .tracks[0].instrument,
    ).toBe('violin')
    expect(
      validateStudioProject(withInstrument(project, 'nyckelharpa'), [asset])
        .tracks[0].instrument,
    ).toBe('nyckelharpa')
  })

  it('refuses a malformed pick', () => {
    const { project, asset } = studioFixture()

    for (const instrument of ['Trumpet', 'two words', '', 7, 'x'.repeat(41)])
      expect(() =>
        validateStudioProject(withInstrument(project, instrument), [asset]),
      ).toThrow('project.tracks[0].instrument')
  })
})
