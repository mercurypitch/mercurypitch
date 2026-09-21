// Journey surface textures — load abortable PBR maps with explicit sampling and ownership.

import { Texture } from 'three'
import type { TextureRecipe } from '../render/texture-recipe'
import { configureTexture } from '../render/texture-recipe'

type JourneyTextureRecipe = Omit<TextureRecipe, 'asset'>

export interface JourneyMarbleTextureUrls {
  basecolor: string
  normal: string
  roughness: string
}

export interface JourneyMarbleTextures {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
  dispose(): void
}

const MARBLE_RECIPES = {
  map: {
    interpretation: 'color',
    wrap: 'repeat',
    repeat: [2, 2],
    anisotropy: 4,
  },
  normalMap: {
    interpretation: 'data',
    wrap: 'repeat',
    repeat: [2, 2],
    anisotropy: 4,
  },
  roughnessMap: {
    interpretation: 'data',
    wrap: 'repeat',
    repeat: [2, 2],
    anisotropy: 4,
  },
} as const satisfies Record<string, JourneyTextureRecipe>

function abortError(): DOMException {
  return new DOMException('Journey surface request cancelled.', 'AbortError')
}

export async function loadJourneySurfaceTexture(
  url: string,
  signal: AbortSignal,
  recipe: JourneyTextureRecipe,
): Promise<Texture> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Journey surface unavailable: ${url}`)
  const bitmap = await globalThis.createImageBitmap(await response.blob(), {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
  })
  if (signal.aborted) {
    bitmap.close()
    throw abortError()
  }
  const texture = configureTexture(new Texture(bitmap), {
    asset: url,
    ...recipe,
    // ImageBitmap uploads ignore Texture.flipY, so decode supplies the flip.
    flipY: false,
  })
  texture.name = `journey-surface:${url}`
  return texture
}

export function disposeJourneySurfaceTexture(texture: Texture): void {
  texture.dispose()
  const image = texture.image as { close?: () => void } | undefined
  image?.close?.()
}

export async function loadJourneyMarbleTextures(
  urls: JourneyMarbleTextureUrls,
  signal: AbortSignal,
  loadTexture: typeof loadJourneySurfaceTexture = loadJourneySurfaceTexture,
): Promise<JourneyMarbleTextures> {
  const loaded = await Promise.allSettled([
    loadTexture(urls.basecolor, signal, MARBLE_RECIPES.map),
    loadTexture(urls.normal, signal, MARBLE_RECIPES.normalMap),
    loadTexture(urls.roughness, signal, MARBLE_RECIPES.roughnessMap),
  ])
  const rejected = loaded.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (rejected !== undefined) {
    for (const result of loaded)
      if (result.status === 'fulfilled')
        disposeJourneySurfaceTexture(result.value)
    throw rejected.reason
  }
  const [map, normalMap, roughnessMap] = loaded.map(
    (result) => (result as PromiseFulfilledResult<Texture>).value,
  ) as [Texture, Texture, Texture]
  let disposed = false
  return {
    map,
    normalMap,
    roughnessMap,
    dispose() {
      if (disposed) return
      disposed = true
      disposeJourneySurfaceTexture(map)
      disposeJourneySurfaceTexture(normalMap)
      disposeJourneySurfaceTexture(roughnessMap)
    },
  }
}
