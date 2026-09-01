// Every number the 3D world can be tuned by, in one place.
// ============================================================
//
// The 2D engine's single best decision was `journey-config.ts`: no feel
// number anywhere else, so tuning is one file and a level can override a
// slice of it without forking any code. This is that, for the 3D world.
//
// The rule that keeps it honest: if a constant changes how the game
// FEELS, it lives here. If it changes how the game LOOKS at a fixed
// feel — a colour, a mesh name — it belongs to the renderer. Physics
// that the simulation solves belongs here, because the whole point is
// that a designer can move it.
//
// The debug panel (§8 of docs/games/glass-3d.md) binds directly to this
// object and dumps it back as JSON, so the shape has to stay plain data:
// numbers, nested objects, nothing computed.

export interface World3DConfig {
  /** The resonance verb: hold a note to the cap, then wave it to break. */
  ring: {
    /** Forgiving pitch band, in semitones. The skill is the wave. */
    tolSemis: number
    /** Seconds of in-band holding to reach `holdCap`. */
    riseSeconds: number
    /** What a steady hold alone can reach. The rest is vibrato's. */
    holdCap: number
    /** Seconds of full-strength vibrato from `holdCap` to the break. */
    pumpSeconds: number
    /** Extra band once ringing — the wave must not fall out of tune. */
    pumpTolBonus: number
    /** Seconds to decay from full to nothing when unsung. Slow: no
     * punishment for breathing. */
    fallSeconds: number
  }

  /** The ear that decides whether the voice is WAVING.
   *
   * The 2D game's band (journey-config.ts) was fitted to a trained
   * vibrato: 3.5-8.5 Hz, 15-140 cents. Measured against synthetic
   * singers (vibrato-reach.test.ts), that band rejects everything a
   * first-time player actually does -- a deliberate, conscious wobble
   * sits nearer 2.5 Hz, and an enthusiastic one swings well past 140
   * cents. Both read as "nothing happening", with no way to tell which.
   *
   * So the 3D world keeps its own band, wider at both ends. The skill
   * is still the wave; it is just no longer a wave only a singer can
   * make. */
  vibrato: {
    /** Sliding window the wave is measured over, seconds. */
    windowSec: number
    /** Oscillation rate that counts, Hz. */
    minHz: number
    maxHz: number
    /** Half peak-to-peak amplitude that counts, cents. */
    minDepthCents: number
    maxDepthCents: number
    /** Samples needed before judging. */
    minSamples: number
    /** A silence gap longer than this resets the window, ms. */
    resetGapMs: number
  }

  /** How the glass comes apart once resonance reaches 1. */
  shatter: {
    /** Metres per second of outward launch at a perfect break. */
    launchSpeed: number
    /** How much of that a worst-case in-tolerance break gets, 0..1. */
    launchSpeedFloorRatio: number
    /** Extra upward metres per second, so shards arc rather than slide. */
    launchLift: number
    /** Random spread on each shard's direction, in radians. */
    spreadRadians: number
    /** Turns per second, at the fastest. */
    spinTurnsPerSecond: number
    /** Seconds over which shards are released, so the break is not flat. */
    releaseWindowSeconds: number
    /** Metres per second squared. Positive; applied downward. */
    gravity: number
    /** Velocity retained after a floor bounce, 0..1. */
    restitution: number
    /** Seconds after its release before a shard has fully settled. */
    settleSeconds: number
  }

  /** The fixed-step loop. */
  loop: {
    /** Seconds per simulation step. */
    stepSeconds: number
    /** Most steps one frame may run before time is simply dropped, so a
     * stall cannot spiral into a longer stall. */
    maxStepsPerFrame: number
  }
}

export const WORLD3D_CONFIG: World3DConfig = {
  ring: {
    tolSemis: 1.2,
    riseSeconds: 1.5,
    holdCap: 0.55,
    pumpSeconds: 1.6,
    pumpTolBonus: 1.0,
    fallSeconds: 2.6,
  },
  vibrato: {
    windowSec: 1.0,
    // 2.2 Hz because a player told to "let it waver" waves at about the
    // rate they would shake their head, not at a singer's 5.5.
    minHz: 2.2,
    maxHz: 9.5,
    // 12 because the smoother costs roughly a fifth of the depth before
    // the detector ever sees it.
    //
    // 220 is not a taste call: it is exactly the pitch band the wave has
    // to stay inside, (ring.tolSemis + ring.pumpTolBonus) * 100. Swing
    // wider than that and the note leaves tolerance, so resonance decays
    // no matter what the ear says. Setting the cap anywhere above 220
    // would only promise a pump the sim then refuses.
    minDepthCents: 12,
    maxDepthCents: 220,
    minSamples: 12,
    resetGapMs: 250,
  },
  shatter: {
    launchSpeed: 3.2,
    launchSpeedFloorRatio: 0.55,
    launchLift: 1.1,
    spreadRadians: 0.45,
    spinTurnsPerSecond: 2.5,
    releaseWindowSeconds: 0.12,
    gravity: 9.81,
    restitution: 0.25,
    settleSeconds: 2.5,
  },
  loop: {
    stepSeconds: 1 / 120,
    maxStepsPerFrame: 5,
  },
}

/** A level's partial override of the config, one branch at a time. */
export type World3DConfigOverride = {
  [K in keyof World3DConfig]?: Partial<World3DConfig[K]>
}

/**
 * Merge a level's overrides over the defaults. One level deep, which is
 * as deep as the config goes — a deeper merge would let a level change
 * something it should not.
 *
 * Written out branch by branch rather than looped over the keys, and
 * deliberately: a loop needs a cast to typecheck, and the cast is what
 * would let a new config branch be added above and silently never be
 * mergeable. This way the compiler asks for it.
 */
export const resolveConfig = (
  override: World3DConfigOverride | undefined,
  base: World3DConfig = WORLD3D_CONFIG,
): World3DConfig => {
  if (override === undefined) return base
  return {
    ring: { ...base.ring, ...override.ring },
    vibrato: { ...base.vibrato, ...override.vibrato },
    shatter: { ...base.shatter, ...override.shatter },
    loop: { ...base.loop, ...override.loop },
  }
}
