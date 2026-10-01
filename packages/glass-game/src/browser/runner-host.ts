// Runner browser host — gallery services, separate typed progress and legal comfortable-note preferences.
import type { GlassGameHost } from '../host'
import type { CompiledRunnerCourse } from '../runner/contracts'
import type { SongRunnerHost } from '../runner/session-contracts'
import { createBrowserRunnerTransport } from './runner-transport'

const memories = new WeakMap<
  GlassGameHost,
  { memory: Map<string, string>; volatile: Set<string> }
>()

export function runnerComfortableMidiRange(course: CompiledRunnerCourse): {
  minimumMidi: number
  maximumMidi: number
} {
  const offsets = course.targets.flatMap((target) =>
    target.notes.flatMap((note) => [
      note.startOffsetSemitones,
      note.endOffsetSemitones,
    ]),
  )
  const low =
    Math.min(0, ...offsets) + course.voice.comfortableRootOffsetSemitones
  const high =
    Math.max(0, ...offsets) + course.voice.comfortableRootOffsetSemitones
  const minimumMidi = Math.ceil(
    Math.max(
      course.voice.minimumComfortableMidi,
      course.voice.minimumComfortableMidi - low,
    ),
  )
  const maximumMidi = Math.floor(
    Math.min(
      course.voice.maximumComfortableMidi,
      course.voice.maximumComfortableMidi - high,
    ),
  )
  if (minimumMidi > maximumMidi)
    throw new Error('The course has no usable comfortable note.')
  return { minimumMidi, maximumMidi }
}

export function resolveRunnerComfortableMidi(
  course: CompiledRunnerCourse,
  stored: string | null,
): number {
  const range = runnerComfortableMidiRange(course)
  const selected =
    stored === null || stored.trim() === '' ? NaN : Number(stored)
  return Number.isInteger(selected) &&
    selected >= range.minimumMidi &&
    selected <= range.maximumMidi
    ? selected
    : Math.round((range.minimumMidi + range.maximumMidi) / 2)
}

export function createBrowserRunnerHost(
  galleryHost: GlassGameHost,
): SongRunnerHost {
  const saved = memories.get(galleryHost) ?? {
    memory: new Map<string, string>(),
    volatile: new Set<string>(),
  }
  memories.set(galleryHost, saved)
  const { memory, volatile } = saved

  function read(key: string): string | null {
    if (volatile.has(key)) return memory.get(key) ?? null
    try {
      const value = galleryHost.readPreference(key)
      if (value !== null) memory.set(key, value)
      return value ?? memory.get(key) ?? null
    } catch {
      return memory.get(key) ?? null
    }
  }

  function write(key: string, value: string): void {
    memory.set(key, value)
    try {
      galleryHost.writePreference(key, value)
      if (galleryHost.readPreference(key) === value) {
        volatile.delete(key)
        return
      }
    } catch {
      /* Keep the current visit playable without storage. */
    }
    volatile.add(key)
  }
  return {
    assetUrl: (id) => galleryHost.assetUrl(id),
    prepareVoiceGesture: () => galleryHost.prepareVoiceGesture(),
    createVoice: () => galleryHost.createVoice(),
    microphoneInput: galleryHost.microphoneInput,
    takeOverMicrophone: galleryHost.takeOverMicrophone?.bind(galleryHost),
    releaseUnusedMicrophoneTakeover:
      galleryHost.releaseUnusedMicrophoneTakeover?.bind(galleryHost),
    readPreference: read,
    writePreference: write,
    subscribeForeground: (listener) =>
      galleryHost.subscribeForeground(listener),
    onExit: () => galleryHost.onExit(),
    loadRunnerProgress(courseId) {
      try {
        return JSON.parse(
          read(`runner-progress:v1:${courseId}`) ?? 'null',
        ) as unknown
      } catch {
        return null
      }
    },
    saveRunnerProgress(progress) {
      write(`runner-progress:v1:${progress.courseId}`, JSON.stringify(progress))
    },
    createRunnerAudio: createBrowserRunnerTransport,
  }
}
