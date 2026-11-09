// Studio migrations tests — a version 1 song steps up to version 2 with nothing else changed and its input untouched, a current song comes back as it is, a newer one is refused in plain words, one that names no version is left to the validator, and every version before this one has its step.
import { describe, expect, it } from 'vitest'
import { migrateStudioProject, STUDIO_MIGRATION_STEPS, STUDIO_NEWER_SONG, StudioNewerSongError, } from './migrations'
import { studioFixture } from './model.test-fixtures'
import { STUDIO_SCHEMA_VERSION } from './types'
import { validateStudioProject } from './validation'

/** The fixture song as a version 1 build saved it: no sequences, no clip that plays MIDI. */
function version1Song() {
  const { project, asset } = studioFixture()
  const song = structuredClone({ ...project, schemaVersion: 1 })
  return { song: Object.freeze(song), current: project, asset }
}

describe('migrateStudioProject', () => {
  it('steps a version 1 song up to version 2, changing nothing else and never its input', () => {
    // Arrange
    const { song, current } = version1Song()

    // Act
    const migrated = migrateStudioProject(song)

    // Assert
    expect(migrated).toEqual({ ...song, schemaVersion: 2 })
    expect(migrated).toEqual(current)
    expect(song.schemaVersion).toBe(1)
  })

  it('reads a version 1 song through validation as version 2', () => {
    // Arrange
    const { song, current, asset } = version1Song()

    // Act
    const read = validateStudioProject(song, [asset])

    // Assert
    expect(read).toEqual(current)
    expect(read.schemaVersion).toBe(2)
  })

  it('hands a current song back as it is', () => {
    // Arrange
    const { current } = version1Song()

    // Act, Assert
    expect(migrateStudioProject(current)).toBe(current)
  })

  it('refuses a song saved by a newer build in plain words', () => {
    // Arrange
    const { current, asset } = version1Song()
    const newer = { ...current, schemaVersion: STUDIO_SCHEMA_VERSION + 1 }

    // Act
    const refusal = (() => {
      try {
        return validateStudioProject(newer, [asset])
      } catch (error) {
        return error
      }
    })()

    // Assert
    expect(refusal).toBeInstanceOf(StudioNewerSongError)
    expect((refusal as Error).message).toBe(
      'This song was saved by a newer MercuryPitch. Update the app to open it.',
    )
    expect(STUDIO_NEWER_SONG).toBe((refusal as Error).message)
  })

  it('leaves a song that names no version to the validator to refuse', () => {
    // Arrange
    const { current, asset } = version1Song()
    const unnamed = { ...current, schemaVersion: '2' }

    // Act, Assert
    expect(migrateStudioProject(unnamed)).toBe(unnamed)
    expect(migrateStudioProject(null)).toBeNull()
    expect(() => validateStudioProject(unnamed, [asset])).toThrow(/version/)
  })

  it('has one step for every version before this one', () => {
    expect(STUDIO_MIGRATION_STEPS).toBe(STUDIO_SCHEMA_VERSION - 1)
  })
})
