// The break, as a timeline of durations.
// ============================================================
//
// §7.1 of glass-3d.md is one timeline, measured from the crack, and P4
// (slice-5-polish-to-v1.md §2.1) chose what of it is built:
//
//   0              the crack: the heavy haptic, and the camera starts to shake
//   0 -> 100 ms    hitstop: the broken glass is seen, and nothing moves
//   100 -> 350 ms  slow motion, at 0.35x
//   350 -> 550 ms  back up to full speed
//   0 -> 400 ms    the shake, fading as the square of what is left of it
//   100/300/550    three light haptics
//   0 -> 1200 ms   the pixel ratio dropped to 1.0 for the burst
//
// EVERY ONE OF THOSE NUMBERS IS A DURATION, and nothing here counts
// frames. iOS puts Low Power Mode, visual idle and thermal mitigation into
// WebKit's half-rate set, and a timeline advanced by frame count would
// play the whole break at half speed for anyone with a low battery. Here
// every quantity is a function of the wall time since the crack, and the
// one that accumulates -- how far the shards have flown -- is integrated
// in closed form, so thirty frames a second and sixty put the same shard
// in the same place and fire the same tap at the same moment.
//
// WHAT SLOWS IS WHAT IS SEEN. Hitstop and slow motion scale the shards'
// clock and Merc's clip, and they do not touch the fixed-step simulation:
// the pad's jump pulse is 80 ms, shorter than the hitstop, and a world
// that stopped stepping for 100 ms would drop a jump pressed inside it.
//
// Chromatic aberration and the dust billboards of §7.1 are not built
// (P4): the first is a render target, which is fill rate on a phone, and
// the shards already carry the moment.

export interface ImpactConfig {
  /** Seconds the broken glass holds still after the crack. */
  hitstopSeconds: number
  /** How fast the world is seen to run in the slow stretch, 0..1. */
  slowScale: number
  /** Seconds after the crack when the ramp back to full speed starts. */
  slowUntilSeconds: number
  /** Seconds after the crack by which it is back at full speed. */
  rampUntilSeconds: number
  /** Seconds the camera shakes for. */
  shakeSeconds: number
  /** How far the camera turns at the crack, degrees. */
  shakeDegrees: number
  /** How far it rolls, degrees. */
  shakeRollDegrees: number
  /** How fast the shake wobbles, Hz. */
  shakeHz: number
  /** Seconds the pixel ratio stays dropped while the glass flies. */
  burstSeconds: number
  /** The pixel ratio for those seconds. Never raises the running one. */
  burstPixelRatio: number
  /** When the three light taps come, seconds after the crack. */
  tap1Seconds: number
  tap2Seconds: number
  tap3Seconds: number
}

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

/**
 * The phase boundaries, in order whatever the config says. A dial dragged
 * past its neighbour -- the ramp ending before the slow stretch does --
 * must not make the shards' clock run backwards.
 */
const phases = (
  cfg: ImpactConfig,
): { stop: number; slow: number; ramp: number; s: number } => {
  const stop = Math.max(0, cfg.hitstopSeconds)
  const slow = Math.max(stop, cfg.slowUntilSeconds)
  const ramp = Math.max(slow, cfg.rampUntilSeconds)
  return { stop, slow, ramp, s: clamp(cfg.slowScale, 0, 1) }
}

/** Ease in and out, so the return to full speed has no corner in it. */
const smooth = (x: number): number => x * x * (3 - 2 * x)
/** The integral of `smooth` from 0 to x. */
const smoothArea = (x: number): number => x * x * x - (x * x * x * x) / 2

/** How fast what is seen runs, `t` seconds after the crack: 0 in the
 * hitstop, `slowScale` in the slow stretch, 1 before and after. */
export const timeScaleAt = (t: number, cfg: ImpactConfig): number => {
  if (!(t >= 0)) return 1
  const { stop, slow, ramp, s } = phases(cfg)
  if (t < stop) return 0
  if (t < slow) return s
  if (t < ramp) return s + (1 - s) * smooth((t - slow) / (ramp - slow))
  return 1
}

/**
 * Seconds of shard flight to show, `t` seconds of wall time after the
 * crack: the integral of `timeScaleAt`, in closed form. A clock that was
 * summed frame by frame instead would drift with the frame rate, which is
 * exactly what this module exists not to do.
 */
export const presentTimeAt = (t: number, cfg: ImpactConfig): number => {
  if (!(t > 0)) return 0
  const { stop, slow, ramp, s } = phases(cfg)
  if (t <= stop) return 0
  let seen = (Math.min(t, slow) - stop) * s
  if (t <= slow) return seen
  const span = ramp - slow
  if (span > 0) {
    const x = Math.min(1, (Math.min(t, ramp) - slow) / span)
    seen += span * (s * x + (1 - s) * smoothArea(x))
  }
  return t <= ramp ? seen : seen + (t - ramp)
}

