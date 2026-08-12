// ============================================================
// Note Hunt progress tests — exact local resume without stale-neck state
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { NoteHuntState } from '@/features/guitar/activities/note-hunt'
import { createNoteHuntRound, createNoteHuntState, reduceNoteHunt, } from '@/features/guitar/activities/note-hunt'
import { instrumentTuningFromSource, standardTuning, } from '@/lib/guitar/instrument-tuning'
import { clearNoteHuntProgress, createNoteHuntProgress, loadNoteHuntProgress, NOTE_HUNT_PROGRESS_STORAGE_KEY, noteHuntTuningSignature, saveNoteHuntProgress, } from './note-hunt-progress'

const STANDARD_GUITAR = standardTuning('guitar')

function noteHuntState(targetPitchClass = 4): NoteHuntState {
  return createNoteHuntState(
    createNoteHuntRound(STANDARD_GUITAR, { targetPitchClass }),
  )
}

function mark(
  state: NoteHuntState,
  stringIndex: number,
  fret: number,
): NoteHuntState {
  return reduceNoteHunt(state, {
    type: 'mark-position',
    stringIndex,
    fret,
  })
}

describe('Note Hunt progress', () => {
  beforeEach(() => localStorage.clear())

  it('resumes the target and exact physical positions from one compact round', () => {
    let state = noteHuntState()
    state = mark(state, 0, 1)
    state = mark(state, 0, 0)
    state = mark(state, 3, 2)

    const saved = saveNoteHuntProgress(state, STANDARD_GUITAR, 3)
    const restored = loadNoteHuntProgress(STANDARD_GUITAR)

    expect(saved).toEqual({
      schemaVersion: 1,
      targetPitchClass: 4,
      foundPositionIds: ['0:0', '3:2'],
      completedRoundCount: 3,
      fretRange: { firstFret: 0, lastFret: 4 },
      tuningSignature: noteHuntTuningSignature(STANDARD_GUITAR),
    })
    expect(restored).not.toBeNull()
    expect(restored?.completedRoundCount).toBe(3)
    expect(restored?.state.round.targetPitchClass).toBe(4)
    expect(restored?.state.marks).toEqual({
      '0:0': 'correct',
      '3:2': 'correct',
    })
    expect(restored?.state.foundCount).toBe(2)
    expect(restored?.state.phase).toBe('active')
    expect(restored?.state.lastAttempt).toBeNull()

    const serialized = localStorage.getItem(NOTE_HUNT_PROGRESS_STORAGE_KEY)
    expect(serialized).not.toContain('wrong')
    expect(serialized).not.toContain('lastAttempt')
  })

  it('reconstructs completion when every exact target position was found', () => {
    let state = noteHuntState()
    for (const position of state.round.targetPositions) {
      state = mark(state, position.stringIndex, position.fret)
    }

    expect(state.phase).toBe('complete')
    expect(saveNoteHuntProgress(state, STANDARD_GUITAR, 1)).not.toBeNull()

    const restored = loadNoteHuntProgress(STANDARD_GUITAR)
    expect(restored?.state.phase).toBe('complete')
    expect(restored?.state.foundCount).toBe(
      restored?.state.round.targetPositions.length,
    )
  })

  it('refuses caller state that belongs to a different neck', () => {
    const dropD = instrumentTuningFromSource(
      'guitar',
      [64, 59, 55, 50, 45, 38],
      { name: 'Drop D' },
    )
    if (dropD === null) throw new Error('Expected a valid Drop D fixture.')

    expect(createNoteHuntProgress(noteHuntState(), dropD, 0)).toBeNull()
    expect(saveNoteHuntProgress(noteHuntState(), dropD, 0)).toBeNull()
    expect(localStorage.getItem(NOTE_HUNT_PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('resets a saved round when the active tuning or fret range changes', () => {
    expect(
      saveNoteHuntProgress(noteHuntState(), STANDARD_GUITAR, 2),
    ).not.toBeNull()

    const capoed = { ...STANDARD_GUITAR, capo: 1 }
    expect(loadNoteHuntProgress(capoed)).toBeNull()
    expect(localStorage.getItem(NOTE_HUNT_PROGRESS_STORAGE_KEY)).toBeNull()

    expect(
      saveNoteHuntProgress(noteHuntState(), STANDARD_GUITAR, 2),
    ).not.toBeNull()
    expect(
      loadNoteHuntProgress(STANDARD_GUITAR, {
        firstFret: 0,
        lastFret: 3,
      }),
    ).toBeNull()
    expect(localStorage.getItem(NOTE_HUNT_PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('removes malformed and incompatible records instead of partially trusting them', () => {
    const valid = createNoteHuntProgress(noteHuntState(), STANDARD_GUITAR, 2)
    if (valid === null) throw new Error('Expected a valid progress fixture.')

    const malformed = [
      '{broken',
      JSON.stringify({ ...valid, schemaVersion: 2 }),
      JSON.stringify({ ...valid, targetPitchClass: 12 }),
      JSON.stringify({ ...valid, completedRoundCount: -1 }),
      JSON.stringify({ ...valid, completedRoundCount: Number.MAX_VALUE }),
      JSON.stringify({ ...valid, fretRange: { firstFret: 0, lastFret: 20 } }),
      JSON.stringify({ ...valid, tuningSignature: 'another-neck' }),
      JSON.stringify({ ...valid, foundPositionIds: '0:0' }),
      JSON.stringify({ ...valid, foundPositionIds: ['0:0', '0:0'] }),
      JSON.stringify({ ...valid, foundPositionIds: ['0:1'] }),
    ]

    for (const stored of malformed) {
      localStorage.setItem(NOTE_HUNT_PROGRESS_STORAGE_KEY, stored)
      expect(loadNoteHuntProgress(STANDARD_GUITAR)).toBeNull()
      expect(localStorage.getItem(NOTE_HUNT_PROGRESS_STORAGE_KEY)).toBeNull()
    }
  })

  it('treats unavailable storage as optional and keeps clear idempotent', () => {
    const blocked = {
      getItem(): string | null {
        throw new Error('blocked')
      },
      setItem(): void {
        throw new Error('blocked')
      },
      removeItem(): void {
        throw new Error('blocked')
      },
    }

    expect(
      saveNoteHuntProgress(noteHuntState(), STANDARD_GUITAR, 0, blocked),
    ).toBeNull()
    expect(loadNoteHuntProgress(STANDARD_GUITAR, undefined, blocked)).toBeNull()
    expect(() => clearNoteHuntProgress(blocked)).not.toThrow()
  })
})
