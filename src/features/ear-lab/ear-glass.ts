// ============================================================
// Ear Lab room glass — how much of the room shows behind the bench
// ============================================================
//
// The same one-number clarity the Guitar Night rooms carry: 0 is the room
// as the bench ships it (a heavy scrim so every reading is legible), 1 is
// as open as it goes. The stylesheet derives the scrim, the vignette and
// the plate veil from it, so one slider moves everything that hides the
// photograph and nothing else. The floor is deliberate: even at 1 the
// Regulator and the dials keep enough contrast to be read.

import { createClampedPreference } from '@/lib/clamped-preference'

const preference = createClampedPreference({
  storageKey: 'pitchperfect_ear_room_glass',
  defaultValue: 0.55,
  min: 0,
  max: 1,
  step: 0.025,
})

export const EAR_GLASS = preference.spec

export const loadEarGlass = preference.load

export const persistEarGlass = preference.persist

/** The custom property the whole stylesheet reads. */
export const EAR_GLASS_VAR = '--ear-glass'

export type EarGlassLabel = 'Focused' | 'Soft' | 'Clear' | 'Open'

function clampEarGlass(value: number): number {
  if (!Number.isFinite(value)) return EAR_GLASS.defaultValue
  return Math.min(EAR_GLASS.max, Math.max(EAR_GLASS.min, value))
}

/** A short, useful description for the visual room-clarity stop. */
export function earGlassLabel(value: number): EarGlassLabel {
  const clamped = clampEarGlass(value)
  if (clamped <= 0.2) return 'Focused'
  if (clamped <= 0.45) return 'Soft'
  if (clamped <= 0.7) return 'Clear'
  return 'Open'
}

/** Keeps the otherwise visual slider understandable without seeing the room. */
export function formatEarGlassValue(value: number): string {
  const clamped = clampEarGlass(value)
  return `${earGlassLabel(clamped)} · ${Math.round(clamped * 100)}% room visibility`
}
