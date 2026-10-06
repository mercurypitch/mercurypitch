// Shatter presentation timing — one pure contract keeps gameplay ownership and rendered shards aligned.

export const SHATTER_PRESENTATION_TIMING = {
  normal: {
    anticipationSeconds: 0.1,
    visibleFlightSeconds: 2.2,
    flightTimeScale: 1,
    fadeStartSeconds: 1.45,
    fadeSeconds: 0.75,
  },
  reducedMotion: {
    anticipationSeconds: 0,
    visibleFlightSeconds: 0.45,
    flightTimeScale: 0.14,
    fadeStartSeconds: 0.45,
    fadeSeconds: 0,
  },
} as const

/** A slow rendered frame cannot consume more visible release than this. */
export const MAXIMUM_SHATTER_FRAME_SECONDS = 0.1

/** Gameplay, input and the cinematic camera retain ownership through every normal-motion shard frame. */
export const SHATTER_LIFECYCLE_SECONDS =
  SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds +
  SHATTER_PRESENTATION_TIMING.normal.visibleFlightSeconds

/** Development presentation control; one changes the duration, not the shard path. */
export const SHATTER_PLAYBACK_SPEED = {
  minimum: 0.4,
  maximum: 1.6,
  default: 1,
} as const

export function parseShatterPlaybackSpeed(
  raw: number | string | null | undefined,
): number {
  const speed = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof speed === 'number' && Number.isFinite(speed)
    ? Math.max(
        SHATTER_PLAYBACK_SPEED.minimum,
        Math.min(SHATTER_PLAYBACK_SPEED.maximum, speed),
      )
    : SHATTER_PLAYBACK_SPEED.default
}

export function shatterLifecycleSeconds(speed: number): number {
  return SHATTER_LIFECYCLE_SECONDS / parseShatterPlaybackSpeed(speed)
}

/** Latch at the break so a settings change never jumps a live fracture forward. */
export function createShatterPlayback(initialSpeed?: number) {
  let nextSpeed = parseShatterPlaybackSpeed(initialSpeed)
  let activeSpeed = nextSpeed
  let previousBreak: number | null = null
  let previousNow = -Infinity
  return {
    setSpeed(speed: number): void {
      nextSpeed = parseShatterPlaybackSpeed(speed)
    },
    speed: () => activeSpeed,
    age(brokenAt: number | null, now: number, speedAtBreak?: number): number {
      if (brokenAt !== previousBreak || now < previousNow)
        activeSpeed =
          speedAtBreak === undefined
            ? nextSpeed
            : parseShatterPlaybackSpeed(speedAtBreak)
      previousBreak = brokenAt
      previousNow = now
      return brokenAt === null ? -1 : Math.max(0, now - brokenAt) * activeSpeed
    },
  }
}
