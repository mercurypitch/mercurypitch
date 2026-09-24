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

/** Gameplay, input and the cinematic camera retain ownership through every normal-motion shard frame. */
export const SHATTER_LIFECYCLE_SECONDS =
  SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds +
  SHATTER_PRESENTATION_TIMING.normal.visibleFlightSeconds
