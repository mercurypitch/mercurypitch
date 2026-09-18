// ============================================================
// Piano Night controller tests — one owner graph across safe source swaps
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compilePianoTempoMap } from '@/features/piano/runtime/piano-tempo-map'
import { applyPersistedValue, onPersistedWrite } from '@/lib/storage'
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

interface CountInClickStub {
  frequency: { value: number }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

function stubCountInAudio(options: { resumes: boolean }): {
  context: {
    currentTime: number
    state: AudioContextState
    createOscillator: ReturnType<typeof vi.fn>
    createGain: ReturnType<typeof vi.fn>
  }
  clicks: CountInClickStub[]
} {
  const clicks: CountInClickStub[] = []
  class CountInAudioContext {
    currentTime = 0
    state: AudioContextState = 'suspended'
    readonly destination = {}
    readonly resume = vi.fn(async () => {
      if (options.resumes) this.state = 'running'
    })
    readonly close = vi.fn(async () => {
      this.state = 'closed'
    })
    readonly createOscillator = vi.fn(() => {
      const click: CountInClickStub = {
        frequency: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      clicks.push(click)
      return click
    })
    readonly createGain = vi.fn(() => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }))
    readonly createDynamicsCompressor = vi.fn(() => ({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }))
  }
  const context = new CountInAudioContext()
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function AudioContextConstructor() {
      return context
    }),
  )
  return { context, clicks }
}

/** Hands back a manual frame pump so the count-in advances deterministically. */
function captureFrames(): {
  frames: FrameRequestCallback[]
  run(): void
} {
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    },
  )
  return {
    frames,
    run() {
      for (const callback of frames.splice(0, frames.length)) callback(0)
    },
  }
}

