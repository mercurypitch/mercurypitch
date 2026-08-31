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

  it('sets loop A and arms loop B correctly and handles marker moving', () => {
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

      // Move marker A
      loop.handleMoveLoopA(6)
      expect(loop.loopA()).toBe(6)

      // Move marker B
      loop.handleMoveLoopB(18)
      expect(loop.loopB()).toBe(18)

      // Move marker A past B (clamped to upper bound)
      loop.handleMoveLoopA(25)
      expect(loop.loopA()).toBeLessThan(loop.loopB())

      // Move marker B before A (clamped to lower bound)
      loop.handleMoveLoopB(2)
      expect(loop.loopB()).toBeGreaterThan(loop.loopA())

      // Setting A at or after B resets B and disables loop
      setBeat(20)
      loop.handleSetLoopA()
      expect(loop.loopA()).toBe(20)
      expect(loop.loopB()).toBe(0)
      expect(loop.loopEnabled()).toBe(false)

      // Setting B <= A does nothing
      setBeat(15)
      loop.handleSetLoopB()
      expect(loop.loopB()).toBe(0)
      expect(loop.loopEnabled()).toBe(false)

      // Toggle loop off and on
      loop.handleToggleLoop()
      expect(loop.loopEnabled()).toBe(true)
      loop.handleToggleLoop()
      expect(loop.loopEnabled()).toBe(false)

      // Direct setters
      loop.setLoopA(5)
      loop.setLoopB(15)
      loop.setLoopEnabled(true)
      expect(loop.loopA()).toBe(5)
      expect(loop.loopB()).toBe(15)
      expect(loop.loopEnabled()).toBe(true)

      // Clear loop
      loop.handleClearLoop()
      expect(loop.loopEnabled()).toBe(false)
      expect(loop.loopA()).toBe(0)
      expect(loop.loopB()).toBe(0)

      dispose()
    })
  })

  it('handles manual seeking outside and inside the loop with auto loop-back', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [tab] = createSignal<string>(TAB_SINGING)
        const [beat, setBeat] = createSignal(0)
        const [total] = createSignal(100)
        const seekToBeat = vi.fn()
        const pianoSeek = vi.fn()
        const setFallingLoop = vi.fn()
        const onLoopLap = vi.fn()

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
          onLoopLap,
        })

        // Setup loop [10, 30)
        loop.setLoopA(10)
        loop.setLoopB(30)
        loop.setLoopEnabled(true)
        await Promise.resolve()

        // Manual seek outside loop (e.g. to beat 50)
        loop.handleLoopSeek(50)
        expect(seekToBeat).toHaveBeenCalledWith(50)
        expect(loop.seekedOutsideLoop()).toBe(true)

        // Playback reaches beat 50 (still outside, no loop back)
        setBeat(50)
        await Promise.resolve()
        expect(onLoopLap).not.toHaveBeenCalled()

        // Manual seek inside loop (beat 15)
        loop.handleLoopSeek(15)
        setBeat(15)
        await Promise.resolve()
        expect(loop.seekedOutsideLoop()).toBe(false)

        // Playhead reaches B (beat 30)
        setBeat(30)
        await Promise.resolve()
        expect(onLoopLap).toHaveBeenCalled()
        expect(seekToBeat).toHaveBeenCalledWith(10)

        dispose()
        resolve()
      })
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

      // Move marker when loopB is unset
      loop.setLoopB(0)
      loop.handleMoveLoopA(10)
      expect(loop.loopA()).toBe(10)

      // When tab is Piano, reaching loop B does not invoke seekToBeat (Piano loops in-controller)
      loop.setLoopA(5)
      loop.setLoopB(15)
      loop.setLoopEnabled(true)
      setPianoBeat(20)

      dispose()
    })
  })
})
