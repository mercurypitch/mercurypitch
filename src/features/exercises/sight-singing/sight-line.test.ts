import { describe, expect, it } from 'vitest'
import { signName } from '../note-reading/staff-kit'
import { sightKey } from './sight-key'
import { lineWords, nameUnder, startNotes, startWords, writeLine, writtenShift, } from './sight-line'

const G_MAJOR = sightKey('G', 'major')
const A_HARMONIC = sightKey('A', 'harmonic-minor')
/** Lesson 16's two phrases as one line, in the higher voice's octave: G4 to D5. */
const LESSON_16 = [67, 69, 71, 69, 67, 67, 74, 71, 69, 67]
const down = (midis: readonly number[]): number[] => midis.map((m) => m - 12)

describe("Sight-Singing's line on the staff", () => {
  it('writes a line at its pitch where it reads within two ledger lines', () => {
    // Arrange: G4 to D5 on the treble staff, for a soprano
    // Act
    const line = writeLine(LESSON_16, G_MAJOR, 'treble', 'soprano')

    // Assert: G4 sits on the second line, D5 on the fourth
    expect(line.shift).toBe(0)
    expect(line.notes.map((n) => n.midi)).toEqual(LESSON_16)
    expect(line.notes.map((n) => n.place)).toEqual([
      2, 3, 4, 3, 2, 2, 6, 4, 3, 2,
    ])
  })

  it("writes a bass's G3 to D4 on the bass staff with do in its top space", () => {
    const line = writeLine(down(LESSON_16), G_MAJOR, 'bass', 'bass')

    expect(line.notes[0].place).toBe(7)
    expect(line.notes.map((n) => n.midi)).toEqual(down(LESSON_16))
  })

  it("writes a tenor's G3 to D4 an octave up on the treble staff, and has it sung where the tenor sings", () => {
    // Arrange: the tenor reads the treble staff (clefForRange); G3 sits
    // under its second ledger line there
    const sung = down(LESSON_16)

    // Act
    const line = writeLine(sung, G_MAJOR, 'treble', 'tenor')

    // Assert: written G4 to D5, as tenor parts are, and sung an octave
    // under, since D5 is over the tenor's top
    expect(writtenShift(sung, G_MAJOR, 'treble')).toBe(12)
    expect(line.notes.map((n) => n.place)).toEqual([
      2, 3, 4, 3, 2, 2, 6, 4, 3, 2,
    ])
    expect(line.notes.map((n) => n.midi)).toEqual(sung)
    expect(line.shift).toBe(12)
  })

  it('sings a line where it is written when the voice reaches it', () => {
    // An alto's low F3 to A3 would need three ledger lines under the
    // treble staff; written an octave up, F4 to A4 is hers to sing too.
    const line = writeLine(
      [53, 55, 57, 55, 53],
      sightKey('F', 'major'),
      'treble',
      'alto',
    )

    expect(line.notes.map((n) => n.midi)).toEqual([65, 67, 69, 67, 65])
    expect(line.shift).toBe(0)
  })

  it('sings a launched phrase where the launch put it, though it is written an octave up', () => {
    // G3 to B3 for a tenor on the treble staff: written G4 to B4, which the
    // tenor could also sing, but the launch chose G3.
    const line = writeLine([55, 57, 59], G_MAJOR, 'treble', 'tenor', {
      fixed: true,
    })

    expect(line.notes.map((n) => n.place)).toEqual([2, 3, 4])
    expect(line.notes.map((n) => n.midi)).toEqual([55, 57, 59])
    expect(line.shift).toBe(12)
    // The drill's own notes would have been sung where they are written.
    expect(
      writeLine([55, 57, 59], G_MAJOR, 'treble', 'tenor').notes.map(
        (n) => n.midi,
      ),
    ).toEqual([67, 69, 71])
  })

  it('signs a note only where its letter differs from the key, every time it does, with a natural on the way back', () => {
    // Arrange: A, G sharp, A, G sharp, G in A harmonic minor
    const midis = [69, 68, 69, 68, 67]

    // Act
    const line = writeLine(midis, A_HARMONIC, 'treble', 'soprano')

    // Assert
    expect(line.notes.map((n) => signName(n.written))).toEqual([
      'A4',
      'G♯4',
      'A4',
      'G♯4',
      'G4',
    ])
    expect(line.notes.map((n) => n.sign)).toEqual([null, 1, null, 1, 0])
  })

  it("leaves the key signature's own flats unsigned, and gives a B natural its sign", () => {
    const line = writeLine(
      [70, 69, 71, 72],
      sightKey('F', 'major'),
      'treble',
      'soprano',
    )

    expect(line.notes.map((n) => n.letter)).toEqual(['B♭', 'A', 'B', 'C'])
    expect(line.notes.map((n) => n.sign)).toEqual([null, null, 0, null])
  })

  it('names each note by its letter, its syllable, or not at all', () => {
    const [gSharp] = writeLine([68], A_HARMONIC, 'treble', 'soprano').notes

    expect(nameUnder(gSharp, 'letters')).toBe('G♯')
    expect(nameUnder(gSharp, 'solfege')).toBe('ti')
    expect(nameUnder(gSharp, 'off')).toBeNull()
  })

  it('tells a screen reader the staff, the key and the notes, with names off by their places', () => {
    const line = writeLine([69, 68, 69], A_HARMONIC, 'treble', 'soprano')

    expect(lineWords(line, 'letters')).toBe(
      'Treble staff in A harmonic minor, no key signature. 3 notes: A, G sharp, A.',
    )
    expect(lineWords(line, 'solfege')).toContain('3 notes: do, ti, do.')
    expect(lineWords(line, 'off')).toContain(
      '3 notes: the second space, the second line, the second space.',
    )
  })
})

describe('Hear do: the start before a line', () => {
  it('plays do, then do-mi-so-mi-do, do at or under the first note', () => {
    const line = writeLine(down(LESSON_16), G_MAJOR, 'bass', 'bass')

    expect(startNotes(line, 'bass')).toEqual([55, 55, 59, 62, 59, 55])
    expect(startWords(line)).toBe('do, mi, so, mi, do')
  })

  it('plays do-me-so-me-do in minor', () => {
    const line = writeLine([69, 71, 72], A_HARMONIC, 'treble', 'soprano')

    expect(startNotes(line, 'soprano')).toEqual([69, 69, 72, 76, 72, 69])
    expect(startWords(line)).toBe('do, me, so, me, do')
  })

  it("moves do up an octave where it would sit under the singer's range", () => {
    // A soprano's line starting on B4 in G: the G under it is G4, in range;
    // one starting on C4 in G would put do on G3, under C4.
    const line = writeLine([60, 62, 64], G_MAJOR, 'treble', 'soprano')

    expect(startNotes(line, 'soprano')[0]).toBe(67)
  })
})
