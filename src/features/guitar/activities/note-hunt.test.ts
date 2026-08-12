// ============================================================
// Note Hunt tests — physical identity, bounded rounds, and honest listening
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarInputPitch } from '@/lib/guitar/input-events'
import { instrumentTuningFromSource, standardTuning, } from '@/lib/guitar/instrument-tuning'
import { createNoteHuntPitchEvidenceAdapter, createNoteHuntRound, createNoteHuntState, noteHuntEvidenceMatchesTarget, noteHuntPositions, reduceNoteHunt, } from './note-hunt'

function pitch(midi: number): GuitarInputPitch {
  return {
    midi,
    noteName: `MIDI ${midi}`,
    cents: 2,
    clarity: 0.91,
  }
}

describe('noteHuntPositions', () => {
  it.each([4, 5, 6, 7, 8])(
    'enumerates every cell of a bounded %i-string tuning',
    (stringCount) => {
      const positions = noteHuntPositions(
        standardTuning('guitar', stringCount),
        {
          firstFret: 0,
          lastFret: 4,
        },
      )

      expect(positions).toHaveLength(stringCount * 5)
      expect(positions[0]).toMatchObject({
        id: '0:0',
        stringIndex: 0,
        fret: 0,
        midi: 64,
      })
      expect(positions.at(-1)).toMatchObject({
        id: `${stringCount - 1}:4`,
        stringIndex: stringCount - 1,
        fret: 4,
      })
    },
  )

  it('uses sounding open pitches after the capo', () => {
    const capoTwo = instrumentTuningFromSource(
      'guitar',
      standardTuning('guitar').openMidi,
      { capo: 2 },
    )!

    expect(
      noteHuntPositions(capoTwo, { firstFret: 0, lastFret: 1 }).slice(0, 2),
    ).toEqual([
      {
        id: '0:0',
        stringIndex: 0,
        fret: 0,
        midi: 66,
        pitchClass: 6,
      },
      {
        id: '0:1',
        stringIndex: 0,
        fret: 1,
        midi: 67,
        pitchClass: 7,
      },
    ])
  })

  it('preserves distinct physical positions that share one MIDI pitch', () => {
    const positions = noteHuntPositions(standardTuning('guitar'), {
      firstFret: 0,
      lastFret: 5,
    })
    const e4Positions = positions.filter((position) => position.midi === 64)

    expect(e4Positions.map((position) => position.id)).toEqual(['0:0', '1:5'])
  })

  it('rejects a wide exercise range that would stop being a focused hunt', () => {
    expect(() =>
      noteHuntPositions(standardTuning('guitar'), {
        firstFret: 0,
        lastFret: 6,
      }),
    ).toThrow('at most 6 frets')
  })
})

describe('createNoteHuntRound', () => {
  it('supports exact lesson targets without invoking random selection', () => {
    const random = vi.fn(() => 0.5)
    const round = createNoteHuntRound(standardTuning('guitar'), {
      targetPitchClass: 4,
      random,
    })

    expect(round.targetPitchClass).toBe(4)
    expect(round.targetNoteName).toBe('E')
    expect(round.targetPositions.length).toBeGreaterThan(1)
    expect(random).not.toHaveBeenCalled()
  })

  it('uses an injected random source deterministically', () => {
    const first = createNoteHuntRound(standardTuning('guitar'), {
      random: () => 0,
    })
    const last = createNoteHuntRound(standardTuning('guitar'), {
      random: () => 0.999_999,
    })

    expect(first.targetPitchClass).toBe(0)
    expect(last.targetPitchClass).toBe(11)
  })
})

describe('reduceNoteHunt', () => {
  it('marks exact positions rather than every cell sharing the same pitch', () => {
    const round = createNoteHuntRound(standardTuning('guitar'), {
      fretRange: { firstFret: 0, lastFret: 5 },
      targetPitchClass: 4,
    })
    const initial = createNoteHuntState(round)
    const afterFirstE4 = reduceNoteHunt(initial, {
      type: 'mark-position',
      stringIndex: 0,
      fret: 0,
    })

    expect(afterFirstE4.marks['0:0']).toBe('correct')
    expect(afterFirstE4.marks['1:5']).toBeUndefined()
    expect(afterFirstE4.foundCount).toBe(1)
    expect(afterFirstE4.phase).toBe('active')
  })

  it('retains wrong marks without advancing the round', () => {
    const initial = createNoteHuntState(
      createNoteHuntRound(standardTuning('guitar'), {
        targetPitchClass: 4,
      }),
    )
    const wrong = reduceNoteHunt(initial, {
      type: 'mark-position',
      stringIndex: 0,
      fret: 1,
    })

    expect(wrong.marks['0:1']).toBe('wrong')
    expect(wrong.foundCount).toBe(0)
    expect(wrong.lastAttempt).toEqual({
      positionId: '0:1',
      outcome: 'wrong',
    })
  })

  it('completes only after every exact target position is marked', () => {
    const round = createNoteHuntRound(standardTuning('guitar'), {
      targetPitchClass: 4,
    })
    let state = createNoteHuntState(round)

    for (const position of round.targetPositions) {
      state = reduceNoteHunt(state, {
        type: 'mark-position',
        stringIndex: position.stringIndex,
        fret: position.fret,
      })
    }

    expect(state.foundCount).toBe(round.targetPositions.length)
    expect(state.phase).toBe('complete')
    expect(
      round.targetPositions.every(
        (position) => state.marks[position.id] === 'correct',
      ),
    ).toBe(true)
  })
})

describe('createNoteHuntPitchEvidenceAdapter', () => {
  it('waits for a provisional event to be enriched, then consumes it once', () => {
    const adapter = createNoteHuntPitchEvidenceAdapter()
    const provisional = {
      id: 'take-1:event-1',
      kind: 'attack' as const,
      pitch: null,
    }

    expect(adapter.consume([provisional])).toEqual([])

    const enriched = { ...provisional, pitch: pitch(64) }
    expect(adapter.consume([enriched])).toEqual([
      {
        eventId: 'take-1:event-1',
        kind: 'attack',
        midi: 64,
        pitchClass: 4,
        noteName: 'MIDI 64',
        cents: 2,
        clarity: 0.91,
      },
    ])
    expect(adapter.consume([{ ...enriched, pitch: pitch(64) }])).toEqual([])
  })

  it('retains pitch truth without inventing a string or fret', () => {
    const adapter = createNoteHuntPitchEvidenceAdapter()
    const [evidence] = adapter.consume([
      { id: 'event-1', kind: 'pitch-change', pitch: pitch(52) },
    ])
    const round = createNoteHuntRound(standardTuning('guitar'), {
      targetPitchClass: 4,
    })

    expect(evidence).toBeDefined()
    expect(noteHuntEvidenceMatchesTarget(evidence!, round)).toBe(true)
    expect(evidence).not.toHaveProperty('positionId')
    expect(evidence).not.toHaveProperty('stringIndex')
    expect(evidence).not.toHaveProperty('fret')
  })

  it('ignores releases and allows an explicit reset', () => {
    const adapter = createNoteHuntPitchEvidenceAdapter()
    const event = { id: 'event-1', kind: 'attack' as const, pitch: pitch(64) }

    expect(
      adapter.consume([
        { id: 'release-1', kind: 'release', pitch: pitch(64) },
        event,
      ]),
    ).toHaveLength(1)
    expect(adapter.consume([event])).toEqual([])

    adapter.reset()
    expect(adapter.consume([event])).toHaveLength(1)
  })
})
