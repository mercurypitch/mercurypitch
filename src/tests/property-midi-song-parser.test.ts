import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type {MidiSong, MidiSongPercussionTrack, MidiSongPitchedTrack} from '@/lib/midi-song';
import { defaultScoreTrack, gmInstrumentName, isPitchedMidiSongTrack,    parseMidiSong } from '@/lib/midi-song'

describe('Property-Based Tests: MIDI Song Parser & GM Instruments', () => {
  it('gmInstrumentName never throws and always returns non-empty string for any integer', () => {
    fc.assert(
      fc.property(fc.integer(), (program) => {
        const name = gmInstrumentName(program)
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
        if (program >= 0 && program <= 127) {
          expect(name).not.toMatch(/^Program \d+$/)
        }
      }),
      { numRuns: 1000 },
    )
  })

  it('parseMidiSong never throws an unhandled exception on arbitrary random byte buffers', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 4096 }),
        (binaryData) => {
          let result: MidiSong | null = null
          expect(() => {
            result = parseMidiSong(binaryData)
          }).not.toThrow()

          if (result != null) {
            const song: MidiSong = result
            expect(song).toHaveProperty('tracks')
            expect(Array.isArray(song.tracks)).toBe(true)
            for (const track of song.tracks) {
              expect(typeof track.name).toBe('string')
              expect(typeof track.instrumentName).toBe('string')
              if (isPitchedMidiSongTrack(track)) {
                expect(Array.isArray(track.notes)).toBe(true)
                for (const note of track.notes) {
                  expect(Number.isFinite(note.midi)).toBe(true)
                  expect(note.midi).toBeGreaterThanOrEqual(0)
                  expect(note.midi).toBeLessThanOrEqual(127)
                  expect(Number.isFinite(note.startBeat)).toBe(true)
                  expect(note.startBeat).toBeGreaterThanOrEqual(0)
                  expect(Number.isFinite(note.duration)).toBe(true)
                  expect(note.duration).toBeGreaterThan(0)
                }
              }
            }
          }
        },
      ),
      { numRuns: 500 },
    )
  })

  it('parseMidiSong handles corrupted MThd header prefixes safely', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 4 }),
        fc.uint8Array({ minLength: 0, maxLength: 512 }),
        (headerMagic, payload) => {
          const encoder = new TextEncoder()
          const magicBytes = encoder.encode(headerMagic)
          const merged = new Uint8Array(magicBytes.length + payload.length)
          merged.set(magicBytes, 0)
          merged.set(payload, magicBytes.length)

          expect(() => {
            parseMidiSong(merged)
          }).not.toThrow()
        },
      ),
      { numRuns: 500 },
    )
  })

  it('defaultScoreTrack safely returns highest note count pitched track or null', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string(),
            isPercussion: fc.boolean(),
            notes: fc.array(
              fc.record({
                midi: fc.integer({ min: 0, max: 127 }),
                startBeat: fc.double({ min: 0, max: 1000, noNaN: true }),
                duration: fc.double({ min: 0.1, max: 10, noNaN: true }),
              }),
            ),
          }),
        ),
        (rawTracks) => {
          const tracks = rawTracks.map((t, idx) => {
            if (t.isPercussion) {
              const percTrack: MidiSongPercussionTrack = {
                id: `track-${idx}`,
                kind: 'percussion',
                name: t.name,
                instrumentName: 'Standard Drums',
                noteCount: 0,
                notes: [],
                percussionHits: [],
                droppedHitCount: 0,
              }
              return percTrack
            }

            const pitchedTrack: MidiSongPitchedTrack = {
              id: `track-${idx}`,
              kind: 'pitched',
              name: t.name,
              instrumentName: 'Acoustic Grand Piano',
              noteCount: t.notes.length,
              notes: t.notes,
            }
            return pitchedTrack
          })

          const song: MidiSong = {
            bpm: 120,
            timeSignatures: [],
            tempoChanges: [],
            tracks,
          }

          const scoreTrack = defaultScoreTrack(song)
          if (scoreTrack === null) {
            const hasPitchedWithNotes = tracks.some(
              (t) => isPitchedMidiSongTrack(t) && t.notes.length > 0,
            )
            expect(hasPitchedWithNotes).toBe(false)
          } else {
            expect(scoreTrack.kind).toBe('pitched')
            expect(scoreTrack.notes.length).toBeGreaterThan(0)
          }
        },
      ),
      { numRuns: 300 },
    )
  })
})
