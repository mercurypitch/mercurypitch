// Where every shard goes, solved once, at the moment of the break.
// ============================================================
//
// The 2D engine integrated shard bodies every frame. This does not, and
// the reason is worth stating because it looks like a downgrade and is
// not:
//
// A shatter is deterministic, lasts a few seconds, and nobody interacts
// with it. So each shard's whole future can be solved the instant the
// glass breaks — a launch velocity, a spin, a release delay — and its
// position at any time is then a closed-form function of one number.
// That number becomes a single uniform, the vertex shader evaluates the
// same arithmetic that is written here, and the CPU does nothing per
// frame at all: one draw call, no buffer uploads, and identical results
// on WebGPU and WebGL2.
//
// The cost is that shards cannot react to anything after the break. For
// a wine glass exploding off a pedestal, they never needed to. If a
// mechanic ever wants shards that pile and re-scatter, that mechanic
// gets a simulation; this one does not need to pay for it.
//
// `shardAt` is the specification. Whatever the shader does must match
// it, and the tests here are what pin it down.

/** Deterministic PRNG, so a seed replays a shatter exactly. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** One shard's entire future, fixed at the break. */
export interface ShardLaunch {
  /** Where its centroid sat in the intact glass. */
  origin: Vec3
  /** Metres per second, at release. */
  velocity: Vec3
  /** Unit axis it tumbles about. */
  spinAxis: Vec3
  /** Radians per second about that axis. */
  spinRate: number
  /** Seconds after the break before it lets go. */
  delay: number
}

/** Where a shard is, and how it is turned, at a moment. */
export interface ShardPose {
  position: Vec3
  /** Radians turned about `spinAxis` so far. */
  angle: number
  /** 0 before release, 1 once fully settled — the fade handle. */
  progress: number
}

export interface ShatterConfig {
  launchSpeed: number
  launchSpeedFloorRatio: number
  launchLift: number
  spreadRadians: number
  /** Constant lean towards the camera, before normalisation. */
  towardViewer: number
  spinTurnsPerSecond: number
  releaseWindowSeconds: number
  gravity: number
  restitution: number
  settleSeconds: number
}

const normalise = (v: Vec3): Vec3 => {
  const len = Math.hypot(v.x, v.y, v.z)
  // A centroid exactly at the break point has no direction to fly. Send
  // it straight up rather than dividing by zero.
  if (len < 1e-6) return { x: 0, y: 1, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/**
 * Solve every shard's launch, once.
 *
 * @param centroids where each shard sat in the intact glass
 * @param breakPoint the impact origin; shards fly away from it
 * @param accuracy how well the note was sung, 0..1 — the only way the
 *   player's performance reaches the look of the break
 * @param seed replays the same shatter exactly
 */
export const solveShatter = (
  centroids: readonly Vec3[],
  breakPoint: Vec3,
  accuracy: number,
  cfg: ShatterConfig,
  seed: number,
): ShardLaunch[] => {
  const rand = mulberry32(seed)
  const clamped = Math.max(0, Math.min(1, accuracy))
  const speed =
    cfg.launchSpeed *
    (cfg.launchSpeedFloorRatio + (1 - cfg.launchSpeedFloorRatio) * clamped)

  return centroids.map((origin) => {
    const away = normalise({
      x: origin.x - breakPoint.x,
      y: origin.y - breakPoint.y,
      z: origin.z - breakPoint.z,
    })

    // Spread, as a small random rotation of the outward direction. Two
    // independent angles rather than one, so the cone is not a ring.
    const spreadA = (rand() * 2 - 1) * cfg.spreadRadians
    const spreadB = (rand() * 2 - 1) * cfg.spreadRadians
    // Leaned towards the viewer. A pure radial burst throws half the
    // glass AWAY from the camera and through the corridor Merc is
    // standing in, which is both the least interesting half to watch and
    // the half that ends up passing through him. Adding a constant to z
    // before normalising tilts the whole cone forward without changing
    // its shape -- shards still fly outward from the break, they just
    // all come slightly at you.
    const dir = normalise({
      x: away.x + spreadA,
      y: away.y + spreadB * 0.5,
      z: away.z + spreadB + cfg.towardViewer,
    })

    const spinAxis = normalise({
      x: rand() * 2 - 1,
      y: rand() * 2 - 1,
      z: rand() * 2 - 1,
    })

    return {
      origin,
      velocity: {
        x: dir.x * speed,
        y: dir.y * speed + cfg.launchLift,
        z: dir.z * speed,
      },
      spinAxis,
      spinRate: (rand() * 2 - 1) * cfg.spinTurnsPerSecond * Math.PI * 2,
      delay: rand() * cfg.releaseWindowSeconds,
    }
  })
}

/**
 * Where a shard is at `t` seconds after the break.
 *
 * Ballistic, with one floor bounce solved in closed form rather than
 * integrated: below the floor, reflect the fall and continue with the
 * energy that survived. It is not a physics engine and does not claim
 * to be — at the speed the debris is moving, one bounce reads as
 * correct and two are never seen.
 */
export const shardAt = (
  launch: ShardLaunch,
  t: number,
  cfg: ShatterConfig,
  floorY = 0,
): ShardPose => {
  const local = t - launch.delay
  if (local <= 0) {
    return { position: launch.origin, angle: 0, progress: 0 }
  }

  const x = launch.origin.x + launch.velocity.x * local
  const z = launch.origin.z + launch.velocity.z * local
  let y =
    launch.origin.y +
    launch.velocity.y * local -
    0.5 * cfg.gravity * local * local

  if (y < floorY) {
    // Time it first crossed the floor, from the same quadratic.
    const a = -0.5 * cfg.gravity
    const b = launch.velocity.y
    const c = launch.origin.y - floorY
    const disc = b * b - 4 * a * c
    const tHit = disc <= 0 ? local : (-b - Math.sqrt(disc)) / (2 * a)
    const after = local - tHit
    const impactSpeed = b - cfg.gravity * tHit
    const bounceSpeed = -impactSpeed * cfg.restitution
    y = floorY + bounceSpeed * after - 0.5 * cfg.gravity * after * after
    if (y < floorY) y = floorY
  }

  return {
    position: { x, y, z },
    angle: launch.spinRate * local,
    progress: Math.max(0, Math.min(1, local / cfg.settleSeconds)),
  }
}

/** Seconds until the last shard has settled, so the caller can dispose. */
export const shatterDuration = (
  launches: readonly ShardLaunch[],
  cfg: ShatterConfig,
): number => {
  let last = 0
  for (const l of launches) {
    if (l.delay > last) last = l.delay
  }
  return last + cfg.settleSeconds
}
