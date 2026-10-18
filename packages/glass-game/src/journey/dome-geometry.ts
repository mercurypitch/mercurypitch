// Dome geometry — separate First Light glazing from its retained authored cornice and finial.

import type { Material, Object3D } from 'three'
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Mesh, MeshStandardMaterial, TubeGeometry, Vector3, } from 'three'
import { createClearTemplePaneMaterial, createTempleOrnamentMaterial, } from './dome-materials'

// Measured in the resident v11 temple's own coordinates, before its 0.9 scale.
const CENTER_Y = 1.55
const CENTER_Z = -0.16
const RADIUS_X = 0.93
const RADIUS_Y = 0.83
const RADIUS_Z = 0.87
const BASE_Y = 1.85
const CROWN_Y = 2.365
const START = Math.asin((BASE_Y - CENTER_Y) / RADIUS_Y)
const END = Math.asin((CROWN_Y - CENTER_Y) / RADIUS_Y)

function domePoint(angle: number, elevation: number): Vector3 {
  const ring = Math.cos(elevation)
  return new Vector3(
    RADIUS_X * ring * Math.sin(angle),
    CENTER_Y + RADIUS_Y * Math.sin(elevation),
    CENTER_Z + RADIUS_Z * ring * Math.cos(angle),
  )
}

/** A thin open-ended surface: no opaque ceiling or doubled transmission shell. */
export function createTemplePaneGeometry(): BufferGeometry {
  const radial = 48
  const vertical = 16
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= vertical; row += 1) {
    const elevation = START + ((END - START) * row) / vertical
    for (let column = 0; column <= radial; column += 1) {
      const point = domePoint((column * Math.PI * 2) / radial, elevation)
      positions.push(...point.toArray())
      normals.push(
        ...new Vector3(
          point.x / RADIUS_X ** 2,
          (point.y - CENTER_Y) / RADIUS_Y ** 2,
          (point.z - CENTER_Z) / RADIUS_Z ** 2,
        )
          .normalize()
          .toArray(),
      )
      if (row < vertical && column < radial) {
        const a = row * (radial + 1) + column
        const b = a + 1
        const c = a + radial + 1
        indices.push(a, b, c, b, c + 1, c)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function combineFrames(pieces: BufferGeometry[]): BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (const piece of pieces) {
    const offset = positions.length / 3
    positions.push(...piece.getAttribute('position').array)
    normals.push(...piece.getAttribute('normal').array)
    for (const index of piece.index!.array) indices.push(index + offset)
    piece.dispose()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Twelve narrow meridians and three rings share one opaque draw. */
export function createTempleFrameGeometry(): BufferGeometry {
  const pieces: BufferGeometry[] = []
  for (let rib = 0; rib < 12; rib += 1) {
    const angle = (rib * Math.PI * 2) / 12
    const points = Array.from({ length: 21 }, (_, row) =>
      domePoint(angle, START + ((END - START) * row) / 20),
    )
    pieces.push(
      new TubeGeometry(new CatmullRomCurve3(points), 20, 0.009, 6, false),
    )
  }
  for (const [height, thickness] of [
    [BASE_Y, 0.014],
    [2.16, 0.006],
    [CROWN_Y, 0.009],
  ] as const) {
    const elevation = Math.asin((height - CENTER_Y) / RADIUS_Y)
    const points = Array.from({ length: 64 }, (_, column) =>
      domePoint((column * Math.PI * 2) / 64, elevation),
    )
    pieces.push(
      new TubeGeometry(
        new CatmullRomCurve3(points, true),
        64,
        thickness,
        6,
        true,
      ),
    )
  }
  return combineFrames(pieces)
}

/** Keep authored rim/finial attributes; compact away the replaced shell's unused vertices. */
export function retainTempleOrnament(source: BufferGeometry): BufferGeometry {
  const position = source.getAttribute('position')
  const sourceIndex = source.index
  const remap = new Map<number, number>()
  const indices: number[] = []
  const count = sourceIndex?.count ?? position.count
  for (let offset = 0; offset < count; offset += 3) {
    const ids = [0, 1, 2].map(
      (n) => sourceIndex?.getX(offset + n) ?? offset + n,
    )
    const center = new Vector3()
    for (const index of ids)
      center.add(new Vector3().fromBufferAttribute(position, index))
    center.multiplyScalar(1 / 3)
    const radius = Math.hypot(
      center.x / 0.92,
      (center.z + CENTER_Z * -1) / 0.86,
    )
    if (!(center.y >= 2.355 || (center.y <= 1.88 && radius >= 0.84))) continue
    for (const index of ids) {
      if (!remap.has(index)) remap.set(index, remap.size)
      indices.push(remap.get(index)!)
    }
  }
  const result = new BufferGeometry()
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values: number[] = []
    for (const index of remap.keys()) {
      for (let component = 0; component < attribute.itemSize; component += 1)
        values.push(attribute.getComponent(index, component))
    }
    result.setAttribute(
      name,
      new Float32BufferAttribute(values, attribute.itemSize),
    )
  }
  result.setIndex(indices)
  result.computeBoundingBox()
  result.computeBoundingSphere()
  return result
}

/** Replace only the measured First Light temple; shared donor geometry stays immutable. */
export function createFirstLightDomeGeometry(
  root: Object3D,
  frameMaterial: Material,
  ownedGeometries: Set<BufferGeometry>,
  ownedMaterials: Set<Material>,
): boolean {
  const roof = root
    .getObjectByName('first-light-isle')
    ?.getObjectByName('map_temple_teal_dome')
  if (
    !(roof instanceof Mesh) ||
    !(roof.material instanceof MeshStandardMaterial) ||
    roof.getObjectByName('first-light-separated-glazing')
  )
    return false
  const position = roof.geometry.getAttribute('position')
  if (position === undefined || roof.geometry.index === null) return false
  const retained = retainTempleOrnament(roof.geometry)
  const panes = createTemplePaneGeometry()
  const frames = createTempleFrameGeometry()
  const ornamentMaterial = createTempleOrnamentMaterial(roof.material)
  const paneMaterial = createClearTemplePaneMaterial()
  for (const geometry of [retained, panes, frames])
    ownedGeometries.add(geometry)
  ownedMaterials.add(ornamentMaterial)
  ownedMaterials.add(paneMaterial)
  roof.geometry = retained
  roof.material = ornamentMaterial
  const glazing = new Mesh(panes, paneMaterial)
  glazing.name = 'first-light-separated-glazing'
  glazing.receiveShadow = true
  const frame = new Mesh(frames, frameMaterial)
  frame.name = 'first-light-separated-gold-ribs'
  frame.castShadow = true
  frame.receiveShadow = true
  roof.add(glazing, frame)
  return true
}
