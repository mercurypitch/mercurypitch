// ============================================================
// Voice Reflections — bounded, local listening notes for saved takes
// ============================================================
//
// Reflections describe what the singer noticed at one replay position. They
// stay subjective by design: no kind means good, bad, or improved.

export const VOICE_REFLECTIONS_VERSION = 1 as const
export const MAX_VOICE_REFLECTIONS = 24
export const MAX_VOICE_REFLECTION_NOTE_LENGTH = 180

export type VoiceReflectionKind = 'keep' | 'curious' | 'try-next'

export interface VoiceReflection {
  id: string
  kind: VoiceReflectionKind
  position: number
  note: string
  createdAt: string
}

interface VoiceReflectionDraft {
  id: string
  kind: VoiceReflectionKind
  position: number
  note: string
  createdAt?: string
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function isReflectionKind(value: unknown): value is VoiceReflectionKind {
  return value === 'keep' || value === 'curious' || value === 'try-next'
}

function sanitizeReflection(value: unknown): VoiceReflection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const candidate = value as Partial<VoiceReflection>
  if (
    typeof candidate.id !== 'string' ||
    candidate.id.trim() === '' ||
    candidate.id.length > 100 ||
    !isReflectionKind(candidate.kind) ||
    !isFiniteNumber(candidate.position) ||
    candidate.position < 0 ||
    candidate.position > 1 ||
    typeof candidate.note !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    Number.isNaN(new Date(candidate.createdAt).getTime())
  ) {
    return null
  }
  return {
    id: candidate.id,
    kind: candidate.kind,
    position: Math.round(candidate.position * 10_000) / 10_000,
    note: candidate.note.trim().slice(0, MAX_VOICE_REFLECTION_NOTE_LENGTH),
    createdAt: new Date(candidate.createdAt).toISOString(),
  }
}

export function createVoiceReflection(
  draft: VoiceReflectionDraft,
): VoiceReflection {
  const reflection = sanitizeReflection({
    ...draft,
    createdAt: draft.createdAt ?? new Date().toISOString(),
  })
  if (reflection === null) {
    throw new Error('Invalid voice reflection')
  }
  return reflection
}

export function parseVoiceReflections(
  raw: string | undefined,
  version: number | undefined,
): VoiceReflection[] {
  if (
    raw === undefined ||
    version !== VOICE_REFLECTIONS_VERSION ||
    raw.length > 100_000
  ) {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .slice(0, MAX_VOICE_REFLECTIONS)
      .map(sanitizeReflection)
      .filter(
        (reflection): reflection is VoiceReflection => reflection !== null,
      )
      .sort(
        (left, right) =>
          left.position - right.position ||
          left.createdAt.localeCompare(right.createdAt),
      )
  } catch {
    return []
  }
}

export function serializeVoiceReflections(
  reflections: readonly VoiceReflection[],
): string {
  const sanitized = reflections
    .map(sanitizeReflection)
    .filter((reflection): reflection is VoiceReflection => reflection !== null)
    .slice(-MAX_VOICE_REFLECTIONS)
    .sort(
      (left, right) =>
        left.position - right.position ||
        left.createdAt.localeCompare(right.createdAt),
    )
  return JSON.stringify(sanitized)
}

export function voiceReflectionLabel(kind: VoiceReflectionKind): string {
  if (kind === 'keep') return 'Keep'
  if (kind === 'curious') return 'Curious'
  return 'Try next time'
}
