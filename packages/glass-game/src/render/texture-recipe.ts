// ============================================================
// Surface texture contract — color and physical data keep explicit glTF sampling semantics.
// ============================================================

import type { Texture } from 'three'
import { ClampToEdgeWrapping, NoColorSpace, RepeatWrapping, SRGBColorSpace, } from 'three'

export interface TextureRecipe {
  asset: string
  interpretation: 'color' | 'data'
  wrap?: 'repeat' | 'clamp'
  repeat?: readonly [number, number]
  flipY?: boolean
  anisotropy?: number
  channel?: number
}

export type SurfaceTextureSlot =
  | 'map'
  | 'normalMap'
  | 'roughnessMap'
  | 'metalnessMap'
  | 'aoMap'
export type SurfaceTextures = Partial<Record<SurfaceTextureSlot, TextureRecipe>>

export function configureTexture(
  texture: Texture,
  recipe: TextureRecipe,
): Texture {
  texture.colorSpace =
    recipe.interpretation === 'color' ? SRGBColorSpace : NoColorSpace
  texture.flipY = recipe.flipY ?? false
  texture.wrapS = texture.wrapT =
    recipe.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping
  texture.repeat.set(...(recipe.repeat ?? [1, 1]))
  texture.anisotropy = recipe.anisotropy ?? 4
  texture.channel = recipe.channel ?? 0
  texture.needsUpdate = true
  return texture
}
