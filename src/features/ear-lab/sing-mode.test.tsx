// ============================================================
// Sing mode for Echo and Span: the same trial answered through the
// pitch pipeline, rated on the voice track, the items untouched.
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import { findThresholdDrill } from '@/lib/ear/drills'
import type * as ItemBank from '@/lib/ear/item-bank'
import type * as Phrase from '@/lib/ear/phrase'
import { ECHO_TIMING, REVEAL_TIMING, SPAN_TIMING } from '@/lib/ear/timing'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToFreq } from '@/lib/scale-data'
import { earItemStates, earPlayerRating, resetEarLabStore, } from '@/stores/ear-lab-store'
import { EchoDrill, echoListeningMs } from './EchoDrill'
import { SpanDrill, spanListeningMs } from './SpanDrill'
import { useThresholdRun } from './use-threshold-run'

const mic = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquire: vi.fn<(id: string) => Promise<MediaStream>>(),
  release: vi.fn(),
  startTask: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(async () => undefined),
}))
vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: (id: string) => mic.acquire(id),
    release: (id: string) => mic.release(id),
  },
}))
vi.mock('@/lib/pitch-f0-stream', () => ({
  createF0Stream: () => ({
    startTask: mic.startTask,
    takeFrames: () => mic.frames,
    latest: () => null,
    dispose: mic.dispose,
  }),
}))
vi.mock('@/lib/ear/banks', async () => {
  const actual = await vi.importActual<typeof Banks>('@/lib/ear/banks')
  return {
    ...actual,
    pickBankItem: (bank: Banks.EarBankItem[]) => bank[0],
  }
})
vi.mock('@/lib/ear/item-bank', async () => {
  const actual = await vi.importActual<typeof ItemBank>('@/lib/ear/item-bank')
  return { ...actual, roveRootMidi: () => 60 }
})
vi.mock('@/lib/ear/phrase', async () => {
  const actual = await vi.importActual<typeof Phrase>('@/lib/ear/phrase')
  return { ...actual, randomPhrase: () => [1, 5, 1] }
})

function fakeEngine(): AudioEngine {
  return {
    init: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    getAudioContext: () => ({}) as AudioContext,
    getVolume: () => 0.8,
    setToneTrim: vi.fn(),
    playTone: vi.fn<(...args: unknown[]) => Promise<void>>(
      async () => undefined,
    ),
    stopTone: vi.fn(),
  } as unknown as AudioEngine
}

/** Eight confident frames inside each note's window, after the 30% the
 *  scorer drops; midi 0 leaves a window silent. */
function sungFrames(
  midis: number[],
  noteMs: number,
  gapMs: number,
  leadMs: number,
): PitchFrame[] {
  const frames: PitchFrame[] = []
  midis.forEach((midi, i) => {
    if (midi === 0) return
    const start = (leadMs + i * (noteMs + gapMs)) / 1000
    for (let k = 0; k < 8; k++) {
      frames.push({
        t: start + ((0.4 + k * 0.07) * noteMs) / 1000,
        f0: midiToFreq(midi),
        conf: 0.9,
        rms: 0.2,
      } as PitchFrame)
    }
  })
  return frames
}

function status(): string {
  return screen.getByTestId('ear-stage-status').textContent ?? ''
}

async function reach(text: string): Promise<void> {
  for (let i = 0; i < 80 && !status().includes(text); i++) {
    await vi.advanceTimersByTimeAsync(100)
  }
  expect(status()).toContain(text)
}

function mount(element: () => ReturnType<typeof EchoDrill>) {
  const engine = fakeEngine()
  return render(() => (
    <EngineContext.Provider
      value={{
        audioEngine: engine,
        practiceEngine: {} as PracticeEngine,
        playbackRuntime: {} as PlaybackRuntime,
        ready: () => true,
      }}
    >
      {element()}
    </EngineContext.Provider>
  ))
}

