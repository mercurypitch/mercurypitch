// Breakable render contracts — shared recipe types without importing the catalog that consumes them.

import type { ResonancePresentationConfig } from './resonance-release-config'

export interface BreakableRenderRecipe {
  shatterProfile?: 'crown' | 'radial' | 'sheet' | 'ice-wall'
  /** Local pane bounds: centred in X/Z, resting at Y=0. */
  barrierEnvelope?: { width: number; height: number; depth: number }
  bundle?: string
  intactNode?: string
  shardPrefix?: string
  shardCount: number
  /** A preferred bundle may contain a newer fracture than its legacy fallback. */
  bundleShardCounts?: Readonly<Record<string, number>>
  persistentPrefix?: string
  /** Optional reviewed source height; rejects an unexpected donor export. */
  sourceHeight?: number
  /** New architectural exports own their neutral floor datum; do not recenter their pane. */
  preserveAuthoredOrigin?: boolean
  /** Identical prepared donor geometry may be leased across vessel instances. */
  sharedGeometry?: boolean
  displayHeight: number
  /** Preserve optical metres when quantized node transforms are baked into geometry. */
  bakeImportedMaterialUnits?: boolean
  /** Legacy named materials whose metre-valued optics scale with display geometry. */
  scaleImportedMaterialUnits?: readonly string[]
  /** Opt-in charge and release treatment layered around standard rigid shards. */
  resonancePresentation?: ResonancePresentationConfig
  /** Imported surfaces eligible for authored crack raycasts. */
  resonanceGlassMaterials?: readonly string[]
  tint: number
  roughness: number
  transmission: number
  thickness: number
  portraitTexture?: string
  portraitMaterial?: string
  /** Whether the image remains protected or travels on the authored shards. */
  portraitFracture?: 'protective-glazing' | 'picture-bearing'
  /** Separate art plane used before fracture and for the collected reward. */
  persistentPortrait?: {
    width: number
    height: number
    centerY: number
    z: number
  }
  faceAnchor?: boolean
  fallbackShape: 'goblet' | 'rounded' | 'fluted' | 'slab'
  fragmentBudget: number
}
