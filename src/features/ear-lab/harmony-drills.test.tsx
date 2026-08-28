// ============================================================
// Cadence and Bassline on a fake engine with the guitar voices
// mocked: the progression strums chord by chord with the train
// turning, four pads are drawn with the answer among them, the
// reveal engraves the numerals; the bass line rings under a held
// tonic and comes back on a seven-rung ladder.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { drawOptions } from '@/lib/ear/draw-options'
import { CADENCE_BANK } from '@/lib/ear/progressions'
import { BASSLINE_TIMING, CADENCE_TIMING, REVEAL_TIMING, } from '@/lib/ear/timing'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { BasslineDrill } from './BasslineDrill'
import { CadenceDrill } from './CadenceDrill'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// Always the first item: I–IV–V, and the line I IV V I.
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) => bank[0],
  }
})
const struck: Array<{ kind: 'guitar' | 'bass'; freq: number; at: number }> = []

function fakeVoice(kind: 'guitar' | 'bass', freq: number, at: number) {
  struck.push({ kind, freq, at })
  return {
    gain: {
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    },
    dispose: vi.fn(),
  }
}
vi.mock('@/lib/guitar/guitar-synth', () => ({
  createGuitarVoice: vi.fn(
    (_ctx: unknown, freq: number, _ms: number, _variant: string, at: number) =>
      fakeVoice('guitar', freq, at),
  ),
  createBassVoice: vi.fn(
    (_ctx: unknown, freq: number, _ms: number, at: number) =>
      fakeVoice('bass', freq, at),
  ),
}))

const ctx = {
  currentTime: 1,
  destination: {},
  createGain: vi.fn(() => ({
    gain: { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
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

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  struck.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('drawOptions', () => {
  it('draws four with the item among them, never twice', () => {
    let seed = 3
    const random = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 20; i++) {
      const drawn = drawOptions(
        CADENCE_BANK[2],
        CADENCE_BANK,
        (entry) => entry.itemId,
        4,
        random,
      )
      expect(drawn).toHaveLength(4)
      expect(
        drawn.filter((item) => item.itemId === CADENCE_BANK[2].itemId),
      ).toHaveLength(1)
      expect(new Set(drawn.map((item) => item.itemId)).size).toBe(4)
    }
  })
})

describe('CadenceDrill', () => {
  const STEP = CADENCE_TIMING.chordMs + CADENCE_TIMING.gapMs
  const LEAD = CADENCE_TIMING.leadInS * 1000

  async function beginAndListen(): Promise<void> {
    render(() => (
      <Stage>
        <CadenceDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    // Three chords of four notes, all on the clock at once.
    expect(struck).toHaveLength(12)
    expect(struck[0].kind).toBe('bass')
    expect(struck[4].at).toBeCloseTo(struck[0].at + STEP / 1000, 3)
    await vi.advanceTimersByTimeAsync(LEAD + 10)
    const train = document.querySelector('svg[data-instrument="train"]')
    expect(train?.querySelectorAll('[data-part="wheel"]').length).toBe(3)
    expect(train?.querySelectorAll('[data-turning="true"]').length).toBe(1)
    expect(train?.querySelectorAll('[data-part="numeral"]').length).toBe(0)
    await vi.advanceTimersByTimeAsync(3 * STEP + CADENCE_TIMING.tailMs)
    expect(status()).toBe('Which progression was that?')
    expect(pads()).toHaveLength(4)
  }

  it('strums the progression with the train turning, then draws four pads', async () => {
    await beginAndListen()
    const labels = pads().map((pad) => pad.textContent ?? '')
    expect(labels.filter((label) => label.includes('I–IV–V'))).toHaveLength(1)
  })

  it('names the progression at the reveal and engraves the wheels', async () => {
    await beginAndListen()
    const right = pads().find((pad) =>
      (pad.textContent ?? '').includes('I–IV–V'),
    )
    fireEvent.click(right as HTMLElement)
    expect(status()).toBe('Yes — I–IV–V.')
    const numerals = [
      ...(document.querySelectorAll(
        'svg[data-instrument="train"] [data-part="numeral"]',
      ) ?? []),
    ].map((n) => n.textContent)
    expect(numerals).toEqual(['I', 'IV', 'V'])
  })

  it('a miss strums the progression again, slower', async () => {
    await beginAndListen()
    const wrong = pads().find(
      (pad) => !(pad.textContent ?? '').includes('I–IV–V'),
    )
    fireEvent.click(wrong as HTMLElement)
    expect(status()).toBe('That was I–IV–V — listen again.')
    await vi.advanceTimersByTimeAsync(0)
    expect(struck).toHaveLength(24)
    // The next round waits for the slow strum to finish, then the hold.
    await vi.advanceTimersByTimeAsync(
      REVEAL_TIMING.identificationWrongMs + 6000,
    )
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'Round 2 of 12',
    )
  })
})

describe('BasslineDrill', () => {
  const STEP = BASSLINE_TIMING.rootMs + BASSLINE_TIMING.rootGapMs
  const HELD = BASSLINE_TIMING.restMs + 4 * STEP
  const LEAD = BASSLINE_TIMING.leadInS * 1000

  async function beginAndListen(): Promise<void> {
    render(() => (
      <Stage>
        <BasslineDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    // The held tonic (four notes) and four bass roots.
    expect(struck).toHaveLength(8)
    expect(struck.slice(4).every((s) => s.kind === 'bass')).toBe(true)
    await vi.advanceTimersByTimeAsync(LEAD + BASSLINE_TIMING.restMs + 10)
    const chain = document.querySelector('svg[data-instrument="chain"]')
    expect(chain?.querySelectorAll('[data-lit="true"]').length).toBe(1)
    await vi.advanceTimersByTimeAsync(HELD + BASSLINE_TIMING.tailMs)
    expect(status()).toBe('Tap the roots back on the ladder, in order.')
    expect(pads()).toHaveLength(7)
  }

  it('rings the tonic under four roots, then opens a seven-rung ladder in numerals', async () => {
    await beginAndListen()
    expect(pads()[3].textContent).toContain('IV')
    expect(screen.getByTestId('ear-phrase-strip').textContent).toContain(
      '0 of 4',
    )
  })

  it('judges the line once all four roots are in', async () => {
    await beginAndListen()
    for (const rung of [0, 3, 4]) fireEvent.click(pads()[rung])
    expect(screen.getByTestId('ear-phrase-strip').textContent).toContain('IIVV')
    expect(status()).toBe('Tap the roots back on the ladder, in order.')
    fireEvent.click(pads()[0])
    expect(status()).toBe('Yes — I–IV–V–I.')
  })

  it('a slip names the line and replays it', async () => {
    await beginAndListen()
    for (const rung of [0, 3, 3, 0]) fireEvent.click(pads()[rung])
    expect(status()).toBe('That was I–IV–V–I — listen again.')
    await vi.advanceTimersByTimeAsync(0)
    expect(struck).toHaveLength(16)
  })
})
