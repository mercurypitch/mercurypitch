// Museum scene catalog — level-specific skyline and dressing stay authored data.

import type { Vec3 } from '../contracts'

export interface MuseumSceneRecipe {
  skyTexture?: string
  archPlatforms: readonly string[]
  planterPlatforms: readonly string[]
  kitDecorations: readonly {
    bundle: string
    node: string
    position: Vec3
    scale: number
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
      archPlatforms: ['hero-deck'],
      planterPlatforms: ['arrival', 'goblet-deck', 'vase-deck', 'hero-deck'],
      kitDecorations: [
        {
          bundle: 'museum-kit',
          node: 'museum_astrolabe',
          position: { x: 5.5, y: -0.2, z: 16 },
          scale: 1.25,
          pedestalRadius: 1.6,
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
