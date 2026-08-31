import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { ARMING_CUE_GAIN, useArmingCue } from './arming-cue'
import { scheduleClick } from './click-synth'
import { EAR_VOLUME } from './ear-sound'

const cancel = vi.fn()
vi.mock('./click-synth', () => ({
  scheduleClick: vi.fn(() => ({ cancel })),
}))

afterEach(() => cleanup())

describe('useArmingCue', () => {
  it('clicks once each time the pads arm, on the click voice, under the bench volume', () => {
    const [armed, setArmed] = createSignal(false)
    const ctx = { currentTime: 2.5 } as AudioContext
    const engine = {
      getAudioContext: () => ctx,
      getVolume: () => 0.5,
    } as unknown as AudioEngine

    function Probe(): null {
      useArmingCue(armed)
      return null
    }
    render(() => (
      <EngineContext.Provider
        value={{
          audioEngine: engine,
          playbackRuntime: {} as PlaybackRuntime,
          practiceEngine: {} as PracticeEngine,
          ready: () => true,
        }}
      >
        <Probe />
      </EngineContext.Provider>
    ))
    expect(scheduleClick).not.toHaveBeenCalled()
    setArmed(true)
    expect(scheduleClick).toHaveBeenCalledTimes(1)
    const [, at, options] = vi.mocked(scheduleClick).mock.calls[0] ?? []
    expect(at).toBe(2.5)
    expect(options?.gainLevel).toBeCloseTo(
      ARMING_CUE_GAIN * 0.5 * EAR_VOLUME.defaultValue,
    )
    // Armed stays armed: no second click until the pads re-arm.
    setArmed(true)
    expect(scheduleClick).toHaveBeenCalledTimes(1)
    setArmed(false)
    // Disarming silences the click, so Stop leaves nothing sounding.
    expect(cancel).toHaveBeenCalledTimes(1)
    setArmed(true)
    expect(scheduleClick).toHaveBeenCalledTimes(2)
  })

  it('never lets a context that cannot click break the run', () => {
    vi.mocked(scheduleClick).mockImplementationOnce(() => {
      throw new Error('closed')
    })
    const [armed, setArmed] = createSignal(false)
    const engine = {
      getAudioContext: () => ({ currentTime: 0 }) as AudioContext,
      getVolume: () => 1,
    } as unknown as AudioEngine

    function Probe(): null {
      useArmingCue(armed)
      return null
    }
    render(() => (
      <EngineContext.Provider
        value={{
          audioEngine: engine,
          playbackRuntime: {} as PlaybackRuntime,
          practiceEngine: {} as PracticeEngine,
          ready: () => true,
        }}
      >
        <Probe />
      </EngineContext.Provider>
    ))
    expect(() => setArmed(true)).not.toThrow()
  })
})
