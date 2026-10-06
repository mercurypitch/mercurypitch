// ============================================================
// Glass renderer contracts — host controls, presentation input and diagnostics.
// ============================================================

import type { GameSnapshot, MovementReferenceKind, Vec3 } from '../contracts'
import type { LoadingProgress } from '../loading-progress'
import type { AdventureCameraMode, ChallengeCameraMetrics } from './camera'
import type { GlassAssetQualityProfile, GlassRenderQualityPreference, GlassRenderQualityProfile, GlassShadowFrameInterval, } from './render-quality'

export interface GlassRendererOptions {
  shatterPlaybackSpeed?: number
  reducedMotion?: boolean
  followSmoothnessSeconds?: number
  cameraMode?: AdventureCameraMode
  renderQuality?: GlassRenderQualityPreference
  /** Host-packaged startup tier; display quality remains independently tunable. */
  assetProfile?: GlassAssetQualityProfile
  onAssetError?: (id: string, error: unknown) => void
  onLoadingProgress?: (progress: LoadingProgress) => void
  onContextLost?: () => void
  onExitCelebrationComplete?: () => void
}

export interface GlassRendererPresentation {
  /** Optional narrated speech energy for Merc's mouth; no microphone access. */
  narrationLevel?: number
  challengeEncounterId: string | null
  /** Host pause or tutorial state; voice setup pause remains camera-active. */
  paused: boolean
  /** Fraction of the viewport covered by the live voice panel and its margin. */
  safeBottomFraction?: number
}

export interface GlassRenderer {
  /** Required assets are installed; the host still owns the first-frame gate. */
  ready: Promise<void>
  /**
   * `dt` is the uncapped visible-frame interval. Each presentation system
   * applies its own safety bound; camera response must not truncate Merc's
   * animation clock after an ordinary dropped mobile frame.
   */
  render(
    snapshot: GameSnapshot,
    dt: number,
    presentation?: GlassRendererPresentation,
  ): boolean
  resize(): void
  orbit(dxRadians: number, dyRadians: number): void
  setOrbitActive(active: boolean): void
  zoom(delta: number): void
  recenter(): void
  setCameraMode(mode: AdventureCameraMode): void
  getCameraMode(): AdventureCameraMode
  /** Actual rendered view heading, used for presentation and diagnostics. */
  getCameraYaw(): number
  /** Actual rendered Merc heading, used only by development diagnostics. */
  getMercYaw(): number | null
  /** Stable camera-relative movement basis for the current held input. */
  getMovementYaw(): number
  setFollowSmoothness(seconds: number): void
  setShatterPlaybackSpeed(speed: number): void
  setRenderQuality(preference: GlassRenderQualityPreference): void
  getRenderQuality(): {
    preference: GlassRenderQualityPreference
    profile: GlassRenderQualityProfile
    /** Startup asset profile; changing display quality does not reload a world. */
    assetProfile: GlassAssetQualityProfile
    pixelRatio: number
    shadowFrameInterval: GlassShadowFrameInterval
  }
  setMovementActive(active: boolean): void
  rebaseMovement(
    kind?: MovementReferenceKind,
    travelOffsetRadians?: number,
  ): void
  cancelHeadingFollow(): void
  pickArtwork(clientX: number, clientY: number): string | null
  nearbyArtwork(position: Vec3): string | null
  getChallengeCameraMetrics(): ChallengeCameraMetrics
  getMetrics(): {
    drawCalls: number
    triangles: number
    textures: number
    geometries: number
    colorBufferFloat: boolean
    floatLinear: boolean
    reflectionCaptures: number
    reflectionTargetPixels: number
    adaptiveQualityActive: boolean
    performanceSampleCount: number
    performanceSampleWindowSeconds: number
    performanceSlowSampleCount: number
    actualPixelRatio: number
    actualShadowFrameInterval: GlassShadowFrameInterval
    shadowUpdates: number
    shadowReuses: number
  }
  dispose(): void
}
