// ============================================================
// The mixing desk: its source, and Colour, Weight and Critique
// rated on the desk's own ids — the Column's estimate untouched.
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import { REVEAL_HOLD } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { earPlayerRating, latestThresholdReading, practiceIndexEstimate, resetEarLabStore, } from '@/stores/ear-lab-store'
import { renderHouseLoop } from './desk-render'
import { primeDeskSource, resetDeskStore } from './desk-store'
import { DeskView } from './DeskView'

const fake = vi.hoisted(() => {
  const data = new Float32Array(8)
  const buffer = {
    duration: 9.6,
    sampleRate: 44_100,
    numberOfChannels: 2,
    length: 8,
    getChannelData: () => data,
  } as unknown as AudioBuffer
  return { buffer }
})

vi.mock('@/features/exercises/feedback', () => ({
  playTierSfx: vi.fn(),
  // The threshold run grades a finished run.
  gradeForScore: (score: number) => (score >= 70 ? 'B' : 'D'),
}))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(async () => undefined),
}))
vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobUrl: vi.fn(async () => null),
}))
vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => [],
  getUvrSession: () => undefined,
}))
vi.mock('./wild-player', () => ({
  playExcerpt: vi.fn(() => ({ done: Promise.resolve(), cancel: vi.fn() })),
}))
vi.mock('./desk-render', () => ({
  renderFault: vi.fn(async () => fake.buffer),
  renderHouseLoop: vi.fn(async () => fake.buffer),
  renderSongMix: vi.fn(async () => fake.buffer),
  matchLoudness: vi.fn(),
  randomSliceStart: () => 0,
  songExcerptStart: () => 0,
}))
vi.mock('@/lib/ear/banks', async () => {
  const actual = await vi.importActual<typeof Banks>('@/lib/ear/banks')
  return {
    ...actual,
    pickBankItem: (bank: Banks.EarBankItem[]) => bank[0],
  }
})

function fakeEngine(): AudioEngine {
  return {
    init: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    getAudioContext: () => ({ sampleRate: 44_100 }) as AudioContext,
    getVolume: () => 0.8,
    setToneTrim: vi.fn(),
    playTone: vi.fn<(...args: unknown[]) => Promise<void>>(
      async () => undefined,
    ),
    playChord: vi.fn().mockResolvedValue(undefined),
    stopTone: vi.fn(),
  } as unknown as AudioEngine
}

function mount() {
  return render(() => (
    <EngineContext.Provider
      value={{
        audioEngine: fakeEngine(),
        practiceEngine: {} as PracticeEngine,
        playbackRuntime: {} as PlaybackRuntime,
        ready: () => true,
      }}
    >
      <DeskView onBack={() => undefined} />
    </EngineContext.Provider>
  ))
}

function status(): string {
  return screen.getByTestId('ear-stage-status').textContent ?? ''
}

async function reach(text: string): Promise<void> {
  for (let i = 0; i < 60 && !status().includes(text); i++) {
    await vi.advanceTimersByTimeAsync(100)
  }
  expect(status()).toContain(text)
}

describe('the desk', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetEarLabStore()
    resetDeskStore()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders the house loop for an empty library and runs Colour on the desk id', async () => {
    mount()
    await vi.advanceTimersByTimeAsync(0)
    expect(renderHouseLoop).toHaveBeenCalledWith(44_100)
    expect(status()).toContain('On the house loop')
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.queryByRole('button', { name: /Calibration/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await reach('Which band was boosted?')
    // The draw is pinned: the 125 Hz band, a 12 dB boost to start.
    fireEvent.click(screen.getByRole('button', { name: /125 Hz/ }))
    expect(status()).toContain(
      'Right — the 125 Hz band, up 12.0 dB. The boost shrinks.',
    )

    // Two right, one wrong, over and over: the staircase steps down after
    // paired hits and up after a miss, so every third answer is a reversal.
    for (
      let trial = 1;
      trial < 70 && !screen.queryByTestId('ear-stage-plate');
      trial++
    ) {
      await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs)
      if (screen.queryByTestId('ear-stage-plate')) break
      await reach('Which band was boosted?')
      fireEvent.click(
        screen.getByRole('button', {
          name: trial % 3 === 2 ? /250 Hz/ : /125 Hz/,
        }),
      )
    }
    expect(screen.getByTestId('ear-stage-plate')).toBeTruthy()
    expect(latestThresholdReading('desk-colour')).not.toBeNull()
    expect(latestThresholdReading('colour')).toBeNull()
    expect(practiceIndexEstimate().parts.colour).toBeUndefined()
  })

  it('Weight plays the heavier render first on the pinned coin and matches loudness', async () => {
    primeDeskSource({ buffer: fake.buffer, label: 'the house loop' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: /^Weight/ }))
    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await reach('Which carried the heavier low end?')
    fireEvent.click(screen.getByRole('button', { name: /The first/ }))
    expect(status()).toContain(
      'Right — the first had the weight, a 6.0 dB shelf under 120 Hz. The shelf thins.',
    )
  })

  it('Critique names the fault and rates under desk-critique only', async () => {
    primeDeskSource({ buffer: fake.buffer, label: 'the house loop' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: /^Critique/ }))
    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await reach('Name the fault.')
    fireEvent.click(screen.getByRole('button', { name: /Mud/ }))
    expect(status()).toContain('Yes — Mud — a build-up around 250 Hz.')
    expect(earPlayerRating('desk-critique').attempts).toBe(1)
    expect(earPlayerRating('stack').attempts).toBe(0)
  })
})
