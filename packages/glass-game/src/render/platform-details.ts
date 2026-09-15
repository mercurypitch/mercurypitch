// Museum perimeter details — two low crystal planters batched by shared material.

import type { BufferGeometry } from 'three'
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PlatformDefinition } from '../contracts'
import type { MuseumMaterials } from './materials'

/** All points are floor-local; the middle lane and exhibit anchors remain clear. */
export function createPlatformPlanters(
  platform: PlatformDefinition,
  materials: MuseumMaterials,
): Group {
  const root = new Group()
  root.name = 'crystal-planters'
  const groups = new Map<string, BufferGeometry[]>()
  const add = (
    id: string,
    geometry: BufferGeometry,
    x: number,
    y: number,
    z: number,
  ) => {
    geometry.translate(x, y, z)
    const batch = groups.get(id) ?? []
    batch.push(geometry)
    groups.set(id, batch)
  }
  const halfWidth = (platform.maxX - platform.minX) / 2
  const halfDepth = (platform.maxZ - platform.minZ) / 2
  for (const sign of [-1, 1]) {
    const x = sign * (halfWidth - 0.22)
    const z = halfDepth - 0.24
    add('marble', new CylinderGeometry(0.17, 0.2, 0.13, 8), x, 0.065, z)
    add('gold', new CylinderGeometry(0.177, 0.177, 0.018, 8), x, 0.135, z)
    add('teal', new CylinderGeometry(0.13, 0.13, 0.025, 8), x, 0.145, z)
    for (let i = 0; i < 3; i++) {
      const height = i === 1 ? 0.38 : 0.23
      const crystal = new ConeGeometry(i === 1 ? 0.07 : 0.055, height, 5)
      crystal.rotateZ((i - 1) * 0.22)
      add(
        'teal',
        crystal,
        x + (i - 1) * 0.066,
        0.15 + height / 2,
        z + (i === 1 ? 0 : 0.04),
      )
    }
    // A small brass setting gives the cluster a crafted museum silhouette.
    add('gold', new BoxGeometry(0.018, 0.3, 0.018), x - 0.14, 0.29, z)
    add('gold', new BoxGeometry(0.018, 0.3, 0.018), x + 0.14, 0.29, z)
    add('gold', new BoxGeometry(0.298, 0.018, 0.018), x, 0.44, z)
  }
  for (const [id, geometries] of groups) {
    const geometry = mergeGeometries(geometries)
    geometries.forEach((part) => part.dispose())
    const mesh = new Mesh(geometry, materials[id])
    mesh.castShadow = mesh.receiveShadow = true
    root.add(mesh)
  }
  return root
}
