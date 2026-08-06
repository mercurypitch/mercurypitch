// ============================================================
// Stem Mixer Mic Controller — cross-tab handoff recovery tests
// ============================================================

import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MicState } from '@/lib/mic-manager'

const listeners = new Set<(state: MicState) => void>()
let managerState: MicState = {
  active: false,
  error: null,
  consumers: [],
  blockedBy: null,
}

const micManager = {
  acquire: vi.fn(),
  release: vi.fn(),
  getStream: vi.fn(() => null as MediaStream | null),
  subscribe: vi.fn((listener: (state: MicState) => void) => {
    listeners.add(listener)
    listener(managerState)
    return () => listeners.delete(listener)
  }),
}

vi.mock('@/lib/mic-manager', () => ({ micManager }))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: vi.fn(() => () => undefined),
}))

const { useStemMixerMicController } =
  await import('./useStemMixerMicController')

const fakeAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
})

const fakeAudioContext = () => ({
  sampleRate: 48_000,
  createMediaStreamSource: vi.fn(() => fakeAudioNode()),
  createGain: vi.fn(() => ({
    ...fakeAudioNode(),
    gain: { value: 1 },
  })),
  createAnalyser: vi.fn(() => ({
    ...fakeAudioNode(),
    fftSize: 1024,
    smoothingTimeConstant: 0.3,
  })),
})

function emitManagerState(next: MicState): void {
  managerState = next
  for (const listener of listeners) listener(next)
}

describe('useStemMixerMicController', () => {
  beforeEach(() => {
    listeners.clear()
    managerState = {
      active: false,
      error: null,
      consumers: [],
      blockedBy: null,
    }
    micManager.acquire.mockReset()
    micManager.release.mockReset()
    micManager.getStream.mockReturnValue(null)
  })

  it('clears a stale cross-tab error after a successful microphone handoff', async () => {
    const heldElsewhere = {
      kind: 'held-elsewhere' as const,
      message:
        'Another MercuryPitch tab is using your microphone. Use it here instead to move it over.',
    }
    micManager.acquire.mockImplementationOnce(async () => {
      emitManagerState({
        active: false,
        error: heldElsewhere,
        consumers: [],
        blockedBy: { tabId: 'other-tab', label: 'Karaoke', at: Date.now() },
      })
      throw heldElsewhere
    })

    const root = createRoot((dispose) => ({
      controller: useStemMixerMicController({
        getAudioCtx: () => ({}) as AudioContext,
        ensureAudioCtx: () => ({}) as AudioContext,
      }),
      dispose,
    }))

    await root.controller.toggleMic()
    expect(root.controller.micError()).toBe(heldElsewhere.message)

    emitManagerState({
      active: false,
      error: null,
      consumers: [],
      blockedBy: null,
    })

    expect(root.controller.micError()).toBe('')
    expect(root.controller.micActive()).toBe(false)
    root.dispose()
  })

  it('shows the yielding tab as mic off after an intentional handoff', async () => {
    const stream = {} as MediaStream
    const context = fakeAudioContext() as unknown as AudioContext
    micManager.acquire.mockResolvedValueOnce(stream)
    micManager.getStream.mockReturnValue(stream)

    const root = createRoot((dispose) => ({
      controller: useStemMixerMicController({
        getAudioCtx: () => context,
        ensureAudioCtx: () => context,
      }),
      dispose,
    }))

    await root.controller.toggleMic()
    expect(root.controller.micActive()).toBe(true)

    micManager.getStream.mockReturnValue(null)
    emitManagerState({
      active: false,
      error: null,
      consumers: [],
      blockedBy: null,
    })

    expect(root.controller.micActive()).toBe(false)
    expect(root.controller.micError()).toBe('')
    root.dispose()
  })
})
