// ============================================================
// Museum kit instances — clone owned geometry while sharing this scene's palette.
// ============================================================

import type { Material, Mesh, Object3D } from 'three'
import { Box3, Float32BufferAttribute, Group, Vector3 } from 'three'
import { GLTF_MATERIAL_ALIASES } from './catalog'
import type { MuseumMaterials } from './materials'

export function createKitInstance(
  source: Object3D,
  materials: MuseumMaterials,
  overrides: Readonly<Record<string, string>> = {},
): Group {
  const wrapper = new Group()
  const clone = source.clone(true)
  clone.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.geometry = mesh.geometry.clone()
    const choose = (material: Material) => {
      return materials[
        overrides[material.name] ??
          GLTF_MATERIAL_ALIASES[material.name] ??
          'teal'
      ]
    }
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(choose)
      : choose(mesh.material)
    // Some ornament exports have no UV; planar projection keeps marble continuous.
    if (
      !mesh.geometry.hasAttribute('uv') &&
      mesh.material === materials.marble
    ) {
      const position = mesh.geometry.getAttribute('position')
      const uv = new Float32Array(position.count * 2)
      for (let i = 0; i < position.count; i++) {
        uv[i * 2] = position.getX(i)
        uv[i * 2 + 1] = position.getZ(i)
      }
      mesh.geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    }
    mesh.castShadow = mesh.receiveShadow = true
  })
  wrapper.add(clone)
  return wrapper
}

export function kitFloorDimensions(source: Object3D): Vector3 {
  let floor: Object3D | undefined
  source.traverse((object) => {
    if (object.name.endsWith('museum_obsidian')) floor = object
  })
  return new Box3().setFromObject(floor ?? source).getSize(new Vector3())
}

/** Materials are shared with the rest of the museum and remain owned there. */
export function removeKitGeometry(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })
  root.clear()
}
