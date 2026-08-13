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
  localStorage.clear()
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
    const createAudioContext = vi.fn(function AudioContextConstructor() {
      return context
    })
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

describe('usePianoNightController practice controls', () => {
  it('configures a zero-safe section loop without activating audio', () => {
    const createAudioContext = vi.fn()
    vi.stubGlobal('AudioContext', createAudioContext)
    const controller = mountController()

    expect(controller.configurePracticeLoop({ startBeat: 0, endBeat: 4 })).toBe(
      true,
    )
    expect(controller.practiceLoop()).toEqual({
      range: { startBeat: 0, endBeat: 4 },
      enabled: true,
      repeatCount: 5,
      currentPass: 1,
    })
    expect(controller.playheadBeat()).toBe(0)
    expect(controller.scoringState().pendingNotes).toBeGreaterThan(0)
    expect(createAudioContext).not.toHaveBeenCalled()
  })

  it('keeps markers but exits repeat when seeking outside the range', () => {
    const controller = mountController()
    controller.configurePracticeLoop({ startBeat: 2, endBeat: 4 })

    controller.seekToBeat(6)

    expect(controller.practiceLoop()).toMatchObject({
      range: { startBeat: 2, endBeat: 4 },
      enabled: false,
      currentPass: 1,
    })
    expect(controller.playheadBeat()).toBe(6)
    expect(controller.statusMessage()).toContain('outside A/B')
  })

  it('settles final-beat passes from transport notifications with one RAF owner', async () => {
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
    const createAudioContext = vi.fn(function AudioContextConstructor() {
      return context
    })
    const scheduledFrames: FrameRequestCallback[] = []
    vi.stubGlobal('AudioContext', createAudioContext)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrames.push(callback)
      return scheduledFrames.length
    })
    const controller = mountController()
    controller.configurePracticeLoop({
      startBeat: 0,
      endBeat: controller.stage().totalBeats,
    })

    const playing = controller.play()
    activation.resolve(undefined)
    await expect(playing).resolves.toBe(true)
    expect(scheduledFrames).toHaveLength(1)

    context.currentTime = 100
    expect(controller.transport.phase()).toBe('playing')
    expect(controller.practiceLoop()).toMatchObject({
      currentPass: 2,
      repeatCount: 5,
    })
    expect(scheduledFrames).toHaveLength(1)

    context.currentTime = 200
    expect(controller.transport.phase()).toBe('playing')
    expect(controller.practiceLoop().currentPass).toBe(3)
    controller.setPracticeRepeatCount(2)
    expect(controller.practiceLoop()).toMatchObject({
      currentPass: 3,
      repeatCount: 3,
    })

    context.currentTime = 300
    expect(controller.transport.phase()).toBe('complete')
    expect(controller.practiceRunComplete()).toBe(true)
    expect(controller.statusMessage()).toContain('3 passes')
    expect(createAudioContext).toHaveBeenCalledOnce()
  })

  it('runs a final section from A when B is the final beat', async () => {
    class ImmediateAudioContext {
      currentTime = 0
      state: AudioContextState = 'running'
      readonly resume = vi.fn(async () => undefined)
      readonly close = vi.fn(async () => {
        this.state = 'closed'
      })
    }
    const context = new ImmediateAudioContext()
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContextConstructor() {
        return context
      }),
    )
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    const controller = mountController()
    const totalBeats = controller.stage().totalBeats
    controller.configurePracticeLoop({
      startBeat: totalBeats - 2,
      endBeat: totalBeats,
    })
    controller.setPracticeRepeatCount(2)

    await expect(controller.play()).resolves.toBe(true)
    context.currentTime = 40
    expect(controller.transport.phase()).toBe('playing')
    expect(controller.practiceLoop().currentPass).toBe(2)
    expect(controller.playheadBeat()).toBe(totalBeats - 2)

    context.currentTime = 80
    expect(controller.transport.phase()).toBe('complete')
    expect(controller.practiceRunComplete()).toBe(true)
    expect(controller.playheadBeat()).toBe(totalBeats)
  })

  it('cancels a pending Play before applying a new A/B range', async () => {
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
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContextConstructor() {
        return new DeferredAudioContext()
      }),
    )
    const controller = mountController()
    controller.configurePracticeLoop({ startBeat: 2, endBeat: 4 })

    const playing = controller.play()
    expect(controller.transport.phase()).toBe('loading')
    controller.configurePracticeLoop({ startBeat: 6, endBeat: 8 })
    activation.resolve(undefined)

    await expect(playing).resolves.toBe(false)
    expect(controller.transport.phase()).toBe('paused')
    expect(controller.practiceLoop()).toMatchObject({
      range: { startBeat: 6, endBeat: 8 },
      enabled: true,
      currentPass: 1,
    })
    expect(controller.statusMessage()).toContain('beat 6.0 to 8.0')
  })

  it('resets to A and preserves practice preferences across a source swap', () => {
    const createAudioContext = vi.fn()
    vi.stubGlobal('AudioContext', createAudioContext)
    const controller = mountController()
    controller.configurePracticeLoop({ startBeat: 2, endBeat: 4 })
    controller.setPracticeRepeatCount(12)
    expect(controller.setPracticeSpeed(0.75)).toBe(true)
    controller.setMasterVolume(0.64)
    controller.seekToBeat(3)

    controller.stop()

    expect(controller.playheadBeat()).toBe(2)
    expect(controller.practiceLoop()).toMatchObject({
      enabled: true,
      repeatCount: 12,
      currentPass: 1,
    })
    expect(controller.practiceSpeed()).toBe(0.75)
    expect(controller.masterVolume()).toBe(0.64)
    expect(
      localStorage.getItem('pitchperfect_piano_night_practice_speed'),
    ).toBe('0.75')
    expect(localStorage.getItem('pitchperfect_piano_night_master_volume')).toBe(
      '0.64',
    )
    expect(createAudioContext).not.toHaveBeenCalled()

    controller.replaceSource(compositionSource('New Practice Piece'))

    expect(controller.practiceLoop()).toEqual({
      range: null,
      enabled: false,
      repeatCount: 12,
      currentPass: 1,
    })
    expect(controller.practiceSpeed()).toBe(0.75)
    expect(controller.masterVolume()).toBe(0.64)
  })

  it('restores sound choices as silent configuration', () => {
    const createAudioContext = vi.fn()
    vi.stubGlobal('AudioContext', createAudioContext)
    const controller = mountController()
    controller.setInstrumentPreference('fallback')
    controller.setSoundCharacter('bright')
    controller.setSoundAmbience('hall')
    controller.setPracticeSpeed(1.25)
    controller.setMasterVolume(0.47)

    cleanup()
    const restored = mountController()

    expect(restored.instrumentPreference()).toBe('fallback')
    expect(restored.soundCharacter()).toBe('bright')
    expect(restored.soundAmbience()).toBe('hall')
    expect(restored.practiceSpeed()).toBe(1.25)
    expect(restored.masterVolume()).toBe(0.47)
    expect(createAudioContext).not.toHaveBeenCalled()
  })

  it('rejects invalid A/B edits and bounds the pass count', () => {
    const controller = mountController()

    expect(controller.setPracticeLoopEnd(0.1)).toBe(false)
    controller.setPracticeRepeatCount(200)

    expect(controller.practiceLoop().repeatCount).toBe(100)
    expect(controller.statusMessage()).toBe(
      'Practice will finish after 100 passes.',
    )
  })
})
