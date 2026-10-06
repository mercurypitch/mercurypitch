// Runner browser host — gallery services, separate typed progress and legal comfortable-note preferences.
import type { GlassGameHost } from '../host'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { CURRENT_SINGING_COURSE, mergeCurrentSingingProgress, } from '../runner/current-course'
import { SINGING_CURRENT } from '../runner/first-course'
import type { RunnerAudioPreferences, SongRunnerHost, } from '../runner/session-contracts'
import { clampRunnerAudioPreferences } from '../runner/session-contracts'
import { createRunnerBackingCache } from './runner-music'
import { createBrowserRunnerTransport } from './runner-transport'
import { createShatterBufferCache } from './shatter-buffer-cache'

const memories = new WeakMap<
  GlassGameHost,
  {
    memory: Map<string, string>
    volatile: Set<string>
    backing: ReturnType<typeof createRunnerBackingCache>
    shatter: ReturnType<typeof createShatterBufferCache>
  }
>()

export const RUNNER_AUDIO_PREFERENCE = 'runner-audio:v1'

export function readRunnerAudioPreferences(
  host: Pick<SongRunnerHost, 'readPreference' | 'writePreference'>,
): RunnerAudioPreferences {
  try {
    const stored = host.readPreference(RUNNER_AUDIO_PREFERENCE)
    if (stored !== null) {
      const value: unknown = JSON.parse(stored)
      if (value !== null && typeof value === 'object' && !Array.isArray(value))
        return clampRunnerAudioPreferences(
          value as Partial<RunnerAudioPreferences>,
        )
    }
  } catch {
    /* Fall back to the previous music-only preference. */
  }
  let musicMuted = false
  try {
    musicMuted = host.readPreference('runner-music-muted:v1') === 'true'
  } catch {
    /* Use the default when private storage is blocked. */
  }
  const preferences = clampRunnerAudioPreferences({ musicMuted })
  try {
    host.writePreference(RUNNER_AUDIO_PREFERENCE, JSON.stringify(preferences))
  } catch {
    /* The current visit still has its mix. */
  }
  return preferences
}

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
    backing: createRunnerBackingCache(),
    shatter: createShatterBufferCache(),
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

  function readProgress(courseId: string): unknown {
    try {
      return JSON.parse(
        read(`runner-progress:v1:${courseId}`) ?? 'null',
      ) as unknown
    } catch {
      return null
    }
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
      const current = readProgress(courseId)
      return courseId === CURRENT_SINGING_COURSE.id
        ? mergeCurrentSingingProgress(current, readProgress(SINGING_CURRENT.id))
        : current
    },
    saveRunnerProgress(progress) {
      write(`runner-progress:v1:${progress.courseId}`, JSON.stringify(progress))
    },
    createRunnerAudio: (course, comfortableMidi) =>
      createBrowserRunnerTransport(course, comfortableMidi, {
        assetUrl: (id) => galleryHost.assetUrl(id),
        backingCache: saved.backing,
        shatterCache: saved.shatter,
        effectsMuted: () => {
          try {
            return JSON.parse(read('museum-audio:v1') ?? 'null')?.muted === true
          } catch {
            return false
          }
        },
      }),
  }
}
