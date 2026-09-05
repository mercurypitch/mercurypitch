// ============================================================
// TapCheck: the pad starts eight clicks on the audio clock and arms
// the ledger from the same instant; taps are stamped by their own
// event time; the take is summarised against the beat grid with the
// round trip taken off, and the copy says so.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { TapCheck } from './TapCheck'

vi.mock('@/lib/audio-unlock', () => ({ unlockAudio: vi.fn() }))

const param = () => ({
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn(),
})
const ctx = {
  currentTime: 2,
  destination: {},
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: param(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  })),
  createGain: vi.fn(() => ({
    gain: param(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}
const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ctx,
  getVolume: () => 0.5,
}

function Rack(props: { children: JSX.Element }): JSX.Element {
  return (
    <EngineContext.Provider
      value={{
        audioEngine: engine as unknown as AudioEngine,
        playbackRuntime: {} as PlaybackRuntime,
        practiceEngine: {} as PracticeEngine,
        ready: () => true,
      }}
    >
      {props.children}
    </EngineContext.Provider>
  )
}

/** A tap stamped at a chosen page time, the way a real pointer event is. */
function tapAt(pad: HTMLElement, atMs: number): void {
  const event = new MouseEvent('pointerdown', { bubbles: true, button: 0 })
  Object.defineProperty(event, 'timeStamp', { value: atMs })
  fireEvent(pad, event)
}

beforeEach(() => {
  vi.clearAllMocks()
  // performance is faked too, so the ledger's origin is exactly
  // computable from the test's own clock.
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
    ],
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TapCheck', () => {
  it('starts the clicks on the first press, counts taps, and reports where they landed', async () => {
    render(() => (
      <Rack>
        <TapCheck />
      </Rack>
    ))
    const pad = screen.getByTestId('ear-tap-pad')
    expect(pad.textContent).toContain('Tap check')
    expect(screen.getByText(/Press the pad to start eight clicks/)).toBeTruthy()

    const pressedAt = performance.now()
    tapAt(pad, pressedAt)
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.init).toHaveBeenCalledTimes(1)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(8)
    expect(pad.textContent).toContain('Tap')
    expect(screen.getByText('Tap with the clicks.')).toBeTruthy()

    // The first click is scheduled 600 ms after the press; taps are
    // measured from there. Three taps: +10, -5, +25 ms off their beats.
    const origin = pressedAt + 600
    tapAt(pad, origin + 10)
    tapAt(pad, origin + 600 - 5)
    tapAt(pad, origin + 1200 + 25)
    expect(screen.getByText(/3 so far/)).toBeTruthy()

    await vi.advanceTimersByTimeAsync(600 + 7 * 600 + 300 + 5)
    const reading = screen.getByText(/Mean/).textContent ?? ''
    expect(reading).toContain('Mean +10 ms (late)')
    expect(reading).toContain('3 of 8 clicks met')
    expect(reading).toContain('Round trip unmeasured')
    expect(pad.textContent).toContain('Again')
  })

  it('says so when no tap met a click', async () => {
    render(() => (
      <Rack>
        <TapCheck />
      </Rack>
    ))
    const pad = screen.getByTestId('ear-tap-pad')
    tapAt(pad, performance.now())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(600 + 7 * 600 + 300 + 5)
    expect(screen.getByText(/No tap landed near a click/)).toBeTruthy()
  })
})
