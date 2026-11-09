// Studio MIDI validation tests — a song with a MIDI clip validates whole; every field of a sequence, its notes and a clip's midi out of its range is refused, a default written out included; note ids are unique and below nextNoteId, sequence ids unique, and a clip names a sequence the song holds; and a sequence no clip names is dropped on read, `sequences` with it when none is left.
import { describe, expect, it } from 'vitest'
import { studioMidiFixture } from './model.test-fixtures'
import type { StudioClip, StudioNote, StudioProject, StudioSequence, } from './types'
import { validateStudioProject } from './validation'
import { STUDIO_MAX_SEQUENCE_NOTES } from './validation-midi'

/** The fixture with its sequence's first note changed by `change`. */
function withNote(change: Record<string, unknown>): StudioProject {
  const { project, sequence } = studioMidiFixture()
  const [first, ...rest] = sequence.notes
  return withSequence(project, {
    ...sequence,
    notes: [{ ...first, ...change } as StudioNote, ...rest],
  })
}

function withSequence(
  project: StudioProject,
  sequence: StudioSequence,
): StudioProject {
  return { ...project, sequences: [sequence] }
}

/** The fixture with its MIDI clip changed by `change`. */
function withClip(change: Partial<StudioClip>): StudioProject {
  const { project, clip } = studioMidiFixture()
  return {
    ...project,
    clips: project.clips.map((each) =>
      each.id === clip.id ? { ...clip, ...change } : each,
    ),
  }
}

