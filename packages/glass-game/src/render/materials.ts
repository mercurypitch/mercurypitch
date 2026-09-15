// ============================================================
// Museum materials — veined stone, warm brass and directional glass reflections.
// ============================================================

import { CanvasTexture, DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, MeshPhysicalMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, } from 'three'
import { MUSEUM_MATERIAL_CATALOG } from './catalog'

export const MUSEUM_COLORS = {
  marble: 0xe8e0cc,
  teal: 0x155c68,
  gold: 0xdcb671,
  sky: 0x7eafc0,
  sunset: 0xedc2a2,
  shadow: 0x314d5e,
}

export function createMarbleTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ebe5d7'
    ctx.fillRect(0, 0, 512, 512)
    // Deliberately authored, repeatable veins; no animation or noisy per-frame paint.
    for (let vein = -4; vein < 17; vein++) {
      ctx.beginPath()
      for (let y = -10; y <= 522; y += 4) {
        const x =
          vein * 46 +
          y * 0.36 +
          Math.sin(y / 65 + vein * 0.73) * 26 +
          Math.sin(y / 19 + vein) * 4
        if (y === -10) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle =
        vein % 3 === 0 ? 'rgba(118,99,78,0.20)' : 'rgba(152,141,119,0.10)'
      ctx.lineWidth = vein % 3 === 0 ? 1.6 : 5
      ctx.stroke()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 2)
  texture.anisotropy = 4
  return texture
}

/** The same warm upper-left key and teal side-light as the scene's lamps. */
export function createReflectionTexture(): DataTexture {
  const width = 512
  const height = 256
  const data = new Float32Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const latitude = ((y + 0.5) / height - 0.5) * Math.PI
    const dy = Math.sin(latitude)
    for (let x = 0; x < width; x++) {
      const longitude = ((x + 0.5) / width - 0.5) * Math.PI * 2
      const dx = Math.cos(latitude) * Math.cos(longitude)
      const dz = Math.cos(latitude) * Math.sin(longitude)
      const sky = Math.max(0, dy)
      const horizon = Math.exp(-Math.abs(dy) * 9)
      const key =
        Math.pow(Math.max(0, dx * -0.57 + dy * 0.74 + dz * 0.35), 45) * 8
      const rim =
        Math.pow(Math.max(0, dx * 0.8 + dy * 0.35 + dz * -0.48), 25) * 3
      const i = (y * width + x) * 4
      data[i] = 0.018 + sky * 0.16 + horizon * 0.9 + key + rim * 0.12
      data[i + 1] = 0.03 + sky * 0.3 + horizon * 0.55 + key * 0.79 + rim * 0.65
      data[i + 2] = 0.045 + sky * 0.42 + horizon * 0.29 + key * 0.5 + rim * 0.85
      data[i + 3] = 1
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType)
  texture.mapping = EquirectangularReflectionMapping
  texture.magFilter = texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createMuseumMaterials(): Record<string, MeshPhysicalMaterial> {
  const marbleMap = createMarbleTexture()
  return Object.fromEntries(
    Object.entries(MUSEUM_MATERIAL_CATALOG).map(([id, recipe]) => {
      const { texture, ...surface } = recipe
      return [
        id,
        new MeshPhysicalMaterial({
          ...surface,
          map: texture !== undefined ? marbleMap : null,
        }),
      ]
    }),
  )
}

export type MuseumMaterials = ReturnType<typeof createMuseumMaterials>
