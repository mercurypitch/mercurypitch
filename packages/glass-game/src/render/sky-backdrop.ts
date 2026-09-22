// Sky illustration framing — crop a flat plate to fill the view without wrapping or stretching it.
import type { Texture } from 'three'

export function fitSkyBackdrop(
  texture: Texture,
  width: number,
  height: number,
): void {
  const image = texture.image as { width: number; height: number }
  const imageAspect = image.width / Math.max(1, image.height)
  const viewAspect = Math.max(1, width) / Math.max(1, height)
  const x = Math.min(1, viewAspect / imageAspect)
  const y = Math.min(1, imageAspect / viewAspect)
  texture.repeat.set(x, y)
  texture.offset.set((1 - x) / 2, (1 - y) / 2)
  texture.updateMatrix()
}
