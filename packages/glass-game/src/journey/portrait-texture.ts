// Journey portrait textures — share abortable artwork decoding and the authored arched inset UV contract.

import type { Mesh } from 'three'
import { SRGBColorSpace, Texture } from 'three'

function abortError(): DOMException {
  return new DOMException('Journey portrait request cancelled.', 'AbortError')
}

export async function loadJourneyPortraitTexture(
  url: string,
  signal: AbortSignal,
): Promise<Texture> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('The museum portrait could not be loaded.')
  const bitmap = await globalThis.createImageBitmap(await response.blob(), {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
  })
  if (signal.aborted) {
    bitmap.close()
    throw abortError()
  }
  const texture = new Texture(bitmap)
  texture.name = `journey-portrait:${url}`
  texture.colorSpace = SRGBColorSpace
  // ImageBitmap uploads ignore Texture.flipY. The bitmap is flipped above so
  // the explicit texture state remains correct for Three's bitmap path.
  texture.flipY = false
  texture.needsUpdate = true
  return texture
}

export function disposeJourneyPortraitTexture(texture: Texture): void {
  texture.dispose()
  const image = texture.image as { close?: () => void } | undefined
  image?.close?.()
}

export function fitJourneyPortraitTexture(
  texture: Texture,
  surface: Mesh,
): void {
  if (surface.userData.journeyPortraitUv === 'authored') {
    // The donor inset already maps its arched 2:3 opening. Its monument is
    // turned around to face the camera, so reverse U. Its glTF V runs from one
    // at the bottom to zero at the top, unlike PlaneGeometry, so reverse V on
    // the already-upright ImageBitmap too while preserving the authored crop.
    texture.repeat.set(-1, -1)
    texture.offset.set(1, 1)
    texture.needsUpdate = true
    return
  }
  const image = texture.image as
    | { readonly width?: number; readonly height?: number }
    | undefined
  const width = image?.width
  const height = image?.height
  surface.geometry.computeBoundingBox()
  const bounds = surface.geometry.boundingBox
  if (
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0 ||
    bounds === null
  )
    return
  const surfaceWidth =
    Math.abs(bounds.max.x - bounds.min.x) * Math.abs(surface.scale.x)
  const surfaceHeight =
    Math.abs(bounds.max.y - bounds.min.y) * Math.abs(surface.scale.y)
  if (surfaceWidth <= 0 || surfaceHeight <= 0) return
  const imageAspect = width / height
  const surfaceAspect = surfaceWidth / surfaceHeight
  texture.repeat.set(1, 1)
  texture.offset.set(0, 0)
  if (imageAspect > surfaceAspect) {
    texture.repeat.x = surfaceAspect / imageAspect
    texture.offset.x = (1 - texture.repeat.x) / 2
  } else if (imageAspect < surfaceAspect) {
    texture.repeat.y = imageAspect / surfaceAspect
    texture.offset.y = (1 - texture.repeat.y) / 2
  }
  texture.needsUpdate = true
}