/** A turn of the lens about its own axes, radians. */
export interface Shake {
  yaw: number
  pitch: number
  roll: number
}

export const NO_SHAKE: Readonly<Shake> = { yaw: 0, pitch: 0, roll: 0 }

const DEG = Math.PI / 180

/** A smooth wobble in [-1, 1]: two sines at a ratio that does not repeat
 * inside a shake. Deterministic, so the same break shakes the same. */
const wobble = (t: number, hz: number, phase: number): number =>
  (Math.sin(2 * Math.PI * hz * t + phase) +
    0.5 * Math.sin(2 * Math.PI * hz * 2.13 * t + phase * 1.7)) /
  1.5

/**
 * The shake, `t` seconds after the crack. Trauma starts at 1 and falls
 * linearly to 0 over `shakeSeconds`; what is seen is trauma SQUARED,
 * which is what makes a shake read as an impact that dies away rather
 * than a camera being waved about for a fixed while.
 *
 * Angles rather than metres, so one number serves the Cabinet's
 * tabletop and the Hallway's corridor alike.
 */
export const shakeAt = (t: number, cfg: ImpactConfig): Shake => {
  if (!(t >= 0) || !(cfg.shakeSeconds > 0) || t >= cfg.shakeSeconds) {
    return NO_SHAKE
  }
  const trauma = 1 - t / cfg.shakeSeconds
  const k = trauma * trauma
  return {
    yaw: k * cfg.shakeDegrees * DEG * wobble(t, cfg.shakeHz, 0.9),
    pitch: k * cfg.shakeDegrees * DEG * wobble(t, cfg.shakeHz, 2.3),
    roll: k * cfg.shakeRollDegrees * DEG * wobble(t, cfg.shakeHz, 4.1),
  }
}

/** Whether the pixel ratio is dropped, `t` seconds after the crack. A
 * scripted step on the timeline rather than a live controller: one of
 * those needs about twenty frames to settle, which is most of the burst,
 * and the pop it makes is worse than one slightly soft second (§7.1). */
export const burstAt = (t: number, cfg: ImpactConfig): boolean =>
  t >= 0 && t < cfg.burstSeconds

/** The running pixel-ratio cap, §5.4: fill cost goes as its square, and
 * on glass and light 1.5 is close to invisible against a phone's 3. */
export const RUNNING_PIXEL_RATIO = 1.5

/** The pixel ratio to draw at. The burst's only ever lowers it: a laptop
 * already at 1.0 draws the burst exactly as it drew before. */
export const pixelRatioFor = (
  devicePixelRatio: number,
  burst: boolean,
  cfg: ImpactConfig,
): number => {
  const running = Math.min(
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1,
    RUNNING_PIXEL_RATIO,
  )
  return burst ? Math.min(running, cfg.burstPixelRatio) : running
}

export type Tap = 'heavy' | 'light'

/** The taps whose moment falls in (from, to], seconds after the crack.
 * Asked with the last frame's time and this one's, so a tap is felt on
 * the first frame at or after its moment, whatever the frame rate. */
export const tapsBetween = (
  from: number,
  to: number,
  cfg: ImpactConfig,
): Tap[] => {
  const all: readonly (readonly [number, Tap])[] = [
    [0, 'heavy'],
    [cfg.tap1Seconds, 'light'],
    [cfg.tap2Seconds, 'light'],
    [cfg.tap3Seconds, 'light'],
  ]
  return all
    .filter(([at]) => at > from && at <= to)
    .sort((a, b) => a[0] - b[0])
    .map(([, tap]) => tap)
}

/** Everything the break asks of one frame. */
export interface ImpactFrame {
  /** Wall seconds since the crack. */
  since: number
  /** Seconds of shard flight to show. */
  shardSeconds: number
  /** How fast Merc's clip runs this frame, 0..1. */
  timeScale: number
  shake: Shake
  /** Whether the pixel ratio is dropped. */
  burst: boolean
  /** Haptics that fell due since the last frame, in order. */
  taps: Tap[]
}

export interface ImpactTrack {
  /** The glass broke at this wall time. A second break restarts it. */
  start(wallSeconds: number): void
  /** This frame's share of the timeline; null before any break. */
  frame(wallSeconds: number, cfg: ImpactConfig): ImpactFrame | null
}

export const createImpactTrack = (): ImpactTrack => {
  let at: number | null = null
  let last = Number.NEGATIVE_INFINITY
  return {
    start(wallSeconds) {
      at = wallSeconds
      last = Number.NEGATIVE_INFINITY
    },
    frame(wallSeconds, cfg) {
      if (at === null) return null
      const since = Math.max(0, wallSeconds - at)
      const taps = tapsBetween(last, since, cfg)
      last = since
      return {
        since,
        shardSeconds: presentTimeAt(since, cfg),
        timeScale: timeScaleAt(since, cfg),
        shake: shakeAt(since, cfg),
        burst: burstAt(since, cfg),
        taps,
      }
    },
  }
}
