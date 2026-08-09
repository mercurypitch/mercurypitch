// ============================================================
// Legacy Piano performance adapter tests — preserve beat truth and delegation
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { FallingNote, GameState } from '@/stores/falling-notes-store'
import { createLegacyPianoPerformanceAdapter } from './createLegacyPianoPerformanceAdapter'

const NOTES: FallingNote[] = [
  {
    id: 1,
    midi: 63,
    name: 'D#4',
    startBeat: 3.25,
    duration: 1.5,
    targetFreq: 311.13,
  },
]

function legacyController(
  initialState: GameState = 'idle',
  notes: FallingNote[] = NOTES,
) {
  let state = initialState
  const pauseGame = vi.fn(() => {
    if (state === 'playing') state = 'paused'
  })
  const resetGame = vi.fn(() => {
    state = 'idle'
  })
  const resumeGame = vi.fn(() => {
    if (state === 'paused') state = 'playing'
  })
  const seekToBeat = vi.fn()
  const setBpm = vi.fn()
  const setPianoCurrentCycle = vi.fn()
  const setSpeed = vi.fn()
  const startGame = vi.fn(async () => {
    state = 'playing'
  })

  return {
    value: {
      currentSongBpm: () => 96.5,
      gameState: () => state,
      pauseGame,
      playheadBeat: () => 12.25,
      resetGame,
      resumeGame,
      seekToBeat,
      setBpm,
      setPianoCurrentCycle,
      setSpeed,
      songNotes: () => notes,
      speed: () => 0.75,
      startGame,
      totalBeats: () => 41.5,
    },
    pauseGame,
    resetGame,
    resumeGame,
    seekToBeat,
    setBpm,
    setPianoCurrentCycle,
    setSpeed,
    startGame,
  }
}

describe('createLegacyPianoPerformanceAdapter', () => {
  it('exposes the legacy stage and exact beat timeline without another clock', () => {
    const legacy = legacyController()
    let title = 'Nocturne in E-flat Major'
    const performance = createLegacyPianoPerformanceAdapter(legacy.value, {
      title: () => title,
    })

    expect(performance.stage.title()).toBe('Nocturne in E-flat Major')
    title = 'Afterglow Study'
    expect(performance.stage.title()).toBe('Afterglow Study')
    expect(performance.stage.notes()).toBe(NOTES)
    expect(performance.stage.timeline).toBe(performance.transport.timeline)
    expect(performance.transport.timeline.playheadBeat()).toBe(12.25)
    expect(performance.transport.timeline.totalBeats()).toBe(41.5)
    expect(performance.transport.timeline.tempoBpm()).toBe(96.5)
    expect(performance.transport.speed()).toBe(0.75)
  })

  it.each([
    ['idle', 'ready'],
    ['countdown', 'count-in'],
    ['playing', 'playing'],
    ['paused', 'paused'],
    ['finished', 'complete'],
  ] as const)('maps legacy %s to %s', (legacyState, expectedPhase) => {
    const legacy = legacyController(legacyState)
    const performance = createLegacyPianoPerformanceAdapter(legacy.value, {
      title: () => 'Study',
    })

    expect(performance.transport.phase()).toBe(expectedPhase)
  })

  it('resumes a paused run without resetting its cycle or starting fresh', async () => {
    const legacy = legacyController('paused')
    const performance = createLegacyPianoPerformanceAdapter(legacy.value, {
      title: () => 'Study',
    })

    await expect(performance.transport.play()).resolves.toBe(true)
    expect(legacy.resumeGame).toHaveBeenCalledOnce()
    expect(legacy.setPianoCurrentCycle).not.toHaveBeenCalled()
    expect(legacy.startGame).not.toHaveBeenCalled()
    expect(performance.transport.phase()).toBe('playing')
  })

  it.each(['idle', 'finished'] as const)(
    'resets the cycle before fresh Play from %s',
    async (state) => {
      const legacy = legacyController(state)
      const performance = createLegacyPianoPerformanceAdapter(legacy.value, {
        title: () => 'Study',
      })

      await expect(performance.transport.play()).resolves.toBe(true)
      expect(legacy.setPianoCurrentCycle).toHaveBeenCalledOnce()
      expect(legacy.setPianoCurrentCycle).toHaveBeenCalledWith(1)
      expect(legacy.startGame).toHaveBeenCalledOnce()
      expect(legacy.resumeGame).not.toHaveBeenCalled()
    },
  )

  it.each(['playing', 'countdown'] as const)(
    'leaves an active %s run on its existing clock',
    async (state) => {
      const legacy = legacyController(state)
      const performance = createLegacyPianoPerformanceAdapter(legacy.value, {
        title: () => 'Study',
      })

      await expect(performance.transport.play()).resolves.toBe(true)
      expect(legacy.resumeGame).not.toHaveBeenCalled()
      expect(legacy.setPianoCurrentCycle).not.toHaveBeenCalled()
      expect(legacy.startGame).not.toHaveBeenCalled()
    },
  )

  it('delegates transport commands with exact beat, tempo and speed values', () => {
    const legacy = legacyController('playing')
    const performance = createLegacyPianoPerformanceAdapter(legacy.value, {
      title: () => 'Study',
    })

    performance.transport.seekToBeat(7.875)
    performance.transport.setTempoBpm(111.25)
    performance.transport.setSpeed(0.625)
    performance.transport.pause()
    performance.transport.stop()

    expect(legacy.seekToBeat).toHaveBeenCalledWith(7.875)
    expect(legacy.setBpm).toHaveBeenCalledWith(111.25)
    expect(legacy.setSpeed).toHaveBeenCalledWith(0.625)
    expect(legacy.pauseGame).toHaveBeenCalledOnce()
    expect(legacy.resetGame).toHaveBeenCalledOnce()
  })

  it('reports when the legacy source has no playable notes', async () => {
    const legacy = legacyController('idle', [])
    const performance = createLegacyPianoPerformanceAdapter(legacy.value, {
      title: () => 'Empty',
    })

    await expect(performance.transport.play()).resolves.toBe(false)
    expect(legacy.setPianoCurrentCycle).toHaveBeenCalledWith(1)
    expect(legacy.startGame).toHaveBeenCalledOnce()
  })
})
