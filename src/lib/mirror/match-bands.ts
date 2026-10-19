// ============================================================
// Voice Mirror match bands — how far from a target a sung note may sit
// ============================================================
//
// The three edges of a match take's band, every error folded into one octave
// (Voice Mirror spec §4.2): 15 cents or less is a bullseye, 35 or less a hit,
// 60 or less close, anything further a miss. metrics.ts scores takes against
// them and re-exports them.
//
// They live in a file of their own, with nothing imported, because the
// lesson pages draw the same band before they have loaded anything of the
// microphone's: vite.config.ts gives this leaf its own chunk ahead of the
// `pitch-core` rule, so a page that only draws the band never downloads
// the scorer. Read every edge from here or from metrics.ts, never a copy.

/** A sung note this close to the target is a bullseye: "right in the middle". */
export const BULLSEYE_TOLERANCE_CENTS = 15

/** A sung note within this folded distance is a "hit" (§4.2) — the green
 *  locked-on feedback in LiveViz and the onboarding demos shares it, so
 *  what the UI celebrates and what the score rewards can't drift apart. */
export const HIT_TOLERANCE_CENTS = 35

/** Beyond the hit band and up to here, a take is "close"; further is a miss. */
export const CLOSE_TOLERANCE_CENTS = 60
