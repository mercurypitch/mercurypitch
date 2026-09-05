// ============================================================
// Property-based & Fuzz Tests: Guitar Pro to MidiSong Converter
// ============================================================

import * as alphaTab from '@coderline/alphatab'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { scoreToMidiSong } from '@/lib/tab/gp-to-midi-song'

function scoreFromTex(tex: string): alphaTab.model.Score {
  const importer = new alphaTab.importer.AlphaTexImporter()
  importer.initFromString(tex, new alphaTab.Settings())
  return importer.readScore()
}

describe('Property-Based Tests: Guitar Pro to MidiSong Converter', () => {
  it('converts arbitrary valid AlphaTex measure sequences to MidiSong preserving invariants', () => {
    // Generate valid frets 0-24, strings 1-6, durations 1, 2, 4, 8, 16
    const notePatternArbitrary = fc.record({
      fret: fc.integer({ min: 0, max: 24 }),
      string: fc.integer({ min: 1, max: 6 }),
      durationDiv: fc.constantFrom(1, 2, 4, 8, 16),
      isRest: fc.boolean(),
    })

    fc.assert(
      fc.property(
        fc.integer({ min: 40, max: 300 }),
        fc.array(notePatternArbitrary, { minLength: 1, maxLength: 16 }),
        (bpm, notePatterns) => {
          const notesTex = notePatterns
            .map((p) =>
              p.isRest
                ? `r.${p.durationDiv}`
                : `${p.fret}.${p.string}.${p.durationDiv}`,
            )
            .join(' ')

          const tex = `\\tempo ${bpm} . ${notesTex}`
          const score = scoreFromTex(tex)
          expect(score).not.toBeNull()

          const song = scoreToMidiSong(score)
          expect(song).not.toBeNull()
          expect(song.bpm).toBe(bpm)
          expect(Array.isArray(song.tracks)).toBe(true)

          if (song.tracks.length > 0) {
            const track = song.tracks[0]
            expect(track.noteCount).toBe(track.notes.length)

            // Invariant 1: notes are sorted ascending by startBeat
            for (let i = 1; i < track.notes.length; i++) {
              expect(track.notes[i].startBeat).toBeGreaterThanOrEqual(
                track.notes[i - 1].startBeat,
              )
            }

            // Invariant 2: every note has positive duration and valid MIDI pitch
            for (const note of track.notes) {
              expect(note.duration).toBeGreaterThan(0)
              expect(note.startBeat).toBeGreaterThanOrEqual(0)
              expect(note.midi).toBeGreaterThanOrEqual(0)
              expect(note.midi).toBeLessThanOrEqual(127)
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('safely handles empty scores and rests-only scores', () => {
    const emptyScore = scoreFromTex('\\tempo 100 . r.1 r.1 r.1')
    const song = scoreToMidiSong(emptyScore)
    expect(song.bpm).toBe(100)
    expect(song.tracks.length).toBe(0)
  })
})
