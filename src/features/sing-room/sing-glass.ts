// ============================================================
// Sing room glass — how much of the room shows behind the trace
// ============================================================
//
// The same one-number clarity the Guitar Night and Ear Lab rooms carry, and
// deliberately the same shape (`createClampedPreference`, a `--*-glass`
// custom property, four words for the stops), because a slider that behaved
// differently in one room would be a different control wearing the same face.
//
// WHAT IT DRIVES. One thing: the room's dim scrim, which is the veil between
// the photograph and the trace. Not the top and bottom gradients — those keep
// the room header and the transport legible, and a singer who opened the room
// all the way would be opening the chrome's contrast with it.
//
// THE DEFAULT IS WHERE THE ROOM SHIPPED. 0.5 is the 25% portrait / 35%
// landscape scrim S3 chose (build brief §7), so a first visit sees exactly
// what device round 2 was reviewing; 1 takes the veil off entirely and 0
// doubles it. The stylesheet does that arithmetic — see `.scrimDim`.

import { createClampedPreference } from '@/lib/clamped-preference'

const preference = createClampedPreference({
  storageKey: 'pitchperfect_sing_room_glass',
  defaultValue: 0.5,
  min: 0,
  max: 1,
  step: 0.025,
})

export const SING_GLASS = preference.spec

export const loadSingGlass = preference.load

export const persistSingGlass = preference.persist

/** The custom property the room's stylesheet reads. */
export const SING_GLASS_VAR = '--mp-sing-glass'

export type SingGlassLabel = 'Focused' | 'Soft' | 'Clear' | 'Open'

function clampSingGlass(value: number): number {
  if (!Number.isFinite(value)) return SING_GLASS.defaultValue
  return Math.min(SING_GLASS.max, Math.max(SING_GLASS.min, value))
}

/** A short, useful description for the visual room-clarity stop. */
export function singGlassLabel(value: number): SingGlassLabel {
  const clamped = clampSingGlass(value)
  if (clamped <= 0.2) return 'Focused'
  if (clamped <= 0.45) return 'Soft'
  if (clamped <= 0.7) return 'Clear'
  return 'Open'
}

/** Keeps the otherwise visual slider understandable without seeing the room. */
export function formatSingGlassValue(value: number): string {
  const clamped = clampSingGlass(value)
  return `${singGlassLabel(clamped)} · ${Math.round(clamped * 100)}% room visibility`
}
