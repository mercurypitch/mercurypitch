// ============================================================
// Piano Night controller tests — one owner graph across safe source swaps
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PianoNightSource } from './piano-night-source'
import { usePianoNightController } from './usePianoNightController'

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

function compositionSource(
  title: string,
  options: { empty?: boolean; tempoBpm?: number } = {},
): PianoNightSource {
  return Object.freeze({
    id: `piano-night:composition:${title.toLowerCase().replaceAll(' ', '-')}`,
    provenance: 'composition',
    provenanceLabel: 'MercuryPitch composition',
    practiceTrackLabel: 'Composed melody',
    additionalTrackCount: 0,
    keyLabel: 'C major',
    hasAuthoredCoach: false,
    tempoMapChangeCount: 0,
    stage: Object.freeze({
      title,
      notes:
        options.empty === true
          ? []
          : Object.freeze([
              Object.freeze({
                id: `${title}:note`,
                midi: 67,
                name: 'G',
                startBeat: 0,
                duration: 1,
                targetFreq: 392,
                velocity: 0.8,
                releaseVelocity: 0,
                channel: 0,
              }),
            ]),
      totalBeats: options.empty === true ? 0 : 8,
      initialTempoBpm: options.tempoBpm ?? 96,
    }),
  })
}

function mountController(): ReturnType<typeof usePianoNightController> {
  let controller!: ReturnType<typeof usePianoNightController>
  const Harness: Component = () => {
    controller = usePianoNightController()
    return null
  }
  render(() => <Harness />)
  return controller
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('usePianoNightController source replacement', () => {
  it('reactively swaps a playable source and applies the manual tempo bounds', () => {
    const createAudioContext = vi.fn()
    vi.stubGlobal('AudioContext', createAudioContext)
    const controller = mountController()
    const replacement = compositionSource('Tablet Etude', { tempoBpm: 320 })

    expect(controller.replaceSource(replacement)).toBe(true)
    expect(controller.source()).toBe(replacement)
    expect(controller.stage()).toBe(replacement.stage)
    expect(controller.transport.phase()).toBe('ready')
    expect(controller.playheadBeat()).toBe(0)
    expect(controller.transport.timeline.tempoBpm()).toBe(280)
    expect(controller.statusMessage()).toBe('Tablet Etude is ready.')

    controller.setTempoBpm(12)
    expect(controller.transport.timeline.tempoBpm()).toBe(40)
    controller.setTempoBpm(400)
    expect(controller.transport.timeline.tempoBpm()).toBe(280)
    expect(createAudioContext).not.toHaveBeenCalled()
  })

  it('rejects an empty source without disturbing the staged song', () => {
    const controller = mountController()
    const previousSource = controller.source()

    expect(
      controller.replaceSource(compositionSource('Empty', { empty: true })),
    ).toBe(false)
    expect(controller.source()).toBe(previousSource)
    expect(controller.stage()).toBe(previousSource.stage)
    expect(controller.transport.phase()).toBe('ready')
  })

  it('ignores a stale Play completion after replacing a loading source', async () => {
    const activation = deferred<undefined>()
    class DeferredAudioContext {
      currentTime = 0
      state: AudioContextState = 'suspended'
      readonly resume = vi.fn(async () => {
        await activation.promise
        this.state = 'running'
      })
      readonly close = vi.fn(async () => {
        this.state = 'closed'
      })
    }
    const context = new DeferredAudioContext()
    const createAudioContext = vi.fn(() => context)
    vi.stubGlobal('AudioContext', createAudioContext)
    const controller = mountController()

    const playing = controller.play()
    expect(controller.transport.phase()).toBe('loading')

    const replacement = compositionSource('Late Night Sketch')
    expect(controller.replaceSource(replacement)).toBe(true)
    activation.resolve(undefined)

    await expect(playing).resolves.toBe(false)
    expect(controller.source()).toBe(replacement)
    expect(controller.transport.phase()).toBe('ready')
    expect(controller.statusMessage()).toBe('Late Night Sketch is ready.')
    expect(createAudioContext).toHaveBeenCalledOnce()
  })
})
