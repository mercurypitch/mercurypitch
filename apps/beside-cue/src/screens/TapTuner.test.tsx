// ============================================================
// TapTuner on a fake shared clock: the ticks it puts on the audio
// clock come off it when the tuner goes away, without a click.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JOURNEY_CONFIG } from '@/games/glass/journey-config'

const audio = vi.hoisted(() => {
  const oscillators: Array<{
    frequency: { value: number }
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }> = []
  const gains: Array<{
    gain: {
      value: number
      setValueAtTime: ReturnType<typeof vi.fn>
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
      cancelScheduledValues: ReturnType<typeof vi.fn>
      setTargetAtTime: ReturnType<typeof vi.fn>
    }
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }> = []
  const ctx = {
    currentTime: 5,
    destination: { kind: 'destination' },
    createOscillator: () => {
      const osc = {
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(osc)
      return osc
    },
    createGain: () => {
      const gain = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
          setTargetAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(gain)
      return gain
    },
  }
  const lease = {
    ensure: () => ctx,
    unlock: () => Promise.resolve(true),
    peek: () => ctx,
    release: vi.fn(),
  }
  return { ctx, lease, oscillators, gains }
})

vi.mock('@/audio/shared-audio-context', () => ({
  acquireSharedAudioContext: () => audio.lease,
}))

import { TapTuner } from './TapTuner'

beforeEach(() => {
  vi.useFakeTimers()
  audio.oscillators.length = 0
  audio.gains.length = 0
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TapTuner', () => {
  it('takes the ticks off the clock when the tuner goes away', async () => {
    render(() => <TapTuner onSaved={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start the ticks' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(audio.oscillators).toHaveLength(JOURNEY_CONFIG.tap.calBeats)
    // The bus is made first: the ticks hang off it, it hangs off the output.
    const bus = audio.gains[0]
    expect(bus.connect).toHaveBeenCalledWith(audio.ctx.destination)
    for (const tick of audio.gains.slice(1)) {
      expect(tick.connect).toHaveBeenCalledWith(bus)
    }

    cleanup()
    // Anchor, then decay, then every tick stops after the tail -- sixteen
    // ticks used to play on for eleven seconds over the next screen.
    expect(bus.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 5)
    expect(bus.gain.setTargetAtTime).toHaveBeenCalledWith(0, 5, 0.012)
    for (const osc of audio.oscillators) {
      expect(osc.stop).toHaveBeenLastCalledWith(5.08)
    }
    expect(bus.disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(bus.disconnect).toHaveBeenCalledTimes(1)
    expect(audio.lease.release).toHaveBeenCalled()
  })
})
