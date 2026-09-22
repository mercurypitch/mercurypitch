// ============================================================
// Museum atmosphere — a luminous horizon and distant suspended observatories.
// ============================================================

import type { Texture } from 'three'
import { BackSide, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry, } from 'three'
import type { MuseumMaterials } from './materials'
import type { MuseumSceneRecipe } from './scene-catalog'

function cloudscape() {
  const canvas = document.createElement('canvas')
  canvas.width = 1536
  canvas.height = 768
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 768)
    gradient.addColorStop(0, '#123749')
    gradient.addColorStop(0.34, '#508ca6')
    gradient.addColorStop(0.5, '#ddbb97')
    gradient.addColorStop(0.62, '#50788b')
    gradient.addColorStop(1, '#183f56')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1536, 768)
    const random = (i: number) => {
      const value = Math.sin(i * 127.1 + 311.7) * 43758.5453
      return value - Math.floor(value)
    }
    // A fixed painted cloud sea: the camera may orbit without any per-frame noise.
    for (let band = 0; band < 5; band++) {
      for (let i = 0; i < 95; i++) {
        const seed = band * 157 + i
        const x = random(seed) * 1536
        const y = 387 + band * 57 + random(seed + 19) * 45
        const radius = 24 + band * 12 + random(seed + 83) * 27
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(1.6, 0.65)
        const cloud = ctx.createRadialGradient(
          0,
          -radius * 0.2,
          radius * 0.05,
          0,
          0,
          radius,
        )
        const alpha = 0.32 + random(seed + 8) * 0.27
        cloud.addColorStop(0, `rgba(245,227,201,${alpha})`)
        cloud.addColorStop(0.5, `rgba(210,207,197,${alpha * 0.75})`)
        cloud.addColorStop(1, 'rgba(140,176,191,0)')
        ctx.fillStyle = cloud
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
        ctx.restore()
      }
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createAtmosphere(
  materials: MuseumMaterials,
  recipe: MuseumSceneRecipe,
) {
  const root = new Group()
  const sky = new Mesh(
    new SphereGeometry(recipe.skyRadius ?? 100, 32, 24),
    new MeshBasicMaterial({
      side: BackSide,
      depthWrite: false,
      map: cloudscape(),
      toneMapped: false,
      fog: false,
    }),
  )
  sky.name = 'museum-sky'
  sky.frustumCulled = false
  if (recipe.atmosphereOrigin !== undefined)
    sky.position.copy(recipe.atmosphereOrigin)
  root.add(sky)
  if (recipe.moon !== undefined) {
    const moon = new Mesh(
      new SphereGeometry(recipe.moon.radius, 32, 24),
      new MeshBasicMaterial({ color: 0xe2e2c6 }),
    )
    moon.position.copy(recipe.moon.position)
    root.add(moon)
    const orbit = new Mesh(
      new TorusGeometry(recipe.moon.radius * 1.58, 0.032, 6, 96),
      materials.gold,
    )
    orbit.position.copy(moon.position)
    orbit.rotation.set(0.75, -0.35, 0.3)
    root.add(orbit)
  }
  for (const observatory of recipe.observatories) {
    const island = new Group()
    island.position.copy(observatory.position)
    const width = observatory.radius
    const stone = new Mesh(
      new ConeGeometry(width, width * 2.2, 7),
      materials.rock,
    )
    stone.rotation.z = Math.PI
    stone.position.y = -width * 1.1
    island.add(stone)
    const floor = new Mesh(
      new CylinderGeometry(width, width, 0.3, 16),
      materials.marble,
    )
    island.add(floor)
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2
      const pillar = new Mesh(
        new CylinderGeometry(0.1, 0.14, width, 8),
        materials.marble,
      )
      pillar.position.set(
        Math.sin(a) * width * 0.8,
        width / 2,
        Math.cos(a) * width * 0.8,
      )
      island.add(pillar)
    }
    const crown = new Mesh(
      new TorusGeometry(width * 0.8, 0.06, 6, 32),
      materials.gold,
    )
    crown.rotation.x = -Math.PI / 2
    crown.position.y = width
    island.add(crown)
    root.add(island)
  }
  return {
    root,
    setSky(texture: Texture) {
      sky.material.map?.dispose()
      sky.material.map = texture
      sky.material.needsUpdate = true
      // Keep ownership on the mesh for disposal even when the scene displays
      // this illustration as a seamless, aspect-correct screen backdrop.
      sky.visible = recipe.skyProjection !== 'backdrop'
    },
  }
}
