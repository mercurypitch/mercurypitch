// ============================================================
// Merc's Journey — every gameplay tunable in one place.
//
// Same philosophy as GLASS_CONFIG: nothing in the journey code hard-codes
// a number that belongs to game feel. Tweak freely between playtests.
// ============================================================

export const JOURNEY_CONFIG = {
  /** Voice → control mapping. */
  voice: {
    /** Consecutive voiced frames required before pitch is trusted. */
    debounceFrames: 3,
    /** Max sprite movement per 60fps frame, semitones (slew clamp). */
    slewSemisPerFrame: 0.45,
    /** Silence longer than this = intentional stop → Merc rests. */
    restGraceMs: 280,
  },

  /** Vertical pitch window and motion feel. */
  view: {
    /** Window bottom, semitones relative to the ground note. */
    windowLoOffset: -3,
    /** Window top, semitones relative to the ground note. */
    windowHiOffset: 9,
    /** World units visible across the screen width. */
    viewUnits: 10,
    /** Camera x follow lerp per frame. */
    cameraLerp: 0.06,
    /** Merc y lerp while flying / while settling onto a rest. */
    flyLerp: 0.22,
    restLerp: 0.15,
    /** Merc x follow lerp toward the active objective. */
    xLerp: 0.045,
  },

  /** Landing on a platform (climb + bridge steps). */
  land: {
    /** In-band tolerance, semitones. */
    bandSemis: 0.6,
    /** Continuous in-band time to land/crystallize, ms. */
    dwellMs: 700,
    /** Out-of-band dwell decay multiplier (dwell -= dt * decay). */
    decay: 2,
  },

  /** Glass (icy) platforms crack under a resting Merc. */
  glass: {
    /** Time from first rest contact to shatter, ms. */
    crackMs: 3200,
    /** Broken platform regrows after, ms. */
    respawnMs: 2600,
  },

  /** The mid-stage gate pane (hold its note to shatter). */
  gate: {
    tolSemis: 0.5,
    /** Full resonance build time in-band, ms. */
    riseMs: 1600,
    /** Full decay time out-of-band, ms. */
    fallMs: 900,
  },

  /** The final wall pane — bigger, slower to charge. */
  wall: {
    tolSemis: 0.5,
    riseMs: 2400,
    fallMs: 900,
  },

  /** Melody bridge over the void. */
  bridge: {
    /** Step notes, semitones above the ground note (sung in order). */
    stepOffsets: [3, 5, 7],
    /** Hum the active step's note as a guide when it activates. */
    humSeconds: 1.4,
  },

  /** Falling + game over. */
  fall: {
    /** Downward speed while falling, canvas fractions per second. */
    speed: 0.9,
    /** Below this canvas-y fraction, the run is lost. */
    yGone: 1.2,
    /** Pause before the game-over card, ms. */
    cardDelayMs: 700,
  },

  /** Visual dressing — parallax, materials, Merc sprite feel. */
  art: {
    /** Horizontal scroll factor per layer (0 = pinned, 1 = world speed). */
    parallaxFar: 0.1,
    parallaxMid: 0.28,
    parallaxNear: 0.55,
    /** Screen-blend opacity of the nebula / dust layers. */
    nebulaAlpha: 0.34,
    dustAlpha: 0.5,
    /** Platform slab thickness, world units (clamped in px below). */
    platformUnits: 0.13,
    platformMinPx: 10,
    platformMaxPx: 20,
    /** Texture pattern scale (image pixels → screen pixels). */
    texScale: 0.35,
    /** Merc sprite height, world units (clamped in px below). */
    mercUnits: 0.48,
    mercMinPx: 38,
    mercMaxPx: 72,
    /** Squash & stretch: scale = 1 + min(squashMax, |vy| * squashVelScale). */
    squashMax: 0.22,
    squashVelScale: 2.4,
    /** Lean into horizontal motion, radians cap + velocity scale. */
    tiltMax: 0.3,
    tiltVelScale: 5,
    /** Wobble while falling, radians. */
    fallWobble: 0.4,
    /** Mercury beads shed while falling (count alive at once). */
    fallBeads: 10,
    /** World units visible across the width in portrait (narrow) view. */
    viewUnitsPortrait: 7,
  },
} as const

export type JourneyConfig = typeof JOURNEY_CONFIG
