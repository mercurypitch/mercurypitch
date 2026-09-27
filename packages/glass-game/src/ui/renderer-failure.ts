// Renderer failure lifecycle — accept current attempts, report bounded diagnostics and release the renderer.

import type { GlassRenderer } from '../render/glass-renderer'
import type { GlassAssetQualityProfile, GlassRenderQualityPreference, GlassRenderQualityProfile, } from '../render/render-quality'
import type { AdventureLoadingPhase, AdventureLoadingState, } from './loading-lifecycle'

export const ASSET_LOAD_ERROR =
  'The gallery could not finish loading. Check your connection, then retry.'
export const GRAPHICS_LOAD_ERROR =
  'The graphics connection stopped. Your progress is safe. Retry the gallery.'
export const GRAPHICS_SUPPORT_ERROR =
  'The museum needs 3D graphics support. Close other demanding apps, then retry.'

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

interface RendererFailureLifecycle {
  state(): Pick<AdventureLoadingState, 'phase'>
  fail(attempt: number, message: string): boolean
}

interface RendererFailureControllerOptions {
  loading: RendererFailureLifecycle
  preference: () => GlassRenderQualityPreference
  currentRenderer: () => GlassRenderer | null
  clearCurrentRenderer: () => void
  clearPresentation: () => void
  pauseSoundscape: () => void
  cancelInteraction: () => void
  pauseGame: () => void
  refresh: () => void
}

export interface RendererAttemptFailure {
  generation: number
  message: string
  renderer: GlassRenderer | null
  stage: RendererFailureStage
  cause: unknown
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

export function createRendererFailureController(
  options: RendererFailureControllerOptions,
) {
  return (failure: RendererAttemptFailure): boolean => {
    const phase = options.loading.state().phase
    if (!options.loading.fail(failure.generation, failure.message)) return false
    const quality = failure.renderer?.getRenderQuality()
    reportRendererFailure(
      {
        attempt: failure.generation,
        phase,
        stage: failure.stage,
        preference: options.preference(),
        renderProfile: quality?.profile ?? 'unavailable',
        assetProfile: quality?.assetProfile ?? 'unavailable',
      },
      failure.cause,
    )
    options.clearPresentation()
    options.pauseSoundscape()
    options.cancelInteraction()
    options.pauseGame()
    options.refresh()
    if (options.currentRenderer() === failure.renderer)
      options.clearCurrentRenderer()
    failure.renderer?.dispose()
    return true
  }
}
