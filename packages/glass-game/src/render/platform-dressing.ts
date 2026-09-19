// ============================================================
// Platform dressing — authored local placements stay outside movement lanes and follow floor visibility.
// ============================================================

import type { Object3D } from 'three'
import { Group } from 'three'
import type { LevelDefinition } from '../contracts'
import { createKitInstance } from './kit-instance'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import type { MuseumSceneRecipe } from './scene-catalog'

export function createPlatformDressing(
  level: LevelDefinition,
  recipe: MuseumSceneRecipe,
  materials: MuseumMaterials,
  library: MaterialLibrary,
) {
  const root = new Group()
  const groups: { platform: string; root: Group }[] = []
  return {
    root,
    install(
      scene: Object3D,
      bundle: string,
      removePlanters: (id: string) => void,
    ) {
      for (const item of recipe.platformDecorations ?? []) {
        if (item.bundle !== bundle) continue
        const source = scene.getObjectByName(item.node)
        if (!source)
          throw new Error(`Missing garden node ${item.node} in ${bundle}`)
        for (const id of item.platforms) {
          const platform = level.platforms.find((floor) => floor.id === id)
          if (!platform) throw new Error(`Unknown garden platform ${id}`)
          const group = new Group()
          group.position.set(
            (platform.minX + platform.maxX) / 2,
            platform.top,
            (platform.minZ + platform.maxZ) / 2,
          )
          const width = platform.maxX - platform.minX,
            depth = platform.maxZ - platform.minZ
          for (const placement of item.placements) {
            const art = createKitInstance(source, materials, {}, library)
            art.position.set(
              placement.u * width,
              placement.y,
              placement.v * depth,
            )
            art.rotation.y = placement.yaw ?? 0
            if (placement.fitWidth !== undefined)
              art.scale.set(
                width / placement.fitWidth,
                placement.scale,
                depth / placement.fitWidth,
              )
            else art.scale.setScalar(placement.scale)
            group.add(art)
          }
          root.add(group)
          groups.push({ platform: id, root: group })
          if (item.replacePlanters === true) removePlanters(id)
        }
      }
    },
    update(enabled: readonly string[]) {
      groups.forEach((group) => {
        group.root.visible = enabled.includes(group.platform)
      })
    },
  }
}
