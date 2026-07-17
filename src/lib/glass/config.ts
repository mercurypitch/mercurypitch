// ============================================================
// Glass — every gameplay tunable in one place.
//
// The knobs the plan (docs/plans/glass-handoff-2026-07-17.md §3.3,
// §17.3) says we will retune after real-singer testing live here,
// not scattered through the feature. Values are the prototype-
// validated starting points; adjust freely — nothing else in the
// glass code hard-codes a number that belongs to game feel.
// ============================================================

export const GLASS_CONFIG = {
  /** Calibration glide → the glass's note (spec §3.2). */
  calibration: {
    /** Length of the low-to-high siren glide take. */
    glideSeconds: 8,
    /** A semitone must be sustained this long to count toward the ceiling. */
    ceilingSustainMs: 300,
    /** Under this much voiced audio the glide is re-run once. */
    minVoicedSeconds: 1.5,
    /** Under this glide span (semitones) the glide is re-run once. */
    minSpanSemitones: 5,
    /** Fallback target when calibration fails twice: median + this. */
    fallbackOffsetFromMedian: 4,
  },

  /** Where the glass rings relative to the singer's ceiling. */
  target: {
    /**
     * Semitones below the calibrated ceiling. −2 keeps first-timers
     * winning (this is a fun experience, not a perfection tool — maff);
     * raise toward −1 when testing says so. A future "Pro mode" pins the
     * target to a legend's actual famous note instead (plan §17.5).
     */
    offsetSemitones: -2,
    /** In-band tolerance, cents (matches the mirror's HIT_TOLERANCE_CENTS). */
    tolCents: 35,
  },

  /** The rep loop (sing → hear yourself → retry). */
  reps: {
    singSeconds: 8,
    /** Cap on the listen-back replay of a take. */
    playbackMaxSeconds: 8,
    /** Reps per session before the results screen offers a wrap-up. */
    defaultReps: 3,
    /** Soft "give your voice a rest" nudge after this many reps. */
    restNudgeAfterReps: 6,
  },

  /** Resonance model (prototype-validated, spec §3.3). */
  resonance: {
    /** Growth per second while in band… */
    rise: 0.3,
    /** …accelerated by the current level (rise + riseAccel·res). */
    riseAccel: 0.5,
    /** Decay per second while out of band. */
    fall: 0.55,
    /** In-band growth is scaled by 1 − edgeSoftening·|off|/tol. */
    edgeSoftening: 0.4,
    /** Continuous in-band seconds required before a shatter may fire. */
    lockForShatterSec: 0.8,
  },

  /** Cumulative glass fatigue (near-misses leave real damage, spec §3.3). */
  fatigue: {
    /** Stress→damage rate; stress = level · proximity². */
    rate: 0.052,
    /** Proximity floor: |off| ≥ this many cents contributes nothing. */
    proximityFloorCents: 300,
    /** Full fatigue lowers the shatter wall by this fraction. */
    assist: 0.38,
    /** Fatigue thresholds that each spawn a permanent crack. */
    crackSteps: [0.18, 0.36, 0.55, 0.74, 0.9],
  },

  /** Performance-scaled shatter timing (spec §17.3). */
  shatter: {
    flashSeconds: 0.22,
    /** Slow-mo time factor at epicness 1 (clean first-try) … */
    slowMoFactorEpic: 0.08,
    /** … and at epicness 0 (rep-5 fatigue grind). */
    slowMoFactorRaw: 0.22,
    /** Slow-mo duration range, same interpolation. */
    slowMoSecondsEpic: 1.1,
    slowMoSecondsRaw: 0.5,
    /** Results reveal this long after the slow-mo ends. */
    resultsDelaySeconds: 1.4,
    /** epicness = clamp01(base + cleanliness·cleanW − (rep−1)·repW − fatigue·fatigueW) */
    epicness: { base: 0.55, cleanW: 0.45, repW: 0.18, fatigueW: 0.35 },
    /** Rigid-body cap (halved under prefers-reduced-motion). */
    maxShards: 128,
  },
} as const

export type GlassConfig = typeof GLASS_CONFIG
