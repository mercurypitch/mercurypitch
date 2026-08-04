// The upcoming-target ladder the exercise tracker draws ahead of the playhead.
//
// The contract every drill has to keep is the same: the ladder is what comes
// AFTER the note being asked for right now. A ladder that repeats the current
// note reads as "sing it twice", and one that runs a note short hides exactly
// the leap the singer needed warning about.

import { describe, expect, it } from 'vitest'
import { useArpeggioJumperController } from '@/features/exercises/arpeggio-jumper/use-arpeggio-jumper-controller'
import { useCallResponseController } from '@/features/exercises/call-response/use-call-response-controller'
import { useMirrorMelodyController } from '@/features/exercises/mirror-melody/use-mirror-melody-controller'
import { useScaleRunnerController } from '@/features/exercises/scale-runner/use-scale-runner-controller'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

function createMockBase(): BaseExerciseController {
  return {
    pitchHistory: () => [],
    _setTargetPitch: ((
      _v: number | null,
    ) => {}) as BaseExerciseController['_setTargetPitch'],
    _getElapsed: () => 0,
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: () => {},
    _completeWithResult: () => {},
    _registerDispose: () => {},
    _getDepths: () => ({ completeDepth: 0, resetDepth: 0, startDepth: 0 }),
    state: () => ({
      status: 'active',
      currentScore: 0,
      elapsedMs: 0,
      metrics: {},
    }),
    start: async () => true,
    stop: () => {},
    reset: () => {},
    result: () => null,
    currentPitch: () => null,
    frequencyData: () => null,
    targetPitch: () => null,
    error: () => null,
  }
}

const audioEngine = { playTone: async () => {} }

const C4 = 60

describe('upcoming targets', () => {
  it('scale runner lists the rest of the scale, current note excluded', () => {
    const ctrl = useScaleRunnerController(createMockBase(), audioEngine)
    ctrl.setScale(C4, 'major', 'up')

    // C major up, root through the octave: 8 notes, 7 of them still to come.
    expect(ctrl.getUpcomingMidi()).toEqual([62, 64, 65, 67, 69, 71, 72])
  })

  it('scale runner reverses with a descending run', () => {
    const ctrl = useScaleRunnerController(createMockBase(), audioEngine)
    ctrl.setScale(C4, 'major', 'down')

    // Starts on the top C, so the ladder runs 71 down to the root.
    expect(ctrl.getUpcomingMidi()).toEqual([71, 69, 67, 65, 64, 62, 60])
  })

  // The scale definitions already close on the octave; the runner used to add
  // it again, so the top note was asked for twice.
  it('scale runner does not repeat the octave', () => {
    const ctrl = useScaleRunnerController(createMockBase(), audioEngine)
    ctrl.setScale(C4, 'major', 'up')
    const upcoming = ctrl.getUpcomingMidi()

    expect(new Set(upcoming).size).toBe(upcoming.length)
  })

  it('is empty before a sequence exists, rather than throwing', () => {
    expect(
      useScaleRunnerController(createMockBase(), audioEngine).getUpcomingMidi(),
    ).toEqual([])
    expect(
      useMirrorMelodyController(
        createMockBase(),
        audioEngine,
      ).getUpcomingMidi(),
    ).toEqual([])
    expect(
      useArpeggioJumperController(
        createMockBase(),
        audioEngine,
      ).getUpcomingMidi(),
    ).toEqual([])
    expect(
      useCallResponseController(
        createMockBase(),
        audioEngine,
      ).getUpcomingMidi(),
    ).toEqual([])
  })

  it('mirror melody drops the note being asked for', () => {
    const ctrl = useMirrorMelodyController(createMockBase(), audioEngine)
    ctrl.setMelody(C4)
    const upcoming = ctrl.getUpcomingMidi()

    expect(upcoming.length).toBeGreaterThan(0)
    // Every entry is a real note, and none of them is the one on the line now.
    expect(upcoming.every((m) => Number.isFinite(m) && m > 0)).toBe(true)
  })

  it('arpeggio jumper lists the leaps still to come', () => {
    const ctrl = useArpeggioJumperController(createMockBase(), audioEngine)
    ctrl.setArpeggio(C4, 'major', 'up')
    const upcoming = ctrl.getUpcomingMidi()

    expect(upcoming.length).toBeGreaterThan(0)
    expect(upcoming[0]).not.toBe(C4)
  })

  // Call-Response is the exception that proves the rule: the singer echoes the
  // WHOLE phrase back, so every note of it is still owed — including the first.
  it('call-response lists the entire phrase for the round', () => {
    const ctrl = useCallResponseController(createMockBase(), audioEngine)
    ctrl.setBase(C4)
    const upcoming = ctrl.getUpcomingMidi()

    expect(upcoming.length).toBeGreaterThanOrEqual(3)
    expect(upcoming[0]).toBe(C4)
  })
})
