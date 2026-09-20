// Seeded floor inlays — quiet, room-authored patterns with bounded geometry and no gameplay collision.

import type { BufferGeometry, Material, Mesh as MeshType, Object3D, } from 'three'
import { BoxGeometry, Group, Matrix4, Mesh, TorusGeometry, Vector3, } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { FloorArtPaletteId, FloorArtRecipeId, LevelDefinition, PlatformDefinition, PlatformFloorArtDefinition, } from '../contracts'
import type { MuseumMaterials } from './materials'

type InlayMaterialId = 'gold' | 'teal' | 'rock'

interface InlayPalette {
  primary: InlayMaterialId
  secondary: InlayMaterialId
  secondaryWeight: number
}

export interface FloorArtVariant {
  detail: 0 | 1 | 2
  mirror: -1 | 1
  phase: number
}

const SURFACE_HEIGHT = 0.01
const LINE_HEIGHT = 0.008
const LINE_WIDTH = 0.022
const EMBEDDED_INLAY_RADIUS_FRACTION = 0.24
const EMBEDDED_INLAY_SURFACE_BAND = 0.03
const EMBEDDED_INLAY_MATERIALS = new Set(['museum_brass', 'museum_petrol'])

const PALETTES: Readonly<Record<FloorArtPaletteId, InlayPalette>> = {
  neutral: { primary: 'gold', secondary: 'teal', secondaryWeight: 0.14 },
  garden: { primary: 'gold', secondary: 'teal', secondaryWeight: 0.24 },
  archive: { primary: 'gold', secondary: 'rock', secondaryWeight: 0.26 },
  portrait: { primary: 'gold', secondary: 'teal', secondaryWeight: 0.22 },
}

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function sample(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}

export function selectFloorArtVariant(
  levelId: string,
  definition: PlatformFloorArtDefinition,
): FloorArtVariant {
  const seed = hashString(
    `${levelId}/${definition.platformId}/${definition.recipeId}/${definition.palette ?? 'neutral'}`,
  )
  return {
    detail: (seed % 3) as 0 | 1 | 2,
    mirror: (seed & 4) === 0 ? -1 : 1,
    phase: sample(seed, 0) * Math.PI * 2,
  }
}

function strip(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  width = LINE_WIDTH,
): BufferGeometry | undefined {
  const dx = x2 - x1
  const dz = z2 - z1
  const length = Math.hypot(dx, dz)
  if (length < 0.001) return undefined
  const geometry = new BoxGeometry(length, LINE_HEIGHT, width)
  geometry.rotateY(-Math.atan2(dz, dx))
  geometry.translate((x1 + x2) / 2, SURFACE_HEIGHT, (z1 + z2) / 2)
  return geometry
}

function circle(radius: number, tube = LINE_HEIGHT): BufferGeometry {
  const geometry = new TorusGeometry(radius, tube, 4, 48)
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, SURFACE_HEIGHT, 0)
  return geometry
}

class InlayBuilder {
  private readonly batches = new Map<InlayMaterialId, BufferGeometry[]>()
  private mark = 0

  constructor(
    private readonly seed: number,
    private readonly palette: InlayPalette,
  ) {}

  add(geometry: BufferGeometry | undefined, secondaryWeight?: number): void {
    if (geometry === undefined) return
    const weight = secondaryWeight ?? this.palette.secondaryWeight
    const material =
      sample(this.seed, ++this.mark) < weight
        ? this.palette.secondary
        : this.palette.primary
    const batch = this.batches.get(material) ?? []
    batch.push(geometry)
    this.batches.set(material, batch)
  }

  build(materials: MuseumMaterials): Mesh[] {
    const meshes: Mesh[] = []
    for (const [materialId, geometries] of this.batches) {
      const geometry = mergeGeometries(geometries)
      geometries.forEach((part) => part.dispose())
      const mesh = new Mesh(geometry, materials[materialId] as Material)
      mesh.name = `floor-art-${materialId}`
      mesh.castShadow = false
      mesh.receiveShadow = true
      meshes.push(mesh)
    }
    return meshes
  }
}

