// Drum Night runtime tests — silent mount, gesture gates and lifecycle cleanup.
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumMidiAccessPort, DrumMidiInputPort } from './drum-input'
import type { DrumKitPlayerPort } from './drum-runtime-types'
import type { DrumRuntimeClock } from './drum-transport'
import type { DrumNightRuntimeController, DrumNightRuntimeOptions, } from './useDrumNightRuntime'
import { useDrumNightRuntime } from './useDrumNightRuntime'

function deferred<T>(): {
  readonly promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

class FakeClock implements DrumRuntimeClock {
  private timestampMs = 0
  private nextFrameId = 1
  private frames = new Map<number, (timestampMs: number) => void>()

  nowMs = (): number => this.timestampMs

  requestFrame = (callback: (timestampMs: number) => void): number => {
    const id = this.nextFrameId++
    this.frames.set(id, callback)
    return id
  }

  cancelFrame = (handle: number): void => {
    this.frames.delete(handle)
  }

  advance(milliseconds: number): void {
    this.timestampMs += milliseconds
    const pending = [...this.frames.values()]
    this.frames.clear()
    for (const callback of pending) callback(this.timestampMs)
  }
}

function playerHarness() {
  return {
    activate: vi.fn<DrumKitPlayerPort['activate']>(() => true),
    running: vi.fn<() => boolean>(() => true),
    trigger: vi.fn<DrumKitPlayerPort['trigger']>(),
    panic: vi.fn<DrumKitPlayerPort['panic']>(),
    dispose: vi.fn<DrumKitPlayerPort['dispose']>(),
  } satisfies DrumKitPlayerPort
}

function mountRuntime(options: DrumNightRuntimeOptions): {
  readonly controller: DrumNightRuntimeController
  readonly unmount: () => void
} {
  let controller!: DrumNightRuntimeController
  const Harness: Component = () => {
    controller = useDrumNightRuntime(options)
    return null
  }
  const mounted = render(() => <Harness />)
  return { controller, unmount: mounted.unmount }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useDrumNightRuntime', () => {
  it('keeps first paint silent and asks for MIDI only from connectMidi', async () => {
    const player = playerHarness()
    const access: DrumMidiAccessPort = {
      inputs: { values: () => [][Symbol.iterator]() },
      onstatechange: null,
    }
    const requestAccess = vi.fn(async () => access)
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { requestAccess, nowMs: () => 0 },
    })

    expect(player.activate).not.toHaveBeenCalled()
    expect(player.trigger).not.toHaveBeenCalled()
    expect(requestAccess).not.toHaveBeenCalled()
    expect(controller.midiState().status).toBe('idle')

    await controller.connectMidi()
    expect(player.activate).not.toHaveBeenCalled()
    expect(requestAccess).toHaveBeenCalledOnce()
    expect(controller.midiState().status).toBe('no-inputs')
  })

  it('retains e-kit evidence without claiming a MIDI message can unlock audio', async () => {
    const player = playerHarness()
    const input: DrumMidiInputPort = {
      id: 'stage-kit',
      name: 'Stage Kit',
      state: 'connected',
      onmidimessage: null,
    }
    const access: DrumMidiAccessPort = {
      inputs: { values: () => [input][Symbol.iterator]() },
      onstatechange: null,
    }
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: {
        requestAccess: async () => access,
        nowMs: () => 0,
      },
    })

    await controller.connectMidi()
    input.onmidimessage?.({
      data: new Uint8Array([0x99, 38, 104]),
      timeStamp: 20,
    })

    expect(controller.recentHit()).toMatchObject({
      gmKey: 38,
      source: 'midi',
      velocity: 104,
    })
    expect(player.activate).not.toHaveBeenCalled()
    expect(player.trigger).not.toHaveBeenCalled()

    await controller.play()
    input.onmidimessage?.({
      data: new Uint8Array([0x99, 38, 96]),
      timeStamp: 40,
    })

    expect(player.activate).toHaveBeenCalledOnce()
    await waitFor(() => expect(player.trigger).toHaveBeenCalledOnce())
    expect(player.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ gmKey: 38, velocity: 96 }),
    )
  })

  it('shares gesture-owned activation with later MIDI strikes', async () => {
    const player = playerHarness()
    const input: DrumMidiInputPort = {
      id: 'stage-kit',
      name: 'Stage Kit',
      state: 'connected',
      onmidimessage: null,
    }
    const access: DrumMidiAccessPort = {
      inputs: { values: () => [input][Symbol.iterator]() },
      onstatechange: null,
    }
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: {
        requestAccess: async () => access,
        nowMs: () => 0,
      },
    })

    await controller.connectMidi()
    await controller.activateAudio()
    input.onmidimessage?.({
      data: new Uint8Array([0x99, 38, 112]),
      timeStamp: 20,
    })

    expect(player.activate).toHaveBeenCalledOnce()
    expect(player.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ gmKey: 38, velocity: 112 }),
    )
  })

  it('activates again when the browser suspended the context after the first time', async () => {
    const player = playerHarness()
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
    })
    await controller.activateAudio()
    expect(player.activate).toHaveBeenCalledOnce()
    await controller.activateAudio()
    expect(player.activate).toHaveBeenCalledOnce()

    // A phone call, a lock, a tab put away: the context is suspended
    // behind the app's back, and Play used to trust the first activation.
    player.running.mockReturnValue(false)
    await controller.activateAudio()
    expect(player.activate).toHaveBeenCalledTimes(2)

    player.running.mockReturnValue(true)
    await controller.activateAudio()
    expect(player.activate).toHaveBeenCalledTimes(2)
  })

  it('activates again after a suspension when the port activates asynchronously', async () => {
    // The real player's activate() is async. Its settled promise used to
    // stay in the in-flight gate, so the re-activation returned it instead
    // of resuming the context, and the player stayed marked inactive.
    const player = playerHarness()
    player.activate.mockImplementation(() => Promise.resolve(true))
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
    })
    expect(await controller.activateAudio()).toBe(true)
    expect(player.activate).toHaveBeenCalledOnce()

    player.running.mockReturnValue(false)
    expect(await controller.activateAudio()).toBe(true)
    expect(player.activate).toHaveBeenCalledTimes(2)

    // Back up: no third activation, and a MIDI strike is not dropped.
    player.running.mockReturnValue(true)
    expect(await controller.activateAudio()).toBe(true)
    expect(player.activate).toHaveBeenCalledTimes(2)
  })

  it('waits out an in-flight failure before retrying audio once', async () => {
    const firstAttempt = deferred<boolean>()
    const player = playerHarness()
    player.activate
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => true)
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { requestAccess: undefined, nowMs: () => 0 },
    })

    const initial = controller.activateAudio()
    const retry = controller.retryAudio()
    expect(player.activate).toHaveBeenCalledOnce()

    firstAttempt.resolve(false)

    await expect(initial).resolves.toBe(false)
    await expect(retry).resolves.toBe(true)
    expect(player.activate).toHaveBeenCalledTimes(2)
  })

  it('plays every repeated keyboard and pointer strike and panics on stop', async () => {
    const player = playerHarness()
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      midiEnvironment: { nowMs: () => 0 },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }))
    controller.strikePad('kick', 127)
    controller.strikePad('kick', 64)

    await waitFor(() => expect(player.trigger).toHaveBeenCalledTimes(4))
    expect(player.activate).toHaveBeenCalledOnce()
    expect(player.trigger.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({ gmKey: 38, velocity: 100 }),
      expect.objectContaining({ gmKey: 38, velocity: 100 }),
      expect.objectContaining({ gmKey: 36, velocity: 127 }),
      expect.objectContaining({ gmKey: 36, velocity: 64 }),
    ])

    controller.stop()
    expect(player.panic).toHaveBeenCalledOnce()
  })

  it('rejects percussion outside GM and records valid touch hits losslessly', async () => {
    const player = playerHarness()
    const clock = new FakeClock()
    const { controller } = mountRuntime({
      player,
      clock,
      keyboardTarget: null,
      midiEnvironment: { nowMs: clock.nowMs },
    })
    controller.setCountInBeats(0)
    controller.setRecording(true)
    await controller.play()

    expect(controller.strikeGeneralMidi(99, 88)).toBe(false)
    expect(controller.strikeGeneralMidi(56, 88)).toBe(true)
    await waitFor(() => expect(player.trigger).toHaveBeenCalledOnce())
    expect(controller.recordedHits()).toHaveLength(1)
    expect(controller.recordedHits()[0]).toMatchObject({
      gmKey: 56,
      velocity: 88,
      source: 'touch',
    })
  })

  it('keeps the captured-hit signal stable across transport-only frames', async () => {
    const player = playerHarness()
    const clock = new FakeClock()
    const { controller } = mountRuntime({
      player,
      clock,
      keyboardTarget: null,
      midiEnvironment: { nowMs: clock.nowMs },
    })
    controller.setCountInBeats(0)
    controller.setRecording(true)
    await controller.play()
    controller.strikePad('snare', 100)
    await waitFor(() => expect(controller.recordedHits()).toHaveLength(1))
    const capturedReference = controller.recordedHits()

    clock.advance(16)

    expect(controller.recordedHits()).toBe(capturedReference)
  })

  it('exposes reactive elapsed-time adapters over the route transport', () => {
    const { controller } = mountRuntime({
      player: playerHarness(),
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
    })
    controller.transportPort.setAuthoredTiming({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500_000 },
        { beat: 2, usPerBeat: 1_000_000 },
      ],
      durationBeats: 6,
    })

    expect(controller.durationSeconds()).toBeCloseTo(5)
    expect(controller.secondsForBeat(3)).toBeCloseTo(2)
    expect(controller.beatForSeconds(2)).toBeCloseTo(3)

    controller.setSpeedScale(0.5)
    expect(controller.durationSeconds()).toBeCloseTo(10)
    controller.seekSeconds(4)
    expect(controller.positionSeconds()).toBeCloseTo(4)
    expect(controller.transportState().positionBeats).toBeCloseTo(3)
  })

  it('pauses and releases voices when the page becomes hidden', async () => {
    const originalVisibility = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    )
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    const player = playerHarness()
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
    })
    await controller.play()
    expect(controller.transportState().phase).toBe('count-in')

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(controller.pageVisible()).toBe(false)
    expect(controller.transportState().phase).toBe('paused')
    expect(player.panic).toHaveBeenCalledOnce()

    if (originalVisibility === undefined) {
      Reflect.deleteProperty(document, 'visibilityState')
    } else {
      Object.defineProperty(document, 'visibilityState', originalVisibility)
    }
  })

  it('exposes reduced-motion changes and removes every owner on cleanup', () => {
    let reduced = false
    const changeListeners = new Set<EventListenerOrEventListenerObject>()
    const query = {
      get matches() {
        return reduced
      },
      addEventListener: vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
          changeListeners.add(listener)
        },
      ),
      removeEventListener: vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
          changeListeners.delete(listener)
        },
      ),
    } as unknown as MediaQueryList
    const player = playerHarness()
    const { controller, unmount } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
      reducedMotionQuery: query,
    })
    expect(controller.prefersReducedMotion()).toBe(false)
    reduced = true
    for (const listener of changeListeners) {
      if (typeof listener === 'function') listener(new Event('change'))
      else listener.handleEvent(new Event('change'))
    }
    expect(controller.prefersReducedMotion()).toBe(true)

    unmount()
    expect(query.removeEventListener).toHaveBeenCalledOnce()
    expect(player.panic).toHaveBeenCalledOnce()
    expect(player.dispose).toHaveBeenCalledOnce()
  })

  it('does not trigger a late first hit after its player owner is disposed', async () => {
    const activation = deferred<boolean>()
    const player = playerHarness()
    player.activate.mockReturnValue(activation.promise)
    const { controller, unmount } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
    })

    controller.strikePad('snare')
    expect(player.activate).toHaveBeenCalledOnce()
    expect(player.trigger).not.toHaveBeenCalled()
    unmount()
    activation.resolve(true)
    await activation.promise
    await Promise.resolve()

    expect(player.trigger).not.toHaveBeenCalled()
    expect(player.dispose).toHaveBeenCalledOnce()
  })

  it('triggers an already-activated hit synchronously before cleanup', async () => {
    const player = playerHarness()
    const { controller, unmount } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
    })
    controller.strikePad('snare')
    await waitFor(() => expect(player.trigger).toHaveBeenCalledOnce())

    controller.strikePad('kick')
    expect(player.trigger).toHaveBeenCalledTimes(2)
    unmount()

    expect(player.trigger).toHaveBeenCalledTimes(2)
  })

  it('collapses a rapid pre-activation burst to its most recent hit', async () => {
    const activation = deferred<boolean>()
    const player = playerHarness()
    player.activate.mockReturnValue(activation.promise)
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
    })

    controller.strikePad('snare', 72)
    controller.strikePad('kick', 108)
    expect(player.activate).toHaveBeenCalledOnce()
    expect(player.trigger).not.toHaveBeenCalled()

    activation.resolve(true)
    await activation.promise
    await waitFor(() => expect(player.trigger).toHaveBeenCalledOnce())
    expect(player.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ gmKey: 36, velocity: 108 }),
    )
  })

  it('contains asynchronous player disposal failures during cleanup', async () => {
    const player = playerHarness()
    player.dispose.mockRejectedValue(new Error('late disposal failure'))
    const { unmount } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
    })

    expect(() => unmount()).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(player.dispose).toHaveBeenCalledOnce()
  })

  it('clears an audio activation error after a successful retry', async () => {
    const player = playerHarness()
    player.activate
      .mockRejectedValueOnce(new Error('Audio context refused'))
      .mockReturnValueOnce(true)
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: { nowMs: () => 0 },
    })

    await expect(controller.play()).resolves.toBe(false)
    expect(controller.runtimeError()).toBe('Audio context refused')
    await expect(controller.play()).resolves.toBe(true)
    expect(controller.runtimeError()).toBeNull()
  })

  it('settles an in-flight MIDI permission request safely after cleanup', async () => {
    const permission = deferred<DrumMidiAccessPort>()
    const player = playerHarness()
    const input: DrumMidiInputPort = {
      id: 'late-kit',
      name: 'Late Kit',
      state: 'connected',
      onmidimessage: null,
    }
    const access: DrumMidiAccessPort = {
      inputs: { values: () => [input][Symbol.iterator]() },
      onstatechange: null,
    }
    const { controller, unmount } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: {
        requestAccess: () => permission.promise,
        nowMs: () => 0,
      },
    })
    const connection = controller.connectMidi()
    unmount()
    permission.resolve(access)

    await expect(connection).resolves.toBe(false)
    expect(access.onstatechange).toBeNull()
    expect(input.onmidimessage).toBeNull()
  })

  it('applies a latency estimate only after five measured e-kit strikes', async () => {
    const player = playerHarness()
    const input: DrumMidiInputPort = {
      id: 'calibration-kit',
      name: 'Calibration Kit',
      state: 'connected' as const,
      onmidimessage: null,
    }
    const secondInput: DrumMidiInputPort = {
      id: 'second-kit',
      name: 'Second Kit',
      state: 'connected' as const,
      onmidimessage: null,
    }
    let connectedInputs: readonly DrumMidiInputPort[] = [input]
    const access: DrumMidiAccessPort = {
      inputs: { values: () => connectedInputs[Symbol.iterator]() },
      onstatechange: null,
    }
    const { controller } = mountRuntime({
      player,
      clock: new FakeClock(),
      keyboardTarget: null,
      midiEnvironment: {
        requestAccess: async () => access,
        nowMs: () => 10_000,
      },
    })
    await controller.connectMidi()

    for (let index = 0; index < 5; index += 1) {
      const expected = 1_000 + index * 500
      expect(controller.expectCalibrationHit(expected)).toBe(true)
      input.onmidimessage?.({
        data: new Uint8Array([0x99, 38, 90]),
        timeStamp: expected + 32,
      })
    }

    expect(controller.calibrationResult()).toMatchObject({
      status: 'ready',
      estimateMs: 32,
    })
    expect(controller.applyLatencyCalibration()).toBe(true)
    expect(controller.latencyCompensationMs()).toBe(32)
    expect(controller.latencyCompensationSourceId()).toBe('calibration-kit')

    input.onmidimessage?.({
      data: new Uint8Array([0x99, 38, 90]),
      timeStamp: 4_032,
    })
    expect(controller.recentHit()?.timestampMs).toBe(4_000)
    controller.strikePad('kick')
    expect(controller.recentHit()?.timestampMs).toBe(0)

    connectedInputs = [input, secondInput]
    access.onstatechange?.()
    expect(controller.selectMidiInput('second-kit')).toBe(true)
    expect(controller.latencyCompensationMs()).toBe(0)
    expect(controller.latencyCompensationSourceId()).toBeNull()

    for (let index = 0; index < 5; index += 1) {
      const expected = 5_000 + index * 500
      expect(controller.expectCalibrationHit(expected)).toBe(true)
      secondInput.onmidimessage?.({
        data: new Uint8Array([0x99, 38, 90]),
        timeStamp: expected + 24,
      })
    }
    expect(controller.applyLatencyCalibration()).toBe(true)
    expect(controller.latencyCompensationSourceId()).toBe('second-kit')

    controller.disconnectMidi()
    expect(controller.latencyCompensationMs()).toBe(0)
    expect(controller.latencyCompensationSourceId()).toBeNull()
  })
})
