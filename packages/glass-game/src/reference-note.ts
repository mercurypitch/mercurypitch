// Reference note timing — bounded sustained examples shared by audio and development controls.
export const REFERENCE_NOTE_HOLD = {
  minimum: 1,
  maximum: 1.5,
  default: 1.25,
} as const
export const REFERENCE_NOTE_HOLD_PREFERENCE = 'reference-note-hold:v1'

export function parseReferenceNoteHold(value: unknown): number {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  )
    return REFERENCE_NOTE_HOLD.default
  const seconds = Number(value)
  return Number.isFinite(seconds)
    ? Math.max(
        REFERENCE_NOTE_HOLD.minimum,
        Math.min(REFERENCE_NOTE_HOLD.maximum, seconds),
      )
    : REFERENCE_NOTE_HOLD.default
}