describe('Studio MIDI validation', () => {
  it('validates a song with a MIDI clip whole, and returns its own copy', () => {
    // Arrange
    const { project, assets } = studioMidiFixture()

    // Act
    const read = validateStudioProject(project, assets)

    // Assert
    expect(read).toEqual(project)
    expect(read.sequences![0]).not.toBe(project.sequences![0])
  })

  it.each([
    ['a note field it does not know', { muted: true }, /Unknown field/],
    ['note id 0', { id: 0 }, /Expected a finite number from 1/],
    ['a fractional note id', { id: 1.5 }, /integer/],
    ['pitch 128', { pitch: 128 }, /0 to 127/],
    ['pitch -1', { pitch: -1 }, /finite number from 0/],
    ['a fractional start', { startTick: 0.5 }, /integer/],
    ['a start before the sequence', { startTick: -1 }, /finite number/],
    ['a length of 0', { lengthTicks: 0 }, /from 1/],
    ['velocity 0', { velocity: 0 }, /above 0/],
    ['velocity above 1', { velocity: 1.01 }, /from 0 to 1/],
    ['velocity past 4 decimals', { velocity: 0.12345 }, /4 decimals/],
    [
      'release velocity written at its default',
      { releaseVelocity: 0.5 },
      /default/,
    ],
    ['release velocity above 1', { releaseVelocity: 1.5 }, /from 0 to 1/],
    [
      'release velocity past 4 decimals',
      { releaseVelocity: 0.00001 },
      /4 decimals/,
    ],
    ['channel written at its default', { channel: 0 }, /default/],
    ['channel 16', { channel: 16 }, /0 to 15/],
  ])('refuses a note with %s', (_case, change, refusal) => {
    // Arrange
    const { assets } = studioMidiFixture()

    // Act, Assert
    expect(() => validateStudioProject(withNote(change), assets)).toThrow(
      refusal,
    )
  })

  it('keeps a note with a release velocity and a channel away from their defaults', () => {
    // Arrange
    const { assets } = studioMidiFixture()
    const song = withNote({ releaseVelocity: 0.25, channel: 9 })

    // Act, Assert
    expect(validateStudioProject(song, assets)).toEqual(song)
  })

  it.each([
    ['a field it does not know', { lanes: [] }, /Unknown field/],
    ['an id that is not one', { id: 'not an id!' }, /Invalid identifier/],
    ['PPQ other than 960', { ppq: 96 }, /version/],
    ['a tempo below 20', { tempoBpm: 19 }, /from 20 to 300/],
    ['a tempo above 300', { tempoBpm: 301 }, /from 20 to 300/],
    ['a length of 0', { lengthTicks: 0 }, /from 1/],
    ['a next note id of 0', { nextNoteId: 0 }, /from 1/],
    ['a next note id its notes reach', { nextNoteId: 2 }, /below nextNoteId/],
    ['notes that are not a list', { notes: {} }, /Expected an array/],
  ])('refuses a sequence with %s', (_case, change, refusal) => {
    // Arrange
    const { project, assets, sequence } = studioMidiFixture()
    const song = withSequence(project, {
      ...sequence,
      ...change,
    } as StudioSequence)

    // Act, Assert
    expect(() => validateStudioProject(song, assets)).toThrow(refusal)
  })

  it('refuses two notes with one id', () => {
    // Arrange
    const { project, assets, sequence } = studioMidiFixture()
    const [first] = sequence.notes
    const song = withSequence(project, {
      ...sequence,
      notes: [first, { ...first, pitch: 72 }],
    })

    // Act, Assert
    expect(() => validateStudioProject(song, assets)).toThrow(/Duplicate value/)
  })

  it(`refuses a sequence of more than ${STUDIO_MAX_SEQUENCE_NOTES} notes, and keeps one of exactly that many`, () => {
    // Arrange
    const { project, assets, sequence } = studioMidiFixture()
    const notes = (count: number): StudioNote[] =>
      Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        pitch: 60,
        startTick: index,
        lengthTicks: 1,
        velocity: 0.5,
      }))
    const full = (count: number) =>
      withSequence(project, {
        ...sequence,
        nextNoteId: count + 1,
        notes: notes(count),
      })

    // Act, Assert
    expect(() =>
      validateStudioProject(full(STUDIO_MAX_SEQUENCE_NOTES), assets),
    ).not.toThrow()
    expect(() =>
      validateStudioProject(full(STUDIO_MAX_SEQUENCE_NOTES + 1), assets),
    ).toThrow(/at most 10000 notes/)
  })

  it('refuses two sequences with one id', () => {
    // Arrange
    const { project, assets, sequence } = studioMidiFixture()
    const song = { ...project, sequences: [sequence, { ...sequence }] }

    // Act, Assert
    expect(() => validateStudioProject(song, assets)).toThrow(/Duplicate value/)
  })

  it('refuses sequences that are not a list', () => {
    // Arrange
    const { project, assets } = studioMidiFixture()
    const song = { ...project, sequences: {} } as unknown as StudioProject

    // Act, Assert
    expect(() => validateStudioProject(song, assets)).toThrow(
      /Expected an array/,
    )
  })

  it.each([
    [
      'a sequence the song does not hold',
      { midi: { sequenceId: 'gone', renderKey: 'key' } },
      /Sequence does not exist/,
    ],
    [
      'an empty render key',
      { midi: { sequenceId: 'sequence-1', renderKey: ' ' } },
      /nonempty text/,
    ],
    [
      'no render key',
      { midi: { sequenceId: 'sequence-1' } },
      /renderKey: Required/,
    ],
    [
      'a midi field it does not know',
      { midi: { sequenceId: 'sequence-1', renderKey: 'key', linked: true } },
      /Unknown field/,
    ],
  ])('refuses a clip that names %s', (_case, change, refusal) => {
    // Arrange
    const { assets } = studioMidiFixture()
    const song = withClip(change as Partial<StudioClip>)

    // Act, Assert
    expect(() => validateStudioProject(song, assets)).toThrow(refusal)
  })

  it('drops a sequence no clip names as the song is read, and `sequences` with the last of them', () => {
    // Arrange
    const { project, assets, sequence, clip } = studioMidiFixture()
    const spare = { ...sequence, id: 'sequence-spare' }
    const withSpare = { ...project, sequences: [sequence, spare] }
    const audioOnly = {
      ...project,
      clips: project.clips.filter((each) => each.id !== clip.id),
    }

    // Act
    const read = validateStudioProject(withSpare, assets)
    const none = validateStudioProject(audioOnly, assets)
    const empty = validateStudioProject({ ...audioOnly, sequences: [] }, assets)
    const unset = validateStudioProject(
      { ...audioOnly, sequences: undefined },
      assets,
    )

    // Assert
    expect(read.sequences).toEqual([sequence])
    expect(none).not.toHaveProperty('sequences')
    expect(empty).not.toHaveProperty('sequences')
    expect(unset).not.toHaveProperty('sequences')
  })
})
