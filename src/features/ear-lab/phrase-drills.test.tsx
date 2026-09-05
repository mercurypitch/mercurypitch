// ============================================================
// Echo and Span on a fake engine: the cadence plants the key as
// parallel tones, the phrase sounds note by note with the bead
// lit, the ladder opens only afterwards, the phrase is judged once
// the last note is in, a slip shows on the chain and replays the
// phrase (Echo) or shortens the staircase (Span), and Stop silences
// the engine mid-phrase.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { ECHO_TIMING, LADDER_TIMING, REVEAL_HOLD, SPAN_TIMING, } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { EchoDrill } from './EchoDrill'
import { SpanDrill } from './SpanDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// Always the first phrase — Do Re Mi — so the test knows the answer.
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
const strip = () => screen.getByTestId('ear-phrase-strip').textContent ?? ''
const ladder = () =>
  within(screen.getByTestId('ear-stage-pads')).getAllByRole('button')
const chain = () => document.querySelector('svg[data-instrument="chain"]')
const parts = (part: string) =>
  chain()?.querySelectorAll(`[data-part="${part}"]`).length ?? 0

const CADENCE = 4 * (ECHO_TIMING.chordMs + ECHO_TIMING.chordGapMs)
const ECHO_PHRASE = (n: number) =>
  n * (ECHO_TIMING.noteMs + ECHO_TIMING.gapMs) + ECHO_TIMING.tailMs
const SPAN_CADENCE = 4 * (SPAN_TIMING.chordMs + SPAN_TIMING.chordGapMs)
const SPAN_PHRASE = (n: number) =>
  n * (SPAN_TIMING.noteMs + SPAN_TIMING.gapMs) + SPAN_TIMING.tailMs

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

describe('EchoDrill', () => {
  async function beginAndListen(): Promise<void> {
    render(() => (
      <Stage>
        <EchoDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    // The first chord of the cadence: one voice carrying the block chord.
    expect(engine.playTone).toHaveBeenCalledTimes(1)
    expect(status()).toBe('Listen to the phrase…')
    await vi.advanceTimersByTimeAsync(CADENCE + ECHO_TIMING.restMs + 10)
    // Four chords planted, and the first note of Do Re Mi is sounding.
    expect(engine.playTone).toHaveBeenCalledTimes(5)
    expect(parts('bead')).toBe(3)
    expect(chain()?.querySelectorAll('[data-lit="true"]').length).toBe(1)
    expect(ladder()[0].hasAttribute('disabled')).toBe(true)
    await vi.advanceTimersByTimeAsync(ECHO_PHRASE(3))
    expect(engine.playTone).toHaveBeenCalledTimes(7)
    expect(status()).toBe('Tap it back on the ladder, note by note.')
    expect(ladder()).toHaveLength(8)
    expect(ladder()[0].hasAttribute('disabled')).toBe(false)
  }

  it('plants a cadence, sounds the phrase with the bead lit, then opens the ladder', async () => {
    await beginAndListen()
    expect(strip()).toContain('0 of 3')
  })

  it('sounds a tapped rung, says how many notes it wants, and explains the top rung', async () => {
    await beginAndListen()
    expect(screen.getByLabelText('Tap the 3 notes back')).toBeTruthy()
    expect(screen.getByText(/1′ is home again/)).toBeTruthy()
    fireEvent.click(ladder()[4])
    expect(engine.playTone).toHaveBeenCalledTimes(8)
    const [, tapMs] = engine.playTone.mock.calls[7] ?? []
    expect(tapMs).toBe(LADDER_TIMING.tapMs)
  })

  it('judges the phrase only once the last note is in', async () => {
    await beginAndListen()
    fireEvent.click(ladder()[0])
    fireEvent.click(ladder()[1])
    expect(status()).toBe('Tap it back on the ladder, note by note.')
    expect(strip()).toContain('DoRe')
    expect(strip()).toContain('2 of 3')
    fireEvent.click(ladder()[2])
    expect(status()).toBe('Yes — Do Re Mi.')
    expect(parts('right')).toBe(3)
    expect(parts('wrong')).toBe(0)
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'Round 1 of 12',
    )
  })

  it('takes one note back before the phrase is judged', async () => {
    await beginAndListen()
    fireEvent.click(ladder()[0])
    expect(strip()).toContain('1 of 3')
    fireEvent.click(screen.getByRole('button', { name: 'Take one back' }))
    expect(strip()).toContain('0 of 3')
    expect(status()).toBe('Tap it back on the ladder, note by note.')
  })

  it('a slip marks the chain, replays the phrase slowly, and moves on', async () => {
    await beginAndListen()
    fireEvent.click(ladder()[0])
    fireEvent.click(ladder()[1])
    fireEvent.click(ladder()[4])
    expect(status()).toBe('That was Do Re Mi — listen again.')
    expect(parts('right')).toBe(2)
    expect(parts('wrong')).toBe(1)
    expect(screen.getByTestId('ear-stage-last-call').textContent).toContain(
      'You tapped Do Re Sol · first slip at note 3',
    )
    // Three rungs sounded under the taps; then the replay: three
    // notes, slower, no cadence.
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.playTone).toHaveBeenCalledTimes(11)
    // The next round waits for the slow replay to finish, then the hold.
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 4000)
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'Round 2 of 12',
    )
  })

  it('Stop mid-phrase silences the engine and ends the run', async () => {
    render(() => (
      <Stage>
        <EchoDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(CADENCE + ECHO_TIMING.restMs + 10)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(engine.stopTone).toHaveBeenCalled()
    const calls = engine.playTone.mock.calls.length
    await vi.advanceTimersByTimeAsync(ECHO_PHRASE(6))
    expect(engine.playTone.mock.calls.length).toBe(calls)
    expect(screen.getByTestId('ear-stage-plate')).toBeTruthy()
  })
})

