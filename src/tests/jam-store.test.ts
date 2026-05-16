// ── Jam Store State Tests ─────────────────────────────────────────────
// Verifies exercise lifecycle state transitions: select, play, pause,
// stop, seek, clear, loop, auto-stop reset.
//
// NOTE: The playback timer uses requestAnimationFrame which is mocked
// in setup.ts to be a no-op. Tick-level timing is therefore not tested
// here — those belong in integration tests. We focus on the signal
// state machine only.

import { beforeEach, describe, expect, it } from 'vitest'
import { clearJamExercise, jamExerciseBeat, jamExerciseLoop, jamExerciseMelody, jamExerciseNoteIndex, jamExercisePaused, jamExercisePlaying, jamExerciseTotalBeats, jamPitchHistory, jamPlaybackPause, jamPlaybackPlay, jamPlaybackSeek, jamPlaybackStop, selectJamExercise, setJamExerciseBeat, setJamExerciseLoop, setJamExercisePlaying, setJamPitchHistory, } from '@/stores/jam-store'
import type { MelodyData } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────

let _nextId = 1
const nextId = () => _nextId++

function makeMelody(bpm = 120, beatCount = 8): MelodyData {
  return {
    id: 'test-melody',
    name: 'Test Melody',
    bpm,
    key: 'C',
    scaleType: 'major',
    createdAt: 0,
    updatedAt: 0,
    items: [
      {
        id: nextId(),
        startBeat: 0,
        duration: 2,
        isRest: false,
        note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
      },
      {
        id: nextId(),
        startBeat: 2,
        duration: 2,
        isRest: false,
        note: { midi: 62, name: 'D', octave: 4, freq: 293.66 },
      },
      {
        id: nextId(),
        startBeat: 4,
        duration: beatCount - 4,
        isRest: false,
        note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
      },
    ],
  }
}

