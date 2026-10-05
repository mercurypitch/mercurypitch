// Runner opening water — one reflective ripple surface shared by the shallow canal sections.
import { DataTexture, LinearFilter, MeshPhysicalMaterial, NoColorSpace, PlaneGeometry, RepeatWrapping, RGBAFormat, UnsignedByteType, Vector2, } from 'three'

/** A periodic normal tile supplies moving reflections without another scene render. */
function rippleNormal() {
  const size = 128
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2
      const v = (y / size) * Math.PI * 2
      const a = Math.cos(u * 3 + v * 2)
      const b = Math.cos(u * 2 - v * 5)
      const nx = a * 0.15 + b * 0.045
      const ny = a * 0.1 - b * 0.11
      const length = Math.hypot(nx, ny, 1)
      const index = (y * size + x) * 4
      pixels[index] = Math.round(((nx / length) * 0.5 + 0.5) * 255)
      pixels[index + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255)
      pixels[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255)
      pixels[index + 3] = 255
    }
  }
  const texture = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  )
  texture.name = 'runner-canal-periodic-normal'
  texture.colorSpace = NoColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.minFilter = texture.magFilter = LinearFilter
  texture.repeat.set(1, 4)
  texture.needsUpdate = true
  return texture
}

export function createRunnerOpeningWater() {
  const geometry = new PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  const normalMap = rippleNormal()
  const material = new MeshPhysicalMaterial({
    name: 'runner-opening-canal-water',
    color: 0x45a99f,
    roughness: 0.13,
    metalness: 0.22,
    clearcoat: 0.7,
    clearcoatRoughness: 0.09,
    normalMap,
    normalScale: new Vector2(0.7, 0.7),
    envMapIntensity: 0.9,
  })
  let disposed = false
  return {
    geometry,
    material,
    update(seconds: number, reducedMotion: boolean) {
      if (!disposed) normalMap.offset.y = reducedMotion ? 0 : (seconds / 6) % 1
    },
    dispose() {
      if (disposed) return
      disposed = true
      geometry.dispose()
      material.dispose()
      normalMap.dispose()
    },
  }
}
