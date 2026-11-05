// ============================================================
// Lesson 14 song — the verse, Merc's two takes and every play, as numbers
// ============================================================
//
// FACTS 17 to 20, 26, 31, 43 and 83 to 88: the verse's notes from do at 80
// beats a minute; take 1's breath inside the phrase and take 2's after
// "star", with its swell; the whole verse's five breaths; a sung line as one
// voice from breath to breath, a repeated note dipping and never silent;
// the chords as soft notes under Merc; Step 3's swell; and the four words'
// Legato and Cadence.

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import { BEAT_SEC, VERSE_SEC } from '@/features/lessons/kit/twinkle'
import { breathGroups, cadenceNotes, CHORD_GAIN, chordMarks, contourOfNotes, doOf, GLIDE_SEC, laOf, legatoLines, legatoNotes, lineChords, lineNotes, spelledDegree, sungLines, SWELL_LEVEL, SWELL_STAR, swellContour, TAKE_BREATH, takeNotes, verseNotes, } from './song'

describe("Lesson 14's song", () => {
  it('sings the first line from do at 80 beats a minute: crotchets, then a minim', () => {
    // Act
    const notes = lineNotes(0, 50)

    // Assert
    expect(notes.map((n) => n.midi)).toEqual([50, 50, 57, 57, 59, 59, 57])
    expect(notes.map((n) => n.from)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((b) => b * BEAT_SEC),
    )
    expect(notes[6].to).toBe(6)
    expect(notes.map((n) => n.printed).join(' ')).toBe(
      'Twin- kle, twin- kle, lit- tle star,',
    )
  })

  it("puts do on D3 for the lower voice and D4 for the higher, la a major sixth up, spelled in D major's sharps", () => {
    expect([doOf('lower'), doOf('higher'), doOf('lower', -2)]).toEqual([
      50, 62, 48,
    ])
    expect(laOf(50)).toBe(59)
    expect(spelledDegree(50, 2)).toEqual({ letter: 'F', alter: 1, octave: 3 })
  })

  it('breathes take 1 inside the phrase, from 4.2 s, and take 2 after “star”, from 5.7 s, its swell 0.5, 1 and 0.5', () => {
    // Act
    const one = takeNotes(1, 50)
    const two = takeNotes(2, 50)

    // Assert
    expect([one[5].to, one[6].from, TAKE_BREATH[1]]).toEqual([4.2, 4.5, 4.2])
    expect([two[6].from, two[6].to, TAKE_BREATH[2]]).toEqual([4.5, 5.7, 5.7])
    expect(two[6].light).toEqual(SWELL_STAR)
    expect(SWELL_STAR.map((p) => p.level)).toEqual([0.5, 1, 0.5])
    expect(one.every((n) => n.light.every((p) => p.level === 1))).toBe(true)
  })

  it('takes each of the verse’s five breaths, 0.3 s, from the end of a line’s long note', () => {
    // Act
    const notes = verseNotes(50)

    // Assert
    expect(notes).toHaveLength(42)
    expect([6, 13, 20, 27, 34].map((i) => notes[i].to)).toEqual([
      5.7, 11.7, 17.7, 23.7, 29.7,
    ])
    expect(notes[41].to).toBe(VERSE_SEC)
    expect(sungLines(notes)).toHaveLength(6)
  })

  it('sings a line as one voice from breath to breath: a glide to a new note, a dip, never silence, on a repeated one', () => {
    // Act
    const one = breathGroups(takeNotes(1, 50))
    const points = contourOfNotes(lineNotes(0, 50))

    // Assert: take 1's breath splits it in two voices
    expect(one.map((g) => g.length)).toEqual([6, 1])
    const dip = points.find((p) => p.t === BEAT_SEC)
    expect(dip?.level).toBe(0.6)
    const glide = points.find(
      (p) => Math.abs(p.t - (2 * BEAT_SEC + GLIDE_SEC)) < 1e-9,
    )
    expect(glide?.hz).toBeCloseTo(hz(57), 6)
    expect(points.every((p) => (p.level ?? 1) > 0)).toBe(true)
  })

  it("carries take 2's swell into its voice, louder to 5.1 s and softer to 5.7 s", () => {
    // Act
    const points = contourOfNotes(takeNotes(2, 50))

    // Assert
    const at = (t: number) =>
      points.find((p) => Math.abs(p.t - t) < 1e-9)?.level
    expect([at(4.5 + GLIDE_SEC), at(5.1), at(5.7)]).toEqual([0.5, 1, 0.5])
  })

  it('gives each phrase its chords, one a minim, each note soft under Merc', () => {
    // Act
    const chords = lineChords(1, 50)

    // Assert: IV I V I under "How I wonder what you are"
    expect(chordMarks(1).map((c) => c.text)).toEqual(['IV', 'I', 'V', 'I'])
    expect(chords).toHaveLength(12)
    expect(chords.slice(0, 3).map((c) => c.midi)).toEqual([55, 59, 62])
    expect(new Set(chords.map((c) => `${c.kind} ${c.gain}`))).toEqual(
      new Set([`soft ${CHORD_GAIN}`]),
    )
  })

  it('glides the swell in from 40 cents low by 0.5 s, then holds so while its level grows to 1 at 2.5 s and falls back', () => {
    // Act
    const points = swellContour(50)

    // Assert
    expect(points[0].hz).toBeCloseTo(hz(57) * 2 ** (-40 / 1200), 6)
    expect(points.slice(1).every((p) => Math.abs(p.hz - hz(57)) < 1e-9)).toBe(
      true,
    )
    expect(SWELL_LEVEL.map((p) => [p.t, p.level])).toEqual([
      [0, 0.5],
      [1, 0.5],
      [2.5, 1],
      [4, 0.5],
    ])
  })

  it('plays Legato as one voice, then a beat later with a break before every note but the first, and Cadence over V and I', () => {
    // Act
    const notes = legatoNotes(50)
    const lines = legatoLines(50)
    const cadence = cadenceNotes(50)

    // Assert
    expect(notes).toHaveLength(14)
    expect(notes[7].from).toBe(6 + BEAT_SEC)
    expect(lines.map((l) => l.t)[0]).toBe(0)
    expect(lines).toHaveLength(8)
    expect(cadence.sung.map((n) => [n.printed, n.from])).toEqual([
      ['what', 0],
      ['you', 0.75],
      ['are!', 1.5],
    ])
    expect(cadence.chords.map((c) => c.t)).toEqual([0, 0, 0, 1.5, 1.5, 1.5])
  })
})
