// Melody adventure preferences — validates the saved setup against one lesson.

import type { LevelDefinition } from '../contracts'
import type { GlassGameHost } from '../host'

export const COMFORTABLE_NOTE_PREFERENCE = 'comfortable-note'

export function melodyPacePreference(lessonId: string): string {
  return `melody-pace:${lessonId}`
}

export function readMelodyPace(
  host: Pick<GlassGameHost, 'readPreference'>,
  lesson: NonNullable<LevelDefinition['melodyLesson']>,
): number {
  const stored = Number(
    host.readPreference(melodyPacePreference(lesson.id)) ?? '',
  )
  return lesson.allowedPaces.includes(stored) ? stored : lesson.defaultPace
}

export function readComfortableMidi(
  host: Pick<GlassGameHost, 'readPreference'>,
  range: { minimumMidi: number; maximumMidi: number },
): number | null {
  const value = Number(host.readPreference(COMFORTABLE_NOTE_PREFERENCE) ?? '')
  return Number.isFinite(value) &&
    value >= range.minimumMidi &&
    value <= range.maximumMidi
    ? value
    : null
}
