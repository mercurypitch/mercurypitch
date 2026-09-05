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
import { REVEAL_HOLD } from '@/lib/ear/timing'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToFreq } from '@/lib/scale-data'
import { earItemStates, earPlayerRating, resetEarLabStore, } from '@/stores/ear-lab-store'
import { EchoDrill, echoPhraseMs } from './EchoDrill'
import { SpanDrill } from './SpanDrill'
import { SUNG_ANSWER, sungAnswerCeilingMs } from './use-sung-answer'
import { useThresholdRun } from './use-threshold-run'

const mic = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquire: vi.fn<(id: string) => Promise<MediaStream>>(),
  release: vi.fn(),
  startTask: vi.fn(() => {
    mic.frames = []
  }),
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
    peekFrames: () => mic.frames,
    latest: () => null,
    latestLevel: () => 0.1,
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
    playChord: vi.fn().mockResolvedValue(undefined),
    stopTone: vi.fn(),
  } as unknown as AudioEngine
}

/** Notes sung in free time: 350 ms each with a 150 ms breath between,
 *  at the stream's hop. Unless the window is still `open`, 1.4 s of
 *  silence follows — enough for it to close itself. */
function sungFrames(
  midis: number[],
  options?: { open?: boolean },
): PitchFrame[] {
  const frames: PitchFrame[] = []
  const push = (t: number, midi: number) =>
    frames.push({
      t: Math.round(t * 1000) / 1000,
      f0: midi > 0 ? midiToFreq(midi) : 0,
      conf: midi > 0 ? 0.9 : 0,
      rms: midi > 0 ? 0.2 : 0.01,
    } as PitchFrame)
  let t = 0.2
  for (const midi of midis) {
    for (let k = 0; k < 22; k++) push(t + k * 0.016, midi)
    t += 0.35
    for (let k = 0; k < 9; k++) push(t + k * 0.016, 0)
    t += 0.15
  }
  if (options?.open !== true) {
    for (let k = 0; k < 90; k++) push(t + k * 0.016, 0)
  }
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

  it('Echo shows the notes as the mic hears them, then judges on silence', async () => {
    mount(() => <EchoDrill onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    expect(mic.acquire).toHaveBeenCalledWith('ear-echo-drill')

    await reach('Sing or play it back')
    expect(mic.startTask).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Done/ })).toBeTruthy()
    const strip = () => screen.getByTestId('ear-phrase-strip').textContent ?? ''
    expect(strip()).toContain('0 of 3')

    // Do Re at the root the trial roved to, the mic still on Re: the
    // strip fills, nothing is judged yet.
    mic.frames = sungFrames([60, 62], { open: true })
    await vi.advanceTimersByTimeAsync(SUNG_ANSWER.pollMs)
    expect(strip()).toContain('Do')
    expect(strip()).toContain('Re')
    expect(strip()).toContain('2 of 3')
    expect(status()).toContain('Sing or play it back')

    // Mi, then a breath of silence: judged by itself.
    mic.frames = sungFrames([60, 62, 64])
    await vi.advanceTimersByTimeAsync(SUNG_ANSWER.pollMs)
    expect(status()).toContain('Yes — Do Re Mi.')
    expect(earPlayerRating('echo-sing').attempts).toBe(1)
    expect(earPlayerRating('echo').attempts).toBe(0)
    expect(earItemStates()['e-steps-up']).toBeUndefined()

    // Round two: the second note a fourth up — Done judges it now, and
    // the chain marks that bead.
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs)
    await reach('Sing or play it back')
    mic.frames = sungFrames([60, 65, 64], { open: true })
    fireEvent.click(screen.getByRole('button', { name: /Done/ }))
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

  it('Echo takes one Begin while the mic is being opened', async () => {
    // Two presses during the permission prompt used to start two runs:
    // the second ate the sprint's armed length and the first prompt
    // kept sounding under it.
    let grant!: (stream: MediaStream) => void
    mic.acquire.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )
    const engine = fakeEngine()
    render(() => (
      <EngineContext.Provider
        value={{
          audioEngine: engine,
          practiceEngine: {} as PracticeEngine,
          playbackRuntime: {} as PlaybackRuntime,
          ready: () => true,
        }}
      >
        <EchoDrill onBack={() => undefined} />
      </EngineContext.Provider>
    ))
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    const begin = screen.getByRole('button', { name: /Begin/ })
    fireEvent.click(begin)
    fireEvent.click(begin)
    grant({} as MediaStream)
    await vi.advanceTimersByTimeAsync(0)
    expect(mic.acquire).toHaveBeenCalledTimes(1)
    // One cadence planted, not two on top of each other.
    expect(engine.playChord).toHaveBeenCalledTimes(1)
  })

  it('Echo closes an empty window at the ceiling and counts it a miss', async () => {
    mount(() => <EchoDrill onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await reach('Sing or play it back')
    await vi.advanceTimersByTimeAsync(
      sungAnswerCeilingMs(echoPhraseMs(3)) + SUNG_ANSWER.pollMs,
    )
    expect(status()).toContain('That was Do Re Mi — listen again.')
    expect(earPlayerRating('echo-sing').attempts).toBe(1)
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
    mic.frames = sungFrames([60, 67, 60])
    await vi.advanceTimersByTimeAsync(SUNG_ANSWER.pollMs)
    expect(status()).toContain(
      'Held — all 3 notes, Do Sol Do. The phrase grows.',
    )

    // Next trial: two notes, then silence — slipped at note 3.
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs)
    await reach('Sing or play it back')
    mic.frames = sungFrames([60, 67])
    await vi.advanceTimersByTimeAsync(SUNG_ANSWER.pollMs)
    expect(status()).toContain('Slipped at note 3 of 3')
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
