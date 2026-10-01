// Runner session harness — controllable shared audio/capture time with real course simulation.
import { vi } from 'vitest'
import type { PitchObservation } from '../../contracts'
import type { GlassVoiceSession } from '../../host'
import type { CompiledRunnerCourse } from '../../runner/contracts'
import type { RunnerAudioSchedule, RunnerAudioTransport, SongRunnerHost, } from '../../runner/session-contracts'
import { createBrowserRunnerSession } from '../runner-session'
import { runnerCourseFixture } from './runner-course'

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
export async function flush(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

export function runnerSessionHarness(
  course: CompiledRunnerCourse = runnerCourseFixture(),
) {
  let now = 10,
    epoch = 0,
    frameId = 0,
    sequence = 0
  let foreground: (value: boolean) => void = () => undefined
  const frames = new Map<number, () => void>()
  const voices: (GlassVoiceSession & {
    emit(value: PitchObservation): void
    interrupt(): void
    detectorReady: boolean
  })[] = []
  const audio: (RunnerAudioTransport & {
    interrupt(): void
    release(): void
    endReference(): void
    anchor: RunnerAudioSchedule | null
  })[] = []
  const permission = deferred<undefined>()
  permission.resolve(undefined)
  let microphoneGate: Promise<void> = permission.promise
  let holdAudioRelease = false
  const preferences = new Map<string, string>()
  const host: SongRunnerHost = {
    assetUrl: (id) => id,
    prepareVoiceGesture: vi.fn(() => ({
      ready: Promise.resolve(true),
      release: vi.fn(),
    })),
    createVoice: vi.fn(() => {
      let callback:
        | ((value: PitchObservation, nowMs: number) => void)
        | undefined
      let onStopped: (() => void) | undefined
      let stopped = false
      const voice = {
        start: vi.fn(async (quiet?: Promise<void>) => {
          await microphoneGate
          await quiet
          if (!stopped) voice.detectorReady = true
        }),
        latest: () => null,
        subscribe: (
          listener: (value: PitchObservation, nowMs: number) => void,
          ended?: () => void,
        ) => {
          callback = listener
          onStopped = ended
          return () => {
            onStopped = undefined
          }
        },
        stop: vi.fn(() => {
          stopped = true
          voice.detectorReady = false
        }),
        emit: (value: PitchObservation) => callback?.(value, now * 1000),
        interrupt: () => onStopped?.(),
        detectorReady: false,
      }
      voices.push(voice)
      return voice
    }),
    readPreference: (key) => preferences.get(key) ?? null,
    writePreference: (key, value) => {
      preferences.set(key, value)
    },
    loadRunnerProgress: () => null,
    saveRunnerProgress: vi.fn(),
    subscribeForeground: (listener) => {
      foreground = listener
      return vi.fn()
    },
    onExit: vi.fn(),
    takeOverMicrophone: vi.fn().mockResolvedValue(true),
    releaseUnusedMicrophoneTakeover: vi.fn().mockResolvedValue(undefined),
    createRunnerAudio: vi.fn(() => {
      const finished = deferred<undefined>(),
        reference = deferred<undefined>()
      let interrupted: (() => void) | undefined
      let disposed = false
      const transport = {
        finished: finished.promise,
        unlock: vi.fn().mockResolvedValue(true),
        currentAudioSeconds: () => (disposed ? null : now),
        schedule: vi.fn((checkpoint): RunnerAudioSchedule => {
          const tempo = course.tempoSegments.find(
            (part) =>
              checkpoint.beat >= part.startBeat &&
              checkpoint.beat < part.endBeat,
          )!
          transport.anchor = {
            countInStartAudioSeconds: now + 0.08,
            audioStartSeconds:
              now + 0.08 + (checkpoint.countInBeats * 60) / tempo.bpm,
            courseStartSeconds: checkpoint.courseSeconds,
            secondsPerBeat: 60 / tempo.bpm,
            countInBeats: checkpoint.countInBeats,
          }
          return transport.anchor
        }),
        hearReference: vi.fn(() => reference.promise),
        setMuted: vi.fn(),
        setVoiceActive: vi.fn(),
        subscribeInterruption: (listener: () => void) => {
          interrupted = listener
          return () => {
            interrupted = undefined
          }
        },
        dispose: vi.fn(() => {
          disposed = true
          reference.resolve(undefined)
          if (!holdAudioRelease) finished.resolve(undefined)
        }),
        interrupt: () => interrupted?.(),
        release: () => finished.resolve(undefined),
        endReference: () => reference.resolve(undefined),
        anchor: null as RunnerAudioSchedule | null,
      } satisfies RunnerAudioTransport & {
        interrupt(): void
        release(): void
        endReference(): void
        anchor: RunnerAudioSchedule | null
      }
      audio.push(transport)
      return transport
    }),
  }
  const session = createBrowserRunnerSession(
    { course, comfortableMidi: 60, host },
    {
      requestFrame(callback) {
        const id = ++frameId
        frames.set(id, callback)
        return id
      },
      cancelFrame(id) {
        frames.delete(id)
      },
      epoch: () => `test-${++epoch}`,
    },
  )

  function tick(at: number) {
    now = at
    const callbacks = [...frames.values()]
    frames.clear()
    for (const callback of callbacks) callback()
  }

  function emit(
    at: number,
    midi: number | null = 60,
    latency = 0,
    voice = voices.at(-1)!,
  ) {
    now = at + latency
    voice.emit({
      sequence: ++sequence,
      captureSeconds: at,
      capturedAtMs: at * 1000,
      midi,
      confidence: midi === null ? 0 : 0.95,
    })
  }

  function ready() {
    const start = now + 0.01
    for (let i = 0; i <= 8; i++) emit(start + i * 0.05)
  }

  function courseTick(seconds: number) {
    const anchor = audio.at(-1)!.anchor!
    tick(anchor.audioStartSeconds + seconds - anchor.courseStartSeconds)
  }

  async function running() {
    session.setPresentationReady(true)
    await session.start()
    ready()
    tick(audio.at(-1)!.anchor!.audioStartSeconds)
  }
  return {
    course,
    session,
    host,
    voices,
    audio,
    preferences,
    frames,
    emit,
    tick,
    ready,
    courseTick,
    running,
    foreground: (value: boolean) => foreground(value),
    clock: () => now,
    setAudioTime: (at: number) => {
      now = at
    },
    setPermission: (promise: Promise<void>) => {
      microphoneGate = promise
    },
    holdAudioRelease: () => {
      holdAudioRelease = true
    },
  }
}