function addQuietMarble(
  builder: InlayBuilder,
  halfWidth: number,
  halfDepth: number,
  variant: FloorArtVariant,
): void {
  const inset = Math.min(
    0.28,
    Math.max(0.12, Math.min(halfWidth, halfDepth) * 0.1),
  )
  const arm = Math.min(
    0.5,
    Math.max(0.16, Math.min(halfWidth, halfDepth) * 0.2),
  )
  for (const sign of [-1, 1]) {
    const x = sign * (halfWidth - inset)
    const z = sign * variant.mirror * (halfDepth - inset)
    builder.add(strip(x, z, x - sign * arm, z), 0.08)
    builder.add(strip(x, z, x, z - sign * variant.mirror * arm), 0.08)
  }
}

function addOrbitalRings(
  builder: InlayBuilder,
  halfWidth: number,
  halfDepth: number,
  variant: FloorArtVariant,
): void {
  const maximum = Math.min(halfWidth, halfDepth) - 0.2
  if (maximum < 0.48) {
    addQuietMarble(builder, halfWidth, halfDepth, variant)
    return
  }
  const ringCount = variant.detail === 2 && maximum > 0.9 ? 3 : 2
  for (let index = 0; index < ringCount; index++) {
    const fraction = 1 - index * 0.23
    builder.add(circle(maximum * fraction), index === 1 ? 0.42 : undefined)
  }
  const tickRadius = maximum * 0.82
  const tickLength = Math.min(0.24, maximum * 0.18)
  for (let index = 0; index < 4; index++) {
    const angle = variant.phase + (index * Math.PI) / 2
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    builder.add(
      strip(
        cosine * (tickRadius - tickLength / 2),
        sine * (tickRadius - tickLength / 2),
        cosine * (tickRadius + tickLength / 2),
        sine * (tickRadius + tickLength / 2),
      ),
    )
  }
}

function diamond(
  builder: InlayBuilder,
  x: number,
  z: number,
  radius: number,
  mirror: -1 | 1,
): void {
  const narrow = radius * (mirror === 1 ? 0.58 : 0.72)
  builder.add(strip(x - radius, z, x, z - narrow))
  builder.add(strip(x, z - narrow, x + radius, z))
  builder.add(strip(x + radius, z, x, z + narrow))
  builder.add(strip(x, z + narrow, x - radius, z))
}

function addAngularParquet(
  builder: InlayBuilder,
  halfWidth: number,
  halfDepth: number,
  variant: FloorArtVariant,
): void {
  const horizontal = halfWidth >= halfDepth
  const short = Math.min(halfWidth, halfDepth)
  const long = Math.max(halfWidth, halfDepth)
  const radius = Math.min(0.62, short * 0.42)
  const count = long > 2.2 && variant.detail > 0 ? 3 : 2
  const spacing = Math.min(
    radius * 2.15,
    ((long - radius) * 2) / Math.max(1, count - 1),
  )
  for (let index = 0; index < count; index++) {
    const offset = (index - (count - 1) / 2) * spacing
    diamond(
      builder,
      horizontal ? offset : 0,
      horizontal ? 0 : offset,
      radius,
      index % 2 === 0 ? variant.mirror : variant.mirror === 1 ? -1 : 1,
    )
  }
}

