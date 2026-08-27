// ============================================================
// PulseDrill on a fake engine: Begin schedules three bars of clicks
// on the audio clock, the answer opens as the call ends, taps are
// stamped by their own event time against the response bar, and the
// reveal writes the call and the take on the drum — clean when every
// onset is met, garnet where one was missed.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { PULSE_TIMING } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { earPlayerRating, resetEarLabStore } from '@/stores/ear-lab-store'
import { PulseDrill } from './PulseDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// Always the first pattern — three quarters — so the test knows the call.
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) => bank[0],
  }
})

const param = () => ({
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
})
const ctx = {
  currentTime: 1,
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
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  stopTone: vi.fn(),
}

function Stage(props: { children: JSX.Element }): JSX.Element {
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

function tapAt(pad: HTMLElement, atMs: number): void {
  const event = new MouseEvent('pointerdown', { bubbles: true, button: 0 })
  Object.defineProperty(event, 'timeStamp', { value: atMs })
  fireEvent(pad, event)
}

const status = () => screen.getByTestId('ear-stage-status').textContent ?? ''
const PERIOD = PULSE_TIMING.periodMs
const BAR = PULSE_TIMING.beats * PERIOD
const LEAD = PULSE_TIMING.leadS * 1000

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
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

/** Begin, and run the clock to the moment the response bar opens. */
async function beginAndListen(): Promise<{ origin: number; pad: HTMLElement }> {
  const t0 = performance.now()
  fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
  await vi.advanceTimersByTimeAsync(0)
  // Count-in and response bars keep the beat (4 + 4), the call has 3 onsets.
  expect(ctx.createOscillator).toHaveBeenCalledTimes(11)
  await vi.advanceTimersByTimeAsync(LEAD)
  expect(status()).toBe('Count-in…')
  await vi.advanceTimersByTimeAsync(BAR)
  expect(status()).toBe('Listen to the call…')
  await vi.advanceTimersByTimeAsync(BAR)
  expect(status()).toBe('Tap it back — now.')
  const pad = screen.getByTestId('ear-tap-pad')
  expect(pad.hasAttribute('disabled')).toBe(false)
  return { origin: t0 + LEAD + 2 * BAR, pad }
}

describe('PulseDrill', () => {
  it('says the taps are raw while the round trip is unmeasured', () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    expect(status()).toContain('tap the call back')
    expect(screen.getByText(/Round trip unmeasured/)).toBeTruthy()
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'raw',
    )
  })

  it('meets every onset of a clean take and writes it on the drum', async () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    const before = earPlayerRating('pulse').rating
    const { origin, pad } = await beginAndListen()

    tapAt(pad, origin + 12)
    tapAt(pad, origin + PERIOD - 8)
    tapAt(pad, origin + 2 * PERIOD + 30)
    expect(status()).toBe('Tap it back — 3 so far.')

    await vi.advanceTimersByTimeAsync(BAR + 100 + PULSE_TIMING.tailMs + 20)
    expect(status()).toBe('Clean — every onset met.')
    const drum = screen.getByRole('img', { name: /Rhythm drum/ })
    expect(drum.querySelectorAll('[data-part="onset"]')).toHaveLength(3)
    expect(
      drum.querySelectorAll('[data-part="onset"][data-met="true"]'),
    ).toHaveLength(3)
    expect(drum.querySelectorAll('[data-part="tap"]')).toHaveLength(3)
    expect(drum.querySelectorAll('[data-part="extra"]')).toHaveLength(0)
    expect(drum.textContent).toContain('Clean')
    expect(earPlayerRating('pulse').rating).toBeGreaterThan(before)

    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    const plate = screen.getByTestId('ear-stage-plate').textContent ?? ''
    expect(plate).toContain('Pulse rating')
    expect(plate).toContain('1 of 1 calls tapped back clean')
  })

  it('marks the missed onsets and the extra tap of a ragged take', async () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    const before = earPlayerRating('pulse').rating
    const { origin, pad } = await beginAndListen()

    // The first onset met, the second late by a quarter of a beat, the
    // third missed altogether.
    tapAt(pad, origin + 5)
    tapAt(pad, origin + PERIOD + 250)

    await vi.advanceTimersByTimeAsync(BAR + 100 + PULSE_TIMING.tailMs + 20)
    expect(status()).toBe('Not quite — 2 onsets missed, 1 extra tap.')
    const drum = screen.getByRole('img', { name: /Rhythm drum/ })
    expect(
      drum.querySelectorAll('[data-part="onset"][data-met="false"]'),
    ).toHaveLength(2)
    expect(drum.querySelectorAll('[data-part="extra"]')).toHaveLength(1)
    expect(earPlayerRating('pulse').rating).toBeLessThan(before)
  })

  it('silences the clicks and ends on the plate when stopped mid-call', async () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(LEAD + BAR + 100)
    expect(status()).toBe('Listen to the call…')
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    expect(screen.getByTestId('ear-stage-plate')).toBeTruthy()
    const oscillators = ctx.createOscillator.mock.results.map(
      (r) => r.value as { stop: ReturnType<typeof vi.fn> },
    )
    expect(oscillators.every((osc) => osc.stop.mock.calls.length === 2)).toBe(
      true,
    )
    // Nothing comes back to life once the scheduled timers would have fired.
    await vi.advanceTimersByTimeAsync(3 * BAR)
    expect(screen.getByTestId('ear-stage-plate')).toBeTruthy()
  })
})
