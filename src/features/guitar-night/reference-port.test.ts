// Reference-port tests keep the score axis traceable to what a file really authored.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarNightReferenceSource } from './reference-port'
import { isGuitarProReferenceFile, isMidiReferenceFile, openGuitarNightReference, resolveReferenceTrack, } from './reference-port'

function source(
  overrides: Partial<GuitarNightReferenceSource> = {},
): GuitarNightReferenceSource {
  return {
    id: 'gsong-1',
    name: 'Velvet Riff',
    bpm: 96,
    scoreTrackId: 'track-lead',
    tracks: [
      {
        id: 'track-lead',
        name: 'Lead guitar',
        noteCount: 2,
        notes: [
          { midi: 64, startBeat: 0, duration: 1, stringIndex: 0, fret: 0 },
          { midi: 67, startBeat: 1, duration: 1, stringIndex: 0, fret: 3 },
        ],
      },
      {
        id: 'track-rhythm',
        name: 'Rhythm guitar',
        noteCount: 3,
        notes: [
          { midi: 40, startBeat: 0, duration: 2 },
          { midi: 45, startBeat: 2, duration: 2 },
          { midi: 50, startBeat: 4, duration: 2 },
        ],
      },
      { id: 'track-empty', name: 'Silent take', noteCount: 0, notes: [] },
    ],
    ...overrides,
  }
}

describe('resolveReferenceTrack', () => {
  it('prefers an explicit request over the remembered track', () => {
    expect(resolveReferenceTrack(source(), 'track-rhythm')?.id).toBe(
      'track-rhythm',
    )
  })

  it('falls back to the remembered track when the request is unknown', () => {
    expect(resolveReferenceTrack(source(), 'track-gone')?.id).toBe('track-lead')
  })

  it('falls back to the densest track when nothing is remembered', () => {
    expect(
      resolveReferenceTrack(source({ scoreTrackId: 'track-gone' }))?.id,
    ).toBe('track-rhythm')
  })

  it('never resolves a track that has no notes', () => {
    expect(resolveReferenceTrack(source(), 'track-empty')?.id).toBe(
      'track-lead',
    )
    expect(
      resolveReferenceTrack(
        source({
          scoreTrackId: 'track-empty',
          tracks: [
            { id: 'track-empty', name: 'Silent', noteCount: 0, notes: [] },
          ],
        }),
      ),
    ).toBeNull()
  })
})

describe('openGuitarNightReference', () => {
  it('keeps authored Guitar Pro fingering instead of re-placing notes', () => {
    const result = openGuitarNightReference(source(), 'track-lead')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reference.tempoBpm).toBe(96)
    expect(result.reference.trackName).toBe('Lead guitar')
    expect(
      result.reference.notes.map((note) => ({
        stringIndex: note.stringIndex,
        fret: note.fret,
        startBeat: note.startBeat,
      })),
    ).toEqual([
      { stringIndex: 0, fret: 0, startBeat: 0 },
      { stringIndex: 0, fret: 3, startBeat: 1 },
    ])
  })

  it('places MIDI notes that carry no authored fingering', () => {
    const result = openGuitarNightReference(source(), 'track-rhythm')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reference.notes).toHaveLength(3)
    for (const note of result.reference.notes) {
      expect(note.stringIndex).toBeGreaterThanOrEqual(0)
      expect(note.fret).toBeGreaterThanOrEqual(0)
    }
  })

  it('lists only playable tracks so an empty part is never offered', () => {
    const result = openGuitarNightReference(source())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reference.tracks.map((track) => track.id)).toEqual([
      'track-lead',
      'track-rhythm',
    ])
  })

  it('reports a score with nothing playable instead of showing an empty stage', () => {
    const result = openGuitarNightReference(
      source({
        tracks: [{ id: 'only', name: 'Only', noteCount: 0, notes: [] }],
      }),
    )

    expect(result).toEqual({ ok: false, code: 'no-playable-notes' })
  })

  it('substitutes a usable tempo when the source recorded none', () => {
    const result = openGuitarNightReference(source({ bpm: 0 }), 'track-lead')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reference.tempoBpm).toBe(120)
  })
})

describe('reference file recognition', () => {
  it('separates Guitar Pro tabs from standard MIDI', () => {
    expect(isGuitarProReferenceFile('riff.gp5')).toBe(true)
    expect(isGuitarProReferenceFile('riff.GPX')).toBe(true)
    expect(isGuitarProReferenceFile('riff.mid')).toBe(false)
    expect(isMidiReferenceFile('riff.midi')).toBe(true)
    expect(isMidiReferenceFile('riff.mp3')).toBe(false)
  })
})
