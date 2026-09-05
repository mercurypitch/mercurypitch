// ============================================================
// Property-based & Fuzz Tests: Piano Project SMF Parser
// ============================================================

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseMidiProject, PianoProjectParseError, } from '@/features/piano-project/parse-midi-project'
import { validatePianoProject } from '@/features/piano-project/piano-project'
import { projectToMidiSong } from '@/features/piano-project/project-to-midi-song'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import { buildMidiFile } from '@/lib/midi-generator'

const IDENTITY = {
  id: 'fuzz-project-id',
  name: 'Fuzzed Project',
  fileName: 'fuzzed.mid',
  sha256: '0'.repeat(64),
  importedAt: '2026-08-31T20:00:00.000Z',
}

describe('Property-Based Tests: Piano Project Parser & Invariants', () => {
  it('strictly throws PianoProjectParseError or succeeds on arbitrary byte arrays (no untyped crashes)', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 4096 }),
        (arbitraryBytes) => {
          try {
            const project = parseMidiProject(arbitraryBytes, IDENTITY)
            expect(project).not.toBeNull()
            expect(project.schemaVersion).toBe(1)
            expect(() => validatePianoProject(project)).not.toThrow()
          } catch (error) {
            // Must ONLY throw typed PianoProjectParseError
            expect(error instanceof PianoProjectParseError).toBe(true)
            const pe = error as PianoProjectParseError
            expect(typeof pe.code).toBe('string')
          }
        },
      ),
      { numRuns: 1000 },
    )
  })

  it('parses valid generated SMF files and converts to MidiSong without error', () => {
    const noteEventArbitrary = fc
      .record({
        midi: fc.integer({ min: 21, max: 108 }),
        tickOn: fc.integer({ min: 0, max: 20_000 }),
        durationTicks: fc.integer({ min: 120, max: 960 }),
      })
      .map((n) => ({
        midi: n.midi,
        tickOn: n.tickOn,
        tickOff: n.tickOn + n.durationTicks,
      })) as fc.Arbitrary<MidiNoteEvent>

    fc.assert(
      fc.property(
        fc.array(noteEventArbitrary, { minLength: 1, maxLength: 15 }),
        fc.integer({ min: 60, max: 180 }),
        (notes, bpm) => {
          const smfBytes = buildMidiFile(notes, bpm)
          expect(smfBytes).not.toBeNull()
          if (!smfBytes) return

          const project = parseMidiProject(smfBytes, IDENTITY)
          expect(project).not.toBeNull()
          expect(project.schemaVersion).toBe(1)

          // Invariant: Validation passes
          expect(() => validatePianoProject(project)).not.toThrow()

          // Invariant: projectToMidiSong conversion succeeds
          const song = projectToMidiSong(project)
          expect(song).not.toBeNull()
          expect(song.bpm).toBe(bpm)
          expect(song.tracks.length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 200 },
    )
  })
})
