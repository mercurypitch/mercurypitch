// Melody practice controller tests — one mic, quiet references and fresh judged capture.

import { describe, expect, it, vi } from 'vitest'
import { glassMelody } from '../content/melodies'
import type { PitchObservation } from '../contracts'
import type { CompiledMelody } from '../core/melody-contour'
import { sampleMelodyAtTime } from '../core/melody-contour'
import type { MelodyReferencePlayer } from '../core/melody-reference'
import type { GlassGameHost, GlassVoiceSession } from '../host'
import type { MelodyPracticeRecordingAdapter } from './melody-practice'
import { createMelodyPractice } from './melody-practice'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index++) await Promise.resolve()
}

class VoiceFake implements GlassVoiceSession {
  listener: ((frame: PitchObservation, nowMs: number) => void) | null = null
  stopped: (() => void) | null = null
  latestFrame: PitchObservation | null = null
  readonly stop = vi.fn()
  readonly start = vi.fn(async (beforeCapture = Promise.resolve()) => {
    await beforeCapture
  })

  latest(): PitchObservation | null {
    return this.latestFrame
  }

  subscribe(
    listener: (frame: PitchObservation, nowMs: number) => void,
    onStopped?: () => void,
  ): () => void {
    this.listener = listener
    this.stopped = onStopped ?? null
    return () => {
      this.listener = null
      this.stopped = null
    }
  }

  emit(frame: PitchObservation, nowMs = frame.capturedAtMs): void {
    this.listener?.(frame, nowMs)
  }
}

class ReferenceFake implements MelodyReferencePlayer {
  readonly finished = deferred()
  readonly stop = vi.fn(() => this.finished.reject(new Error('cancelled')))
  readonly dispose = vi.fn()
  progress: ((timelineSeconds: number) => void) | undefined

  play(onProgress?: (timelineSeconds: number) => void): Promise<void> {
    this.progress = onProgress
    return this.finished.promise
  }
}

function harness(
  storedRoot: string | null = '60',
  recordingOverride?: MelodyPracticeRecordingAdapter,
) {
  const preferences = new Map<string, string>()
  if (storedRoot !== null) preferences.set('comfortable-note', storedRoot)
  const voice = new VoiceFake()
  const references: Array<{
    contour: CompiledMelody
    player: ReferenceFake
  }> = []
  let foreground: (foreground: boolean) => void = () => undefined
  let nowMs = 1000
  const releases: string[] = []
  const host: Pick<
    GlassGameHost,
    'createVoice' | 'readPreference' | 'writePreference' | 'subscribeForeground'
  > = {
    createVoice: vi.fn(() => voice),
    readPreference: (key) => preferences.get(key) ?? null,
    writePreference: (key, value) => {
      preferences.set(key, value)
    },
    subscribeForeground: (listener) => {
      foreground = listener
      return () => undefined
    },
  }
  const makeReference = vi.fn((contour: CompiledMelody) => {
    const player = new ReferenceFake()
    references.push({ contour, player })
    return player
  })
  const complete = vi.fn()
  const errors = vi.fn()
  const recordingEvents: string[] = []
  const recording: MelodyPracticeRecordingAdapter = {
    start(session) {
      expect(session).toBe(voice)
      recordingEvents.push('recording:start')
    },
    stop(session, outcome) {
      expect(session).toBe(voice)
      recordingEvents.push(`recording:${outcome}`)
    },
  }
  const controller = createMelodyPractice({
    host,
    melody: glassMelody('first-arc'),
    createReference: makeReference,
    beforeCapture: async () => undefined,
    canPlay: () => true,
    onChange: () => undefined,
    onComplete: complete,
    onError: errors,
    onReleaseVoice: () => releases.push('released'),
    recording: recordingOverride ?? recording,
    now: () => nowMs,
  })
  return {
    complete,
    controller,
    errors,
    foreground: (value: boolean) => foreground(value),
    host,
    makeReference,
    preferences,
    recordingEvents,
    references,
    releases,
    setNow: (value: number) => {
      nowMs = value
    },
    voice,
  }
}

function frame(
  sequence: number,
  captureSeconds: number,
  midi: number | null,
  capturedAtMs: number,
): PitchObservation {
  return {
    sequence,
    captureSeconds,
    capturedAtMs,
    midi,
    confidence: midi === null ? 0 : 0.95,
  }
}

