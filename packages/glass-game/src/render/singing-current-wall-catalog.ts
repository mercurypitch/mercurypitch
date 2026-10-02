// Singing Current wall recipes — independently authored metre-scale panes keep their frame and fracture provenance.

import { SINGING_CURRENT_WALL_PROFILES } from '../content/singing-current-wall-profiles'
import type { BreakableRenderRecipe } from './breakable-render-recipe'

export const SINGING_CURRENT_WALL_RENDER_CATALOG: Readonly<
  Record<string, BreakableRenderRecipe>
> = Object.fromEntries(
  Object.values(SINGING_CURRENT_WALL_PROFILES).map((profile) => [
    profile.bundle,
    {
      bundle: profile.bundle,
      intactNode: profile.intactNode,
      shardPrefix: profile.shardPrefix,
      shardCount: profile.shardCount,
      persistentPrefix: profile.persistentPrefix,
      sourceHeight: profile.sourceHeight,
      displayHeight: profile.sourceHeight,
      preserveAuthoredOrigin: true,
      bakeImportedMaterialUnits: true,
      sharedGeometry: true,
      barrierEnvelope: {
        width: profile.presentation.pane.width,
        height: profile.presentation.pane.height,
        depth: profile.presentation.pane.depth,
      },
      shatterProfile: 'ice-wall',
      fallbackShape: 'slab',
      fragmentBudget: profile.shardCount,
      tint: profile.tint,
      roughness: profile.roughness,
      transmission: profile.id === 'W06' ? 0.92 : 0.97,
      thickness: profile.presentation.pane.depth,
    },
  ]),
)
