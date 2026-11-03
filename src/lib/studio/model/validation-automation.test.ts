// Studio automation validation tests — a saved line is taken only in time order, inside its control's travel, and never repaired.
import { describe, expect, it } from 'vitest'
import { STUDIO_MAX_AUTOMATION_POINTS } from './automation'
import { studioFixture } from './model.test-fixtures'
import { validateStudioProject } from './validation'

/** The fixture song as saved, its lane carrying `automation`. */
function saved(automation: unknown) {
  const { project, asset } = studioFixture()
  const raw = JSON.parse(JSON.stringify(project)) as Record<string, unknown>
  const [track] = raw.tracks as Record<string, unknown>[]
  track.automation = automation
  return { raw, asset }
}

function refusal(automation: unknown): string {
  const { raw, asset } = saved(automation)
  try {
    validateStudioProject(raw, [asset])
    return 'accepted'
  } catch (error) {
    return (error as Error).message
  }
}

const point = (frame: number, value: number) => ({ frame, value })

describe('Studio automation validation', () => {
  it('takes a volume and a pan line in time order and returns them unchanged', () => {
    // Arrange
    const automation = {
      volume: [point(0, -60), point(48000, 12)],
      pan: [point(24000, -1), point(72000, 1)],
    }
    const { raw, asset } = saved(automation)

    // Act
    const project = validateStudioProject(raw, [asset])

    // Assert
    expect(project.tracks[0].automation).toEqual(automation)
  })

  it.each([
    ['points out of time order', { volume: [point(9, 0), point(3, 0)] }],
    ['two points on one frame', { pan: [point(9, 0), point(9, 0.5)] }],
    ['a value past the fader top', { volume: [point(0, 12.5)] }],
    ['a value under the fader floor', { volume: [point(0, -61)] }],
    ['a pan past full right', { pan: [point(0, 1.01)] }],
    ['a value that is not a number', { volume: [point(0, Number.NaN)] }],
    ['a frame between two frames', { volume: [point(0.5, 0)] }],
    ['a frame before the song', { volume: [point(-1, 0)] }],
    ['an empty line', { volume: [] }],
    ['no line at all', {}],
    ['a line of another control', { tempo: [point(0, 1)] }],
    ['a point with a field of its own', { pan: [{ ...point(0, 0), x: 1 }] }],
    ['a line that is not a list', { volume: point(0, 0) }],
  ])('refuses %s', (_name, automation) => {
    // Act
    const message = refusal(automation)

    // Assert
    expect(message).toMatch(/^project\.tracks\[0\]\.automation/)
  })

  it('refuses a line with more points than a lane keeps', () => {
    // Arrange
    const crowded = Array.from(
      { length: STUDIO_MAX_AUTOMATION_POINTS + 1 },
      (_, index) => point(index * 100, 0),
    )

    // Act
    const message = refusal({ volume: crowded })

    // Assert
    expect(message).toContain(`1 to ${STUDIO_MAX_AUTOMATION_POINTS} points`)
  })

  it('takes a lane whose automation was left undefined as a lane without one', () => {
    // Arrange
    const { project, asset } = studioFixture()
    const raw = {
      ...project,
      tracks: [{ ...project.tracks[0], automation: undefined }],
    }

    // Act
    const opened = validateStudioProject(raw, [asset])

    // Assert
    expect(opened.tracks[0].automation).toBeUndefined()
  })
})