function addSoundWave(
  builder: InlayBuilder,
  halfWidth: number,
  halfDepth: number,
  variant: FloorArtVariant,
): void {
  const horizontal = halfWidth >= halfDepth
  const halfLong = horizontal ? halfWidth : halfDepth
  const halfShort = horizontal ? halfDepth : halfWidth
  const extent = Math.max(0.2, halfLong - 0.2)
  const amplitude = Math.min(0.2, halfShort * 0.16)
  const rows = variant.detail === 0 ? 2 : 3
  const segments = 14
  for (let row = 0; row < rows; row++) {
    let previousLong = -extent
    let previousShort = sampleSoundWaveOffset(
      halfShort,
      amplitude,
      variant,
      row,
      rows,
      0,
    )
    for (let segment = 1; segment <= segments; segment++) {
      const currentLong = -extent + (segment / segments) * extent * 2
      const currentShort = sampleSoundWaveOffset(
        halfShort,
        amplitude,
        variant,
        row,
        rows,
        segment / segments,
      )
      builder.add(
        horizontal
          ? strip(previousLong, previousShort, currentLong, currentShort)
          : strip(previousShort, previousLong, currentShort, currentLong),
        0,
      )
      previousLong = currentLong
      previousShort = currentShort
    }
  }
}

export function sampleSoundWaveOffset(
  halfShort: number,
  amplitude: number,
  variant: FloorArtVariant,
  row: number,
  rows: number,
  progress: number,
): number {
  const baseline = (row - (rows - 1) / 2) * Math.min(0.28, halfShort * 0.3)
  return (
    baseline +
    amplitude *
      Math.sin(
        variant.phase + row * 0.9 + variant.mirror * progress * Math.PI * 2,
      )
  )
}

function addHeroPetal(
  builder: InlayBuilder,
  halfWidth: number,
  halfDepth: number,
  variant: FloorArtVariant,
): void {
  const maximum = Math.min(halfWidth, halfDepth) - 0.18
  if (maximum < 0.5) {
    addQuietMarble(builder, halfWidth, halfDepth, variant)
    return
  }
  const count = variant.detail === 0 ? 5 : 6
  const inner = Math.min(0.3, maximum * 0.3)
  const tip = maximum * 0.86
  const petalWidth = Math.min(0.2, maximum * 0.2)
  for (let index = 0; index < count; index++) {
    const angle = variant.phase + (index / count) * Math.PI * 2
    const radialX = Math.cos(angle)
    const radialZ = Math.sin(angle)
    const tangentX = -radialZ
    const tangentZ = radialX
    const middle = (inner + tip) / 2
    const baseX = radialX * inner
    const baseZ = radialZ * inner
    const tipX = radialX * tip
    const tipZ = radialZ * tip
    const leftX = radialX * middle + tangentX * petalWidth
    const leftZ = radialZ * middle + tangentZ * petalWidth
    const rightX = radialX * middle - tangentX * petalWidth
    const rightZ = radialZ * middle - tangentZ * petalWidth
    builder.add(strip(baseX, baseZ, leftX, leftZ), 0.1)
    builder.add(strip(leftX, leftZ, tipX, tipZ), 0.1)
    builder.add(strip(tipX, tipZ, rightX, rightZ), 0.1)
    builder.add(strip(rightX, rightZ, baseX, baseZ), 0.1)
  }
}

function addRecipe(
  builder: InlayBuilder,
  recipeId: FloorArtRecipeId,
  halfWidth: number,
  halfDepth: number,
  variant: FloorArtVariant,
): void {
  if (recipeId === 'quiet-marble')
    addQuietMarble(builder, halfWidth, halfDepth, variant)
  else if (recipeId === 'orbital-rings')
    addOrbitalRings(builder, halfWidth, halfDepth, variant)
  else if (recipeId === 'angular-parquet')
    addAngularParquet(builder, halfWidth, halfDepth, variant)
  else if (recipeId === 'sound-wave')
    addSoundWave(builder, halfWidth, halfDepth, variant)
  else addHeroPetal(builder, halfWidth, halfDepth, variant)
}

