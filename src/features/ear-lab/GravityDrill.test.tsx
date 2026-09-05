// ============================================================
// Gravity is Home over the chromatic twelve: twelve pads with the
// chromatic labels, a probe that can land off the scale, answers
// rated under 'gravity' with a 1/12 floor, and the Function readout
// still reading Home.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as ItemBank from '@/lib/ear/item-bank'
import { GRAVITY_DEGREES, GRAVITY_SET } from '@/lib/ear/item-bank'
import { HOME_TIMING } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { earPlayerRating, resetEarLabStore } from '@/stores/ear-lab-store'
import { GravityDrill } from './GravityDrill'
import { facultyReadout, instrumentReading, INSTRUMENTS } from './instruments'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
vi.mock('@/lib/mic-manager', () => ({
  micManager: { acquire: vi.fn(), release: vi.fn() },
}))
// A fixed root, and always ♭6 (degree 9 of the twelve).
vi.mock('@/lib/ear/item-bank', async (importOriginal) => {
  const original = await importOriginal<typeof ItemBank>()
  return {
    ...original,
    roveRootMidi: () => 60,
    pickHomeItem: (
      _states: unknown,
      _rating: number,
      options?: { set?: ItemBank.DegreeSet },
    ) => {
      const set = options?.set ?? original.HOME_SET
      const degree = set.degrees.find((d) => d.label === '♭6') ?? set.degrees[0]
      return {
        itemId: set.itemId(degree.degree),
        degree,
        difficulty: degree.seed,
      }
    },
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
const pads = () =>
  within(screen.getByTestId('ear-stage-pads')).getAllByRole('button')
const CADENCE = 4 * (HOME_TIMING.chordMs + HOME_TIMING.chordGapMs)

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

async function beginAndListen(): Promise<void> {
  render(() => (
    <Stage>
      <GravityDrill onBack={vi.fn()} />
    </Stage>
  ))
  fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
  await vi.advanceTimersByTimeAsync(CADENCE + 5)
  // The probe: ♭6 over C = A♭4, MIDI 68.
  const probe =
    engine.playTone.mock.calls[engine.playTone.mock.calls.length - 1]
  expect(probe[0]).toBeCloseTo(415.3, 0)
  await vi.advanceTimersByTimeAsync(HOME_TIMING.probeMs + 5)
  expect(status()).toBe('Which of the twelve was that?')
}

describe('GravityDrill', () => {
  it('lays out twelve pads with the chromatic labels', async () => {
    await beginAndListen()
    const labels = pads().map((pad) => pad.textContent ?? '')
    expect(labels).toHaveLength(12)
    expect(labels[1]).toContain('♭2')
    expect(labels[6]).toContain('♯4')
    expect(labels[8]).toContain('♭6')
    expect(labels[11]).toContain('7')
  })

  it('rates a right answer under gravity, not home', async () => {
    await beginAndListen()
    fireEvent.click(pads()[8])
    expect(status()).toBe('Yes — Le (♭6).')
    expect(earPlayerRating('gravity').attempts).toBe(1)
    expect(earPlayerRating('home').attempts).toBe(0)
  })

  it('names the slip in the chromatic labels and replays the fall home', async () => {
    await beginAndListen()
    fireEvent.click(pads()[9])
    expect(status()).toBe('That was Le (♭6) — hear it fall home.')
    expect(earPlayerRating('gravity').attempts).toBe(1)
  })

  it('the bench reads Gravity on its own tile and keeps Function on Home', () => {
    const gravity = INSTRUMENTS.find((i) => i.view === 'gravity')
    expect(gravity?.faculty).toBe('function')
    expect(gravity && instrumentReading(gravity)).toBeNull()
    expect(facultyReadout('function')).toBeNull()
    expect(GRAVITY_SET.choices).toBe(12)
    expect(GRAVITY_DEGREES.map((d) => d.semitone)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
  })
})
