// ============================================================
// Ear Lab — drill pacing, in one tunable place.
//
// THIS IS THE FILE TO EDIT when a drill feels rushed or draggy.
// Every note length, gap and reveal pause in the Ear Lab reads
// from here, so pacing can be tuned without touching controller
// logic and without hunting constants across eight files.
//
// Two rules when tuning:
//  - These are PRESENTATION only. Nothing here may change what a
//    drill measures — the staircase levels and Elo scales live in
//    drills.ts and banks.ts, and a reading taken at one tempo must
//    stay comparable to one taken at another.
//  - Longer gaps make a task EASIER (more time to hold the first
//    sound in memory). Big changes therefore shift what a reading
//    means in practice, even though the unit is unchanged — worth
//    a fresh calibration after a large edit.
// ============================================================

/** Hairline — two tones, "which was higher?" */
export const HAIRLINE_TIMING = {
  toneMs: 500,
  /** Silence between the two tones. */
  gapMs: 220,
} as const

/** The Grid — six clicks on a lattice, one nudged off it. */
export const GRID_TIMING = {
  /** Lead-in before the first click, so scheduling is never late. */
  leadInS: 0.2,
  /** Silence after the last click before the answer buttons arm. */
  tailMs: 250,
} as const

/** Home — cadence, probe, then a tapped or sung degree. */
export const HOME_TIMING = {
  chordMs: 520,
  /** Silence between cadence chords. */
  chordGapMs: 130,
  /** The probe note being identified. */
  probeMs: 950,
  /** How long the mic listens for a sung answer. */
  singWindowMs: 2600,
  /** The wrong-answer replay: the probe, then home. */
  resolutionProbeMs: 420,
  resolutionTonicMs: 500,
} as const

/** Leap — two notes, name the interval. */
export const LEAP_TIMING = {
  toneMs: 550,
  gapMs: 140,
  /** The slower replay after a miss. */
  replayToneMs: 700,
  replayGapMs: 200,
} as const

/** Stack — one chord, name its quality. */
export const STACK_TIMING = {
  chordMs: 1100,
  /** Each note of the broken-chord replay after a miss. */
  brokenNoteMs: 280,
  /** The re-stacked block that closes the replay. */
  replayChordMs: 900,
} as const

/** Contour — up, down or same, fast. */
export const CONTOUR_TIMING = {
  toneMs: 330,
  gapMs: 110,
  replayToneMs: 550,
  replayGapMs: 180,
} as const

/** How long the reveal holds before the next round. */
export const REVEAL_TIMING = {
  /** Threshold drills: right/wrong is a colour flash, no replay. */
  thresholdMs: 420,
  identificationCorrectMs: 650,
  /** Longer, because a miss replays the sound. */
  identificationWrongMs: 1500,
} as const

/** The latency wizard's click train. */
export const LATENCY_TIMING = {
  clicks: 5,
  spacingS: 0.6,
  /** Settle time before the first click is scheduled. */
  settleS: 0.35,
  /** Recording tail after the last click. */
  tailS: 0.7,
  /** Hard cap on the capture, so a dead mic cannot hang the wizard. */
  captureTimeoutMs: 12000,
} as const
