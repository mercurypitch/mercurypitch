// ============================================================
// Drum Night audio-session tests — gesture creation and route teardown
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createDrumNightAudioSession, DRUM_NIGHT_OUTPUT_COMPRESSOR, DRUM_NIGHT_OUTPUT_MAKEUP_DB, DRUM_NIGHT_OUTPUT_SAFETY_DB, } from './drum-night-audio-session'

function audioHarness() {
  const makeParam = () => ({ setValueAtTime: vi.fn() })
  const makeup = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: makeParam(),
  } as unknown as GainNode
  const safety = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: makeParam(),
  } as unknown as GainNode
  const compressor = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    threshold: makeParam(),
    knee: makeParam(),
    ratio: makeParam(),
    attack: makeParam(),
    release: makeParam(),
  } as unknown as DynamicsCompressorNode
  const close = vi.fn(async () => undefined)
  const context = {
    close,
    createDynamicsCompressor: vi.fn(() => compressor),
    createGain: vi
      .fn<() => GainNode>()
      .mockReturnValueOnce(makeup)
      .mockReturnValueOnce(safety),
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    state: 'running',
  } as unknown as AudioContext
  return { close, compressor, context, makeup, safety }
}

describe('createDrumNightAudioSession', () => {
  it('does not construct Web Audio until a gesture-owned getter is called', () => {
    const harness = audioHarness()
    const createContext = vi.fn(() => harness.context)
    const session = createDrumNightAudioSession({ createContext })

    expect(createContext).not.toHaveBeenCalled()
    expect(session.activeContext()).toBeNull()
    expect(session.activeOutput()).toBeNull()
    expect(session.performanceTimestampToContextTime(1_000)).toBeNull()
    expect(createContext).not.toHaveBeenCalled()
    expect(session.contextForGesture()).toBe(harness.context)
    expect(session.outputForGesture()).toBe(harness.makeup)
    expect(createContext).toHaveBeenCalledOnce()
    expect(harness.makeup.connect).toHaveBeenCalledWith(harness.compressor)
    expect(harness.compressor.connect).toHaveBeenCalledWith(harness.safety)
    expect(harness.safety.connect).toHaveBeenCalledWith(
      harness.context.destination,
    )
  })

  it('applies bounded makeup before compression and a final safety trim', () => {
    const harness = audioHarness()
    const session = createDrumNightAudioSession({
      createContext: () => harness.context,
    })

    session.outputForGesture()

    expect(harness.makeup.gain.setValueAtTime).toHaveBeenCalledWith(
      10 ** (DRUM_NIGHT_OUTPUT_MAKEUP_DB / 20),
      0,
    )
    expect(harness.compressor.threshold.setValueAtTime).toHaveBeenCalledWith(
      DRUM_NIGHT_OUTPUT_COMPRESSOR.thresholdDb,
      0,
    )
    expect(harness.compressor.knee.setValueAtTime).toHaveBeenCalledWith(
      DRUM_NIGHT_OUTPUT_COMPRESSOR.kneeDb,
      0,
    )
    expect(harness.compressor.ratio.setValueAtTime).toHaveBeenCalledWith(
      DRUM_NIGHT_OUTPUT_COMPRESSOR.ratio,
      0,
    )
    expect(harness.compressor.attack.setValueAtTime).toHaveBeenCalledWith(
      DRUM_NIGHT_OUTPUT_COMPRESSOR.attackSeconds,
      0,
    )
    expect(harness.compressor.release.setValueAtTime).toHaveBeenCalledWith(
      DRUM_NIGHT_OUTPUT_COMPRESSOR.releaseSeconds,
      0,
    )
    expect(harness.safety.gain.setValueAtTime).toHaveBeenCalledWith(
      10 ** (DRUM_NIGHT_OUTPUT_SAFETY_DB / 20),
      0,
    )
  })

  it('maps performance timestamps against an already-active context without reacquiring it', () => {
    const harness = audioHarness()
    Object.defineProperty(harness.context, 'currentTime', { value: 12.5 })
    const createContext = vi.fn(() => harness.context)
    const session = createDrumNightAudioSession({
      createContext,
      nowMs: () => 2_000,
    })

    session.contextForGesture()

    expect(session.activeContext()).toBe(harness.context)
    expect(session.activeOutput()).toBe(harness.makeup)
    expect(session.performanceTimestampToContextTime(2_250)).toBe(12.75)
    expect(createContext).toHaveBeenCalledOnce()
  })

  it('disconnects the output and closes its route-owned context once', async () => {
    const harness = audioHarness()
    const session = createDrumNightAudioSession({
      createContext: () => harness.context,
    })
    session.contextForGesture()

    await session.dispose()
    await session.dispose()

    expect(harness.makeup.disconnect).toHaveBeenCalledOnce()
    expect(harness.compressor.disconnect).toHaveBeenCalledOnce()
    expect(harness.safety.disconnect).toHaveBeenCalledOnce()
    expect(harness.close).toHaveBeenCalledOnce()
    expect(session.contextForGesture()).toBeNull()
    expect(session.activeContext()).toBeNull()
    expect(session.activeOutput()).toBeNull()
    expect(session.performanceTimestampToContextTime(1_000)).toBeNull()
  })

  it('returns a silent boundary when context construction fails', () => {
    const session = createDrumNightAudioSession({
      createContext: () => {
        throw new Error('blocked')
      },
    })

    expect(session.contextForGesture()).toBeNull()
    expect(session.outputForGesture()).toBeNull()
  })

  it('can acquire a fresh graph on a later gesture after construction fails', () => {
    const harness = audioHarness()
    const createContext = vi
      .fn<() => AudioContext>()
      .mockImplementationOnce(() => {
        throw new Error('transient failure')
      })
      .mockReturnValue(harness.context)
    const session = createDrumNightAudioSession({ createContext })

    expect(session.contextForGesture()).toBeNull()
    expect(session.contextForGesture()).toBe(harness.context)
    expect(session.outputForGesture()).toBe(harness.makeup)
    expect(createContext).toHaveBeenCalledTimes(2)
    expect(harness.makeup.connect).toHaveBeenCalledOnce()
  })
})
