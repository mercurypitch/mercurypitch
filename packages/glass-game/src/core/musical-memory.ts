// Musical memory — a bounded local recording and the exact melody it accompanied.
export const MEMORY_MAX_BYTES = 12 * 1024 * 1024
export const MEMORY_MAX_SECONDS = 45

export interface MusicalMemory {
  version: 1
  levelId: string
  melodyId: string
  melodyVersion: number
  title: string
  recordedAt: number
  rootMidi: number
  pace: number
  transposeSemitones: number
  durationSeconds: number
  audio: Blob
}

export interface MusicalMemoryStore {
  get(levelId: string): Promise<MusicalMemory | null>
  /** Explicit Save replaces this gallery's previous take atomically. */
  put(memory: MusicalMemory): Promise<void>
  remove(levelId: string): Promise<void>
}

export interface MusicalMemoryPlayback {
  play(
    audio: Blob,
    onEnded?: () => void,
    beforePlayback?: Promise<void>,
  ): Promise<boolean>
  stop(): Promise<void>
  dispose(): void
}

export function isMusicalMemory(value: unknown): value is MusicalMemory {
  if (value === null || typeof value !== 'object') return false
  const item = value as Partial<MusicalMemory>
  return (
    item.version === 1 &&
    typeof item.levelId === 'string' &&
    item.levelId.length > 0 &&
    item.levelId.length <= 160 &&
    typeof item.melodyId === 'string' &&
    item.melodyId.length > 0 &&
    item.melodyId.length <= 160 &&
    typeof item.title === 'string' &&
    item.title.length > 0 &&
    item.title.length <= 160 &&
    Number.isInteger(item.melodyVersion) &&
    item.melodyVersion! > 0 &&
    Number.isFinite(item.recordedAt) &&
    item.recordedAt! > 0 &&
    Number.isFinite(item.rootMidi) &&
    item.rootMidi! >= 0 &&
    item.rootMidi! <= 127 &&
    Number.isFinite(item.pace) &&
    item.pace! > 0 &&
    item.pace! <= 4 &&
    Number.isFinite(item.transposeSemitones) &&
    Math.abs(item.transposeSemitones!) <= 48 &&
    Number.isFinite(item.durationSeconds) &&
    item.durationSeconds! > 0 &&
    item.durationSeconds! <= MEMORY_MAX_SECONDS &&
    item.audio instanceof Blob &&
    item.audio.size > 0 &&
    item.audio.size <= MEMORY_MAX_BYTES &&
    /^audio\/(mp4|webm|ogg)(;|$)/i.test(item.audio.type)
  )
}

export function memoryFileName(memory: MusicalMemory): string {
  const name = memory.levelId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  const extension = memory.audio.type.startsWith('audio/mp4')
    ? 'm4a'
    : memory.audio.type.startsWith('audio/ogg')
      ? 'ogg'
      : 'webm'
  return `merc-${name}-${new Date(memory.recordedAt).toISOString().slice(0, 10)}.${extension}`
}
