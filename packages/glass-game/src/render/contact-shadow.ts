// ============================================================
// Merc contact shadow — a soft grounding cue restricted to enabled landing floors.
// ============================================================

import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'

export function createContactShadow(level: LevelDefinition) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 31)
    gradient.addColorStop(0, 'rgba(6,24,27,0.6)')
    gradient.addColorStop(0.45, 'rgba(6,24,27,0.3)')
    gradient.addColorStop(1, 'rgba(6,24,27,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  }
  const material = new MeshBasicMaterial({
    map: new CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new Mesh(new PlaneGeometry(0.72, 0.54), material)
  mesh.name = 'merc-contact-shadow'
  mesh.rotation.x = -Math.PI / 2
  return {
    mesh,
    update(snapshot: GameSnapshot) {
      const feet = snapshot.player.position
      const floors = level.platforms.filter(
        (floor) =>
          snapshot.enabledPlatformIds.includes(floor.id) &&
          feet.x >= floor.minX &&
          feet.x <= floor.maxX &&
          feet.z >= floor.minZ &&
          feet.z <= floor.maxZ &&
          floor.top <= feet.y + 0.06,
      )
      const floor = floors.sort((a, b) => b.top - a.top)[0]
      mesh.visible = floor !== undefined && feet.y - floor.top < 1.2
      if (floor === undefined) return
      mesh.position.set(feet.x, floor.top + 0.025, feet.z)
      const height = Math.max(0, feet.y - floor.top)
      mesh.scale.setScalar(1 + height * 0.3)
      material.opacity = Math.max(0, 0.75 - height * 0.45)
    },
  }
}
