// Journey ponds — instanced marble coping and shallow stone beds give terrace water a physical home.

import type { BufferGeometry, Material } from 'three'
import { CatmullRomCurve3, CylinderGeometry, Group, InstancedMesh, Matrix4, Quaternion, TubeGeometry, Vector3, } from 'three'
import type { MuseumJourneyDefinition } from '../content/museum-journey'
import { JOURNEY_TERRACE_SURFACE_OFFSET } from './terrace-layout'

export function createJourneyPondBorders(
  definition: MuseumJourneyDefinition,
  material: Material,
  owned: Set<BufferGeometry>,
): Group {
  const root = new Group()
  root.name = 'museum-water-gardens'
  const sources = definition.spillways.flatMap((spillway) => {
    if (spillway.source === undefined) return []
    const stage = definition.stages.find(
      (candidate) => candidate.id === spillway.stageId,
    )
    const island = definition.landmasses.find(
      (candidate) => candidate.id === stage?.islandId,
    )
    if (island === undefined)
      throw new Error(`Pond ${spillway.id} has no supporting island.`)
    return [
      {
        spillway,
        source: spillway.source,
        floorY: island.position[1] + JOURNEY_TERRACE_SURFACE_OFFSET,
      },
    ]
  })
  if (sources.length === 0) return root
  const floorGeometry = new CylinderGeometry(1, 1, 1, 48)
  // The broad opening faces the authored waterfall. No coping crosses its lip.
  const points = Array.from({ length: 49 }, (_, index) => {
    const angle = 1.08 + ((Math.PI * 2 - 2.16) * index) / 48
    return new Vector3(Math.sin(angle), 0, Math.cos(angle))
  })
  const copingGeometry = new TubeGeometry(
    new CatmullRomCurve3(points),
    48,
    0.04,
    8,
    false,
  )
  owned.add(floorGeometry)
  owned.add(copingGeometry)
  const floors = new InstancedMesh(floorGeometry, material, sources.length)
  floors.name = 'journey-pond-stone-beds'
  const copings = new InstancedMesh(copingGeometry, material, sources.length)
  copings.name = 'journey-pond-open-marble-copings'
  const matrix = new Matrix4(),
    rotation = new Quaternion(),
    axis = new Vector3(0, 1, 0)
  sources.forEach(({ spillway, source, floorY }, index) => {
    const bedHeight = Math.max(0.01, source.position[1] - 0.0175 - floorY)
    const width = source.width * 0.5,
      length = source.length * 0.5
    rotation.setFromAxisAngle(axis, spillway.yaw)
    matrix.compose(
      new Vector3(
        source.position[0],
        floorY + bedHeight * 0.5,
        source.position[2],
      ),
      rotation,
      new Vector3(width + 0.023, bedHeight, length + 0.023),
    )
    floors.setMatrixAt(index, matrix)
    matrix.compose(
      new Vector3(...source.position).add(new Vector3(0, 0.008, 0)),
      rotation,
      new Vector3(width, 0.65, length),
    )
    copings.setMatrixAt(index, matrix)
  })
  for (const instances of [floors, copings]) {
    instances.castShadow = true
    instances.receiveShadow = true
    instances.instanceMatrix.needsUpdate = true
    root.add(instances)
  }
  return root
}
