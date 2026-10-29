// ============================================================
// Hairline in the native room: the room's skin draws its loupe upright,
// and the pads carry the lamps that say which tone is sounding, since
// the upright loupe lights no line. The stage is a stand-in that draws
// the instrument and the console under a skin holding the loupe alone,
// so every other part is the web's own (drills.test.tsx holds the
// web's Hairline to its loupe, with no lamp on a pad).
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import { HAIRLINE_TIMING } from '@/lib/ear/timing'
import type * as NativeBuild from '@/lib/native-build'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import type { EarStageProps, StageSkin } from './EarStage'
import { StageSkinContext } from './EarStage'
import { HairlineDrill } from './HairlineDrill'
import { RoomLoupe } from './merc/RoomLoupe'

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
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))

const SKIN = { VernierLoupe: RoomLoupe } as unknown as StageSkin

vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => (
    <StageSkinContext.Provider value={SKIN}>
      <figure>{props.instrument()}</figure>
      {props.console()}
    </StageSkinContext.Provider>
  ),
}))

const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ({ currentTime: 0 }),
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

const pads = () =>
  within(screen.getByTestId('ear-stage-pads')).getAllByRole('button')
const lamps = () => pads().map((pad) => pad.getAttribute('data-lamp'))

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

describe('Hairline in the room', () => {
  it("draws the room's upright loupe, and lights the pad of the tone sounding", async () => {
    render(() => (
      <Stage>
        <HairlineDrill onBack={vi.fn()} />
      </Stage>
    ))
    expect(
      document.querySelector('[data-instrument="upright-loupe"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-instrument="vernier"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await vi.advanceTimersByTimeAsync(5)
    expect(lamps()).toEqual(['on', 'off'])

    await vi.advanceTimersByTimeAsync(
      HAIRLINE_TIMING.toneMs + HAIRLINE_TIMING.gapMs,
    )
    expect(lamps()).toEqual(['off', 'on'])
    // Nothing on the loupe says which line is which while it sounds.
    expect(screen.queryAllByTestId('loupe-higher')).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(HAIRLINE_TIMING.toneMs + 20)
    expect(lamps()).toEqual(['off', 'off'])
  })

  it('names the higher line at the reveal, and says the magnification', async () => {
    // At 0.75 the coin flip makes the second tone the higher.
    vi.spyOn(Math, 'random').mockReturnValue(0.75)
    render(() => (
      <Stage>
        <HairlineDrill onBack={vi.fn()} />
      </Stage>
    ))
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await vi.advanceTimersByTimeAsync(
      HAIRLINE_TIMING.toneMs * 2 + HAIRLINE_TIMING.gapMs + 20,
    )
    expect(screen.queryAllByTestId('loupe-higher')).toHaveLength(0)

    fireEvent.click(pads()[1])

    expect(screen.getByTestId('loupe-higher').textContent).toBe('The second')
    // The run's first gap, 50 cents, at twice the scale.
    expect(screen.getByTestId('loupe-magnification').textContent).toBe('×2')
  })
})
