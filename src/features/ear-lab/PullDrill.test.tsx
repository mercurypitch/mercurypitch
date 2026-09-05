// ============================================================
// PullDrill on a fake engine: the cadence plants the key, the two
// degrees sound in a coin-flipped order with the beam level, the
// answer names the leaning degree, and a miss replays the lean and
// its resolution.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { PULL_TIMING, REVEAL_HOLD } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { PullDrill } from './PullDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// Always the first pair — Ti against Do.
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) => bank[0],
  }
})

const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ({ currentTime: 1 }),
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  playTone: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  playChord: vi.fn().mockResolvedValue(undefined),
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

const status = () => screen.getByTestId('ear-stage-status').textContent ?? ''
const beam = () => document.querySelector('svg[data-instrument="beam"]')
const CADENCE =
  4 * (PULL_TIMING.chordMs + PULL_TIMING.chordGapMs) + PULL_TIMING.restMs
const PROBES =
  2 * PULL_TIMING.probeMs + PULL_TIMING.probeGapMs + PULL_TIMING.tailMs

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** random → 0.3 keeps the bank's order: Ti first, Do second. */
async function beginAndListen(): Promise<void> {
  vi.spyOn(Math, 'random').mockReturnValue(0.3)
  render(() => (
    <Stage>
      <PullDrill onBack={vi.fn()} />
    </Stage>
  ))
  fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
  await vi.advanceTimersByTimeAsync(0)
  expect(engine.playChord).toHaveBeenCalledTimes(1)
  expect(engine.playTone).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(CADENCE + 10)
  // Four chords planted, the first degree sounding, the beam level.
  expect(engine.playChord).toHaveBeenCalledTimes(4)
  expect(engine.playTone).toHaveBeenCalledTimes(1)
  expect(
    beam()?.querySelector('[data-part="beam"]')?.getAttribute('data-tilt'),
  ).toBe('0')
  expect(
    beam()?.querySelector('[data-side="1"] [data-lit="true"]'),
  ).not.toBeNull()
  // The pad says so too: "The first" carries the lamp while it sounds.
  expect(
    screen.getByRole('button', { name: /The first/ }).getAttribute('data-lamp'),
  ).toBe('on')
  expect(
    screen
      .getByRole('button', { name: /The second/ })
      .getAttribute('data-lamp'),
  ).toBe('off')
  await vi.advanceTimersByTimeAsync(PROBES)
  expect(engine.playTone).toHaveBeenCalledTimes(2)
  expect(status()).toBe('Which note leans harder — the first, or the second?')
}

describe('PullDrill', () => {
  it('plants the key, sounds both degrees with the beam level, then asks', async () => {
    await beginAndListen()
    expect(
      screen
        .getByRole('button', { name: /The first/ })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('the leading tone leans harder: the first is right, and the beam tips to it', async () => {
    await beginAndListen()
    fireEvent.click(screen.getByRole('button', { name: /The first/ }))
    expect(status()).toBe('Yes — the first, Ti leaning to Do′.')
    const tilt = Number(
      beam()?.querySelector('[data-part="beam"]')?.getAttribute('data-tilt'),
    )
    expect(tilt).toBeLessThan(0)
    expect(beam()?.querySelector('[data-part="nameplate"]')?.textContent).toBe(
      'Ti leaning to Do′',
    )
  })

  it('a miss replays the lean and its resolution, then moves on', async () => {
    await beginAndListen()
    fireEvent.click(screen.getByRole('button', { name: /The second/ }))
    expect(status()).toBe(
      'That was the first, Ti leaning to Do′ — listen again.',
    )
    await vi.advanceTimersByTimeAsync(
      PULL_TIMING.replayMs + PULL_TIMING.probeGapMs + 5,
    )
    // Ti, then Do′: two replay tones.
    expect(engine.playTone).toHaveBeenCalledTimes(4)
    // The next round waits for the replay's tail, then the hold.
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 2000)
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'Round 2 of 12',
    )
  })

  it('Stop mid-cadence silences the engine', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3)
    render(() => (
      <Stage>
        <PullDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(PULL_TIMING.chordMs)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(engine.stopTone).toHaveBeenCalled()
    const calls = engine.playTone.mock.calls.length
    await vi.advanceTimersByTimeAsync(CADENCE + PROBES)
    expect(engine.playTone.mock.calls.length).toBe(calls)
  })
})
