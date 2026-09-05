// ── GuitarContext lifecycle regression tests ─────────────────────────
// Verifies that async mic acquisition cannot outlive its owning guitar mode.

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuitarProvider, useGuitar } from '@/contexts/GuitarContext'
import { TAB_GUITAR, TAB_HOME } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'

const engineMocks = vi.hoisted(() => ({
  audioEngine: {
    audioCtx: null,
    getTimeData: vi.fn(() => new Float32Array(0)),
    onMicLost: vi.fn(() => vi.fn()),
    outputDeviceSupported: vi.fn(() => false),
    playClick: vi.fn(),
    playNote: vi.fn(),
    playTone: vi.fn(),
    setInstrument: vi.fn(),
    setOutputDevice: vi.fn(async () => undefined),
    startMic: vi.fn(async () => true),
    stopAllNotes: vi.fn(),
    stopMic: vi.fn(),
    stopTone: vi.fn(),
  },
  practiceEngine: {
    startMic: vi.fn<() => Promise<boolean>>(),
    stopMic: vi.fn(),
  },
}))

vi.mock('@/contexts/EngineContext', () => ({
  useEngines: () => ({
    audioEngine: engineMocks.audioEngine,
    playbackRuntime: {},
    practiceEngine: engineMocks.practiceEngine,
    ready: () => true,
  }),
}))

describe('GuitarContext mode lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveTab(TAB_HOME)
    engineMocks.audioEngine.startMic.mockReset()
    engineMocks.audioEngine.startMic.mockResolvedValue(true)
    engineMocks.audioEngine.stopMic.mockReset()
    engineMocks.practiceEngine.startMic.mockReset()
    engineMocks.practiceEngine.startMic.mockResolvedValue(true)
    engineMocks.practiceEngine.stopMic.mockReset()
  })

  afterEach(() => {
    cleanup()
    setActiveTab(TAB_HOME)
  })

  it('releases a Sing-to-Fretboard mic grant that resolves after tab leave', async () => {
    let resolveStart: ((started: boolean) => void) | undefined
    engineMocks.audioEngine.startMic.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )

    let guitarContext: ReturnType<typeof useGuitar> | undefined
    const Probe: Component = () => {
      guitarContext = useGuitar()
      return null
    }

    render(() => (
      <GuitarProvider>
        <Probe />
      </GuitarProvider>
    ))

    if (!guitarContext) throw new Error('GuitarProvider did not render')
    setActiveTab(TAB_GUITAR)
    guitarContext.fretboard.setGuitarView('interactive')
    guitarContext.fretboard.setFretboardMode('singToFretboard')

    await waitFor(() => {
      expect(engineMocks.audioEngine.startMic).toHaveBeenCalledTimes(1)
    })
    expect(guitarContext.modes.singToFretboard.running()).toBe(true)
    expect(engineMocks.practiceEngine.startMic).not.toHaveBeenCalled()

    setActiveTab(TAB_HOME)
    await waitFor(() => {
      expect(engineMocks.audioEngine.stopMic).toHaveBeenCalledTimes(1)
    })

    resolveStart?.(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(engineMocks.audioEngine.stopMic).toHaveBeenCalledTimes(2)
    expect(guitarContext.modes.singToFretboard.running()).toBe(false)
  })

  it('keeps one pending guitar mic claim across Tuner to Sing', async () => {
    let resolveStart: ((started: boolean) => void) | undefined
    const pendingStart = new Promise<boolean>((resolve) => {
      resolveStart = resolve
    })
    engineMocks.audioEngine.startMic.mockImplementation(() => pendingStart)

    let guitarContext: ReturnType<typeof useGuitar> | undefined
    const Probe: Component = () => {
      guitarContext = useGuitar()
      return null
    }

    render(() => (
      <GuitarProvider>
        <Probe />
      </GuitarProvider>
    ))

    if (!guitarContext) throw new Error('GuitarProvider did not render')
    const context = guitarContext
    setActiveTab(TAB_GUITAR)
    context.fretboard.setGuitarView('interactive')
    context.fretboard.setFretboardMode('tuner')

    await waitFor(() => {
      expect(engineMocks.audioEngine.startMic).toHaveBeenCalledTimes(1)
    })

    context.fretboard.setFretboardMode('singToFretboard')
    await waitFor(() => {
      expect(context.modes.singToFretboard.running()).toBe(true)
    })
    expect(engineMocks.audioEngine.startMic).toHaveBeenCalledTimes(1)
    resolveStart?.(true)

    await waitFor(() => {
      expect(context.guitar.isMicActive()).toBe(true)
    })
    expect(engineMocks.practiceEngine.startMic).not.toHaveBeenCalled()
    expect(engineMocks.audioEngine.stopMic).not.toHaveBeenCalled()
  })

  it('does not stop an existing guitar mic after visiting Sing', async () => {
    engineMocks.practiceEngine.stopMic.mockImplementation(() => {
      engineMocks.audioEngine.stopMic()
    })

    let guitarContext: ReturnType<typeof useGuitar> | undefined
    const Probe: Component = () => {
      guitarContext = useGuitar()
      return null
    }

    render(() => (
      <GuitarProvider>
        <Probe />
      </GuitarProvider>
    ))

    if (!guitarContext) throw new Error('GuitarProvider did not render')
    const context = guitarContext
    expect(await context.guitar.startMic()).toBe(true)
    expect(context.guitar.isMicActive()).toBe(true)

    setActiveTab(TAB_GUITAR)
    context.fretboard.setGuitarView('interactive')
    context.fretboard.setFretboardMode('singToFretboard')
    await waitFor(() => {
      expect(context.modes.singToFretboard.running()).toBe(true)
    })

    context.fretboard.setFretboardMode('explore')
    await waitFor(() => {
      expect(context.modes.singToFretboard.running()).toBe(false)
    })

    expect(engineMocks.audioEngine.stopMic).not.toHaveBeenCalled()
    expect(engineMocks.practiceEngine.startMic).not.toHaveBeenCalled()
    expect(context.guitar.isMicActive()).toBe(true)
  })

  it('does not let a stale Tuner start stop a newer user start', async () => {
    let resolveStart: ((started: boolean) => void) | undefined
    const pendingStart = new Promise<boolean>((resolve) => {
      resolveStart = resolve
    })
    engineMocks.audioEngine.startMic.mockImplementation(() => pendingStart)

    let guitarContext: ReturnType<typeof useGuitar> | undefined
    const Probe: Component = () => {
      guitarContext = useGuitar()
      return null
    }

    render(() => (
      <GuitarProvider>
        <Probe />
      </GuitarProvider>
    ))

    if (!guitarContext) throw new Error('GuitarProvider did not render')
    setActiveTab(TAB_GUITAR)
    guitarContext.fretboard.setGuitarView('interactive')
    guitarContext.fretboard.setFretboardMode('tuner')
    await waitFor(() => {
      expect(engineMocks.audioEngine.startMic).toHaveBeenCalledTimes(1)
    })

    guitarContext.fretboard.setFretboardMode('explore')
    const stopsBeforeReplacement =
      engineMocks.audioEngine.stopMic.mock.calls.length
    const replacementStart = guitarContext.guitar.startMic()
    resolveStart?.(true)

    expect(await replacementStart).toBe(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(guitarContext.guitar.isMicActive()).toBe(true)
    expect(engineMocks.audioEngine.stopMic).toHaveBeenCalledTimes(
      stopsBeforeReplacement,
    )
  })
})