function resetExerciseState() {
  jamPlaybackStop()
  clearJamExercise()
  setJamExerciseLoop(false)
  setJamPitchHistory({})
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('selectJamExercise', () => {
  beforeEach(resetExerciseState)

  it('sets the melody signal', () => {
    const melody = makeMelody()
    selectJamExercise(melody)
    expect(jamExerciseMelody()).toBe(melody)
  })

  it('computes totalBeats from the melody items', () => {
    const melody = makeMelody(120, 8)
    selectJamExercise(melody)
    // max(startBeat + duration): 4 + 4 = 8
    expect(jamExerciseTotalBeats()).toBe(8)
  })

  it('resets playback state to initial values', () => {
    const melody = makeMelody()
    selectJamExercise(melody)
    setJamExerciseBeat(3)
    setJamExercisePlaying(true)

    // Selecting a new exercise resets everything
    selectJamExercise(makeMelody(140, 16))
    expect(jamExerciseBeat()).toBe(0)
    expect(jamExercisePlaying()).toBe(false)
    expect(jamExercisePaused()).toBe(false)
    expect(jamExerciseNoteIndex()).toBe(-1)
  })

  it('handles melodies with only rest items gracefully', () => {
    const restMelody: MelodyData = {
      id: 'rest-only',
      name: 'Rest Melody',
      bpm: 120,
      key: 'C',
      scaleType: 'major',
      createdAt: 0,
      updatedAt: 0,
      items: [
        {
          id: nextId(),
          startBeat: 0,
          duration: 4,
          isRest: true,
          note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
        },
      ],
    }
    selectJamExercise(restMelody)
    expect(jamExerciseTotalBeats()).toBe(4)
    expect(jamExerciseMelody()).toBe(restMelody)
  })
})

describe('jamPlaybackPlay', () => {
  beforeEach(resetExerciseState)

  it('sets playing=true and paused=false', () => {
    selectJamExercise(makeMelody())
    jamPlaybackPlay()
    expect(jamExercisePlaying()).toBe(true)
    expect(jamExercisePaused()).toBe(false)
  })

  it('starts with a 4-beat count-in by default (beat = -4)', () => {
    selectJamExercise(makeMelody())
    jamPlaybackPlay()
    expect(jamExerciseBeat()).toBe(-4)
  })

  it('respects an explicit startBeat argument', () => {
    selectJamExercise(makeMelody())
    jamPlaybackPlay(2)
    expect(jamExerciseBeat()).toBe(2)
  })
})

describe('jamPlaybackPause', () => {
  beforeEach(resetExerciseState)

  it('sets paused=true; playing remains true (paused, not stopped)', () => {
    selectJamExercise(makeMelody())
    jamPlaybackPlay()
    jamPlaybackPause()
    expect(jamExercisePaused()).toBe(true)
    expect(jamExercisePlaying()).toBe(true)
  })
})

describe('jamPlaybackStop', () => {
  beforeEach(resetExerciseState)

  it('resets all playback signals to initial state', () => {
    selectJamExercise(makeMelody())
    jamPlaybackPlay()
    setJamExerciseBeat(5)

    jamPlaybackStop()
    expect(jamExercisePlaying()).toBe(false)
    expect(jamExercisePaused()).toBe(false)
    expect(jamExerciseBeat()).toBe(0)
    expect(jamExerciseNoteIndex()).toBe(-1)
  })
})

describe('jamPlaybackSeek', () => {
  beforeEach(resetExerciseState)

  it('sets the beat to the requested position', () => {
    selectJamExercise(makeMelody())
    jamPlaybackSeek(3.5)
    expect(jamExerciseBeat()).toBe(3.5)
  })
})

describe('clearJamExercise', () => {
  beforeEach(resetExerciseState)

  it('clears the melody and resets all exercise state', () => {
    selectJamExercise(makeMelody())
    jamPlaybackPlay()
    setJamExerciseBeat(4)

    clearJamExercise()
    expect(jamExerciseMelody()).toBeNull()
    expect(jamExerciseTotalBeats()).toBe(0)
    expect(jamExercisePlaying()).toBe(false)
    expect(jamExercisePaused()).toBe(false)
    expect(jamExerciseBeat()).toBe(0)
    expect(jamExerciseNoteIndex()).toBe(-1)
  })
})

describe('jamExerciseLoop', () => {
  it('defaults to false', () => {
    setJamExerciseLoop(false)
    expect(jamExerciseLoop()).toBe(false)
  })

  it('can be toggled on and off', () => {
    setJamExerciseLoop(true)
    expect(jamExerciseLoop()).toBe(true)
    setJamExerciseLoop(false)
    expect(jamExerciseLoop()).toBe(false)
  })
})

describe('auto-stop: beat resets to 0 after end', () => {
  // The rAF timer is mocked as a no-op, so we simulate the auto-stop
  // branch manually to verify the intended end state.

  beforeEach(resetExerciseState)

  it('after stop, beat is 0 not at end-of-melody position', () => {
    selectJamExercise(makeMelody(120, 8))
    jamPlaybackPlay()
    setJamExerciseBeat(8) // simulate reaching the end

    jamPlaybackStop()

    expect(jamExerciseBeat()).toBe(0)
    expect(jamExercisePlaying()).toBe(false)
  })
})

// ── Pitch history windowing ───────────────────────────────────────────

describe('jamPitchHistory signal', () => {
  beforeEach(() => {
    setJamPitchHistory({})
  })

  it('stores samples under the correct peer ID', () => {
    const sample = {
      frequency: 440,
      noteName: 'A4',
      cents: 0,
      clarity: 0.9,
      midi: 69,
      timestamp: Date.now(),
    }
    setJamPitchHistory({ 'peer-1': [sample] })
    expect(jamPitchHistory()['peer-1']).toHaveLength(1)
    expect(jamPitchHistory()['peer-1']![0]!.frequency).toBe(440)
  })

  it('caps at 600 samples via the trim logic used in the store', () => {
    const now = Date.now()
    const MAX = 600
    const arr = Array.from({ length: 605 }, (_, i) => ({
      frequency: 440,
      noteName: 'A4',
      cents: 0,
      clarity: 0.9,
      midi: 69,
      timestamp: now + i,
    }))
    // Apply the same trim that startJamPitchDetection does
    if (arr.length > MAX) arr.splice(0, arr.length - MAX)
    setJamPitchHistory({ 'peer-1': arr })
    expect(jamPitchHistory()['peer-1']!.length).toBeLessThanOrEqual(MAX)
  })

  it('supports multiple peers independently', () => {
    setJamPitchHistory({
      alice: [
        {
          frequency: 440,
          noteName: 'A4',
          cents: 0,
          clarity: 0.9,
          midi: 69,
          timestamp: 1,
        },
      ],
      bob: [
        {
          frequency: 523,
          noteName: 'C5',
          cents: 5,
          clarity: 0.8,
          midi: 72,
          timestamp: 2,
        },
      ],
    })
    expect(jamPitchHistory()['alice']).toHaveLength(1)
    expect(jamPitchHistory()['bob']).toHaveLength(1)
    expect(jamPitchHistory()['alice']![0]!.noteName).toBe('A4')
    expect(jamPitchHistory()['bob']![0]!.noteName).toBe('C5')
  })
})