describe('sing mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetEarLabStore()
    mic.frames = []
    mic.acquire.mockReset()
    mic.acquire.mockResolvedValue({} as MediaStream)
    mic.release.mockReset()
    mic.startTask.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Echo rates a sung phrase under echo-sing and leaves the item alone', async () => {
    mount(() => <EchoDrill onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(mic.acquire).toHaveBeenCalledWith('ear-echo-drill')

    await reach('Sing or play it back')
    expect(mic.startTask).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Listening/ })).toBeTruthy()

    // Do Re Mi at the root the trial roved to.
    mic.frames = sungFrames(
      [60, 62, 64],
      ECHO_TIMING.noteMs,
      ECHO_TIMING.gapMs,
      ECHO_TIMING.singLeadMs,
    )
    await vi.advanceTimersByTimeAsync(echoListeningMs(3))
    expect(status()).toContain('Yes — Do Re Mi.')
    expect(earPlayerRating('echo-sing').attempts).toBe(1)
    expect(earPlayerRating('echo').attempts).toBe(0)
    expect(earItemStates()['e-steps-up']).toBeUndefined()

    // Round two: the second note sung a fourth up — wrong, and the chain
    // marks that bead.
    await vi.advanceTimersByTimeAsync(REVEAL_TIMING.identificationCorrectMs)
    await reach('Sing or play it back')
    mic.frames = sungFrames(
      [60, 65, 64],
      ECHO_TIMING.noteMs,
      ECHO_TIMING.gapMs,
      ECHO_TIMING.singLeadMs,
    )
    fireEvent.click(screen.getByRole('button', { name: /Listening/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(status()).toContain('That was Do Re Mi — listen again.')
    expect(
      document.querySelectorAll('[data-instrument="chain"] [data-part="wrong"]')
        .length,
    ).toBe(1)
    expect(earPlayerRating('echo-sing').attempts).toBe(2)
    expect(earPlayerRating('echo').attempts).toBe(0)
    expect(earItemStates()['e-steps-up']).toBeUndefined()
  })

  it('Echo falls back to the ladder when the mic cannot be opened', async () => {
    mic.acquire.mockRejectedValue(new Error('NotAllowedError'))
    mount(() => <EchoDrill onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(mic.release).toHaveBeenCalledWith('ear-echo-drill')

    await reach('Tap it back on the ladder')
    expect(screen.getByTestId('ear-phrase-strip')).toBeTruthy()
    for (const word of ['Do', 'Re', 'Mi']) {
      fireEvent.click(
        screen.getByRole('button', { name: new RegExp(`${word}$`) }),
      )
    }
    expect(status()).toContain('Yes — Do Re Mi.')
    expect(earPlayerRating('echo').attempts).toBe(1)
    expect(earPlayerRating('echo-sing').attempts).toBe(0)
  })

  it('Span sings a practice run under span-sing with Calibration hidden', async () => {
    mount(() => <SpanDrill onBack={() => undefined} />)
    expect(screen.getByRole('button', { name: /Calibration/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    expect(screen.queryByRole('button', { name: /Calibration/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(mic.acquire).toHaveBeenCalledWith('ear-span-drill')

    await reach('Sing or play it back')
    mic.frames = sungFrames(
      [60, 67, 60],
      SPAN_TIMING.noteMs,
      SPAN_TIMING.gapMs,
      SPAN_TIMING.singLeadMs,
    )
    await vi.advanceTimersByTimeAsync(spanListeningMs(3))
    expect(status()).toContain(
      'Held — all 3 notes, Do Sol Do. The phrase grows.',
    )

    // Next trial: the middle note missing — slipped at note 2.
    await vi.advanceTimersByTimeAsync(REVEAL_TIMING.thresholdMs)
    await reach('Sing or play it back')
    mic.frames = sungFrames(
      [60, 0, 60],
      SPAN_TIMING.noteMs,
      SPAN_TIMING.gapMs,
      SPAN_TIMING.singLeadMs,
    )
    await vi.advanceTimersByTimeAsync(spanListeningMs(3))
    expect(status()).toContain('Slipped at note 2 of 3')
  })

  it('a threshold run reads under the given track for practice only', () => {
    createRoot((dispose) => {
      const drill = findThresholdDrill('span')
      if (!drill) throw new Error('span missing')
      const run = useThresholdRun(drill, async () => undefined, {})
      expect(run.trackId()).toBe('span')
      run.start('practice', { drillId: 'span-sing' })
      expect(run.trackId()).toBe('span-sing')
      run.stop()
      run.start('calibration', { drillId: 'span-sing' })
      expect(run.trackId()).toBe('span')
      run.stop()
      dispose()
    })
  })
})
