// Museum scene catalog — level-specific skyline and dressing stay authored data.

import type { Bounds3, LevelDefinition, Vec3 } from '../contracts'

export interface MuseumSceneRecipe {
  skyTexture?: string
  environment?: string
  reflectionProbe?: Vec3
  atmosphereOrigin?: Vec3
  skyRadius?: number
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

export interface MuseumVisualRecipe {
  bundle: string
  node: string
  scale: number
}

export interface MuseumSceneFrame {
  cameraFar: number
  lightTarget: Vec3
  keyPosition: Vec3
  rimPosition: Vec3
  shadowExtent: number
  shadowFar: number
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

/** Bounded authored visuals fail at startup instead of silently changing design. */
export const MUSEUM_VISUAL_CATALOG: Readonly<
  Record<string, MuseumVisualRecipe>
> = {
  'museum-arch': {
    bundle: 'museum-kit',
    node: 'museum_arch',
    scale: 1,
  },
}

function centre(bounds: Bounds3): Vec3 {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  }
}

function radius(bounds: Bounds3): number {
  return (
    Math.hypot(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ,
    ) / 2
  )
}

function authoredSkyRadius(bounds: Bounds3): number {
  return Math.max(40, radius(bounds) * 4)
}

/** World framing and shadow coverage follow authored bounds, including translations. */
export function getMuseumSceneFrame(level: LevelDefinition): MuseumSceneFrame {
  const presentation = level.presentation
  if (presentation === undefined)
    return {
      cameraFar: 180,
      lightTarget: { x: 5, y: 0, z: 4 },
      keyPosition: { x: -6, y: 12, z: 8 },
      rimPosition: { x: 12, y: 5, z: -6 },
      shadowExtent: 10,
      shadowFar: 35,
    }
  const lightTarget = centre(presentation.lightBounds)
  const lightRadius = Math.max(2, radius(presentation.lightBounds))
  const worldRadius = Math.max(2, radius(presentation.worldBounds))
  const skyRadius = authoredSkyRadius(presentation.worldBounds)
  const lightDistance = lightRadius * 2 + 3
  return {
    cameraFar: skyRadius + worldRadius + 8,
    lightTarget,
    keyPosition: {
      x: lightTarget.x - lightDistance * 0.55,
      y: lightTarget.y + lightDistance,
      z: lightTarget.z + lightDistance * 0.65,
    },
    rimPosition: {
      x: lightTarget.x + lightDistance,
      y: lightTarget.y + lightDistance * 0.45,
      z: lightTarget.z - lightDistance * 0.5,
    },
    shadowExtent: lightRadius * 1.08,
    shadowFar: lightDistance + lightRadius * 2 + 4,
  }
}

/** Presentation metadata opts any authored level into the shared museum theme. */
export function getMuseumSceneRecipe(
  level: LevelDefinition,
): MuseumSceneRecipe {
  const presentation = level.presentation
  if (presentation === undefined)
    return MUSEUM_SCENE_CATALOG[level.id] ?? EMPTY_SCENE
  const origin = centre(presentation.worldBounds)
  return {
    skyTexture: 'museum-sky',
    environment: 'museum-environment-v2',
    reflectionProbe: {
      x: level.spawn.position.x,
      y: Math.min(
        presentation.worldBounds.maxY,
        Math.max(presentation.worldBounds.minY, level.spawn.position.y + 1.15),
      ),
      z: level.spawn.position.z,
    },
    atmosphereOrigin: origin,
    skyRadius: authoredSkyRadius(presentation.worldBounds),
    preferredBundles: {
      'museum-kit': 'museum-kit-v2',
      vessels: 'vessels-v2',
    },
    archPlatforms: [],
    planterPlatforms: [],
    kitDecorations: [],
    observatories: [],
  }
}

export function getMuseumVisualRecipe(id: string): MuseumVisualRecipe {
  const recipe = MUSEUM_VISUAL_CATALOG[id]
  if (recipe === undefined)
    throw new Error(
      `Unknown museum visual recipe "${id}". Register it in render/scene-catalog.ts.`,
    )
  return recipe
}
