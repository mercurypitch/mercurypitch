// Collectible artwork tuning — development-only size changes redraw the latest frame without advancing the runner.
import { createSignal } from 'solid-js'
import { COLLECTIBLE_ARTWORK_SCALE, normalizeCollectibleArtworkScale, } from '../core/collectible-artwork'
import type { GlassGameHost } from '../host'
import type { SongRunnerRenderer } from '../render/runner-renderer'
import type { RunnerSnapshot } from '../runner/contracts'
import { hasDevelopmentTuning } from './development-tuning'

export const COLLECTIBLE_ARTWORK_SCALE_PREFERENCE =
  'collectible-artwork-scale:v1'

interface ArtworkPresentation {
  renderer():
    | Pick<SongRunnerRenderer, 'setCollectibleArtworkScale' | 'render'>
    | undefined
  snapshot(): RunnerSnapshot
  canRender(): boolean
  disposed(): boolean
  failed(cause: unknown): void
}

export function createCollectibleArtworkPreference(
  host: Pick<
    GlassGameHost,
    'readPreference' | 'writePreference' | 'developmentTuning'
  >,
  presentation: ArtworkPresentation,
) {
  const enabled = hasDevelopmentTuning(host)
  let saved: string | null = null
  if (enabled) {
    try {
      saved = host.readPreference(COLLECTIBLE_ARTWORK_SCALE_PREFERENCE)
    } catch {
      // Optional tuning must not stop the scene when host storage is unavailable.
    }
  }
  const [collectibleArtworkScale, setCollectibleArtworkScale] = createSignal(
    enabled
      ? normalizeCollectibleArtworkScale(saved)
      : COLLECTIBLE_ARTWORK_SCALE.default,
  )
  return {
    collectibleArtworkScale,
    changeCollectibleArtworkScale(value: number): void {
      if (!enabled || presentation.disposed()) return
      const scale = normalizeCollectibleArtworkScale(value)
      setCollectibleArtworkScale(scale)
      try {
        host.writePreference(
          COLLECTIBLE_ARTWORK_SCALE_PREFERENCE,
          String(scale),
        )
      } catch {
        // Keep the current visit usable even when the host cannot save tuning.
      }
      const renderer = presentation.renderer()
      if (!renderer) return
      try {
        renderer.setCollectibleArtworkScale(scale)
        if (
          presentation.canRender() &&
          !renderer.render(presentation.snapshot(), 0)
        )
          throw new Error('No usable frame for artwork size change')
      } catch (cause) {
        presentation.failed(cause)
      }
    },
  }
}
