// ============================================================
// Pulse's Hear it again in the native room, on a fake engine: a replay
// still waiting on the audio engine when the room closes sounds nothing
// once the engine is ready, and a replay sounding when the sound is
// taken away stops with its lamps while the verdict stays.
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { PULSE_TIMING } from '@/lib/ear/timing'
import type * as NativeBuild from '@/lib/native-build'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import type { EarStageProps } from './EarStage'
import { PulseDrill } from './PulseDrill'
import { setRevealRule } from './reveal-pacing'
import type { StageRoom } from './stage-room'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))
vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// Always the first pattern — three quarters — so the test knows the call.
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) => bank[0],
  }
})

/** The room the drill hands its stage, kept to drive and read back. */
const handed: { room: StageRoom | undefined } = { room: undefined }
vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to read back, not drawn
    handed.room = props.room
    return null
  },
}))

const param = () => ({
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn(),
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
  resume: vi.fn(async (): Promise<void> => undefined),
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

const PERIOD = PULSE_TIMING.periodMs
const BAR = PULSE_TIMING.beats * PERIOD
const LEAD = PULSE_TIMING.leadS * 1000

function room(): StageRoom {
  if (!handed.room) throw new Error('Pulse handed its stage no room')
  return handed.room
}

/** A run, and a bar left untapped: the miss waits on its verdict. */
async function toTheVerdict(): Promise<void> {
  room().again?.()
  await vi.advanceTimersByTimeAsync(
    LEAD + 2 * BAR + PULSE_TIMING.waitBeats * PERIOD + PULSE_TIMING.tailMs,
  )
  expect(room().beat()).toBe('reveal')
  expect(room().replay?.allowed()).toBe(true)
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  // The room's pacing: a miss waits for Next.
  setRevealRule('merc')
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
    ],
  })
})

afterEach(() => {
  cleanup()
  setRevealRule('switch')
  handed.room = undefined
  vi.useRealTimers()
})

describe("Pulse's Hear it again", () => {
  it('sounds nothing once the room closes while it waits on the audio', async () => {
    const { unmount } = render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    await toTheVerdict()

    // The audio is slow to wake for the replay (iOS after a call).
    let wake = (): void => undefined
    engine.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          wake = resolve
        }),
    )
    room().replay?.play()
    await vi.advanceTimersByTimeAsync(0)
    const before = ctx.createOscillator.mock.calls.length

    unmount()
    wake()
    await vi.advanceTimersByTimeAsync(LEAD + 2 * BAR)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(before)
  })

  it('stops with its lamps when the sound is taken away, and the verdict stays', async () => {
    render(() => (
      <Stage>
        <PulseDrill onBack={vi.fn()} />
      </Stage>
    ))
    await toTheVerdict()

    const before = ctx.createOscillator.mock.calls.length
    room().replay?.play()
    await vi.advanceTimersByTimeAsync(LEAD + BAR / 2)
    // The count-in and the call again, sounding.
    expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(before)
    expect(room().sounding()).toBe(true)

    room().hold?.()
    const replayed = ctx.createOscillator.mock.results
      .slice(before)
      .map((r) => r.value as { stop: ReturnType<typeof vi.fn> })
    // Each click stopped by its own schedule and again by the silencing.
    expect(replayed.every((osc) => osc.stop.mock.calls.length === 2)).toBe(true)
    expect(room().sounding()).toBe(false)
    expect(room().beat()).toBe('reveal')
    expect(room().replay?.allowed()).toBe(true)
    // Nothing of it comes back once its timers would have fired.
    await vi.advanceTimersByTimeAsync(2 * BAR)
    expect(room().sounding()).toBe(false)
    expect(room().beat()).toBe('reveal')
  })
})
