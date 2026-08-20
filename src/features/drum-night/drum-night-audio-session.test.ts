// ============================================================
// Drum Night audio-session tests — gesture creation and route teardown
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createDrumNightAudioSession } from './drum-night-audio-session'

function audioHarness() {
  const disconnect = vi.fn()
  const connect = vi.fn()
  const setValueAtTime = vi.fn()
  const output = {
    connect,
    disconnect,
    gain: { setValueAtTime },
  } as unknown as GainNode
  const close = vi.fn(async () => undefined)
  const context = {
    close,
    createGain: vi.fn(() => output),
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    state: 'running',
  } as unknown as AudioContext
  return { close, connect, context, disconnect, output, setValueAtTime }
}

describe('createDrumNightAudioSession', () => {
  it('does not construct Web Audio until a gesture-owned getter is called', () => {
    const harness = audioHarness()
    const createContext = vi.fn(() => harness.context)
    const session = createDrumNightAudioSession({ createContext })

    expect(createContext).not.toHaveBeenCalled()
    expect(session.contextForGesture()).toBe(harness.context)
    expect(session.outputForGesture()).toBe(harness.output)
    expect(createContext).toHaveBeenCalledOnce()
    expect(harness.connect).toHaveBeenCalledWith(harness.context.destination)
  })

  it('disconnects the output and closes its route-owned context once', async () => {
    const harness = audioHarness()
    const session = createDrumNightAudioSession({
      createContext: () => harness.context,
    })
    session.contextForGesture()

    await session.dispose()
    await session.dispose()

    expect(harness.disconnect).toHaveBeenCalledOnce()
    expect(harness.close).toHaveBeenCalledOnce()
    expect(session.contextForGesture()).toBeNull()
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
    expect(session.outputForGesture()).toBe(harness.output)
    expect(createContext).toHaveBeenCalledTimes(2)
    expect(harness.connect).toHaveBeenCalledOnce()
  })
})
