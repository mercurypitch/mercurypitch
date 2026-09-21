// ============================================================
// Journey sky — a generated warm horizon and low-cost distant cloud layers.
// ============================================================

import type { Texture } from 'three'
import { CanvasTexture, DoubleSide, EquirectangularReflectionMapping, Group, InstancedMesh, LinearFilter, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, } from 'three'

export interface JourneySky {
  root: Group
  background: Texture
  update(visibleSeconds: number, dt: number, reducedMotion: boolean): void
  dispose(): void
}

interface CloudLayer {
  mesh: InstancedMesh
  baseRotation: number
  drift: number
}

const TAU = Math.PI * 2

function canvas(width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas')
  result.width = width
  result.height = height
  return result
}

function context2d(surface: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = surface.getContext('2d')
  if (context === null)
    throw new Error('The journey sky needs a 2D canvas context.')
  return context
}

function paintHazeCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, width * 0.52)
  gradient.addColorStop(0, `rgba(255, 246, 229, ${alpha})`)
  gradient.addColorStop(0.46, `rgba(255, 235, 218, ${alpha * 0.62})`)
  gradient.addColorStop(1, 'rgba(255, 229, 210, 0)')
  context.save()
  context.translate(x, y)
  context.scale(1, height / width)
  context.translate(-x, -y)
  context.fillStyle = gradient
  context.beginPath()
  context.arc(x, y, width * 0.54, 0, TAU)
  context.fill()
  context.restore()
}

function createBackgroundTexture(): CanvasTexture {
  const surface = canvas(512, 256)
  const context = context2d(surface)
  const gradient = context.createLinearGradient(0, 0, 0, surface.height)
  gradient.addColorStop(0, '#536b88')
  gradient.addColorStop(0.34, '#839cab')
  gradient.addColorStop(0.53, '#d7d4c6')
  gradient.addColorStop(0.64, '#efc1a5')
  gradient.addColorStop(0.76, '#c49482')
  gradient.addColorStop(1, '#666d78')
  context.fillStyle = gradient
  context.fillRect(0, 0, surface.width, surface.height)

  const haze = [
    [-12, 142, 150, 26, 0.2],
    [94, 151, 116, 20, 0.17],
    [218, 140, 164, 28, 0.22],
    [382, 150, 144, 22, 0.18],
    [522, 142, 150, 26, 0.2],
  ] as const
  for (const [x, y, width, height, alpha] of haze)
    paintHazeCloud(context, x, y, width, height, alpha)

  const texture = new CanvasTexture(surface)
  texture.name = 'journey-sky-background'
  texture.colorSpace = SRGBColorSpace
  texture.mapping = EquirectangularReflectionMapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function createCloudTexture(): CanvasTexture {
  const surface = canvas(256, 128)
  const context = context2d(surface)
  const lobes = [
    [52, 76, 42, 25, 0.56],
    [90, 58, 54, 37, 0.78],
    [132, 67, 62, 34, 0.82],
    [177, 61, 49, 31, 0.7],
    [211, 78, 37, 22, 0.46],
  ] as const
  for (const [x, y, width, height, alpha] of lobes) {
    const gradient = context.createRadialGradient(x, y, 1, x, y, width)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    gradient.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.54})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.save()
    context.translate(x, y)
    context.scale(1, height / width)
    context.translate(-x, -y)
    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, width, 0, TAU)
    context.fill()
    context.restore()
  }
  const texture = new CanvasTexture(surface)
  texture.name = 'journey-sky-cloud-softness'
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function createCloudLayer(
  name: string,
  geometry: PlaneGeometry,
  texture: CanvasTexture,
  options: {
    count: number
    radius: number
    height: number
    width: number
    opacity: number
    color: number
    phase: number
    drift: number
  },
): CloudLayer {
  const material = new MeshBasicMaterial({
    color: options.color,
    map: texture,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    fog: true,
    side: DoubleSide,
    forceSinglePass: true,
    toneMapped: true,
  })
  material.name = `${name}-material`
  const mesh = new InstancedMesh(geometry, material, options.count)
  mesh.name = name
  mesh.frustumCulled = false
  mesh.renderOrder = -20
  const dummy = new Object3D()
  for (let index = 0; index < options.count; index++) {
    const angle = options.phase + (index / options.count) * TAU
    const radius = options.radius + ((index % 3) - 1) * 0.8
    const verticalOffset = ((index * 2) % 5) * 0.22
    dummy.position.set(
      Math.sin(angle) * radius,
      options.height + verticalOffset,
      Math.cos(angle) * radius,
    )
    dummy.lookAt(0, options.height, 0)
    dummy.scale.set(
      options.width * (0.86 + (index % 4) * 0.09),
      options.width * (0.2 + (index % 3) * 0.025),
      1,
    )
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  return { mesh, baseRotation: options.phase * 0.18, drift: options.drift }
}

export function createJourneySky(): JourneySky {
  const background = createBackgroundTexture()
  const cloudTexture = createCloudTexture()
  const geometry = new PlaneGeometry(1, 1)
  geometry.name = 'journey-sky-cloud-plane'
  const root = new Group()
  root.name = 'journey-sky'
  const layers = [
    createCloudLayer('journey-sky-clouds-peach', geometry, cloudTexture, {
      count: 7,
      radius: 28,
      height: -1.8,
      width: 7.8,
      opacity: 0.2,
      color: 0xffd6bc,
      phase: 0.22,
      drift: 0.0026,
    }),
    createCloudLayer('journey-sky-clouds-cream', geometry, cloudTexture, {
      count: 8,
      radius: 33,
      height: 0.15,
      width: 8.6,
      opacity: 0.17,
      color: 0xfff1da,
      phase: 1.1,
      drift: -0.0017,
    }),
    createCloudLayer('journey-sky-clouds-celadon', geometry, cloudTexture, {
      count: 6,
      radius: 38,
      height: 2.2,
      width: 9.4,
      opacity: 0.1,
      color: 0xc9e0d8,
      phase: 2.05,
      drift: 0.0011,
    }),
  ]
  for (const layer of layers) {
    layer.mesh.rotation.y = layer.baseRotation
    root.add(layer.mesh)
  }

  let disposed = false
  let lastVisibleSeconds: number | undefined
  const phases = layers.map(() => 0)
  return {
    root,
    background,
    update(visibleSeconds, dt, reducedMotion) {
      if (disposed) return
      const elapsed =
        lastVisibleSeconds === undefined
          ? Math.max(0, Math.min(0.05, dt))
          : Math.max(0, Math.min(0.05, visibleSeconds - lastVisibleSeconds))
      lastVisibleSeconds = visibleSeconds
      if (reducedMotion) return
      for (const [index, layer] of layers.entries()) {
        phases[index] = (phases[index]! + elapsed * layer.drift) % TAU
        layer.mesh.rotation.y = layer.baseRotation + phases[index]!
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      lastVisibleSeconds = undefined
      root.clear()
      for (const layer of layers) {
        const material = layer.mesh.material as MeshBasicMaterial
        layer.mesh.dispose()
        material.dispose()
      }
      geometry.dispose()
      cloudTexture.dispose()
      background.dispose()
    },
  }
}
