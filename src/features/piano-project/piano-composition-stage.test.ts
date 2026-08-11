// ============================================================
// Piano composition stage tests — untrusted library reads and stable projection
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoComposition, PianoCompositionStorage, } from './piano-composition-stage'
import { PIANO_COMPOSITION_LIBRARY_KEY, pianoCompositionToStage, readPianoCompositions, } from './piano-composition-stage'

function storage(serialized: string | null): PianoCompositionStorage {
  return {
    getItem(key) {
      expect(key).toBe(PIANO_COMPOSITION_LIBRARY_KEY)
      return serialized
    },
  }
}

function library(melodies: Record<string, unknown>): string {
  return JSON.stringify({ melodies })
}

describe('readPianoCompositions', () => {
  it('distinguishes an absent library from a valid empty catalogue', () => {
    expect(readPianoCompositions(storage(null))).toMatchObject({
      status: 'absent',
      compositions: [],
      skippedRows: 0,
      skippedItems: 0,
    })
    expect(readPianoCompositions(storage(library({})))).toMatchObject({
      status: 'empty',
      compositions: [],
      skippedRows: 0,
      skippedItems: 0,
    })
  })

  it('keeps unavailable storage and malformed bytes failure-bearing', () => {
    const unavailable = readPianoCompositions({
      getItem() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    expect(unavailable).toMatchObject({
      status: 'unavailable',
      compositions: [],
    })
    if (unavailable.status === 'unavailable') {
      expect(unavailable.error).toBeInstanceOf(DOMException)
    }

    const malformed = readPianoCompositions(storage('{not-json'))
    expect(malformed).toMatchObject({
      status: 'malformed',
      compositions: [],
    })
    if (malformed.status === 'malformed') {
      expect(malformed.error).toBeInstanceOf(SyntaxError)
    }

    expect(
      readPianoCompositions(storage(JSON.stringify({ melodies: [] }))),
    ).toMatchObject({ status: 'malformed', compositions: [] })
  })

  it('sanitizes pitched melodies while excluding drums, rests, and bad rows', () => {
    const result = readPianoCompositions(
      storage(
        library({
          study: {
            id: 'study',
            name: '  Tablet Study  ',
            bpm: 360,
            kind: 'melody',
            items: [
              {
                id: 20,
                note: { midi: 67 },
                startBeat: 2,
                duration: 1.5,
                velocity: 400,
              },
              {
                id: 10,
                note: { midi: 60 },
                startBeat: 0,
                duration: 2,
              },
              {
                id: 11,
                note: { midi: 62 },
                startBeat: 1,
                duration: 1,
                isRest: true,
              },
              {
                id: 12,
                note: { midi: 128 },
                startBeat: 3,
                duration: 1,
              },
              {
                id: 13,
                note: { midi: 64 },
                startBeat: -1,
                duration: 1,
              },
              {
                id: 14,
                note: { midi: 65 },
                startBeat: 4,
                duration: 1,
                velocity: 'loud',
              },
            ],
          },
          drums: {
            id: 'drums',
            name: 'Beat grid',
            bpm: 120,
            kind: 'drums',
            items: [
              {
                id: 1,
                note: { midi: 36 },
                startBeat: 0,
                duration: 1,
              },
            ],
          },
          broken: {
            id: 'different-id',
            name: 'Broken',
            bpm: 100,
            items: [],
          },
        }),
      ),
    )

    expect(result.status).toBe('ready')
    expect(result.skippedRows).toBe(1)
    expect(result.skippedItems).toBe(3)
    expect(result.compositions).toHaveLength(1)
    expect(result.compositions[0]).toMatchObject({
      id: 'study',
      name: 'Tablet Study',
      bpm: 280,
      notes: [
        {
          id: 'study:item-10:1',
          midi: 60,
          startBeat: 0,
          duration: 2,
          velocity: 100 / 127,
        },
        {
          id: 'study:item-20:0',
          midi: 67,
          startBeat: 2,
          duration: 1.5,
          velocity: 1,
        },
      ],
    })
  })

  it('reports an all-invalid catalogue as malformed instead of empty', () => {
    const result = readPianoCompositions(
      storage(
        library({
          broken: { id: 'other', name: '', bpm: 'fast', items: 'none' },
        }),
      ),
    )

    expect(result).toMatchObject({
      status: 'malformed',
      compositions: [],
      skippedRows: 1,
    })
  })

  it('keeps generated note identities stable across repeated reads', () => {
    const serialized = library({
      stable: {
        id: 'stable',
        name: 'Stable',
        bpm: 96,
        items: [
          {
            note: { midi: 60 },
            startBeat: 0,
            duration: 1,
          },
        ],
      },
    })

    const first = readPianoCompositions(storage(serialized))
    const second = readPianoCompositions(storage(serialized))
    expect(first.compositions[0]?.notes[0]?.id).toBe(
      second.compositions[0]?.notes[0]?.id,
    )
    expect(first.compositions[0]?.notes[0]?.id).toBe('stable:item-index-0:0')
  })
})

describe('pianoCompositionToStage', () => {
  it('sorts one composition into a stable Piano performance stage', () => {
    const composition: PianoComposition = {
      id: 'night-piece',
      name: 'Night Piece',
      bpm: 104,
      notes: [
        {
          id: 'night-piece:item-2:0',
          midi: 67,
          startBeat: 2,
          duration: 1.5,
          velocity: 0.5,
        },
        {
          id: 'night-piece:item-1:1',
          midi: 60,
          startBeat: 0,
          duration: 2,
          velocity: 0.75,
        },
      ],
    }

    const stage = pianoCompositionToStage(composition)

    expect(stage).toMatchObject({
      title: 'Night Piece',
      totalBeats: 3.5,
      initialTempoBpm: 104,
      notes: [
        {
          id: 'night-piece:item-1:1',
          midi: 60,
          name: 'C',
          startBeat: 0,
          duration: 2,
          targetFreq: 261.6255653005986,
          isBacking: false,
          trackId: 'composition:night-piece',
          velocity: 0.75,
          releaseVelocity: 0,
          channel: 0,
        },
        {
          id: 'night-piece:item-2:0',
          midi: 67,
          name: 'G',
          startBeat: 2,
          duration: 1.5,
          velocity: 0.5,
        },
      ],
    })
    expect(Object.isFrozen(stage)).toBe(true)
    expect(Object.isFrozen(stage.notes)).toBe(true)
    expect(Object.isFrozen(stage.notes[0])).toBe(true)
    expect(stage.tempoMap).toEqual({
      initialTempoBpm: 104,
      points: [{ beat: 0, bpm: 104, authoredSeconds: 0 }],
    })
  })
})
