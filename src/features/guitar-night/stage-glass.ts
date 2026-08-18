// ============================================================
// Guitar Night room glass — how much of the room you can actually see
// ============================================================
//
// Four rooms ship as photographs (see `backdrops.ts`), and until now almost
// none of them reached the eye: the backdrop veils itself with two dark
// gradients, and fourteen `backdrop-filter` rules sit on top, the stage chrome
// alone contributing six of them at 10–12px over surfaces at 72% opacity. On
// the darker rooms — Velvet Rehearsal especially — the picked room was a
// rumour.
//
// This is the one number that opens it back up. Unlike Karaoke Night's
// `--kn-alpha`, which IS a surface alpha, this is a clarity: **0 is exactly
// the room as it shipped**, 1 is as open as it goes. CSS derives three things
// from it — surface alpha, blur radius and the backdrop's own veil — so one
// slider moves everything that was hiding the photograph, and a value of zero
// can always be read as "nothing here changed".
//
// The default is deliberately not 0. The complaint that prompted this was
// about the *default* being too heavy, so a first visit gets a room already
// partway open; the slider is for taste from there.

import { createStageGlassPreference } from '@/lib/stage-glass-preference'

const preference = createStageGlassPreference({
  storageKey: 'pitchperfect_gn_room_glass',
  defaultValue: 0.35,
  min: 0,
  max: 1,
  step: 0.05,
})

export const GUITAR_NIGHT_GLASS = preference.spec

export const loadGuitarNightGlass = preference.load

export const persistGuitarNightGlass = preference.persist

/** The custom property the whole stylesheet reads. */
export const GUITAR_NIGHT_GLASS_VAR = '--gn-glass'
