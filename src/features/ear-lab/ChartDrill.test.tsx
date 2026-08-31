// ============================================================
// ChartDrill on a fake engine: the pattern is written on the drum
// before a single beat sounds, only the count-in and the wait rail
// are scheduled — the chart is read, not heard — and the take runs
// on the same anchor as Pulse's: the first tap starts the bar
// wherever the player places it.
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
import { ChartDrill } from './ChartDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// Always the first pattern — three quarters — so the test knows the chart.
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
const drum = () => screen.getByRole('img', { name: /Rhythm drum/ })
const PERIOD = PULSE_TIMING.periodMs
const COUNT = PULSE_TIMING.beats * PERIOD
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

/** Begin, and run the clock to the downbeat after the count-in. */
async function beginAndRead(): Promise<{ origin: number; pad: HTMLElement }> {
  const t0 = performance.now()
  fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
  await vi.advanceTimersByTimeAsync(0)
  // Only the count-in sounds (4) — the chart is on the paper, not in
  // the speaker, and the bar that follows is silent until it is
  // started.
  expect(ctx.createOscillator).toHaveBeenCalledTimes(4)
  await vi.advanceTimersByTimeAsync(LEAD)
  expect(status()).toBe('Count-in — read the chart…')
  // The pattern is already written on the upper rule.
  expect(drum().querySelectorAll('[data-part="score-onset"]')).toHaveLength(3)
  await vi.advanceTimersByTimeAsync(COUNT - PULSE_TIMING.armEarlyMs)
  expect(status()).toBe('Yours — your first tap starts the bar.')
  const pad = screen.getByTestId('ear-tap-pad')
  expect(pad.hasAttribute('disabled')).toBe(false)
  await vi.advanceTimersByTimeAsync(PULSE_TIMING.armEarlyMs)
  // Nothing plays the first beat for the player any more.
  expect(ctx.createOscillator).toHaveBeenCalledTimes(4)
  expect(drum().textContent).toContain('tap to start')
  return { origin: t0 + LEAD + COUNT, pad }
}

describe('ChartDrill', () => {
  it('shows the chart on the bench before a run', () => {
    render(() => (
      <Stage>
        <ChartDrill onBack={vi.fn()} />
      </Stage>
    ))
    expect(status()).toBe('A written bar over the click — tap it at sight.')
  })

  it('anchors the take on the first tap and reads a clean bar', async () => {
    render(() => (
      <Stage>
        <ChartDrill onBack={vi.fn()} />
      </Stage>
    ))
    const before = earPlayerRating('chart').rating
    const { origin, pad } = await beginAndRead()

    await vi.advanceTimersByTimeAsync(700)
    tapAt(pad, origin + 700)
    expect(status()).toBe('Tapping — 1 so far.')
    await vi.advanceTimersByTimeAsync(PERIOD)
    tapAt(pad, origin + 700 + PERIOD + 50)
    await vi.advanceTimersByTimeAsync(PERIOD)
    tapAt(pad, origin + 700 + 2 * PERIOD - 30)

    await vi.advanceTimersByTimeAsync(
      4 * PERIOD + 120 + PULSE_TIMING.tailMs + 40,
    )
    expect(status()).toBe('Clean — every onset met.')
    expect(drum().querySelectorAll('[data-part="score-onset"]')).toHaveLength(0)
    expect(
      drum().querySelectorAll('[data-part="onset"][data-met="true"]'),
    ).toHaveLength(3)
    expect(drum().querySelectorAll('[data-part="tap"]')).toHaveLength(3)
    // the paper carries a clef and a metre, so the drill's name is
    // only in the spoken label now
    expect(drum().getAttribute('aria-label')).toContain('the chart')
    expect(earPlayerRating('chart').rating).toBeGreaterThan(before)
  })

  it('marks a chart misread against its own anchor', async () => {
    render(() => (
      <Stage>
        <ChartDrill onBack={vi.fn()} />
      </Stage>
    ))
    const before = earPlayerRating('chart').rating
    const { origin, pad } = await beginAndRead()

    // Anchor, then a tap half a beat off the written second onset.
    await vi.advanceTimersByTimeAsync(200)
    tapAt(pad, origin + 200)
    await vi.advanceTimersByTimeAsync(PERIOD + 300)
    tapAt(pad, origin + 200 + PERIOD + 300)

    await vi.advanceTimersByTimeAsync(
      4 * PERIOD + 120 + PULSE_TIMING.tailMs + 40,
    )
    expect(status()).toBe('Not quite — 2 onsets missed, 1 extra tap.')
    expect(earPlayerRating('chart').rating).toBeLessThan(before)
  })
})
