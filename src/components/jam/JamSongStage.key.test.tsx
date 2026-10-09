// ============================================================
// JamSongStage — the key engine's failure belongs to the stage that saw it
// ============================================================
//
// Whether this device can shift its audio is a store signal, because the
// room key beside the transport reads it from outside the stage. The stage
// lowers it when its own engine fails, and nothing raised it again: one
// failure that was only a busy phone missing the engine's start deadline
// turned the room key off for every song after it, until a reload, and the
// host's control said the key could not change on this device. Each stage
// makes an engine of its own, so each starts from what the device can do.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamKeyShiftDeps } from '@/lib/jam/jam-key-shift'

const engines = vi.hoisted(() => ({
  made: [] as { onUnavailable: (error?: unknown) => void }[],
}))

// The engine needs AudioWorklet; what a stage does when it fails does not.
vi.mock('@/lib/jam/jam-key-shift', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createJamKeyShift: (deps: JamKeyShiftDeps) => {
    engines.made.push(deps)
    return {
      backingOutput: (ctx: AudioContext) => ctx.destination,
      guideOutput: (ctx: AudioContext) => ctx.destination,
      apply: () => undefined,
      latencySec: () => 0,
      shiftSemitones: () => 0,
      available: () => true,
      dispose: () => undefined,
    }
  },
}))

// A stage asks for the audio engine on mount and waits for it; none is
// needed to see what it does with a failure.
vi.mock('@/stores/app-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  initAudioEngine: () => new Promise(() => undefined),
}))

import { jamKeyShiftAvailable, setJamKeyShiftAvailable, } from '@/stores/jam-store'
import { JamSongStage } from './JamSongStage'

beforeEach(() => {
  engines.made = []
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the room key on a device whose engine failed once', () => {
  it('can change the key again on the next song stage', () => {
    vi.stubGlobal('AudioWorkletNode', vi.fn())
    const first = render(() => <JamSongStage />)
    engines.made
      .at(-1)!
      .onUnavailable(new Error('The engine missed its start.'))
    expect(jamKeyShiftAvailable()).toBe(false)
    first.unmount()

    render(() => <JamSongStage />)

    expect(jamKeyShiftAvailable()).toBe(true)
  })

  it('still says so on a device that has no AudioWorklet to run it on', () => {
    setJamKeyShiftAvailable(true)

    render(() => <JamSongStage />)

    expect(typeof AudioWorkletNode).toBe('undefined')
    expect(jamKeyShiftAvailable()).toBe(false)
  })
})
