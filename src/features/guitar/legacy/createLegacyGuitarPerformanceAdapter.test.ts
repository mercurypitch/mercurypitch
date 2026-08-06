// Legacy performance-adapter tests protect truthful beat/second mapping and control delegation.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarPracticeController } from '@/features/guitar-practice/useGuitarPracticeController'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { createLegacyGuitarPerformanceAdapter } from './createLegacyGuitarPerformanceAdapter'

const NOTES: readonly GuitarNote[] = [
  {
    id: 'one',
    midi: 64,
    noteName: 'E4',
    stringIndex: 0,
    fret: 0,
    startBeat: 0,
    duration: 1,
    targetFreq: 329.63,
  },
]

function controller(
  state: 'idle' | 'countdown' | 'playing' | 'paused' | 'finished' = 'idle',
) {
  let gameState = state
  const seekToBeat = vi.fn()
  const resumeGame = vi.fn(() => {
    gameState = 'playing'
  })
  const startGame = vi.fn(() => {
    gameState = 'playing'
  })
  return {
    value: {
      fallingNotes: () => NOTES,
      gameState: () => gameState,
      pauseGame: vi.fn(),
      playbackRate: () => 1,
      playheadBeat: () => 12,
      resumeGame,
      seekToBeat,
      setPlaybackRate: vi.fn(),
      selectedSongName: () => 'Midnight Study',
      songBpm: () => 120,
      startGame,
      stopGame: vi.fn(),
      totalBeats: () => 32,
    } as unknown as GuitarPracticeController,
    resumeGame,
    seekToBeat,
    startGame,
  }
}

describe('createLegacyGuitarPerformanceAdapter', () => {
  it('maps the existing beat clock to canonical media seconds', () => {
    const legacy = controller()
    const performance = createLegacyGuitarPerformanceAdapter(legacy.value)

    expect(performance.stage.title()).toBe('Midnight Study')
    expect(performance.stage.notes()).toBe(NOTES)
    expect(performance.transport.timeline.positionSeconds()).toBe(6)
    expect(performance.transport.timeline.durationSeconds()).toBe(16)
    performance.transport.seekSeconds(3.5)
    expect(legacy.seekToBeat).toHaveBeenCalledWith(7)
  })

  it('resumes a paused run instead of resetting it', async () => {
    const legacy = controller('paused')
    const performance = createLegacyGuitarPerformanceAdapter(legacy.value)

    await expect(performance.transport.play()).resolves.toBe(true)
    expect(legacy.resumeGame).toHaveBeenCalledOnce()
    expect(legacy.startGame).not.toHaveBeenCalled()
    expect(performance.transport.phase()).toBe('playing')
  })
})
