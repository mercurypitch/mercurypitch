// ============================================================
// PulseDrill on a fake engine: Begin schedules the count-in, the
// call and the wait rail on the audio clock, the answer opens a
// breath before the call ends, the first tap anchors the take
// wherever the player places it — Space as well as the pointer —
// and the reveal writes the call and the take on the drum: clean
// when every onset is met, garnet where one was missed, and a bar
// nobody started judged as never begun.
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

/** Begin, and run the clock to the downbeat after the call — the
 *  moment the open bar starts waiting for its anchor. */
async function beginAndListen(): Promise<{ origin: number; pad: HTMLElement }> {
  const t0 = performance.now()
  fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
  await vi.advanceTimersByTimeAsync(0)
  // The count-in keeps the beat (4), the call has 3 onsets, and the
  // wait rail holds 8 more soft beats for the anchor.
  expect(ctx.createOscillator).toHaveBeenCalledTimes(15)
  await vi.advanceTimersByTimeAsync(LEAD)
  expect(status()).toBe('Count-in…')
  await vi.advanceTimersByTimeAsync(BAR)
  expect(status()).toBe('Listen to the call…')
  // The pad arms a breath early, so an eager first tap never dies.
  await vi.advanceTimersByTimeAsync(BAR - PULSE_TIMING.armEarlyMs)
  expect(status()).toBe('Yours — your first tap starts the bar.')
  const pad = screen.getByTestId('ear-tap-pad')
  expect(pad.hasAttribute('disabled')).toBe(false)
  await vi.advanceTimersByTimeAsync(PULSE_TIMING.armEarlyMs)
  return { origin: t0 + LEAD + 2 * BAR, pad }
}

/** How long past the anchor a one-bar take is judged. */
const JUDGE = BAR + 120 + PULSE_TIMING.tailMs + 40

describe('PulseDrill', () => {
  it('says the taps are raw while the round trip is unmeasured', () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    expect(status()).toContain('tap the call back')
    expect(screen.getByText(/first tap anchors the bar/)).toBeTruthy()
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'raw',
    )
  })

  it('anchors the take on the first tap and meets every onset from it', async () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    const before = earPlayerRating('pulse').rating
    const { origin, pad } = await beginAndListen()

    // The anchor lands nowhere near the old grid — half a beat late —
    // and the take is still clean, because the bar is the player's.
    await vi.advanceTimersByTimeAsync(500)
    tapAt(pad, origin + 500)
    expect(status()).toBe('Tapping — 1 so far.')
    // The tap answered with a tick and the bar restarted from it:
    // one tick plus three rail beats past the fifteen from Begin and
    // the arming cue that opened the answer.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(20)
    await vi.advanceTimersByTimeAsync(PERIOD)
    tapAt(pad, origin + 500 + PERIOD - 40)
    await vi.advanceTimersByTimeAsync(PERIOD)
    tapAt(pad, origin + 500 + 2 * PERIOD + 60)
    expect(status()).toBe('Tapping — 3 so far.')

    await vi.advanceTimersByTimeAsync(JUDGE)
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

    // The anchor stands for the first onset; the second tap lands a
    // quarter of a beat late of the second, the third never comes.
    await vi.advanceTimersByTimeAsync(300)
    tapAt(pad, origin + 300)
    await vi.advanceTimersByTimeAsync(PERIOD + 250)
    tapAt(pad, origin + 300 + PERIOD + 250)

    await vi.advanceTimersByTimeAsync(JUDGE)
    expect(status()).toBe('Not quite — 2 onsets missed, 1 extra tap.')
    const drum = screen.getByRole('img', { name: /Rhythm drum/ })
    expect(
      drum.querySelectorAll('[data-part="onset"][data-met="false"]'),
    ).toHaveLength(2)
    expect(drum.querySelectorAll('[data-part="extra"]')).toHaveLength(1)
    expect(earPlayerRating('pulse').rating).toBeLessThan(before)
  })

  it('takes the space bar as a tap, stamped by its own event time', async () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    const { origin } = await beginAndListen()

    await vi.advanceTimersByTimeAsync(400)
    const key = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(key, 'timeStamp', { value: origin + 400 })
    document.body.dispatchEvent(key)
    expect(status()).toBe('Tapping — 1 so far.')
  })

  it('judges a bar nobody started as never begun', async () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    const before = earPlayerRating('pulse').rating
    await beginAndListen()

    await vi.advanceTimersByTimeAsync(
      PULSE_TIMING.waitBeats * PERIOD + PULSE_TIMING.tailMs,
    )
    expect(status()).toBe('No take — the bar came and went untapped.')
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
