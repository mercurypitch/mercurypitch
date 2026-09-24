// Exhibit approach pads — persistent next-target rings make the singing area visible before entering it.

import type { Material } from 'three'
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry, TorusGeometry, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'

export function createExhibitApproachPads(
  level: LevelDefinition,
  parentFor: (id: string) => Group,
  gold: Material,
) {
  const discGeometry = new CircleGeometry(0.23, 48)
  const rimGeometry = new TorusGeometry(0.24, 0.012, 5, 48)
  const approachGeometry = new RingGeometry(0.42, 0.46, 48)
  const pads = level.breakables.map((target) => {
    const root = new Group()
    root.name = `approach-pad-${target.id}`
    root.position.copy(target.anchor)
    root.position.y += 0.02
    root.rotation.x = -Math.PI / 2
    const discMaterial = new MeshBasicMaterial({
      color: 0x68d9d3,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
    const approachMaterial = new MeshBasicMaterial({
      color: 0xffdf98,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
    const approach = new Mesh(approachGeometry, approachMaterial)
    approach.name = `approach-ring-${target.id}`
    approach.visible = false
    root.add(
      new Mesh(discGeometry, discMaterial),
      new Mesh(rimGeometry, gold),
      approach,
    )
    parentFor(target.id).add(root)
    return { id: target.id, root, discMaterial, approach, approachMaterial }
  })

  return {
    update(snapshot: GameSnapshot) {
      for (const pad of pads) {
        pad.root.visible = !snapshot.completedBreakableIds.includes(pad.id)
        const nearby = snapshot.nearbyBreakableId === pad.id
        pad.discMaterial.opacity = nearby ? 0.55 : 0.18
        pad.approach.visible =
          nearby || snapshot.nextRequiredBreakableId === pad.id
        pad.approachMaterial.opacity = nearby ? 0.95 : 0.65
      }
    },
  }
}
