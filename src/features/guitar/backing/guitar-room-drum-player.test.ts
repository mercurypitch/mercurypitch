// ============================================================
// Guitar room drum player tests — inert intent and live five-kit switching
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightDrumKitId } from '@/features/guitar-night/guitar-night-drum-sound'
import { createLazyGuitarRoomDrumPlayer } from './guitar-room-drum-player'

const samplePlayer = vi.hoisted(() => ({
  createDrumKitPlayer: vi.fn(),
}))

vi.mock('@/features/drum-night/audio/drum-kit-player', () => samplePlayer)

beforeEach(() => {
  vi.clearAllMocks()
})

function playerPort() {
  return {
    activate: vi.fn(() => true),
    trigger: vi.fn(() => 'synth-fallback' as const),
    panic: vi.fn(),
    dispose: vi.fn(),
    selectKit: vi.fn(
      async (_kitId: GuitarNightDrumKitId): Promise<void> => undefined,
    ),
    choke: vi.fn(() => 'idle' as const),
    prewarm: vi.fn(async () => undefined),
    snapshot: vi.fn(() => ({
      selectedKitId: 'studio' as const,
      sampleStatus: 'ready' as const,
      status: 'ready' as const,
      fallbackReady: true,
      sampledReady: true,
      loadedSamples: 5,
      preparedSamples: 5,
      plannedSamples: 5,
      selectedFormat: 'opus' as const,
      decodedBytes: 1_024,
      publishedEncodedBytes: 512,
      error: null,
    })),
    subscribe: vi.fn((_listener: () => void) => () => undefined),
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
  })

  it('keeps rapid pre-activation intent inert and opens the latest kit', async () => {
    const port = playerPort()
    samplePlayer.createDrumKitPlayer.mockReturnValue(port)
    const player = createLazyGuitarRoomDrumPlayer({
      getAudioContext: () => ({}) as AudioContext,
      getOutput: () => ({}) as AudioNode,
      kitId: 'mercury-synth',
    })

    player.setKit('studio')
    player.setKit('circuit')

    expect(samplePlayer.createDrumKitPlayer).not.toHaveBeenCalled()
    await expect(player.activate()).resolves.toBe(true)
    expect(samplePlayer.createDrumKitPlayer).toHaveBeenCalledWith({
      getAudioContext: expect.any(Function),
      getOutput: expect.any(Function),
      initialKitId: 'circuit',
    })
    expect(port.selectKit).not.toHaveBeenCalled()
  })

  it('reconciles a kit change that lands while the lazy player is being published', async () => {
    const port = playerPort()
    samplePlayer.createDrumKitPlayer.mockImplementation(() => {
      queueMicrotask(() => player.setKit('circuit'))
      return port
    })
    const player = createLazyGuitarRoomDrumPlayer({
      getAudioContext: () => ({}) as AudioContext,
      getOutput: () => ({}) as AudioNode,
      kitId: 'studio',
    })

    await expect(player.activate()).resolves.toBe(true)
    expect(samplePlayer.createDrumKitPlayer).toHaveBeenCalledWith({
      getAudioContext: expect.any(Function),
      getOutput: expect.any(Function),
      initialKitId: 'studio',
    })
    expect(port.selectKit).toHaveBeenCalledOnce()
    expect(port.selectKit).toHaveBeenCalledWith('circuit')
  })

  it('delegates rapid live Circuit and sampled switches without awaiting warm-up', async () => {
    let rejectStudio!: (reason: unknown) => void
    const port = playerPort()
    port.selectKit.mockImplementation((kitId) => {
      if (kitId !== 'studio') return Promise.resolve()
      return new Promise<void>((_resolve, reject) => {
        rejectStudio = reject
      })
    })
    samplePlayer.createDrumKitPlayer.mockReturnValue(port)
    const player = createLazyGuitarRoomDrumPlayer({
      getAudioContext: () => ({}) as AudioContext,
      getOutput: () => ({}) as AudioNode,
      kitId: 'mercury-synth',
    })
    await player.activate()

    expect(player.setKit('studio')).toBeUndefined()
    expect(player.setKit('circuit')).toBeUndefined()
    expect(port.selectKit.mock.calls.map(([kitId]) => kitId)).toEqual([
      'studio',
      'circuit',
    ])

    rejectStudio(new DOMException('Superseded', 'AbortError'))
    await Promise.resolve()
    expect(port.selectKit).toHaveBeenLastCalledWith('circuit')
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

  it('forwards GM chokes, used-score prewarm, and truthful readiness only after activation', async () => {
    let publishSnapshot = (): void => undefined
    const port = playerPort()
    port.subscribe.mockImplementation((listener) => {
      publishSnapshot = listener
      return () => undefined
    })
    samplePlayer.createDrumKitPlayer.mockReturnValue(port)
    const player = createLazyGuitarRoomDrumPlayer({
      getAudioContext: () => ({}) as AudioContext,
      getOutput: () => ({}) as AudioNode,
      kitId: 'studio',
    })
    const listener = vi.fn()
    player.subscribe?.(listener)

    expect(player.snapshot?.()).toMatchObject({
      selectedKitId: 'studio',
      status: 'idle',
      fallbackReady: false,
      sampledReady: false,
    })
    expect(player.choke?.({ gmKey: 49, lane: 'authored' })).toBe('dropped')

    await player.activate()
    expect(player.choke?.({ gmKey: 49, lane: 'authored' })).toBe('idle')
    expect(port.choke).toHaveBeenCalledWith({ gmKey: 49, lane: 'authored' })
    await player.prewarm?.([{ gmKey: 49, velocity: 116 }])
    expect(port.prewarm).toHaveBeenCalledWith([{ gmKey: 49, velocity: 116 }])
    expect(player.snapshot?.()).toMatchObject({
      status: 'ready',
      sampleStatus: 'ready',
      fallbackReady: true,
      sampledReady: true,
      selectedFormat: 'opus',
    })

    publishSnapshot()
    expect(listener).toHaveBeenCalledOnce()
  })
})
