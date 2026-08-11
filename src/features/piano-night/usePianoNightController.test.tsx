// ============================================================
// Piano Night controller tests — one owner graph across safe source swaps
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compilePianoTempoMap } from '@/features/piano/runtime/piano-tempo-map'
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
  options: {
    empty?: boolean
    noteStartBeat?: number
    tempoBpm?: number
    tempoPoints?: ReadonlyArray<{ beat: number; bpm: number }>
  } = {},
): PianoNightSource {
  const initialTempoBpm = options.tempoBpm ?? 96
  const tempoMap = compilePianoTempoMap(
    options.tempoPoints ?? [{ beat: 0, bpm: initialTempoBpm }],
  )
  return Object.freeze({
    id: `piano-night:composition:${title.toLowerCase().replaceAll(' ', '-')}`,
    provenance: 'composition',
    provenanceLabel: 'MercuryPitch composition',
    practiceTrackLabel: 'Composed melody',
    additionalTrackCount: 0,
    keyLabel: 'C major',
    hasAuthoredCoach: false,
    tempoMapChangeCount: Math.max(0, tempoMap.points.length - 1),
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
                startBeat: options.noteStartBeat ?? 0,
                duration: 1,
                targetFreq: 392,
                velocity: 0.8,
                releaseVelocity: 0,
                channel: 0,
              }),
            ]),
      totalBeats: options.empty === true ? 0 : 8,
      initialTempoBpm,
      tempoMap,
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

  it('adopts every authored tempo point when the source changes', () => {
    const controller = mountController()
    const replacement = compositionSource('Rubato Study', {
      tempoBpm: 90,
      tempoPoints: [
        { beat: 0, bpm: 90 },
        { beat: 2, bpm: 132 },
        { beat: 6, bpm: 72 },
      ],
    })

    expect(controller.replaceSource(replacement)).toBe(true)
    expect(controller.transport.authoredTempoBpmAtBeat(1)).toBe(90)
    expect(controller.transport.authoredTempoBpmAtBeat(3)).toBe(132)
    expect(controller.transport.authoredTempoBpmAtBeat(7)).toBe(72)
    expect(controller.transport.playbackSecondsAtBeat(7)).toBeCloseTo(
      (2 * 60) / 90 + (4 * 60) / 132 + 60 / 72,
      5,
    )
  })

  it('treats a seek to the final beat as skipped practice, not missed notes', () => {
    const controller = mountController()

    controller.seekToBeat(controller.stage().totalBeats)

    expect(controller.transport.phase()).toBe('complete')
    expect(controller.scoringState()).toMatchObject({
      hits: 0,
      misses: 0,
      pendingNotes: 0,
      skippedNotes: controller.stage().notes.length,
    })
  })

  it('settles the replacement source after the previous source completed', () => {
    const controller = mountController()
    controller.seekToBeat(controller.stage().totalBeats)
    expect(controller.transport.phase()).toBe('complete')

    const replacement = compositionSource('Boundary Cadence', {
      noteStartBeat: 8,
    })
    expect(controller.replaceSource(replacement)).toBe(true)
    expect(controller.scoringState()).toMatchObject({
      misses: 0,
      pendingNotes: 1,
    })

    controller.seekToBeat(replacement.stage.totalBeats)

    expect(controller.statusMessage()).toBe(
      'Boundary Cadence complete. Ready to play again.',
    )
    expect(controller.scoringState()).toMatchObject({
      misses: 1,
      pendingNotes: 0,
      complete: true,
    })
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
