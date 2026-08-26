// ============================================================
// Piano Night room glass — how much of the room you can actually see
// ============================================================
//
// Piano Night ships rooms the same way Guitar Night does, and hid them the
// same way: a four-stop grade over the photograph, then a session HUD, a
// coach card and a transport bar at 91–96% opacity floating on top of it.
// Guitar Night already has the answer — one clarity number that several
// quantities hang off — so this is that number for the piano stage, with the
// same meaning: **0 is exactly the room as it shipped**, 1 is as open as it
// goes.
//
// The one thing Guitar Night does not have to worry about is the keybed. Here
// the keys are the play surface: notes fall onto them and land on them, so
// they get their own gentler curve (`--pn-key-scale`) and a struck key never
// thins at all. Turning the room up should let light through the ivory, not
// make it harder to see which key just fired.
//
// The keybed is also why this needed two tokens rather than one. It is
// painted three layers deep — bed, backing, key — and three stacked alphas
// do not add up to one: a single scale on all three left a white key 99%
// opaque at the default and 93% at Open, so the keys changed shade and never
// went see-through. `--pn-keybed-scale` clears the two layers behind the key
// first, on a steeper curve that reaches zero, and only then does the key
// itself have nothing left to thin through.

import { createClampedPreference } from '@/lib/clamped-preference'

const preference = createClampedPreference({
  storageKey: 'pitchperfect_pn_room_glass',
  // Not 0, for Guitar Night's reason: a control nobody discovers is a control
  // nobody has, and a first visit should already show that the room is a room.
  // Lower than Guitar Night's 0.55 because the keybed moves with this one and
  // the keys are worth being careful with — at this default they are still
  // 81% solid.
  defaultValue: 0.45,
  min: 0,
  max: 1,
  step: 0.025,
})

export const PIANO_NIGHT_GLASS = preference.spec

export const loadPianoNightGlass = preference.load

export const persistPianoNightGlass = preference.persist

/** The custom property the whole stylesheet reads. */
export const PIANO_NIGHT_GLASS_VAR = '--pn-glass'

export type PianoNightGlassLabel = 'Focused' | 'Soft' | 'Clear' | 'Open'

function clampPianoNightGlass(value: number): number {
  if (!Number.isFinite(value)) return PIANO_NIGHT_GLASS.defaultValue
  return Math.min(PIANO_NIGHT_GLASS.max, Math.max(PIANO_NIGHT_GLASS.min, value))
}

/** A short, useful description for the visual room-clarity stop. */
export function pianoNightGlassLabel(value: number): PianoNightGlassLabel {
  const clamped = clampPianoNightGlass(value)
  if (clamped <= 0.2) return 'Focused'
  if (clamped <= 0.45) return 'Soft'
  if (clamped <= 0.7) return 'Clear'
  return 'Open'
}

/** Keeps the otherwise visual slider understandable without seeing the room. */
export function formatPianoNightGlassValue(value: number): string {
  const clamped = clampPianoNightGlass(value)
  return `${pianoNightGlassLabel(clamped)} · ${Math.round(clamped * 100)}% room visibility`
}