describe('usePianoNightController count-in', () => {
  it('leaves the count-in off until the player opts in', () => {
    vi.stubGlobal('AudioContext', vi.fn())
    const controller = mountController()

    expect(controller.countInBeats()).toBe(0)
    expect(controller.isCountingIn()).toBe(false)
  })

  it('respects a 4-beat count-in before engaging the transport', async () => {
    const { context } = stubCountInAudio({ resumes: true })
    const pump = captureFrames()
    const controller = mountController()
    // A late first note keeps the fallback synth out of the oscillator count.
    controller.replaceSource(
      compositionSource('Counted Entry', { noteStartBeat: 4 }),
    )
    controller.setCountInBeats(4)
    const beatSeconds = 60 / controller.transport.timeline.tempoBpm()

    const playing = controller.play()
    expect(controller.countInRemaining()).toBe(4)
    expect(controller.isCountingIn()).toBe(true)
    expect(controller.transport.phase()).not.toBe('playing')

    await vi.waitFor(() => {
      expect(pump.frames.length).toBeGreaterThan(0)
    })
    // One click per counted beat, all scheduled ahead on the audio clock.
    expect(context.createOscillator).toHaveBeenCalledTimes(4)

    for (const beat of [1, 2, 3]) {
      context.currentTime = beat * beatSeconds
      pump.run()
      expect(controller.countInRemaining()).toBe(4 - beat)
      expect(controller.transport.phase()).not.toBe('playing')
    }

    context.currentTime = 4 * beatSeconds
    pump.run()

    await expect(playing).resolves.toBe(true)
    expect(controller.countInRemaining()).toBe(0)
    expect(controller.isCountingIn()).toBe(false)
    expect(controller.transport.phase()).toBe('playing')
  })

  it('does not count in when resuming from pause', async () => {
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

    await expect(controller.play()).resolves.toBe(true)
    controller.pause()
    expect(controller.transport.phase()).toBe('paused')

    controller.setCountInBeats(4)
    const resumed = controller.play()
    // runCountIn publishes the remaining beats before its first await, so a
    // zero here means the resume never entered one.
    expect(controller.countInRemaining()).toBe(0)
    expect(controller.isCountingIn()).toBe(false)

    await expect(resumed).resolves.toBe(true)
    expect(controller.transport.phase()).toBe('playing')
  })

  it('a second play() during count-in does not schedule a second click train', async () => {
    const { context } = stubCountInAudio({ resumes: true })
    const pump = captureFrames()
    const controller = mountController()
    controller.replaceSource(
      compositionSource('Counted Entry', { noteStartBeat: 4 }),
    )
    controller.setCountInBeats(4)
    const beatSeconds = 60 / controller.transport.timeline.tempoBpm()

    const first = controller.play()
    const second = controller.play()

    await expect(second).resolves.toBe(false)
    await vi.waitFor(() => {
      expect(pump.frames.length).toBeGreaterThan(0)
    })
    expect(context.createOscillator).toHaveBeenCalledTimes(4)

    context.currentTime = 4 * beatSeconds
    pump.run()

    await expect(first).resolves.toBe(true)
    expect(context.createOscillator).toHaveBeenCalledTimes(4)
    expect(controller.countInRemaining()).toBe(0)
  })

  it('count-in settles when the audio context never resumes', async () => {
    const { context } = stubCountInAudio({ resumes: false })
    // No frames at all: only the wall-clock deadline can end this count-in.
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    const controller = mountController()
    controller.replaceSource(
      compositionSource('Counted Entry', { noteStartBeat: 4 }),
    )
    controller.setCountInBeats(1)

    const playing = controller.play()
    expect(controller.countInRemaining()).toBe(1)

    await expect(playing).resolves.toBe(true)
    expect(controller.countInRemaining()).toBe(0)
    expect(controller.isCountingIn()).toBe(false)
    // A suspended context cannot sound or time the clicks, so none are queued.
    expect(context.createOscillator).not.toHaveBeenCalled()
    expect(context.state).toBe('suspended')
  }, 10000)
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

  it('settles B before a touch onset can enter the finished pass', async () => {
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
    controller.replaceSource(
      compositionSource('Boundary Onset', {
        noteStartBeat: 3.9,
        tempoBpm: 96,
      }),
    )
    controller.configurePracticeLoop({ startBeat: 2, endBeat: 4 })
    controller.setPracticeRepeatCount(2)

    await expect(controller.play()).resolves.toBe(true)
    context.currentTime = ((4.05 - 2) * 60) / 96
    controller.playKeyboardKey(67)

    await vi.waitFor(() => {
      expect(controller.practiceLoop().currentPass).toBe(2)
    })
    expect(controller.transport.phase()).toBe('playing')
    expect(controller.transport.timeline.playheadBeat()).toBeCloseTo(2, 5)
    expect(controller.scoringState()).toMatchObject({
      hits: 0,
      misses: 0,
      pendingNotes: 1,
    })
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
    controller.flushMasterVolumePersistence()
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

  it('updates volume live while coalescing storage and cloud-sync writes', () => {
    vi.useFakeTimers()
    const writes: Array<[string, string]> = []
    onPersistedWrite((key, value) => writes.push([key, value]))
    try {
      const controller = mountController()

      controller.setMasterVolume(0.41)
      controller.setMasterVolume(0.48)
      controller.setMasterVolume(0.53)

      expect(controller.masterVolume()).toBe(0.53)
      expect(
        localStorage.getItem('pitchperfect_piano_night_master_volume'),
      ).toBeNull()

      vi.advanceTimersByTime(180)
      expect(
        localStorage.getItem('pitchperfect_piano_night_master_volume'),
      ).toBe('0.53')
      expect(
        writes.filter(
          ([key]) => key === 'pitchperfect_piano_night_master_volume',
        ),
      ).toHaveLength(1)

      controller.setMasterVolume(0.58)
      cleanup()
      expect(
        localStorage.getItem('pitchperfect_piano_night_master_volume'),
      ).toBe('0.58')
    } finally {
      onPersistedWrite(null)
      vi.useRealTimers()
    }
  })

  it('applies a hydrated master volume to the live controller', () => {
    const controller = mountController()

    applyPersistedValue('pitchperfect_piano_night_master_volume', '0.42')

    expect(controller.masterVolume()).toBe(0.42)
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
