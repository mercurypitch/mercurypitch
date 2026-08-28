// ============================================================
// Beat Hunt and Drift on a fake engine: the pairs and the train go
// on the audio clock, the instrument follows the schedule without
// giving the answer away, the pads arm only after the sound, and
// the reveal names what was true.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import { BEAT_TIMING, DRIFT_TIMING, REVEAL_HOLD } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { BeatHuntDrill } from './BeatHuntDrill'
import { DriftDrill } from './DriftDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))

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

const status = () => screen.getByTestId('ear-stage-status').textContent ?? ''
const pad = (name: RegExp) => screen.getByRole('button', { name })

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

describe('BeatHuntDrill', () => {
  const DYAD = BEAT_TIMING.dyadMs
  const LEAD = BEAT_TIMING.leadInS * 1000
  const WHOLE = LEAD + 2 * DYAD + BEAT_TIMING.gapMs + BEAT_TIMING.tailMs

  async function practiceAndListen(): Promise<void> {
    // random → 0.3: the detuned pair comes first.
    vi.spyOn(Math, 'random').mockReturnValue(0.3)
    render(() => (
      <Stage>
        <BeatHuntDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(pad(/Practice run/))
    await vi.advanceTimersByTimeAsync(0)
    // Two pairs, two sines each, all on the clock before anything sounds.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(LEAD + 10)
    const svg = document.querySelector('svg[data-instrument="beat-pendulums"]')
    expect(svg?.getAttribute('aria-label')).toContain('first pair swinging')
    // Nothing on the drawing says which pair is detuned.
    expect(svg?.querySelectorAll('[data-beating="true"]').length).toBe(0)
    await vi.advanceTimersByTimeAsync(DYAD + BEAT_TIMING.gapMs)
    expect(svg?.getAttribute('aria-label')).toContain('second pair swinging')
    await vi.advanceTimersByTimeAsync(
      WHOLE - LEAD - 10 - DYAD - BEAT_TIMING.gapMs,
    )
    expect(status()).toBe('Which pair was beating — the first, or the second?')
    expect(pad(/The first/).hasAttribute('disabled')).toBe(false)
  }

  it('sounds two pairs, keeps the drawing neutral, then arms the pads', async () => {
    await practiceAndListen()
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      '40.0¢',
    )
  })

  it('a right answer names the pair and the beat rate, and hangs the bob out of phase', async () => {
    await practiceAndListen()
    fireEvent.click(pad(/The first/))
    expect(status()).toMatch(
      /^Right — the first pair was beating, [\d.]+ beats a second at 40\.0¢\.$/,
    )
    const svg = document.querySelector('svg[data-instrument="beat-pendulums"]')
    expect(
      svg?.querySelector('[data-pair="1"]')?.getAttribute('data-beating'),
    ).toBe('true')
    expect(svg?.querySelector('[data-part="nameplate"]')?.textContent).toMatch(
      /beats a second/,
    )
  })

  it('a wrong answer widens the detune', async () => {
    await practiceAndListen()
    fireEvent.click(pad(/The second/))
    expect(status()).toMatch(
      /The first pair was beating, .* The detune widens\.$/,
    )
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 5)
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByTestId('ear-stage-progress').textContent).not.toContain(
      '40.0¢',
    )
  })

  it('Stop mid-pair cancels the tones on the clock', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3)
    render(() => (
      <Stage>
        <BeatHuntDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(pad(/Practice run/))
    await vi.advanceTimersByTimeAsync(LEAD + 100)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const oscillators = ctx.createOscillator.mock.results.map((r) => r.value)
    expect(oscillators).toHaveLength(4)
    for (const osc of oscillators) {
      expect(osc.stop).toHaveBeenLastCalledWith(ctx.currentTime)
    }
  })
})

describe('DriftDrill', () => {
  const LEAD = DRIFT_TIMING.leadInS * 1000
  const CLICKS = DRIFT_TIMING.steadyClicks + DRIFT_TIMING.driftClicks

  async function practiceAndListen(random: number): Promise<void> {
    vi.spyOn(Math, 'random').mockReturnValue(random)
    render(() => (
      <Stage>
        <DriftDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(pad(/Practice run/))
    await vi.advanceTimersByTimeAsync(0)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(CLICKS)
    await vi.advanceTimersByTimeAsync(LEAD + 10)
    const svg = document.querySelector('svg[data-instrument="metronome"]')
    expect(svg?.querySelectorAll('[data-lit="true"]').length).toBe(1)
    expect(
      svg?.querySelector('[data-part="arm"]')?.getAttribute('data-lean'),
    ).toBe('0')
    // Long enough for the slowest train and its tail.
    await vi.advanceTimersByTimeAsync(CLICKS * DRIFT_TIMING.periodMs * 1.5)
    expect(status()).toBe('Did the tempo hold steady, gain, or lose?')
  }

  it('a steady train: eleven clicks, the lamps chase, Steady is right', async () => {
    await practiceAndListen(0)
    fireEvent.click(pad(/Steady/))
    expect(status()).toBe('Right — it held steady.')
    const svg = document.querySelector('svg[data-instrument="metronome"]')
    expect(
      svg?.querySelector('[data-part="arm"]')?.getAttribute('data-lean'),
    ).toBe('0')
    expect(svg?.querySelector('[data-part="nameplate"]')?.textContent).toBe(
      'Steady',
    )
  })

  it('a train that gained: the arm leans forward at the reveal, a miss widens the drift', async () => {
    await practiceAndListen(0.5)
    fireEvent.click(pad(/Slower/))
    expect(status()).toBe('It gained 10%. The drift widens.')
    const svg = document.querySelector('svg[data-instrument="metronome"]')
    expect(
      svg?.querySelector('[data-part="arm"]')?.getAttribute('data-lean'),
    ).toBe('22')
    expect(svg?.querySelector('[data-part="nameplate"]')?.textContent).toBe(
      'Faster by 10%',
    )
  })

  it('Stop mid-train cancels the clicks on the clock', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    render(() => (
      <Stage>
        <DriftDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(pad(/Practice run/))
    await vi.advanceTimersByTimeAsync(LEAD + DRIFT_TIMING.periodMs * 2)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const oscillators = ctx.createOscillator.mock.results.map((r) => r.value)
    expect(oscillators).toHaveLength(CLICKS)
    for (const osc of oscillators) {
      expect(osc.stop).toHaveBeenLastCalledWith(ctx.currentTime)
    }
  })
})
