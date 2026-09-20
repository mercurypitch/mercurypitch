// Gallery inspection — raycast real painting insets and offer nearby art without camera gymnastics.
import type { Object3D, PerspectiveCamera } from 'three'
import { Box3, Mesh, Raycaster, Vector2, Vector3 } from 'three'
import { galleryArtwork } from '../content/gallery-artworks'
import type { LevelDefinition, Vec3 } from '../contracts'

function visible(object: Object3D): boolean {
  for (
    let ancestor: Object3D | null = object;
    ancestor;
    ancestor = ancestor.parent
  )
    if (!ancestor.visible) return false
  return true
}

function descendantOf(object: Object3D, root: Object3D): boolean {
  for (
    let ancestor: Object3D | null = object;
    ancestor;
    ancestor = ancestor.parent
  )
    if (ancestor === root) return true
  return false
}

export function createGalleryInspection(
  root: Object3D,
  camera: PerspectiveCamera,
  canvas: Pick<HTMLElement, 'getBoundingClientRect'>,
  level: LevelDefinition,
  occluders: () => readonly Object3D[],
) {
  const definitions = (level.presentation?.decorations ?? []).filter(
    (item) => galleryArtwork(item.recipeId) !== null,
  )
  const raycaster = new Raycaster()
  const origin = new Vector3()
  const centre = new Vector3()
  const normal = new Vector3()
  const direction = new Vector3()
  const bounds = new Box3()
  let targets: { root: Object3D; surface: Mesh; recipeId: string }[] = []

  function loadedTargets() {
    // Called only after assets are ready; a fresh renderer owns a fresh cache.
    if (targets.length === 0)
      targets = definitions.flatMap((definition) => {
        const art = root.getObjectByName(`decoration-${definition.id}`)
        if (!art) return []
        const surfaces: typeof targets = []
        art.traverse((object) => {
          if (!(object instanceof Mesh)) return
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          if (materials.some((material) => material.name === 'decor_surface'))
            surfaces.push({
              root: art,
              surface: object,
              recipeId: definition.recipeId,
            })
        })
        return surfaces
      })
    root.updateWorldMatrix(true, true)
    return targets.filter((target) => visible(target.surface))
  }

  function blocked(distance: number, art: Object3D): boolean {
    return raycaster
      .intersectObjects(
        occluders().filter(
          (object) => visible(object) && !descendantOf(object, art),
        ),
        false,
      )
      .some((hit) => hit.distance < distance - 0.01)
  }

  return {
    pick(clientX: number, clientY: number): string | null {
      const rect = canvas.getBoundingClientRect()
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      )
        return null
      const available = loadedTargets()
      camera.updateWorldMatrix(true, false)
      raycaster.setFromCamera(
        new Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((clientY - rect.top) / rect.height) * 2,
        ),
        camera,
      )
      const hit = raycaster
        .intersectObjects(
          available.map((item) => item.surface),
          false,
        )
        .at(0)
      if (!hit) return null
      const target = available.find((item) => item.surface === hit.object)!
      return blocked(hit.distance, target.root) ? null : target.recipeId
    },
    nearby(position: Vec3): string | null {
      origin.copy(position).y += 0.9
      let selected: string | null = null
      let closest = 7
      for (const target of loadedTargets()) {
        bounds.setFromObject(target.surface).getCenter(centre)
        direction.subVectors(centre, origin)
        const distance = direction.length()
        normal.set(0, 0, 1).transformDirection(target.root.matrixWorld)
        if (distance >= closest || direction.dot(normal) >= 0) continue
        raycaster.set(origin, direction.normalize())
        if (blocked(distance, target.root)) continue
        closest = distance
        selected = target.recipeId
      }
      return selected
    },
  }
}
