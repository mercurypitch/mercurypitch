// ============================================================
// DrumMachinePanel tests — direct controls activate Web Audio before use
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DrumMachinePanel } from '@/components/guitar/DrumMachinePanel'
import type { DrumMachine } from '@/lib/guitar/drum-machine'
import type { DrumPattern, DrumSound } from '@/lib/guitar/drum-machine'
import { DRUM_SOUNDS } from '@/lib/guitar/drum-machine'

afterEach(cleanup)

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function createUninitializedDrumMachine(initGate?: Promise<void>) {
  let initialized = false
  let playing = false
  const listeners = new Set<() => void>()
  const triggered: DrumSound[] = []
  const pattern = Object.fromEntries(
    DRUM_SOUNDS.map((sound) => [sound, new Array<boolean>(16).fill(false)]),
  ) as DrumPattern
  const volumes = Object.fromEntries(
    DRUM_SOUNDS.map((sound) => [sound, 0.8]),
  ) as Record<DrumSound, number>

  const init = vi.fn(async () => {
    if (initGate) await initGate
    initialized = true
  })
  const start = vi.fn(async () => {
    if (!initialized) return
    playing = true
    for (const listener of listeners) listener()
  })
  const trigger = vi.fn((sound: DrumSound) => {
    if (initialized) triggered.push(sound)
  })
  const stop = vi.fn(() => {
    playing = false
    for (const listener of listeners) listener()
  })
  const unsubscribe = vi.fn((listener: () => void) => {
    listeners.delete(listener)
  })

  const machine = {
    get playing() {
      return playing
    },
    get bpm() {
      return 120
    },
    get currentStep() {
      return 0
    },
    get pattern() {
      return pattern
    },
    get volumes() {
      return volumes
    },
    init,
    start,
    stop,
    trigger,
    toggleStep: vi.fn(),
    loadPreset: vi.fn(),
    setBpm: vi.fn(),
    setVolume: vi.fn(),
    clearPattern: vi.fn(),
    onChange: vi.fn((listener: () => void) => {
      listeners.add(listener)
      return () => unsubscribe(listener)
    }),
  } as unknown as DrumMachine

  return { init, machine, start, stop, trigger, triggered, unsubscribe }
}

describe('DrumMachinePanel audio activation', () => {
  it('initializes the drum machine before starting from Play', async () => {
    const { init, machine, start } = createUninitializedDrumMachine()
    render(() => <DrumMachinePanel drumMachine={machine} />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    await waitFor(() => expect(screen.getByText('Playing')).toBeInTheDocument())
    expect(init).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledOnce()
    expect(init.mock.invocationCallOrder[0]).toBeLessThan(
      start.mock.invocationCallOrder[0],
    )
  })

  it('initializes the drum machine before auditioning a sound', async () => {
    const { init, machine, trigger, triggered } =
      createUninitializedDrumMachine()
    render(() => <DrumMachinePanel drumMachine={machine} />)

    fireEvent.click(screen.getByTitle('Test Kick'))

    await waitFor(() => expect(triggered).toEqual(['kick']))
    expect(init).toHaveBeenCalledOnce()
    expect(trigger).toHaveBeenCalledOnce()
    expect(init.mock.invocationCallOrder[0]).toBeLessThan(
      trigger.mock.invocationCallOrder[0],
    )
  })

  it('does not start if initialization resolves after unmount', async () => {
    const gate = createDeferred()
    const { init, machine, start } = createUninitializedDrumMachine(
      gate.promise,
    )
    const { unmount } = render(() => <DrumMachinePanel drumMachine={machine} />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(init).toHaveBeenCalledOnce()
    unmount()

    gate.resolve()
    await gate.promise
    await Promise.resolve()

    expect(start).not.toHaveBeenCalled()
  })

  it('does not audition a sound if initialization resolves after unmount', async () => {
    const gate = createDeferred()
    const { init, machine, trigger } = createUninitializedDrumMachine(
      gate.promise,
    )
    const { unmount } = render(() => <DrumMachinePanel drumMachine={machine} />)

    fireEvent.click(screen.getByTitle('Test Kick'))
    expect(init).toHaveBeenCalledOnce()
    unmount()

    gate.resolve()
    await gate.promise
    await Promise.resolve()

    expect(trigger).not.toHaveBeenCalled()
  })

  it('stops an active loop before unsubscribing on unmount', async () => {
    const { machine, stop, unsubscribe } = createUninitializedDrumMachine()
    const { unmount } = render(() => <DrumMachinePanel drumMachine={machine} />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(screen.getByText('Playing')).toBeInTheDocument())

    unmount()

    expect(stop).toHaveBeenCalledOnce()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(
      unsubscribe.mock.invocationCallOrder[0],
    )
  })
})
