// ============================================================
// SubdivideDrill on a fake engine with the kit mocked: two bars go
// on the clock with the accent louder, the lattice chases without
// showing the grouping, four metre pads are drawn with the answer
// among them, and the reveal lights beat one.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { REVEAL_HOLD, SUBDIVIDE_TIMING } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { SubdivideDrill } from './SubdivideDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// Always the first pattern: 4/4, kick hat snare hat.
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) => bank[0],
  }
})
const hits: Array<{ voice: string; at: number; volume: number }> = []
vi.mock('@/lib/drum-voices', () => ({
  triggerDrumVoice: vi.fn(
    (voice: string, _ctx: unknown, at: number, volume: number) => {
      hits.push({ voice, at, volume })
    },
  ),
}))

const ctx = {
  currentTime: 1,
  destination: {},
  createGain: vi.fn(() => ({
    gain: {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    context: { currentTime: 0 },
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
const pads = () =>
  within(screen.getByTestId('ear-stage-pads')).getAllByRole('button')
const lattice = () => document.querySelector('svg[data-instrument="metre"]')
const LEAD = SUBDIVIDE_TIMING.leadInS * 1000
const BAR = 4 * SUBDIVIDE_TIMING.quarterMs

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  hits.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function beginAndListen(): Promise<void> {
  render(() => (
    <Stage>
      <SubdivideDrill onBack={vi.fn()} />
    </Stage>
  ))
  fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
  await vi.advanceTimersByTimeAsync(0)
  // Two bars of four, the kick on one louder than the rest.
  expect(hits).toHaveLength(8)
  expect(hits[0]).toMatchObject({ voice: 'kick', volume: 1 })
  expect(hits[1].volume).toBeLessThan(1)
  expect(hits[4].at).toBeCloseTo(hits[0].at + BAR / 1000, 3)
  await vi.advanceTimersByTimeAsync(LEAD + SUBDIVIDE_TIMING.quarterMs + 10)
  expect(lattice()?.querySelectorAll('[data-part="pallet"]').length).toBe(4)
  expect(lattice()?.querySelector('[data-lit="true"]')).not.toBeNull()
  expect(lattice()?.querySelectorAll('[data-accent="true"]').length).toBe(0)
  expect(lattice()?.querySelector('[data-part="bar-line"]')).toBeNull()
  await vi.advanceTimersByTimeAsync(2 * BAR + SUBDIVIDE_TIMING.tailMs)
  expect(status()).toBe('What is the metre?')
  expect(pads()).toHaveLength(4)
}

describe('SubdivideDrill', () => {
  it('plays two bars, chases the lattice without grouping, then draws four metres', async () => {
    await beginAndListen()
    const labels = pads().map((pad) => pad.textContent ?? '')
    expect(labels.filter((label) => label.includes('4/4'))).toHaveLength(1)
  })

  it('names the metre at the reveal and lights beat one', async () => {
    await beginAndListen()
    const right = pads().find((pad) => (pad.textContent ?? '').includes('4/4'))
    fireEvent.click(right as HTMLElement)
    expect(status()).toBe('Yes — 4/4.')
    expect(lattice()?.querySelectorAll('[data-accent="true"]').length).toBe(1)
    expect(lattice()?.querySelector('[data-part="bar-line"]')).not.toBeNull()
    expect(
      lattice()?.querySelector('[data-part="nameplate"]')?.textContent,
    ).toBe('4/4')
  })

  it('a miss plays the bars again, slower, then moves on', async () => {
    await beginAndListen()
    const wrong = pads().find((pad) => !(pad.textContent ?? '').includes('4/4'))
    fireEvent.click(wrong as HTMLElement)
    expect(status()).toBe('That was 4/4 — listen again.')
    await vi.advanceTimersByTimeAsync(0)
    expect(hits).toHaveLength(16)
    const slowBar = hits[12].at - hits[8].at
    expect(slowBar).toBeGreaterThan(BAR / 1000)
    // The next round waits for the slow bars to finish, then the hold.
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 12000)
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'Round 2 of 12',
    )
  })

  it('Stop silences the kit master and clears the lamps', async () => {
    render(() => (
      <Stage>
        <SubdivideDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(LEAD + SUBDIVIDE_TIMING.quarterMs)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const master = ctx.createGain.mock.results[0]?.value
    // Anchor, then decay: a jump to zero was a click on every Stop.
    expect(master?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.012)
    expect(master?.disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(80)
    expect(master?.disconnect).toHaveBeenCalled()
    // The stage is on its plate now; the lattice, if still drawn, is dark.
    expect(lattice()?.querySelector('[data-lit="true"]') ?? null).toBeNull()
  })
})
