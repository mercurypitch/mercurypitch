// Reference-port tests keep the score axis traceable to what a file really authored.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarNightReferenceSource } from './reference-port'
import { isGuitarProReferenceFile, isMidiReferenceFile, liftIntoGuitarRange, measuredReferenceFromTranscription, openGuitarNightReference, resolveReferenceTrack, } from './reference-port'

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

describe('measuredReferenceFromTranscription', () => {
  const transcription = {
    coverage: 0.82,
    analysedSeconds: 120,
    notes: [
      {
        midi: 28,
        noteName: 'E1',
        startSeconds: 0.5,
        durationSeconds: 0.4,
        confidence: 0.8,
      },
      {
        midi: 45,
        noteName: 'A2',
        startSeconds: 1.2,
        durationSeconds: 0.3,
        confidence: 0.7,
      },
    ],
  }

  it('marks the reference as measured and keeps the recording timeline', () => {
    const reference = measuredReferenceFromTranscription({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      transcription,
    })

    expect(reference.kind).toBe('measured')
    expect(reference.coverage).toBe(0.82)
    // One beat per second, so measured seconds reach the stage unscaled.
    expect(reference.tempoBpm).toBe(60)
    expect(reference.notes.map((note) => note.startBeat)).toEqual([0.5, 1.2])
    expect(reference.notes.map((note) => note.duration)).toEqual([0.4, 0.3])
  })

  it('raises sub-guitar notes into range and says that it did', () => {
    const reference = measuredReferenceFromTranscription({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      transcription,
    })

    expect(reference.liftedOctaves).toBe(true)
    // E1 becomes E2 — same pitch class, now placeable on six strings.
    expect(reference.notes[0].midi).toBe(40)
    expect(reference.notes[1].midi).toBe(45)
  })

  it('leaves a line already in guitar range untouched', () => {
    const reference = measuredReferenceFromTranscription({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      transcription: {
        ...transcription,
        notes: [transcription.notes[1]],
      },
    })

    expect(reference.liftedOctaves).toBe(false)
    expect(reference.notes[0].midi).toBe(45)
  })
})

describe('liftIntoGuitarRange', () => {
  it('raises by whole octaves only', () => {
    expect(liftIntoGuitarRange(28)).toBe(40)
    expect(liftIntoGuitarRange(31)).toBe(43)
    expect(liftIntoGuitarRange(40)).toBe(40)
    expect(liftIntoGuitarRange(64)).toBe(64)
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
