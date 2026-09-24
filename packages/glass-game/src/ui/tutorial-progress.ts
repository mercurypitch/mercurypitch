// Tutorial persistence — each gallery and teaching revision gets its own introduction.
import type { LevelDefinition } from '../contracts'
import type { GlassGameHost } from '../host'

type TutorialHost = Pick<GlassGameHost, 'readPreference' | 'writePreference'>

export function tutorialPreferenceKey(level: LevelDefinition): string {
  const lesson = level.guidance?.tutorial
  return `tutorial:${level.id}:${lesson?.id ?? 'comfortable-hold'}:v${lesson?.version ?? 1}`
}

export function hasSeenTutorial(
  host: TutorialHost,
  level: LevelDefinition,
): boolean {
  const saved = host.readPreference(tutorialPreferenceKey(level))
  if (saved !== null) return saved === 'seen'
  const lesson = level.guidance?.tutorial
  // The old global flag only represents the original comfortable-hold lesson.
  return (
    (lesson?.id ?? 'comfortable-hold') === 'comfortable-hold' &&
    (lesson?.version ?? 1) === 1 &&
    host.readPreference('tutorial') === 'seen'
  )
}

export function markTutorialSeen(
  host: TutorialHost,
  level: LevelDefinition,
): void {
  host.writePreference(tutorialPreferenceKey(level), 'seen')
}
