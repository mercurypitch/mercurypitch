// ============================================================
// Piano audio-clock transport tests — one clock, silent entry, and stale-safe control
// ============================================================

import { createComputed, createMemo, createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createPianoAudioClockTransport } from './piano-audio-clock-transport'

class FakeAudioContext {
  currentTime = 10
  state: AudioContextState = 'suspended'
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })
}

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function harness(
  options: {
    totalBeats?: () => number
    tempoBpm?: number
    speed?: number
    activation?: () => Promise<void>
  } = {},
) {
  const context = new FakeAudioContext()
  const contextFactory = vi.fn(() => context as unknown as AudioContext)
  const activateContext = vi.fn(
    options.activation ??
      (async () => {
        await context.resume()
      }),
  )
  const transport = createPianoAudioClockTransport({
    totalBeats: options.totalBeats ?? (() => 32),
    initialTempoBpm: options.tempoBpm ?? 120,
    initialSpeed: options.speed ?? 1,
    contextFactory,
    activateContext,
  })
  return { activateContext, context, contextFactory, transport }
}

describe('createPianoAudioClockTransport', () => {
  it('constructs silently and does not create its own polling clock', () => {
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame')
    const setInterval = vi.spyOn(window, 'setInterval')
    const instance = harness()

    expect(instance.transport.phase()).toBe('ready')
    expect(instance.transport.timeline.playheadBeat()).toBe(0)
    expect(instance.transport.timeline.totalBeats()).toBe(32)
    expect(instance.transport.timeline.tempoBpm()).toBe(120)
    expect(instance.transport.speed()).toBe(1)
    expect(instance.contextFactory).not.toHaveBeenCalled()
    expect(instance.activateContext).not.toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(setInterval).not.toHaveBeenCalled()

    requestAnimationFrame.mockRestore()
    setInterval.mockRestore()
  })

  it('does not activate audio for an empty score', async () => {
    const instance = harness({ totalBeats: () => 0 })

    await expect(instance.transport.play()).resolves.toBe(false)
    expect(instance.contextFactory).not.toHaveBeenCalled()
    expect(instance.activateContext).not.toHaveBeenCalled()
    expect(instance.transport.phase()).toBe('ready')
  })

  it('creates and activates one context on Play, then derives beats from it', async () => {
    const instance = harness({ tempoBpm: 90, speed: 0.5 })

    await expect(instance.transport.play()).resolves.toBe(true)
    expect(instance.contextFactory).toHaveBeenCalledOnce()
    expect(instance.activateContext).toHaveBeenCalledOnce()
    expect(instance.transport.phase()).toBe('playing')

    instance.context.currentTime = 14
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(3)
    expect(instance.contextFactory).toHaveBeenCalledOnce()
  })

  it('invalidates reactive consumers when discrete transport state changes', () => {
    const activation = deferred<undefined>()
    const instance = harness({ activation: () => activation.promise })
    createRoot((disposeRoot) => {
      let reads = 0
      let observed = ''
      const snapshot = createMemo(() => {
        reads += 1
        return [
          instance.transport.phase(),
          instance.transport.timeline.tempoBpm(),
          instance.transport.speed(),
        ].join(':')
      })
      createComputed(() => {
        observed = snapshot()
      })
      expect(observed).toBe('ready:120:1')
      let previousReads = reads

      void instance.transport.play()
      expect(observed).toBe('loading:120:1')
      expect(reads).toBeGreaterThan(previousReads)
      previousReads = reads

      instance.transport.setTempoBpm(96)
      instance.transport.setSpeed(0.75)
      expect(observed).toBe('loading:96:0.75')
      expect(reads).toBeGreaterThan(previousReads)
      previousReads = reads

      instance.transport.pause()
      expect(observed).toBe('ready:96:0.75')
      expect(reads).toBeGreaterThan(previousReads)
      activation.resolve(undefined)
      disposeRoot()
    })
  })

  it('parks on pause and resumes from the same beat on the existing context', async () => {
    const instance = harness()
    await instance.transport.play()
    instance.context.currentTime = 12.5

    instance.transport.pause()
    expect(instance.transport.phase()).toBe('paused')
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(5)

    instance.context.currentTime = 20
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(5)
    await expect(instance.transport.play()).resolves.toBe(true)
    instance.context.currentTime = 21
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(7)
    expect(instance.contextFactory).toHaveBeenCalledOnce()
    expect(instance.activateContext).toHaveBeenCalledTimes(2)
  })

  it('seeks against the same running audio clock without changing phase', async () => {
    const instance = harness({ tempoBpm: 60 })
    await instance.transport.play()
    instance.context.currentTime = 13
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(3)

    instance.transport.seekToBeat(11.25)
    expect(instance.transport.phase()).toBe('playing')
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(11.25)

    instance.context.currentTime = 14.5
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(12.75)
  })

  it('rebases tempo and speed changes without jumping the playhead', async () => {
    const instance = harness({ tempoBpm: 120 })
    await instance.transport.play()
    instance.context.currentTime = 12
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(4)

    instance.transport.setTempoBpm(60)
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(4)
    instance.context.currentTime = 14
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(6)

    instance.transport.setSpeed(0.5)
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(6)
    instance.context.currentTime = 16
    expect(instance.transport.timeline.playheadBeat()).toBeCloseTo(7)
  })

  it('completes at the exact final beat and replays from zero', async () => {
    const instance = harness({ totalBeats: () => 8, tempoBpm: 120 })
    const onChange = vi.fn()
    instance.transport.subscribe(onChange)
    await instance.transport.play()
    instance.context.currentTime = 14.5

    expect(instance.transport.timeline.playheadBeat()).toBe(8)
    expect(instance.transport.phase()).toBe('complete')
    const completeNotifications = onChange.mock.calls.length
    expect(instance.transport.timeline.playheadBeat()).toBe(8)
    expect(onChange).toHaveBeenCalledTimes(completeNotifications)

    await expect(instance.transport.play()).resolves.toBe(true)
    expect(instance.transport.timeline.playheadBeat()).toBe(0)
    expect(instance.transport.phase()).toBe('playing')
  })

  it('stops at zero and leaves the already-created context reusable', async () => {
    const instance = harness()
    await instance.transport.play()
    instance.context.currentTime = 12

    instance.transport.stop()
    expect(instance.transport.phase()).toBe('ready')
    expect(instance.transport.timeline.playheadBeat()).toBe(0)

    await instance.transport.play()
    expect(instance.contextFactory).toHaveBeenCalledOnce()
    expect(instance.transport.phase()).toBe('playing')
  })

  it('reports activation failure and permits a later explicit retry', async () => {
    let attempts = 0
    const instance = harness({
      activation: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('blocked')
      },
    })

    await expect(instance.transport.play()).resolves.toBe(false)
    expect(instance.transport.phase()).toBe('error')
    expect(instance.transport.error()).toContain('Audio could not start')

    await expect(instance.transport.play()).resolves.toBe(true)
    expect(instance.transport.phase()).toBe('playing')
    expect(instance.transport.error()).toBeNull()
    expect(instance.contextFactory).toHaveBeenCalledOnce()
  })

  it('ignores a stale activation after Stop', async () => {
    const activation = deferred<undefined>()
    const instance = harness({ activation: () => activation.promise })
    const playing = instance.transport.play()

    expect(instance.transport.phase()).toBe('loading')
    instance.transport.stop()
    activation.resolve(undefined)

    await expect(playing).resolves.toBe(false)
    expect(instance.transport.phase()).toBe('ready')
    expect(instance.transport.timeline.playheadBeat()).toBe(0)
  })

  it('closes its context and ignores stale activation after disposal', async () => {
    const activation = deferred<undefined>()
    const instance = harness({ activation: () => activation.promise })
    const playing = instance.transport.play()

    await instance.transport.dispose()
    expect(instance.context.close).toHaveBeenCalledOnce()
    expect(instance.transport.getAudioContext()).toBeNull()
    activation.resolve(undefined)

    await expect(playing).resolves.toBe(false)
    await expect(instance.transport.play()).resolves.toBe(false)
    expect(instance.transport.phase()).toBe('ready')
  })
})