describe('SpanDrill', () => {
  // random → 0: the walk is Do Sol Do (1, 5, 1) and the root stays at 48.
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  async function practiceAndListen(): Promise<void> {
    render(() => (
      <Stage>
        <SpanDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.playTone).toHaveBeenCalledTimes(1)
    expect(status()).toBe('Listen to the phrase…')
    await vi.advanceTimersByTimeAsync(SPAN_CADENCE + SPAN_TIMING.restMs + 10)
    expect(engine.playTone).toHaveBeenCalledTimes(5)
    expect(parts('bead')).toBe(3)
    expect(chain()?.querySelectorAll('[data-lit="true"]').length).toBe(1)
    await vi.advanceTimersByTimeAsync(SPAN_PHRASE(3))
    expect(status()).toBe('Tap it back on the ladder, note by note.')
    expect(ladder()[0].hasAttribute('disabled')).toBe(false)
  }

  it('says on the bench how long the first phrase will be', () => {
    render(() => (
      <Stage>
        <SpanDrill onBack={vi.fn()} />
      </Stage>
    ))
    expect(status()).toBe(
      'A phrase of 3 notes to start — give it all back, and it grows while you keep up.',
    )
  })

  it('starts at three notes and grows when the phrase is held', async () => {
    await practiceAndListen()
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      '3 notes',
    )
    fireEvent.click(ladder()[0])
    fireEvent.click(ladder()[4])
    fireEvent.click(ladder()[0])
    expect(status()).toBe('Held — all 3 notes, Do Sol Do. The phrase grows.')
    expect(parts('right')).toBe(3)
  })

  it('names the first slip and shortens the phrase', async () => {
    await practiceAndListen()
    fireEvent.click(ladder()[0])
    fireEvent.click(ladder()[1])
    fireEvent.click(ladder()[0])
    expect(status()).toBe(
      'Slipped at note 2 of 3 — it was Do Sol Do, you tapped Do Re Do. The phrase shortens.',
    )
    expect(parts('wrong')).toBe(1)
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 5)
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      '2 notes',
    )
  })

  it('Stop mid-cadence silences the engine', async () => {
    render(() => (
      <Stage>
        <SpanDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await vi.advanceTimersByTimeAsync(SPAN_TIMING.chordMs)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(engine.stopTone).toHaveBeenCalled()
    const calls = engine.playTone.mock.calls.length
    await vi.advanceTimersByTimeAsync(SPAN_CADENCE + SPAN_PHRASE(3))
    expect(engine.playTone.mock.calls.length).toBe(calls)
  })
})
