// Melody station markers — low glass-and-brass route cues show contour, order and local progress.

import type { Material } from 'three'
import { CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, OctahedronGeometry, TorusGeometry, } from 'three'
import type { GameSnapshot, LevelDefinition, MelodyStationMarkerDefinition, } from '../contracts'
import type { MuseumMaterials } from './materials'

const BASE_RADIUS = 0.105
const HEAD_MIN_Y = 0.24
const HEAD_MAX_Y = 0.36
const HEAD_RADIUS = 0.052
const ORDER_DOT_SPACING = 0.034
const ORDER_DOT_Z = 0.126

function contourHeight(
  marker: MelodyStationMarkerDefinition,
  markers: readonly MelodyStationMarkerDefinition[],
): number {
  const offsets = markers.map((item) => item.pitchOffsetSemitones)
  const minimum = Math.min(...offsets)
  const maximum = Math.max(...offsets)
  if (maximum === minimum) return (HEAD_MIN_Y + HEAD_MAX_Y) / 2
  return (
    HEAD_MIN_Y +
    ((marker.pitchOffsetSemitones - minimum) / (maximum - minimum)) *
      (HEAD_MAX_Y - HEAD_MIN_Y)
  )
}

function setMarkerMaterial(
  head: Mesh,
  halo: Mesh,
  material: Material,
  haloVisible: boolean,
): void {
  head.material = material
  halo.material = material
  halo.visible = haloVisible
}

/** Build room-owned cues without adding collision or another asset download. */
export function createMelodyStationMarkers(
  level: LevelDefinition,
  materials: MuseumMaterials,
) {
  const definitions = level.presentation?.melodyMarkers ?? []
  const root = new Group()
  root.name = 'melody-station-markers'

  const baseGeometry = new CylinderGeometry(BASE_RADIUS, BASE_RADIUS, 0.025, 16)
  const ringGeometry = new TorusGeometry(BASE_RADIUS, 0.008, 5, 28)
  ringGeometry.rotateX(Math.PI / 2)
  const stemGeometry = new CylinderGeometry(0.008, 0.011, 1, 8)
  const headGeometry = new OctahedronGeometry(HEAD_RADIUS, 1)
  const haloGeometry = new TorusGeometry(HEAD_RADIUS * 1.42, 0.006, 4, 24)
  const dotGeometry = new OctahedronGeometry(0.012, 0)
  const dotMatrix = new Matrix4()

  const records = definitions.map((definition, index) => {
    const marker = new Group()
    marker.name = `melody-marker-${definition.id}`
    marker.position.copy(definition.position)
    marker.rotation.y = definition.yaw
    marker.userData.melodyMarker = {
      encounterId: definition.encounterId,
      anchorId: definition.anchorId,
      order: index + 1,
      pitchOffsetSemitones: definition.pitchOffsetSemitones,
    }

    const headY = contourHeight(definition, definitions)
    const stemHeight = headY - 0.045
    const base = new Mesh(baseGeometry, materials.gold)
    base.name = `melody-marker-base-${definition.id}`
    base.position.y = 0.0125
    const ring = new Mesh(ringGeometry, materials.gold)
    ring.name = `melody-marker-ring-${definition.id}`
    ring.position.y = 0.028
    const stem = new Mesh(stemGeometry, materials.gold)
    stem.name = `melody-marker-stem-${definition.id}`
    stem.scale.y = stemHeight
    stem.position.y = 0.035 + stemHeight / 2
    const head = new Mesh(headGeometry, materials.glass)
    head.name = `melody-marker-head-${definition.id}`
    head.position.y = headY
    const halo = new Mesh(haloGeometry, materials.glass)
    halo.name = `melody-marker-halo-${definition.id}`
    halo.position.y = headY
    halo.position.z = -0.004
    halo.visible = false

    const orderDots = new InstancedMesh(dotGeometry, materials.gold, index + 1)
    orderDots.name = `melody-marker-order-${definition.id}`
    for (let dot = 0; dot <= index; dot++) {
      dotMatrix.makeTranslation(
        (dot - index / 2) * ORDER_DOT_SPACING,
        0.044,
        ORDER_DOT_Z,
      )
      orderDots.setMatrixAt(dot, dotMatrix)
    }
    orderDots.instanceMatrix.needsUpdate = true

    for (const object of [base, ring, stem, head, halo, orderDots]) {
      object.userData.excludeFromCameraCollision = true
      object.castShadow = object !== halo
      object.receiveShadow = object !== halo
    }
    marker.add(base, ring, stem, head, halo, orderDots)
    root.add(marker)
    return { definition, marker, head, halo }
  })

  return {
    root,
    instances: records.map(({ definition, marker }) => ({
      roomId: definition.roomId,
      root: marker,
    })),
    update(snapshot: GameSnapshot): void {
      const completed = new Set(snapshot.completedBreakableIds)
      for (const { definition, head, halo } of records) {
        if (completed.has(definition.encounterId)) {
          setMarkerMaterial(head, halo, materials.teal, true)
          continue
        }
        const next = snapshot.nextRequiredBreakableId === definition.encounterId
        setMarkerMaterial(
          head,
          halo,
          next ? materials.gold : materials.glass,
          next,
        )
      }
    },
  }
}
