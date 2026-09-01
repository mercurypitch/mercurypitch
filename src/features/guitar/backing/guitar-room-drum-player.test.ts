// ============================================================
// Guitar room drum player tests — no capability work before activation
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLazyGuitarRoomDrumPlayer } from './guitar-room-drum-player'

const samplePlayer = vi.hoisted(() => ({
  createDrumKitPlayer: vi.fn(),
}))
const circuitPlayer = vi.hoisted(() => ({
  createCircuitDrumSynth: vi.fn(),
}))

vi.mock('@/features/drum-night/audio/drum-kit-player', () => samplePlayer)
vi.mock('@/features/drum-night/audio/circuit-drum-synth', () => circuitPlayer)

beforeEach(() => {
  vi.clearAllMocks()
})

function playerPort() {
  return {
    activate: vi.fn(() => true),
    trigger: vi.fn(() => 'synth-fallback' as const),
    panic: vi.fn(),
    dispose: vi.fn(),
  }
}

describe('createLazyGuitarRoomDrumPlayer', () => {
  it('does not construct or import a selected sample kit before activation', async () => {
    const port = playerPort()
    samplePlayer.createDrumKitPlayer.mockReturnValue(port)
    const context = {} as AudioContext
    const output = {} as AudioNode
    const player = createLazyGuitarRoomDrumPlayer({
      getAudioContext: () => context,
      getOutput: () => output,
      kitId: 'studio',
    })

    expect(samplePlayer.createDrumKitPlayer).not.toHaveBeenCalled()
    expect(player.trigger({ gmKey: 36, velocity: 100 })).toBe('dropped')

    await expect(player.activate()).resolves.toBe(true)
    expect(samplePlayer.createDrumKitPlayer).toHaveBeenCalledWith({
      getAudioContext: expect.any(Function),
      getOutput: expect.any(Function),
      initialKitId: 'studio',
    })
    expect(circuitPlayer.createCircuitDrumSynth).not.toHaveBeenCalled()
  })

  it('uses the explicit Circuit model only when Circuit was selected', async () => {
    const port = playerPort()
    circuitPlayer.createCircuitDrumSynth.mockReturnValue(port)
    const player = createLazyGuitarRoomDrumPlayer({
      getAudioContext: () => ({}) as AudioContext,
      getOutput: () => ({}) as AudioNode,
      kitId: 'circuit',
    })

    await expect(player.activate()).resolves.toBe(true)
    expect(circuitPlayer.createCircuitDrumSynth).toHaveBeenCalledOnce()
    expect(samplePlayer.createDrumKitPlayer).not.toHaveBeenCalled()
  })

  it('settles a late activation and disposes its player', async () => {
    let resolveActivation!: (ready: boolean) => void
    const port = playerPort()
    port.activate.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveActivation = resolve
      }) as never,
    )
    samplePlayer.createDrumKitPlayer.mockReturnValue(port)
    const player = createLazyGuitarRoomDrumPlayer({
      getAudioContext: () => ({}) as AudioContext,
      getOutput: () => ({}) as AudioNode,
      kitId: 'classic-gm',
    })

    const activation = player.activate()
    await vi.waitFor(() =>
      expect(samplePlayer.createDrumKitPlayer).toHaveBeenCalledOnce(),
    )
    const disposal = player.dispose()
    resolveActivation(true)

    await expect(activation).resolves.toBe(true)
    await disposal
    expect(port.dispose).toHaveBeenCalledOnce()
    await expect(player.activate()).resolves.toBe(false)
  })
})
