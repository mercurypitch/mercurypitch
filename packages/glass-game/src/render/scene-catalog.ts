// Museum scene catalog — level-specific skyline and dressing stay authored data.

import type { Vec3 } from '../contracts'

export interface MuseumSceneRecipe {
  skyTexture?: string
  environment?: string
  reflectionProbe?: Vec3
  preferredBundles?: Readonly<Record<string, string>>
  platformDecorations?: readonly {
    bundle: string
    node: string
    platforms: readonly string[]
    replacePlanters?: boolean
    placements: readonly {
      u: number
      v: number
      y: number
      scale: number
      yaw?: number
      fitWidth?: number
    }[]
  }[]
  archPlatforms: readonly string[]
  planterPlatforms: readonly string[]
  kitDecorations: readonly {
    bundle: string
    node: string
    position: Vec3
    scale: number
    yaw?: number
    pedestalRadius?: number
  }[]
  observatories: readonly { position: Vec3; radius: number }[]
  moon?: { position: Vec3; radius: number }
}

const EMPTY_SCENE: MuseumSceneRecipe = {
  archPlatforms: [],
  planterPlatforms: [],
  kitDecorations: [],
  observatories: [],
}

export const MUSEUM_SCENE_CATALOG: Readonly<Record<string, MuseumSceneRecipe>> =
  {
    glassworks: {
      skyTexture: 'museum-sky',
      environment: 'museum-environment-v2',
      reflectionProbe: { x: 1.2, y: 1.15, z: 1.2 },
      preferredBundles: {
        'museum-kit': 'museum-kit-v2',
        vessels: 'vessels-v2',
      },
      archPlatforms: ['hero-deck'],
      platformDecorations: [
        {
          bundle: 'museum-garden-v2',
          node: 'garden_perimeter',
          platforms: ['arrival', 'goblet-deck', 'vase-deck', 'hero-deck'],
          replacePlanters: true,
          placements: [
            { u: -0.3, v: -0.34, y: 0.084, scale: 0.7 },
            { u: 0.3, v: -0.34, y: 0.084, scale: 0.7 },
          ],
        },
        {
          bundle: 'museum-garden-v2',
          node: 'ivy_trail',
          platforms: ['arrival', 'goblet-deck', 'hero-deck'],
          placements: [
            { u: -0.25, v: -0.49, y: -0.08, scale: 0.7 },
            { u: 0.25, v: -0.49, y: -0.08, scale: 0.7 },
          ],
        },
        {
          bundle: 'museum-garden-v2',
          node: 'island_root',
          platforms: ['arrival', 'goblet-deck', 'vase-deck', 'hero-deck'],
          placements: [{ u: 0, v: 0, y: -1.05, scale: 0.6, fitWidth: 3.1 }],
        },
      ],
      planterPlatforms: ['arrival', 'goblet-deck', 'vase-deck', 'hero-deck'],
      kitDecorations: [
        {
          bundle: 'museum-kit',
          node: 'museum_arch',
          position: { x: 1.2, y: 0, z: 4.85 },
          scale: 1,
        },
        {
          bundle: 'museum-canopy-v3',
          node: 'meshy_observatory_canopy',
          position: { x: 5.5, y: -1.5, z: 16 },
          scale: 1.7,
          pedestalRadius: 2.5,
        },
        {
          // The donor's sill stays beyond the overlook, never across a jump.
          bundle: 'museum-arcade-v3',
          node: 'meshy_garden_arcade',
          position: { x: 5.7, y: -0.25, z: 13 },
          scale: 1.05,
          yaw: Math.PI,
          pedestalRadius: 3.1,
        },
        {
          bundle: 'museum-column-v3',
          node: 'meshy_gilded_column',
          position: { x: -1.25, y: -0.2, z: 5.5 },
          scale: 0.82,
          yaw: Math.PI / 6,
          pedestalRadius: 0.5,
        },
        {
          bundle: 'museum-column-v3',
          node: 'meshy_gilded_column',
          position: { x: 12.25, y: -0.05, z: 4.8 },
          scale: 0.82,
          yaw: -Math.PI / 6,
          pedestalRadius: 0.5,
        },
      ],
      moon: { position: { x: 24, y: 27, z: -50 }, radius: 3.3 },
      observatories: [
        { position: { x: 21, y: -2, z: 21 }, radius: 2 },
        { position: { x: 0, y: -3.8, z: 35 }, radius: 2.7 },
        { position: { x: -29, y: -5.6, z: 22 }, radius: 3.4 },
        { position: { x: -16, y: -2, z: -6 }, radius: 2 },
      ],
    },
  }

/** New levels start without Glassworks' ornaments or fixed world coordinates. */
export function getMuseumSceneRecipe(levelId: string): MuseumSceneRecipe {
  return MUSEUM_SCENE_CATALOG[levelId] ?? EMPTY_SCENE
}
