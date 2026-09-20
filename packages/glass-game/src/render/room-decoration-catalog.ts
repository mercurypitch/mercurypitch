// Room decoration catalog — reusable authored props, framed art and probe-lit mirrors.

export type RoomDecorationSurfaceRecipe =
  | {
      kind: 'painting'
      materialName: 'decor_surface'
      textureAsset: string
    }
  | {
      kind: 'mirror'
      materialName: 'decor_surface'
      materialId: 'mirror'
    }

export interface RoomDecorationRecipe {
  bundle: string
  node: string
  scale: number
  surface?: RoomDecorationSurfaceRecipe
}

/**
 * Meshy-authored V5 props remain normalized at source. Paintings and mirrors
 * share one ornate frame while the inset surface supplies the room identity.
 */
export const ROOM_DECORATION_CATALOG: Readonly<
  Record<string, RoomDecorationRecipe>
> = {
  'crystal-planter-v5': {
    bundle: 'museum-decor-v5',
    node: 'decor_crystal_planter',
    scale: 1,
  },
  'garden-painting-v5': {
    bundle: 'museum-decor-v5',
    node: 'decor_gallery_frame',
    scale: 1,
    surface: {
      kind: 'painting',
      materialName: 'decor_surface',
      textureAsset: 'painting-garden-v5',
    },
  },
  'archive-painting-v5': {
    bundle: 'museum-decor-v5',
    node: 'decor_gallery_frame',
    scale: 1,
    surface: {
      kind: 'painting',
      materialName: 'decor_surface',
      textureAsset: 'painting-archive-v5',
    },
  },
  'portrait-painting-v5': {
    bundle: 'museum-decor-v5',
    node: 'decor_gallery_frame',
    scale: 1,
    surface: {
      kind: 'painting',
      materialName: 'decor_surface',
      textureAsset: 'painting-portrait-v5',
    },
  },
  'gallery-mirror-v5': {
    bundle: 'museum-decor-v5',
    node: 'decor_gallery_frame',
    scale: 1,
    surface: {
      kind: 'mirror',
      materialName: 'decor_surface',
      materialId: 'mirror',
    },
  },
}

export function getRoomDecorationRecipe(id: string): RoomDecorationRecipe {
  const recipe = ROOM_DECORATION_CATALOG[id]
  if (recipe === undefined)
    throw new Error(
      `Unknown room decoration recipe "${id}". Register it in render/room-decoration-catalog.ts.`,
    )
  return recipe
}

export function roomDecorationTextureAssets(
  recipe: RoomDecorationRecipe,
): readonly string[] {
  return recipe.surface?.kind === 'painting'
    ? [recipe.surface.textureAsset]
    : []
}
