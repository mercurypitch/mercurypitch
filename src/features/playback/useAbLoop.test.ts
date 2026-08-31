// ============================================================
// useAbLoop controller tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { TAB_PIANO, TAB_SINGING } from '@/features/tabs/constants'
import { useAbLoop } from './useAbLoop'

describe('useAbLoop', () => {
  it('initializes with loop disabled and zeroes for A and B', () => {
    createRoot((dispose) => {
      const [tab] = createSignal<string>(TAB_SINGING)
      const [beat] = createSignal(0)
      const [total] = createSignal(100)
      const seekToBeat = vi.fn()
      const pianoSeek = vi.fn()
      const setFallingLoop = vi.fn()

      const loop = useAbLoop({
        activeTab: tab,
        currentBeat: beat,
        totalBeats: total,
        seekToBeat,
        pianoTransport: {
          playheadBeat: () => 0,
          totalBeats: () => 100,
          seekToBeat: pianoSeek,
        },
        fallingNotes: {
          setLoop: setFallingLoop,
        },
      })

      expect(loop.loopEnabled()).toBe(false)
      expect(loop.loopA()).toBe(0)
      expect(loop.loopB()).toBe(0)
      expect(loop.seekedOutsideLoop()).toBe(false)

      dispose()
    })
  })

  it('sets loop A and arms loop B correctly', () => {
    createRoot((dispose) => {
      const [tab] = createSignal<string>(TAB_SINGING)
      const [beat, setBeat] = createSignal(4)
      const [total] = createSignal(100)
      const seekToBeat = vi.fn()
      const pianoSeek = vi.fn()
      const setFallingLoop = vi.fn()

      const loop = useAbLoop({
        activeTab: tab,
        currentBeat: beat,
        totalBeats: total,
        seekToBeat,
        pianoTransport: {
          playheadBeat: () => 0,
          totalBeats: () => 100,
          seekToBeat: pianoSeek,
        },
        fallingNotes: {
          setLoop: setFallingLoop,
        },
      })

      // Set A at beat 4
      loop.handleSetLoopA()
      expect(loop.loopA()).toBe(4)
      expect(loop.loopEnabled()).toBe(false)

      // Move playhead to beat 12 and set B
      setBeat(12)
      loop.handleSetLoopB()
      expect(loop.loopB()).toBe(12)
      expect(loop.loopEnabled()).toBe(true)

      // Toggle loop off and on
      loop.handleToggleLoop()
      expect(loop.loopEnabled()).toBe(false)
      loop.handleToggleLoop()
      expect(loop.loopEnabled()).toBe(true)

      // Clear loop
      loop.handleClearLoop()
      expect(loop.loopEnabled()).toBe(false)
      expect(loop.loopA()).toBe(0)
      expect(loop.loopB()).toBe(0)

      dispose()
    })
  })

  it('routes loop operations to pianoTransport when active tab is Piano', () => {
    createRoot((dispose) => {
      const [tab] = createSignal<string>(TAB_PIANO)
      const [singBeat] = createSignal(0)
      const [pianoBeat, setPianoBeat] = createSignal(8)
      const [total] = createSignal(100)
      const seekToBeat = vi.fn()
      const pianoSeek = vi.fn()
      const setFallingLoop = vi.fn()

      const loop = useAbLoop({
        activeTab: tab,
        currentBeat: singBeat,
        totalBeats: total,
        seekToBeat,
        pianoTransport: {
          playheadBeat: pianoBeat,
          totalBeats: total,
          seekToBeat: pianoSeek,
        },
        fallingNotes: {
          setLoop: setFallingLoop,
        },
      })

      loop.handleSetLoopA()
      expect(loop.loopA()).toBe(8)

      setPianoBeat(20)
      loop.handleSetLoopB()
      expect(loop.loopB()).toBe(20)
      expect(loop.loopEnabled()).toBe(true)

      loop.handleLoopSeek(15)
      expect(pianoSeek).toHaveBeenCalledWith(15)
      expect(seekToBeat).not.toHaveBeenCalled()

      dispose()
    })
  })
})