describe('melody practice controller', () => {
  it('starts recording only after the quiet reference boundary and completes from fresh capture', async () => {
    const app = harness()
    const starting = app.controller.start()
    await flush()

    expect(app.controller.snapshot().mode).toBe('reference')
    expect(app.recordingEvents).toEqual([])
    const reference = app.references[0]
    expect(reference.contour).toBe(app.controller.snapshot().contour)
    app.voice.emit(frame(1, 1, 60, 1100), 1100)

    app.setNow(2000)
    app.voice.latestFrame = frame(10, 2, 60, 1990)
    reference.player.finished.resolve()
    await starting
    expect(app.controller.snapshot().mode).toBe('singing')
    expect(app.recordingEvents).toEqual(['recording:start'])

    // Buffered reference evidence at or before the handoff cannot score.
    app.voice.emit(frame(10, 2, 60, 1990), 2000)
    expect(app.controller.snapshot().judge?.progress).toBe(0)

    const contour = app.controller.snapshot().contour!
    let sequence = 11
    let elapsed = 0
    while (app.controller.snapshot().judge?.complete !== true && elapsed < 5) {
      const referenceTime = Math.min(contour.durationSeconds - 1e-8, elapsed)
      const midi = sampleMelodyAtTime(contour, referenceTime).midi!
      const capturedAtMs = 2100 + elapsed * 1000
      app.voice.emit(
        frame(sequence++, 2.1 + elapsed, midi, capturedAtMs),
        capturedAtMs,
      )
      elapsed += 0.025
    }

    expect(app.controller.snapshot()).toMatchObject({
      mode: 'complete',
      judge: { complete: true, progress: 1 },
    })
    expect(app.complete).toHaveBeenCalledOnce()
    expect(app.recordingEvents).toEqual([
      'recording:start',
      'recording:complete',
    ])
    expect(app.voice.stop).toHaveBeenCalledOnce()
    expect(app.releases).toEqual(['released'])
  })

  it('calibrates a whole-phrase fit and asks for a lower note when the shape would clip', async () => {
    const app = harness(null)
    await app.controller.start()
    expect(app.controller.snapshot().mode).toBe('calibrating')

    let sequence = 1
    let captureSeconds = 1
    const singStable = (midi: number): void => {
      for (let index = 0; index < 12; index++) {
        const capturedAtMs = 1000 + captureSeconds * 1000
        app.voice.emit(
          frame(sequence++, captureSeconds, midi, capturedAtMs),
          capturedAtMs,
        )
        captureSeconds += 0.05
      }
    }
    singStable(84)
    expect(app.references).toHaveLength(0)
    expect(app.controller.snapshot().message).toContain('lower')

    singStable(70)
    await flush()
    expect(app.controller.snapshot().mode).toBe('reference')
    expect(app.preferences.get('comfortable-note')).toBe('70')
    expect(
      app.controller.snapshot().contour?.anchors.map((anchor) => anchor.midi),
    ).toEqual([70, 72, 70])
  })

  it('creates Hear output inside the gesture and uses the recompiled pace and transposition', async () => {
    const order: string[] = []
    const quiet = deferred()
    const preferences = new Map([['comfortable-note', '60']])
    let made: { contour: CompiledMelody; player: ReferenceFake } | null = null
    const controller = createMelodyPractice({
      host: {
        createVoice: () => new VoiceFake(),
        readPreference: (key) => preferences.get(key) ?? null,
        writePreference: (key, value) => preferences.set(key, value),
        subscribeForeground: () => () => undefined,
      },
      melody: glassMelody('first-arc'),
      createReference: (contour) => {
        order.push('reference')
        const player = new ReferenceFake()
        made = { contour, player }
        return player
      },
      beforeCapture: () => {
        order.push('silence')
        return quiet.promise
      },
      canPlay: () => true,
      onChange: () => undefined,
    })
    expect(controller.configure({ pace: 1.25, transposeSemitones: 2 })).toBe(
      true,
    )
    const hearing = controller.hear()
    expect(order).toEqual(['reference', 'silence'])
    expect(made!.contour).toBe(controller.snapshot().contour)
    expect(made!.contour).toMatchObject({ pace: 1.25, transposeSemitones: 2 })
    quiet.resolve()
    await flush()
    made!.player.finished.resolve()
    await hearing
    expect(controller.snapshot().mode).toBe('idle')
  })

  it('cancels a live recording before stopping the one mic and never auto-resumes after background', async () => {
    const app = harness()
    const starting = app.controller.start()
    await flush()
    app.references[0].player.finished.resolve()
    await starting
    expect(app.controller.snapshot().mode).toBe('singing')

    app.foreground(false)
    expect(app.controller.snapshot().mode).toBe('paused')
    expect(app.recordingEvents).toEqual([
      'recording:start',
      'recording:cancelled',
    ])
    expect(app.voice.stop).toHaveBeenCalledOnce()
    expect(app.releases).toEqual(['released'])

    app.foreground(true)
    expect(app.controller.snapshot().mode).toBe('idle')
    expect(app.host.createVoice).toHaveBeenCalledOnce()
  })

  it('still releases the microphone when optional recording cleanup throws', async () => {
    const order: string[] = []
    const app = harness('60', {
      start: () => order.push('recording:start'),
      stop: () => {
        order.push('recording:stop')
        throw new Error('recorder failed')
      },
    })
    app.voice.stop.mockImplementation(() => {
      order.push('voice:stop')
    })
    const starting = app.controller.start()
    await flush()
    app.references[0].player.finished.resolve()
    await starting

    app.foreground(false)
    expect(order).toEqual(['recording:start', 'recording:stop', 'voice:stop'])
    expect(app.releases).toEqual(['released'])
  })
})
