// Drum Night loop-range tests — A/B drafts commit once to the route clock.
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { DrumLoopRange, DrumTransportPhase } from './drum-transport'
import { createDrumTransport } from './drum-transport'
import { normalizeDrumLoopRange, snapDrumLoopBeat, useDrumNightLoopRange, } from './useDrumNightLoopRange'

describe('Drum Night loop-range domain', () => {
  it('snaps to sixteenths, preserves beat zero and normalizes crossed input', () => {
    expect(snapDrumLoopBeat(1.13, 8)).toBe(1.25)
    expect(normalizeDrumLoopRange(0, 0.25, 8)).toEqual({
      startBeat: 0,
      endBeat: 0.25,
    })
    expect(normalizeDrumLoopRange(6.1, 2.1, 8)).toEqual({
      startBeat: 2,
      endBeat: 6,
    })
    expect(normalizeDrumLoopRange(2, 99, 8)).toEqual({
      startBeat: 2,
      endBeat: 8,
    })
    expect(normalizeDrumLoopRange(2, 2.1, 8)).toBeNull()
    expect(normalizeDrumLoopRange(0, 1, 0)).toBeNull()
  })

  it('keeps A pending until B activates one transport loop', () => {
    createRoot((dispose) => {
      const [position] = createSignal(7)
      const [currentLoop, setCurrentLoop] = createSignal<DrumLoopRange | null>(
        null,
      )
      const setLoop = vi.fn((next: DrumLoopRange | null) => {
        setCurrentLoop(next)
        return true
      })
      const loop = useDrumNightLoopRange({
        durationBeats: () => 16,
        positionBeats: position,
        phase: () => 'stopped',
        currentLoop,
        setLoop,
        seekSeconds: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      })

      expect(loop.setStart(1.13)).toBe(true)
      expect(loop.markA()).toBe(1.25)
      expect(loop.markB()).toBeNull()
      expect(loop.isPending()).toBe(true)
      expect(setLoop).not.toHaveBeenCalled()

      expect(loop.setEnd(4.62)).toBe(true)
      expect(loop.span()).toEqual({ startBeat: 1.25, endBeat: 4.5 })
      expect(loop.isActive()).toBe(true)
      expect(setLoop).toHaveBeenCalledOnce()
      expect(setLoop).toHaveBeenCalledWith({
        startBeat: 1.25,
        endBeat: 4.5,
      })
      dispose()
    })
  })

  it('publishes marker previews locally and commits the scheduler once', () => {
    createRoot((dispose) => {
      const [currentLoop, setCurrentLoop] = createSignal<DrumLoopRange | null>(
        null,
      )
      const setLoop = vi.fn((next: DrumLoopRange | null) => {
        setCurrentLoop(next)
        return true
      })
      const loop = useDrumNightLoopRange({
        durationBeats: () => 16,
        positionBeats: () => 0,
        phase: () => 'paused',
        currentLoop,
        setLoop,
        seekSeconds: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      })
      expect(loop.setSpan({ startBeat: 2, endBeat: 6 })).toBe(true)
      setLoop.mockClear()

      expect(loop.moveMarkA(3.13)).toBe(true)
      expect(loop.markA()).toBe(3.25)
      expect(setLoop).not.toHaveBeenCalled()
      expect(loop.commitMark('A')).toBe(true)
      expect(setLoop).toHaveBeenCalledOnce()
      expect(setLoop).toHaveBeenCalledWith({
        startBeat: 3.25,
        endBeat: 6,
      })

      setLoop.mockClear()
      expect(loop.moveMarkA(99)).toBe(true)
      expect(loop.markA()).toBe(5.75)
      expect(loop.commitMark('A')).toBe(true)
      expect(setLoop).toHaveBeenCalledOnce()
      dispose()
    })
  })

  it('drops the opposite boundary when a set-at-playhead action crosses it', () => {
    createRoot((dispose) => {
      const [position] = createSignal(4)
      const [currentLoop, setCurrentLoop] = createSignal<DrumLoopRange | null>(
        null,
      )
      const setLoop = vi.fn((next: DrumLoopRange | null) => {
        setCurrentLoop(next)
        return true
      })
      const loop = useDrumNightLoopRange({
        durationBeats: () => 16,
        positionBeats: position,
        phase: () => 'paused',
        currentLoop,
        setLoop,
        seekSeconds: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      })
      loop.setSpan({ startBeat: 2, endBeat: 4 })
      setLoop.mockClear()

      expect(loop.setStart()).toBe(true)
      expect(loop.markA()).toBe(4)
      expect(loop.markB()).toBeNull()
      expect(loop.isPending()).toBe(true)
      expect(setLoop).toHaveBeenCalledOnce()
      expect(setLoop).toHaveBeenCalledWith(null)
      dispose()
    })
  })

  it('enters A through one transport mutation and clears without jumping', () => {
    createRoot((dispose) => {
      const transport = createDrumTransport({
        countInBeats: 0,
        authoredTiming: { tempoBpm: 60, durationBeats: 16 },
      })
      transport.seek(10)
      const beforeCommit = transport.scheduleRevision()
      const loop = useDrumNightLoopRange({
        durationBeats: () => transport.state().authoredDurationBeats ?? 0,
        positionBeats: () => transport.state().positionBeats,
        phase: () => transport.state().phase,
        currentLoop: () => transport.state().loop,
        setLoop: (next) => transport.setLoop(next),
        seekSeconds: (seconds) => transport.seekSeconds(seconds),
        pause: () => transport.pause(),
        resume: () => transport.start(),
      })

      loop.setStart(2)
      loop.setEnd(4)
      expect(transport.state().positionBeats).toBe(2)
      expect(transport.scheduleRevision()).toBe(beforeCommit + 1)

      transport.seek(3)
      loop.clear()
      expect(transport.state().loop).toBeNull()
      expect(transport.state().positionBeats).toBe(3)
      dispose()
    })
  })

  it('pauses once for a running scrub and resumes once when it settles', () => {
    createRoot((dispose) => {
      const [phase, setPhase] = createSignal<DrumTransportPhase>('playing')
      const pause = vi.fn(() => setPhase('paused'))
      const resume = vi.fn(() => setPhase('playing'))
      const seekSeconds = vi.fn()
      const loop = useDrumNightLoopRange({
        durationBeats: () => 16,
        positionBeats: () => 0,
        phase,
        currentLoop: () => null,
        setLoop: () => true,
        seekSeconds,
        pause,
        resume,
      })

      loop.beginScrub()
      loop.beginScrub()
      loop.seekSeconds(1)
      loop.seekSeconds(2)
      loop.endScrub()
      loop.endScrub()

      expect(pause).toHaveBeenCalledOnce()
      expect(seekSeconds.mock.calls).toEqual([[1], [2]])
      expect(resume).toHaveBeenCalledOnce()
      expect(loop.isScrubbing()).toBe(false)
      dispose()
    })
  })

  it('does not start transport after a scrub that began paused', () => {
    createRoot((dispose) => {
      const pause = vi.fn()
      const resume = vi.fn()
      const loop = useDrumNightLoopRange({
        durationBeats: () => 16,
        positionBeats: () => 0,
        phase: () => 'paused',
        currentLoop: () => null,
        setLoop: () => true,
        seekSeconds: vi.fn(),
        pause,
        resume,
      })

      loop.beginScrub()
      loop.endScrub()
      expect(pause).not.toHaveBeenCalled()
      expect(resume).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('restores the committed range when the transport rejects an edit', () => {
    createRoot((dispose) => {
      const [currentLoop, setCurrentLoop] = createSignal<DrumLoopRange | null>(
        null,
      )
      let accept = true
      const setLoop = vi.fn((next: DrumLoopRange | null) => {
        if (!accept) return false
        setCurrentLoop(next)
        return true
      })
      const loop = useDrumNightLoopRange({
        durationBeats: () => 16,
        positionBeats: () => 0,
        phase: () => 'paused',
        currentLoop,
        setLoop,
        seekSeconds: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      })
      loop.setSpan({ startBeat: 2, endBeat: 6 })
      accept = false

      loop.moveMarkA(3)
      expect(loop.commitMark()).toBe(false)
      expect(loop.markA()).toBe(2)
      expect(loop.markB()).toBe(6)
      dispose()
    })
  })
})
