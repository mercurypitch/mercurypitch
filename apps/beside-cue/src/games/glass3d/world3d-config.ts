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
    /** Constant lean towards the camera, added to each shard's outward
     * direction before it is normalised. 0 is a pure radial burst, which
     * throws half the glass away from the viewer and through Merc. */
    towardViewer: number
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

  /** How Merc walks and jumps. Metres and seconds; see sim/locomotion3d. */
  locomotion: {
    walkSpeed: number
    accelSeconds: number
    jumpHeight: number
    gravity: number
    coyoteSeconds: number
    bufferSeconds: number
    maxFallSpeed: number
    minX: number
    maxX: number
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
  // Loosened 2026-09-03: maff was running out of breath before the ring
  // broke. The hold reaches further and gets there sooner, the vibrato
  // that finishes it is worth half again as much per second, the pitch
  // band is wider, and a breath costs much less -- `fallSeconds` is the
  // one that decides whether stopping to breathe undoes the attempt.
  //
  // The skill is still the wave. It is just no longer a breath-hold
  // contest on top of it.
  ring: {
    tolSemis: 1.5,
    riseSeconds: 1.2,
    holdCap: 0.6,
    pumpSeconds: 1.1,
    pumpTolBonus: 1.0,
    fallSeconds: 4.0,
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
    // 250 is not a taste call: it is exactly the pitch band the wave has
    // to stay inside, (ring.tolSemis + ring.pumpTolBonus) * 100. Swing
    // wider than that and the note leaves tolerance, so resonance decays
    // no matter what the ear says. Setting the cap anywhere above it
    // would only promise a pump the sim then refuses -- and it moved
    // from 220 with `tolSemis`, which is what the test that pins the two
    // together is for.
    minDepthCents: 12,
    maxDepthCents: 250,
    minSamples: 12,
    resetGapMs: 250,
  },
  // Retuned 2026-09-03, after maff watched it on a device: "the glass
  // breaks ugly and too fast, it should not shatter like that and hit
  // merc and go behind him". It was a bang -- every shard released
  // inside 0.12s at 3.2 m/s under full gravity, spinning two and a half
  // turns a second, gone before the eye could follow any one of them.
  //
  // What replaces it is a slower, floatier break that can be watched:
  // roughly two thirds the launch speed, a release window nearly three
  // times as long so the pane comes apart in a cascade rather than all
  // at once, and gravity below Earth's -- which is not physics, it is
  // the reason slow-motion glass looks like glass. More lift and more
  // spread to arc them apart, less spin so an individual shard reads as
  // a shape rather than a blur, and a longer settle so the floor is not
  // reached before the eye is.
  // These are the Hallway's, at Hallway scale. `shatterIn` below is how
  // another world borrows them, and how the whole break is slowed
  // further without hand-editing six numbers into disagreement.
  //
  // Slowed once more on 2026-09-03 -- maff: "a bit even slower when it
  // shatters, like a slow motion camera shot or similar would be
  // nicer". These carry a x1.35 slow-motion already applied: gravity is
  // divided by 1.35 SQUARED, which is the part that is easy to get
  // wrong and the difference between slow motion and weak gravity.
  shatter: {
    launchSpeed: 1.55,
    launchSpeedFloorRatio: 0.6,
    launchLift: 1.0,
    spreadRadians: 0.55,
    towardViewer: 0.45,
    spinTurnsPerSecond: 1.05,
    releaseWindowSeconds: 0.43,
    gravity: 4.1,
    restitution: 0.2,
    settleSeconds: 4.3,
  },
  // Merc is a hovering droplet about half a metre tall, so these are
  // not a human's numbers: he accelerates fast, tops out slow, and
  // falls under a gravity well below Earth's because a blob that drops
  // like a brick stops reading as a liquid. `minX`/`maxX` are the
  // Hallway's; a chamber overrides them with its own length.
  locomotion: {
    walkSpeed: 1.15,
    accelSeconds: 0.14,
    jumpHeight: 0.5,
    gravity: 6.2,
    coyoteSeconds: 0.11,
    bufferSeconds: 0.13,
    maxFallSpeed: 5.5,
    minX: -1.5,
    maxX: 1.45,
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
/**
 * The same break, in a different-sized world or at a different speed.
 *
 * Both knobs are here because the two are constantly confused and the
 * arithmetic is not the same.
 *
 * `worldScale` is SIZE. The Cabinet's glass is about a fifth of the
 * Hallway's pane, and metres per second are absolute, so the identical
 * numbers make the Cabinet's break look five times faster -- which is
 * exactly what maff saw ("the cabinet shatter is a bit even faster so
 * not that good", 2026-09-03). Distances, speeds and accelerations all
 * scale linearly with size; durations do not move at all.
 *
 * `slowMotion` is TIME, and it is the one that behaves oddly: halving
 * the speed of a falling object does not halve the speed of the fall,
 * because gravity goes on doing what it does. A camera running k times
 * slow sees velocities divided by k and accelerations divided by k
 * SQUARED, and every duration stretched by k. Getting that square wrong
 * is what makes slow motion look like weak gravity instead.
 */
export const shatterIn = (
  base: World3DConfig['shatter'],
  opts: { worldScale?: number; slowMotion?: number },
): World3DConfig['shatter'] => {
  const s = opts.worldScale ?? 1
  const k = opts.slowMotion ?? 1
  return {
    ...base,
    launchSpeed: (base.launchSpeed * s) / k,
    launchLift: (base.launchLift * s) / k,
    gravity: (base.gravity * s) / (k * k),
    releaseWindowSeconds: base.releaseWindowSeconds * k,
    settleSeconds: base.settleSeconds * k,
    spinTurnsPerSecond: base.spinTurnsPerSecond / k,
  }
}

/**
 * The Cabinet, whose glass is roughly a fifth of the Hallway's pane.
 *
 * Everything else it uses is the Hallway's -- one ring, one ear, one
 * loop -- so this is an override of the one part of the config that is
 * measured in metres.
 */
export const CABINET_CONFIG: World3DConfig = {
  ...WORLD3D_CONFIG,
  shatter: shatterIn(WORLD3D_CONFIG.shatter, { worldScale: 0.2 }),
}

/**
 * A chamber, where the note names a PLACE and not just a pane.
 *
 * The Hallway can afford a wide band -- there is one note in the room
 * and holding it is the whole task. A chamber cannot. Its modes are
 * neighbours on the harmonic ladder, and the rungs get closer as they
 * climb: modes 4 and 5 are 3.86 semitones apart, so two bands 1.5 wide
 * would leave less than a semitone of ground between "you are singing
 * the lower one" and "you are singing the upper one". Narrowed until
 * there is real room to be wrong in, which is what makes being right
 * mean something (docs/games/standing-wave-chamber.md §2).
 *
 * `pumpTolBonus` narrows with it, so the vibrato phase stays the same
 * proportion of forgiveness it is in the Hallway.
 */
/**
 * How many strips a chamber's floor pattern is drawn in.
 *
 * Here rather than in the renderer that draws them, because a LEVEL has
 * to be checkable against it: a strip is coloured from the amplitude at
 * its CENTRE, so a room can spawn a player on safe ground inside a strip
 * it has painted as lethal. Chamber 4 shipped exactly that mismatch, and
 * the test that catches it should not have to import three.js to do it.
 */
export const FLOOR_STRIPS = 72

export const CHAMBER_CONFIG: World3DConfig = {
  ...WORLD3D_CONFIG,
  ring: {
    ...WORLD3D_CONFIG.ring,
    tolSemis: 0.7,
    pumpTolBonus: 0.45,
  },
  vibrato: {
    ...WORLD3D_CONFIG.vibrato,
    maxDepthCents: (0.7 + 0.45) * 100,
  },
}

export const resolveConfig = (
  override: World3DConfigOverride | undefined,
  base: World3DConfig = WORLD3D_CONFIG,
): World3DConfig => {
  if (override === undefined) return base
  return {
    ring: { ...base.ring, ...override.ring },
    vibrato: { ...base.vibrato, ...override.vibrato },
    shatter: { ...base.shatter, ...override.shatter },
    locomotion: { ...base.locomotion, ...override.locomotion },
    loop: { ...base.loop, ...override.loop },
  }
}
