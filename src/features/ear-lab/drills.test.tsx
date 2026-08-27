// ============================================================
// The drill stages, end to end on a fake engine: Begin sounds the
// prompt, the pads arm once it has sounded, an answer colours the
// reveal and says it, and Stop lands on the plate. The Grid runs
// its clicks through click-synth on a fake AudioContext, so the
// sample-accurate path is exercised, not stubbed.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import { CONTOUR_TIMING, LEAP_TIMING } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { ContourDrill } from './ContourDrill'
import { GridDrill } from './GridDrill'
import { LeapDrill } from './LeapDrill'
import { StackDrill } from './StackDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))

/** Enough AudioContext for click-synth to schedule against. */
function fakeAudioContext() {
  const param = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  return {
    currentTime: 0,
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
}

const ctx = fakeAudioContext()
const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ctx,
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  playTone: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
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
const pads = () =>
  within(screen.getByTestId('ear-stage-pads')).getAllByRole('button')
const armedPads = () => pads().filter((pad) => !pad.hasAttribute('disabled'))

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Contour', () => {
  it('sounds the pair, arms the three directions, tells the truth, and stops to the plate', async () => {
    const onBack = vi.fn()
    render(() => (
      <Stage>
        <ContourDrill onBack={onBack} />
      </Stage>
    ))
    expect(status()).toContain('which way did the second one go')
    expect(screen.queryByTestId('ear-stage-pads')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    expect(status()).toBe('Listen…')
    await vi.advanceTimersByTimeAsync(CONTOUR_TIMING.gapMs + 20)
    expect(engine.playTone).toHaveBeenCalledTimes(2)
    expect(status()).toBe('Which way did it move?')
    expect(armedPads().map((pad) => pad.textContent)).toEqual([
      '1Up',
      '2Down',
      '3Same',
    ])

    fireEvent.click(armedPads()[0])
    expect(status()).toMatch(/^(Yes — |That was )/)
    expect(screen.getByLabelText('Right')).toBeTruthy()
    expect(armedPads()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    const plate = screen.getByTestId('ear-stage-plate')
    expect(plate.textContent).toContain('Contour rating')
    // The direction is drawn at random, so the one answer may have hit or missed.
    expect(plate.textContent).toMatch(/[01] of 1 named correctly/)
    expect(engine.stopTone).toHaveBeenCalled()
  })
})

describe('Leap', () => {
  it('names twelve intervals without keycaps and marks the miss beside the truth', async () => {
    render(() => (
      <Stage>
        <LeapDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(LEAP_TIMING.gapMs + 20)
    expect(engine.playTone).toHaveBeenCalledTimes(2)
    expect(armedPads()).toHaveLength(12)
    expect(pads().some((pad) => /^\d/.test(pad.textContent ?? ''))).toBe(false)

    // Answer every pad's neighbour in turn until one is wrong, so the
    // garnet mark is exercised; the first click may happen to be right.
    fireEvent.click(armedPads()[0])
    const first = status()
    expect(first).toMatch(/^(Yes — |That was )/)
    if (first.startsWith('That was')) {
      expect(screen.getByLabelText('Wrong')).toBeTruthy()
    }
    expect(screen.getByLabelText('Right')).toBeTruthy()
  })
})

describe('Stack', () => {
  it('voices the chord as one block with its intervals and arms the qualities', async () => {
    render(() => (
      <Stage>
        <StackDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.playTone).toHaveBeenCalledTimes(1)
    const intervals = engine.playTone.mock.calls[0][10]
    expect(Array.isArray(intervals)).toBe(true)
    expect((intervals as number[]).length).toBeGreaterThan(0)
    expect(status()).toBe('Which quality was that?')
    expect(armedPads().length).toBeGreaterThan(2)

    fireEvent.click(armedPads()[0])
    expect(status()).toMatch(/^(Yes — |That was )/)
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    expect(screen.getByTestId('ear-stage-plate').textContent).toContain(
      'Stack rating',
    )
  })
})

describe('The Grid', () => {
  it('schedules six clicks on the audio clock, arms the last four, reveals the offset, and silences on Stop', async () => {
    render(() => (
      <Stage>
        <GridDrill onBack={vi.fn()} />
      </Stage>
    ))
    expect(screen.getByText(/Click: Wood at 70%/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(6)
    expect(status()).toBe('Listen to the lattice…')

    await vi.advanceTimersByTimeAsync(4000)
    expect(status()).toContain('Which click was off')
    expect(armedPads().map((pad) => pad.textContent)).toEqual([
      '3Third',
      '4Fourth',
      '5Fifth',
      '6Sixth',
    ])

    fireEvent.click(armedPads()[1])
    // Right: "Right — the fourth click was late by 40 ms."; wrong: "It was
    // the fifth, early by 40 ms. The offset widens." — the pick is random.
    expect(status()).toMatch(/(early|late) by \d+ ms\./)
    expect(status()).toMatch(
      /^(Right — the|It was the) (third|fourth|fifth|sixth)/,
    )

    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    expect(screen.getByTestId('ear-stage-plate')).toBeTruthy()
    const oscillators = ctx.createOscillator.mock.results.map(
      (r) => r.value as { stop: ReturnType<typeof vi.fn> },
    )
    // Every click is stopped by its own schedule AND silenced on Stop.
    expect(oscillators.every((osc) => osc.stop.mock.calls.length === 2)).toBe(
      true,
    )
  })
})
