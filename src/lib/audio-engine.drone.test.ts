// ============================================================
// The engine's drone: one oscillator on the drone's partials, as a tone
// ============================================================
//
// Drone Intonation's drone sounds through playDrone, whatever the app's
// instrument: one oscillator whose wave is built from DRONE_PARTIALS, held
// for the round and released by the next tone or by stopTone like any
// tone. The shared Web Audio double (src/tests/setup-common.ts) stands in
// for the context; its oscillators and waves are recorded here.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from './audio-engine'
import { DRONE_PARTIALS } from './drone-voice'

interface RecordedOscillator {
  frequency: { value: number }
  setPeriodicWave: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  type: string
}

describe('AudioEngine.playDrone', () => {
  let engine: AudioEngine
  let oscillators: RecordedOscillator[]
  let waves: Array<{ real: Float32Array; imag: Float32Array; wave: object }>

  beforeEach(async () => {
    engine = new AudioEngine()
    await engine.init()
    const ctx = engine.getAudioContext()!
    oscillators = []
    waves = []
    const createOscillator = ctx.createOscillator.bind(ctx)
    vi.spyOn(ctx, 'createOscillator').mockImplementation(() => {
      const osc = createOscillator() as unknown as RecordedOscillator
      osc.setPeriodicWave = vi.fn()
      osc.start = vi.fn()
      osc.stop = vi.fn()
      oscillators.push(osc)
      return osc as unknown as OscillatorNode
    })
    vi.spyOn(ctx, 'createPeriodicWave').mockImplementation(
      (real: Iterable<number>, imag: Iterable<number>) => {
        const wave = {}
        waves.push({
          real: Float32Array.from(real),
          imag: Float32Array.from(imag),
          wave,
        })
        return wave as PeriodicWave
      },
    )
  })

  afterEach(() => {
    engine.destroy()
    vi.restoreAllMocks()
  })

  it('sounds one oscillator on a wave of the drone partials, at the drone', async () => {
    // Act
    await engine.playDrone(130.81, 6000)

    // Assert
    expect(oscillators).toHaveLength(1)
    expect(oscillators[0].frequency.value).toBe(130.81)
    expect(waves).toHaveLength(1)
    expect(oscillators[0].setPeriodicWave).toHaveBeenCalledWith(waves[0].wave)
    expect(Array.from(waves[0].imag.slice(1))).toEqual(
      DRONE_PARTIALS.map((level) => Math.fround(level)),
    )
    expect(oscillators[0].start).toHaveBeenCalledOnce()
    expect(engine.isTonePlaying()).toBe(true)
  })

  it('keeps its harmonics whatever the instrument is set to', async () => {
    // The piano would build six sines of its own and die away.
    engine.setInstrument('piano')

    await engine.playDrone(130.81, 6000)

    expect(oscillators).toHaveLength(1)
    expect(oscillators[0].setPeriodicWave).toHaveBeenCalledOnce()
  })

  it('holds for its length and stops just after it, when nothing cuts it short', async () => {
    await engine.playDrone(130.81, 6000)

    // The context's clock stands at 0 in the double.
    const [stopAt] = oscillators[0].stop.mock.calls.at(-1) as [number]
    expect(stopAt).toBeGreaterThan(6)
    expect(stopAt).toBeLessThan(6.2)
  })

  it('is released by stopTone, as a tone is', async () => {
    await engine.playDrone(130.81, 6000)

    engine.stopTone(100)

    const [stopAt] = oscillators[0].stop.mock.calls.at(-1) as [number]
    expect(stopAt).toBeLessThan(0.5)
    expect(engine.isTonePlaying()).toBe(false)
  })

  it('gives way to the next tone', async () => {
    await engine.playDrone(130.81, 6000)

    await engine.playTone(196, 500)

    const [stopAt] = oscillators[0].stop.mock.calls.at(-1) as [number]
    expect(stopAt).toBeLessThan(0.5)
  })
})
