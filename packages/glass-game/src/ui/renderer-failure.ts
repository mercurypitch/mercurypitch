// Renderer failure diagnostics — retain the original local error with bounded lifecycle context.

import type { GlassAssetQualityProfile, GlassRenderQualityPreference, GlassRenderQualityProfile, } from '../render/render-quality'
import type { AdventureLoadingPhase } from './loading-lifecycle'

export type RendererFailureStage =
  | 'initialization'
  | 'asset-load'
  | 'context-lost'
  | 'frame'

interface RendererFailureContext {
  attempt: number
  phase: AdventureLoadingPhase
  stage: RendererFailureStage
  preference: GlassRenderQualityPreference
  renderProfile: GlassRenderQualityProfile | 'unavailable'
  assetProfile: GlassAssetQualityProfile | 'unavailable'
}

/** Local console only: no audio, save data or arbitrary rejected payloads. */
export function reportRendererFailure(
  context: RendererFailureContext,
  cause: unknown,
): void {
  const original = cause instanceof Error ? cause : undefined
  const diagnostic = new Error('Glassworks renderer attempt failed', {
    cause: original,
  })
  console.error(
    '[Glassworks graphics]',
    {
      ...context,
      errorName: original?.name.slice(0, 80) ?? 'UnknownError',
      errorMessage:
        original?.message.slice(0, 240) ?? 'No error detail supplied',
    },
    diagnostic,
  )
}
