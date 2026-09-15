// ============================================================
// Museum kit instances — clone owned geometry while sharing this scene's palette.
// ============================================================

import type { Material, Mesh, Object3D } from 'three'
import { Box3, Float32BufferAttribute, Group, Vector3 } from 'three'
import { GLTF_MATERIAL_ALIASES } from './catalog'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'

export function createKitInstance(
  source: Object3D,
  materials: MuseumMaterials,
  overrides: Readonly<Record<string, string>> = {},
  library: MaterialLibrary,
): Group {
  const wrapper = new Group()
  const clone = source.clone(true)
  clone.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.geometry = mesh.geometry.clone()
    let needsPlanarUv = false
    const choose = (material: Material) => {
      const override = overrides[material.name]
      const preset = override ?? GLTF_MATERIAL_ALIASES[material.name]
      if (preset !== undefined && materials[preset]?.map) needsPlanarUv = true
      return library.clone(
        material,
        preset === undefined ? undefined : materials[preset],
      )
    }
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(choose)
      : choose(mesh.material)
    // Some ornament exports have no UV; planar projection keeps marble continuous.
    if (!mesh.geometry.hasAttribute('uv') && needsPlanarUv) {
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
  const encoded: unknown = source.userData.collider_json
  if (typeof encoded === 'string') {
    const bounds = JSON.parse(encoded) as {
      width?: unknown
      depth?: unknown
      height?: unknown
    }
    if (
      typeof bounds.width !== 'number' ||
      !Number.isFinite(bounds.width) ||
      bounds.width <= 0 ||
      typeof bounds.depth !== 'number' ||
      !Number.isFinite(bounds.depth) ||
      bounds.depth <= 0
    )
      throw new Error(`Invalid authored floor dimensions for ${source.name}`)
    return new Vector3(
      bounds.width,
      typeof bounds.height === 'number' ? bounds.height : 0,
      bounds.depth,
    )
  }
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