function createFloorArt(
  levelId: string,
  platform: PlatformDefinition,
  definition: PlatformFloorArtDefinition,
  materials: MuseumMaterials,
): Group {
  const root = new Group()
  root.name = `floor-art-${platform.id}`
  const variant = selectFloorArtVariant(levelId, definition)
  root.userData.floorArt = { ...definition, variant }
  const seed = hashString(
    `${levelId}/${definition.platformId}/${definition.recipeId}/${definition.palette ?? 'neutral'}`,
  )
  const builder = new InlayBuilder(
    seed,
    PALETTES[definition.palette ?? 'neutral'],
  )
  const halfWidth = Math.max(0, (platform.maxX - platform.minX) / 2 - 0.08)
  const halfDepth = Math.max(0, (platform.maxZ - platform.minZ) / 2 - 0.08)
  if (halfWidth >= 0.12 && halfDepth >= 0.12)
    addRecipe(builder, definition.recipeId, halfWidth, halfDepth, variant)
  root.add(...builder.build(materials))
  return root
}

/** Create local inlay groups for the floor groups that own their visibility. */
export function createPlatformFloorArt(
  level: LevelDefinition,
  materials: MuseumMaterials,
): ReadonlyMap<string, Group> {
  const result = new Map<string, Group>()
  const platforms = new Map(
    level.platforms.map((platform) => [platform.id, platform]),
  )
  const definitions = level.presentation?.floorArt ?? []
  const platformIds = new Set<string>()
  for (const definition of definitions) {
    if (platformIds.has(definition.platformId))
      throw new Error(
        `Duplicate floor art for platform "${definition.platformId}".`,
      )
    platformIds.add(definition.platformId)
    if (!platforms.has(definition.platformId))
      throw new Error(
        `Floor art references unknown platform "${definition.platformId}".`,
      )
  }
  for (const definition of definitions) {
    const platform = platforms.get(definition.platformId)!
    result.set(
      definition.platformId,
      createFloorArt(level.id, platform, definition, materials),
    )
  }
  return result
}

/**
 * Remove the preferred V2 centre motif while retaining its outer border,
 * cornice and underside. Blender batches the motif into the brass and petrol
 * meshes, so this must filter owned triangles rather than whole mesh names.
 */
export function removeEmbeddedFloorInlay(
  root: Object3D,
  dimensions: Pick<Vector3, 'x' | 'z'>,
): number {
  const centreRadius =
    Math.min(dimensions.x, dimensions.z) * EMBEDDED_INLAY_RADIUS_FRACTION
  const rootInverse = new Matrix4()
  const relative = new Matrix4()
  const vertex = new Vector3()
  let removed = 0

  root.updateWorldMatrix(true, true)
  rootInverse.copy(root.matrixWorld).invert()
  root.traverse((object) => {
    const mesh = object as MeshType
    if (
      !mesh.isMesh ||
      Array.isArray(mesh.material) ||
      !EMBEDDED_INLAY_MATERIALS.has(mesh.material.name)
    )
      return
    const geometry = mesh.geometry
    const position = geometry.getAttribute('position')
    if (position === undefined) return
    const index = geometry.getIndex()
    const sourceCount = index?.count ?? position.count
    if (sourceCount % 3 !== 0) return

    relative.multiplyMatrices(rootInverse, mesh.matrixWorld)
    const retained: number[] = []
    let meshRemoved = 0
    for (let offset = 0; offset < sourceCount; offset += 3) {
      const triangle = [
        index?.getX(offset) ?? offset,
        index?.getX(offset + 1) ?? offset + 1,
        index?.getX(offset + 2) ?? offset + 2,
      ]
      const insideCentreSurface = triangle.every((vertexIndex) => {
        vertex.fromBufferAttribute(position, vertexIndex).applyMatrix4(relative)
        return (
          Math.abs(vertex.y) <= EMBEDDED_INLAY_SURFACE_BAND &&
          Math.hypot(vertex.x, vertex.z) <= centreRadius
        )
      })
      if (insideCentreSurface) meshRemoved++
      else retained.push(...triangle)
    }
    if (meshRemoved === 0) return
    geometry.setIndex(retained)
    if (geometry.groups.length > 0) {
      geometry.clearGroups()
      geometry.addGroup(0, retained.length, 0)
    }
    removed += meshRemoved
  })
  return removed
}
