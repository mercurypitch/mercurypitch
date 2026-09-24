// Render quality policy — one stable startup choice bounds mobile pixels and shadow cadence.

export const GLASS_RENDER_QUALITY_PREFERENCE = 'render-quality:v1'

export type GlassRenderQualityPreference = 'auto' | 'high' | 'balanced'
export type GlassRenderQualityProfile = Exclude<
  GlassRenderQualityPreference,
  'auto'
>

export interface GlassRenderQualityEnvironment {
  cssWidth: number
  cssHeight: number
  coarsePointer: boolean
  mobileHint: boolean
}

export interface GlassRenderQualityPolicy {
  profile: GlassRenderQualityProfile
  maximumPixelRatio: number
  shadowFrameInterval: 1 | 2
  shadowMapSize: 1024
  transmissionResolutionScale: 0.5
}

const HIGH: GlassRenderQualityPolicy = {
  profile: 'high',
  maximumPixelRatio: 1.5,
  shadowFrameInterval: 1,
  shadowMapSize: 1024,
  transmissionResolutionScale: 0.5,
}

const BALANCED: GlassRenderQualityPolicy = {
  profile: 'balanced',
  maximumPixelRatio: 1.25,
  shadowFrameInterval: 2,
  shadowMapSize: 1024,
  transmissionResolutionScale: 0.5,
}

const MAXIMUM_COMPACT_EDGE = 600

export function parseGlassRenderQualityPreference(
  raw: string | null | undefined,
): GlassRenderQualityPreference {
  return raw === 'high' || raw === 'balanced' || raw === 'auto' ? raw : 'auto'
}

export function resolveGlassRenderQuality(
  preference: GlassRenderQualityPreference,
  environment: GlassRenderQualityEnvironment,
): GlassRenderQualityPolicy {
  if (preference === 'high') return HIGH
  if (preference === 'balanced') return BALANCED
  const width = Number.isFinite(environment.cssWidth)
    ? Math.max(0, environment.cssWidth)
    : 0
  const height = Number.isFinite(environment.cssHeight)
    ? Math.max(0, environment.cssHeight)
    : 0
  const shortEdge = Math.min(width, height)
  const compactCoarsePointer =
    shortEdge > 0 &&
    shortEdge <= MAXIMUM_COMPACT_EDGE &&
    environment.coarsePointer
  return environment.mobileHint || compactCoarsePointer ? BALANCED : HIGH
}

export function effectiveGlassPixelRatio(
  devicePixelRatio: number,
  policy: GlassRenderQualityPolicy,
): number {
  const ratio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1
  return Math.min(ratio, policy.maximumPixelRatio)
}

/** First frame and every Nth frame update; invalidation always updates next. */
export function createShadowUpdateCadence(initialInterval: 1 | 2) {
  let interval = initialInterval
  let reusedFrames = 0
  let invalidated = true
  return {
    next(): boolean {
      if (invalidated || reusedFrames >= interval - 1) {
        invalidated = false
        reusedFrames = 0
        return true
      }
      reusedFrames++
      return false
    },
    invalidate(): void {
      invalidated = true
    },
    setInterval(next: 1 | 2): void {
      if (interval === next) return
      interval = next
      reusedFrames = 0
      invalidated = true
    },
  }
}
