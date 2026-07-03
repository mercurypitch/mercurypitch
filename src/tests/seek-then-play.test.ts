// ============================================================
// Seek-then-play regression tests (piano + guitar controllers).
// Clicking the progress bar while stopped, then pressing Play,
// used to snap the playhead back to 0 — the seeked position is
// now consumed as the start position.
// ============================================================

import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { useGuitarPracticeController } from '@/features/guitar-practice/useGuitarPracticeController'
import type { AudioEngine } from '@/lib/audio-engine'
import type { FallingNote } from '@/stores/falling-notes-store'
import { setCountIn } from '@/stores/transport-store'

const mockAudioEngine = () =>
  ({
    init: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    getSampleRate: () => 44100,
    getBufferSize: () => 2048,
    getTimeData: () => new Float32Array(2048),
    playMetronomeClick: () => {},
    playClick: () => {},
    playNote: () => {},
    stopTone: () => {},
    isMicActive: () => false,
    audioCtx: null,
  }) as unknown as AudioEngine

const pianoNotes: FallingNote[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  midi: 60 + (i % 12),
  name: 'C4',
  startBeat: i,
  duration: 1,
  targetFreq: 261.6,
}))

// NOTE: the guitar controller's startGame() reads fallingNotes(), which is
// derived from baseNotes in a createEffect — and Solid effects do not fire
// inside createRoot in vitest/jsdom (see exercise-recursion-repro.test.ts).
// The guitar path shares the exact pending-seek pattern tested here for the
// piano controller and is verified live in the browser instead.

describe('piano: seek while stopped then play', () => {
  it('startGame begins at the seeked beat instead of 0', async () => {
    await createRoot(async (dispose) => {
      setCountIn(0)
      const ctl = useFallingNotesController(mockAudioEngine())
      ctl.loadSong(pianoNotes, 'Seek Test', 120)
      ctl.seekToBeat(8)
      await ctl.startGame()
      expect(ctl.gameState()).toBe('playing')
      // The rAF loop may tick between start and assert — allow drift forward.
      expect(ctl.playheadBeat()).toBeGreaterThanOrEqual(7.5)
      expect(ctl.playheadBeat()).toBeLessThan(10)
      dispose()
    })
  })

  it('stop clears the pending position: play starts from 0 again', async () => {
    await createRoot(async (dispose) => {
      setCountIn(0)
      const ctl = useFallingNotesController(mockAudioEngine())
      ctl.loadSong(pianoNotes, 'Seek Test', 120)
      ctl.seekToBeat(8)
      ctl.resetGame()
      await ctl.startGame()
      expect(ctl.playheadBeat()).toBeLessThan(2)
      dispose()
    })
  })
})

describe('guitar: seek while stopped', () => {
  it('seekToBeat while idle moves the playhead and stop resets it', () => {
    createRoot((dispose) => {
      setCountIn(0)
      const ctl = useGuitarPracticeController(mockAudioEngine())
      ctl.loadSong(
        Array.from({ length: 16 }, (_, i) => ({
          midi: 52 + (i % 12),
          startBeat: i,
          duration: 1,
        })),
        'Seek Test',
        120,
      )
      ctl.seekToBeat(8)
      expect(ctl.playheadBeat()).toBe(8)
      ctl.stopGame()
      expect(ctl.playheadBeat()).toBe(0)
      dispose()
    })
  })
})
