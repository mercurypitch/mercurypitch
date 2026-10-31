// Building garden tests — resident resource reuse, owned geometry lifetime and clear statue bays.

import { readFileSync } from 'node:fs'
import type { BufferGeometry, Object3D } from 'three'
import { Box3, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Texture, Vector3, } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { createJourneyArchitecture } from './architecture'
import { createJourneyBuildingGarden } from './building-gardens'
import { createFirstIslandFlowers, FIRST_ISLAND_TERRACE_BEDS, } from './first-island-beds'
import { clearsJourneyStairway, JOURNEY_STAIR_COUNT, JOURNEY_STAIR_DEPTH, JOURNEY_STAIR_RUN, JOURNEY_STAIRWAYS, JOURNEY_TERRACE_SURFACE_OFFSET, } from './terrace-layout'
import { journeyBridgeDistanceXZ } from './vegetation-placement'

async function loadKit(path: string): Promise<Object3D> {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${path}`,
      import.meta.url,
    ),
  )
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({
      name: 'EXT_texture_webp',
      loadTexture: async () => new Texture(),
    }))
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene
}

function deckY(stage: (typeof FLOATING_MUSEUM_JOURNEY.stages)[number]): number {
  const island = FLOATING_MUSEUM_JOURNEY.landmasses.find(
    (landmass) => landmass.id === stage.islandId,
  )!
  return (
    (island.position[1] +
      JOURNEY_TERRACE_SURFACE_OFFSET -
      stage.architecturePosition[1]) /
    stage.scale
  )
}

describe('building gardens', () => {
  let source: Object3D
  let map: Object3D
  let architecture: Object3D
  beforeAll(async () => {
    source = await loadKit(
      'journey-map-v11/floating-museum-garden-edge-mobile-v11.glb',
    )
    map = await loadKit('journey-map-v1/floating-museum-map-kit-v1-meshopt.glb')
    architecture = await loadKit(
      'journey-map-v8/floating-museum-architecture-kit-v8-meshopt.glb',
    )
  })

  it('keeps old kits and the small entry garden unchanged', () => {
    const owned = new Set<BufferGeometry>()
    const authored = (): Object3D => new Group()
    expect(
      createJourneyBuildingGarden(
        FLOATING_MUSEUM_JOURNEY.stages[0]!,
        new Group(),
        authored,
        owned,
        deckY(FLOATING_MUSEUM_JOURNEY.stages[0]!),
      ),
    ).toBeUndefined()
    expect(
      createJourneyBuildingGarden(
        FLOATING_MUSEUM_JOURNEY.stages[1]!,
        source,
        authored,
        owned,
        deckY(FLOATING_MUSEUM_JOURNEY.stages[0]!),
      ),
    ).toBeUndefined()
    expect(owned.size).toBe(0)
  })

  it('borrows resident art and owns six card geometries plus one instanced corolla', () => {
    const borrowedGeometries = new Set<BufferGeometry>()
    const borrowedMaterials = new Set()
    for (const donor of [source, map])
      donor.traverse((object) => {
        if (!(object instanceof Mesh)) return
        borrowedGeometries.add(object.geometry)
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          borrowedMaterials.add(material)
      })
    const owned = new Set<BufferGeometry>()
    const flowerMaterial = new MeshBasicMaterial()
    borrowedMaterials.add(flowerMaterial)
    const flowerGeometries = new Set<BufferGeometry>()
    const geometryStages = new Map<BufferGeometry, string>()
    let draws = 0
    let triangles = 0
    let casts = 0
    for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
      const garden = createJourneyBuildingGarden(
        stage,
        source,
        (name) => map.getObjectByName(name)!.clone(true),
        owned,
        deckY(stage),
        flowerMaterial,
      )
      garden?.traverse((object) => {
        if (!(object instanceof Mesh)) return
        expect(borrowedMaterials.has(object.material)).toBe(true)
        expect(
          owned.has(object.geometry) || borrowedGeometries.has(object.geometry),
        ).toBe(true)
        const count = object instanceof InstancedMesh ? object.count : 1
        if (object.name === 'first-island-terrace-flowers') {
          expect(count).toBe(234)
          expect(object.material).toBe(flowerMaterial)
          flowerGeometries.add(object.geometry)
        }
        if (owned.has(object.geometry))
          geometryStages.set(object.geometry, stage.id)
        draws++
        triangles += (object.geometry.index!.count / 3) * count
        if (object.castShadow) casts++
      })
    }
    expect(owned.size).toBe(7)
    expect(flowerGeometries.size).toBe(1)
    for (const geometry of owned) {
      expect(borrowedGeometries.has(geometry)).toBe(false)
      if (flowerGeometries.has(geometry)) continue
      // The real resident materials enable vertex colours and alpha. Missing
      // COLOR_0 makes these new cards black in the actual WebGL host.
      const color = geometry.getAttribute('color')
      expect(color.count).toBe(geometry.getAttribute('position').count)
      expect(color.itemSize).toBe(4)
      for (let vertex = 0; vertex < color.count; vertex++) {
        const rgb = [color.getX(vertex), color.getY(vertex), color.getZ(vertex)]
        expect(color.getW(vertex)).toBe(1)
        if (rgb.every((channel) => channel === 1)) continue
        // Only the low First Light ground beds darken their borrowed foliage.
        // The cornices, urns and other islands keep neutral atlas colours.
        expect(geometryStages.get(geometry)).toBe('first-light-isle')
        expect(geometry.getAttribute('position').getY(vertex)).toBeLessThan(0.3)
        expect(rgb).toEqual([128 / 255, 165 / 255, 113 / 255])
      }
    }
    // One corolla batch adds no texture/shadow pass; the garden triangle cap stays.
    expect(draws).toBeLessThanOrEqual(11)
    expect(triangles).toBeLessThan(64000)
    expect(casts).toBeLessThanOrEqual(4)
    for (const geometry of owned) geometry.dispose()
    flowerMaterial.dispose()
  })

  it.each([0, 0.12])(
    'keeps urns and cypresses on decks raised by %s metres',
    (lift) => {
      const owned = new Set<BufferGeometry>()
      const material = new MeshBasicMaterial()
      const authored =
        (scene: Object3D) =>
        (name: string): Object3D => {
          const unit = scene.getObjectByName(name)!.clone(true)
          unit.position.set(0, 0, 0)
          unit.rotation.set(0, 0, 0)
          unit.scale.set(1, 1, 1)
          return unit
        }
      const definition = {
        ...FLOATING_MUSEUM_JOURNEY,
        landmasses: FLOATING_MUSEUM_JOURNEY.landmasses.map((island) => ({
          ...island,
          position: [
            island.position[0],
            island.position[1] + lift,
            island.position[2],
          ] as const,
        })),
      }
      const assembly = createJourneyArchitecture(
        definition,
        authored(map),
        authored(source),
        authored(architecture),
        {
          gold: material,
          jade: material,
          ivory: material,
          amber: material,
          celadon: material,
          clearGlass: material,
          shadow: material,
          crystal: material,
        },
        owned,
        source,
      )
      try {
        assembly.root.updateMatrixWorld(true)
        let groundedInstances = 0
        for (const stage of definition.stages) {
          if (stage.kind === 'garden') continue
          const island = definition.landmasses.find(
            (item) => item.id === stage.islandId,
          )!
          const garden = assembly.root.getObjectByName(
            `${stage.id}-building-garden`,
          )!
          expect(garden).toBeDefined()
          garden.traverse((object) => {
            if (!(object instanceof InstancedMesh)) return
            if (object.name === 'first-island-terrace-flowers') return
            object.geometry.computeBoundingBox()
            for (let index = 0; index < object.count; index++) {
              const matrix = new Matrix4()
              object.getMatrixAt(index, matrix)
              const bounds = object.geometry
                .boundingBox!.clone()
                .applyMatrix4(matrix.premultiply(object.matrixWorld))
              expect(bounds.min.y).toBeCloseTo(
                island.position[1] + JOURNEY_TERRACE_SURFACE_OFFSET,
                4,
              )
              groundedInstances++
            }
          })
        }
        expect(groundedInstances).toBe(7)
      } finally {
        assembly.root.traverse((object) => {
          if (object instanceof InstancedMesh) object.dispose()
        })
        for (const geometry of owned) geometry.dispose()
        material.dispose()
      }
    },
  )

  it('keeps First Light hanging growth beside the central statue and roots trees on the deck', () => {
    const owned = new Set<BufferGeometry>()
    const garden = createJourneyBuildingGarden(
      FLOATING_MUSEUM_JOURNEY.stages[0]!,
      source,
      (name) => map.getObjectByName(name)!.clone(true),
      owned,
      deckY(FLOATING_MUSEUM_JOURNEY.stages[0]!),
    )!
    const trails = garden.getObjectByName(
      'first-light-isle-supported-jasmine-trails',
    ) as Mesh | undefined
    const actualTrails =
      trails ??
      (garden.children.find((object) =>
        object.name.endsWith('supported-jasmine-trails'),
      ) as Mesh)
    const positions = actualTrails.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) < 1.24 && positions.getZ(i) > 0.18)
        expect(Math.abs(positions.getX(i))).toBeGreaterThan(0.28)
    }
    const cypress = garden.children.find((object) =>
      object.name.startsWith('museum-building-framing-cypresses'),
    ) as InstancedMesh
    const bounds = new Box3().setFromObject(cypress)
    expect(bounds.min.y).toBeCloseTo(
      deckY(FLOATING_MUSEUM_JOURNEY.stages[0]!),
      4,
    )
    expect(bounds.getSize(new Vector3()).y).toBeLessThan(2)
    for (const geometry of owned) geometry.dispose()
  })

  it('supports the First Light bed footprints on the real deck and keeps paths and landmarks clear', () => {
    const stage = FLOATING_MUSEUM_JOURNEY.stages[0]!
    const island = FLOATING_MUSEUM_JOURNEY.landmasses.find(
      (item) => item.id === stage.islandId,
    )!
    const islandStages = FLOATING_MUSEUM_JOURNEY.stages.filter(
      (item) => item.islandId === island.id,
    )
    const local = new Group()
    local.position.fromArray(stage.architecturePosition)
    local.rotation.y = stage.yaw
    local.scale.setScalar(stage.scale)
    local.updateMatrixWorld(true)
    const deck = map.getObjectByName('map_platform')!.clone(true)
    deck.position.fromArray(island.position)
    deck.position.y += JOURNEY_TERRACE_SURFACE_OFFSET
    deck.rotation.set(0, island.yaw, 0)
    deck.scale.fromArray(island.terraceScale)
    const material = new MeshBasicMaterial({ side: DoubleSide })
    deck.traverse((object) => {
      if (object instanceof Mesh) object.material = material
    })
    deck.updateMatrixWorld(true)
    const ray = new Raycaster()
    try {
      for (const bed of FIRST_ISLAND_TERRACE_BEDS)
        for (const lobe of bed.lobes) {
          const centre = local.localToWorld(new Vector3(lobe.x, 0, lobe.z))
          const radius = lobe.radius * stage.scale
          for (const other of islandStages) {
            expect(clearsJourneyStairway(other, centre, radius), bed.id).toBe(
              true,
            )
            expect(
              Math.hypot(
                centre.x - other.position[0],
                centre.z - other.position[2],
              ),
              `${bed.id} pod ${other.id}`,
            ).toBeGreaterThan(0.8 + radius)
            if (other.portrait)
              expect(
                Math.hypot(
                  centre.x - other.portrait.position[0],
                  centre.z - other.portrait.position[2],
                ),
                `${bed.id} portrait`,
              ).toBeGreaterThan(0.65 + radius)
          }
          for (const bridge of FLOATING_MUSEUM_JOURNEY.bridges)
            expect(
              journeyBridgeDistanceXZ(bridge, centre),
              bed.id,
            ).toBeGreaterThan(bridge.width / 2 + 0.08 + radius)
          for (const spillway of FLOATING_MUSEUM_JOURNEY.spillways) {
            if (!spillway.source) continue
            const pond = spillway.source
            const dx = centre.x - pond.position[0]
            const dz = centre.z - pond.position[2]
            const x = Math.cos(spillway.yaw) * dx - Math.sin(spillway.yaw) * dz
            const z = Math.sin(spillway.yaw) * dx + Math.cos(spillway.yaw) * dz
            const ellipse =
              x ** 2 / (pond.width / 2 + 0.055 + radius) ** 2 +
              z ** 2 / (pond.length / 2 + 0.055 + radius) ** 2
            expect(ellipse, `${bed.id} pond ${spillway.id}`).toBeGreaterThan(1)
          }
          for (let sample = 0; sample < 33; sample++) {
            const angle = (sample * Math.PI) / 16
            const distance = sample === 32 ? 0 : lobe.radius
            const point = local.localToWorld(
              new Vector3(
                lobe.x + Math.cos(angle) * distance,
                0,
                lobe.z + Math.sin(angle) * distance,
              ),
            )
            ray.set(new Vector3(point.x, 5, point.z), new Vector3(0, -1, 0))
            const hit = ray.intersectObject(deck, true)[0]
            expect(hit, `${bed.id} deck sample ${sample}`).toBeDefined()
            expect(hit!.point.y).toBeCloseTo(
              island.position[1] + JOURNEY_TERRACE_SURFACE_OFFSET,
              5,
            )
          }
        }
    } finally {
      material.dispose()
    }
  })

  it('roots foreground blooms on resident rim foliage without crossing pods or the promenade', () => {
    const stage = FLOATING_MUSEUM_JOURNEY.stages[0]!
    const island = FLOATING_MUSEUM_JOURNEY.landmasses[0]!
    const local = new Group()
    local.position.fromArray(stage.architecturePosition)
    local.rotation.y = stage.yaw
    local.scale.setScalar(stage.scale)
    local.updateMatrixWorld(true)
    const cliff = new Group()
    cliff.position.fromArray(island.position)
    cliff.rotation.y = island.yaw
    cliff.scale.set(
      (island.scale[0] * 2.621731) / 4.5,
      island.scale[1] * 1.65,
      (island.scale[2] * 2.602302) / 2.464056,
    )
    const foliage = source
      .getObjectByName('map_foliage_first_light')!
      .clone(true)
    foliage.position.set(0, 0, 0)
    foliage.rotation.set(0, 0, 0)
    foliage.scale.set(1, 1, 1)
    cliff.add(foliage)
    const material = new MeshBasicMaterial({ side: DoubleSide })
    foliage.traverse((object) => {
      if (object instanceof Mesh) object.material = material
    })
    cliff.updateMatrixWorld(true)
    const owned = new Set<BufferGeometry>()
    const flowers = createFirstIslandFlowers(material, owned, deckY(stage))
    const groundCount = FIRST_ISLAND_TERRACE_BEDS.flatMap(
      (bed) => bed.lobes,
    ).reduce(
      (sum, lobe) => sum + 2 * (lobe.flowers ?? (lobe.radius < 0.2 ? 6 : 9)),
      0,
    )
    const ray = new Raycaster()
    const positions = flowers.geometry.getAttribute('position')
    try {
      expect(flowers.count - groundCount).toBe(60)
      for (let index = groundCount; index < flowers.count; index++) {
        const matrix = new Matrix4()
        flowers.getMatrixAt(index, matrix)
        const centre = local.localToWorld(
          new Vector3().setFromMatrixPosition(matrix),
        )
        ray.set(new Vector3(centre.x, 5, centre.z), new Vector3(0, -1, 0))
        const contacts = ray.intersectObject(foliage, true)
        // Texture alpha is checked separately against the real embedded WebP;
        // this test catches transform drift and detached crowns in the donor.
        expect(
          contacts.some(
            (hit) =>
              Math.abs((centre.y - hit.point.y) / stage.scale - 0.024) < 0.0001,
          ),
          `rim bloom ${index} foliage contact`,
        ).toBe(true)
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = local.localToWorld(
            new Vector3()
              .fromBufferAttribute(positions, vertex)
              .applyMatrix4(matrix),
          )
          for (const other of FLOATING_MUSEUM_JOURNEY.stages.filter(
            (item) => item.islandId === island.id,
          )) {
            expect(
              clearsJourneyStairway(other, point, 0),
              `rim bloom ${index} stairs`,
            ).toBe(true)
            expect(
              Math.hypot(
                point.x - other.position[0],
                point.z - other.position[2],
              ),
              `rim bloom ${index} pod`,
            ).toBeGreaterThan(0.8)
          }
          for (const bridge of FLOATING_MUSEUM_JOURNEY.bridges)
            expect(
              journeyBridgeDistanceXZ(bridge, point),
              `rim bloom ${index} promenade`,
            ).toBeGreaterThan(bridge.width / 2 + 0.08)
        }
      }
    } finally {
      flowers.dispose()
      for (const geometry of owned) geometry.dispose()
      material.dispose()
    }
  })

  it('keeps low planted crowns out of every entrance stair footprint', () => {
    for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
      const owned = new Set<BufferGeometry>()
      createJourneyBuildingGarden(
        stage,
        source,
        (name) => map.getObjectByName(name)!.clone(true),
        owned,
        deckY(stage),
      )
      const stair = JOURNEY_STAIRWAYS[stage.kind]
      const back =
        stair.frontZ -
        (JOURNEY_STAIR_COUNT - 1) * JOURNEY_STAIR_RUN -
        JOURNEY_STAIR_DEPTH / 2
      const front = stair.frontZ + JOURNEY_STAIR_DEPTH / 2
      for (const geometry of owned) {
        const positions = geometry.getAttribute('position')
        for (let vertex = 0; vertex < positions.count; vertex++) {
          if (positions.getY(vertex) >= 0.65) continue
          const inStair =
            Math.abs(positions.getX(vertex)) < stair.width / 2 &&
            positions.getZ(vertex) > back &&
            positions.getZ(vertex) < front
          expect(inStair, `${stage.id} low foliage vertex ${vertex}`).toBe(
            false,
          )
        }
        geometry.dispose()
      }
    }
  })

  it('keeps First Light urns and their crowns clear of all five existing crystals', () => {
    const owned = new Set<BufferGeometry>()
    const material = new MeshBasicMaterial()
    const authored =
      (scene: Object3D) =>
      (name: string): Object3D => {
        const unit = scene.getObjectByName(name)!.clone(true)
        unit.position.set(0, 0, 0)
        unit.rotation.set(0, 0, 0)
        unit.scale.set(1, 1, 1)
        return unit
      }
    const stage = FLOATING_MUSEUM_JOURNEY.stages[0]!
    const assembly = createJourneyArchitecture(
      { ...FLOATING_MUSEUM_JOURNEY, stages: [stage], bridges: [] },
      authored(map),
      authored(source),
      undefined,
      {
        gold: material,
        jade: material,
        ivory: material,
        amber: material,
        celadon: material,
        clearGlass: material,
        shadow: material,
        crystal: material,
      },
      owned,
      source,
    )
    try {
      assembly.root.updateMatrixWorld(true)
      const garden = assembly.root.getObjectByName(
        `${stage.id}-building-garden`,
      )!
      const urns = garden.getObjectByName(
        'museum-building-garden-urns-0',
      ) as InstancedMesh
      const crystals = assembly.root.getObjectByName(
        'museum-crystal-cluster',
      ) as InstancedMesh
      expect(urns.count).toBe(2)
      expect(crystals.count).toBe(5)
      crystals.geometry.computeBoundingBox()
      urns.geometry.computeBoundingBox()
      const crystalBounds = Array.from(
        { length: crystals.count },
        (_, index) => {
          const matrix = new Matrix4()
          crystals.getMatrixAt(index, matrix)
          return crystals.geometry
            .boundingBox!.clone()
            .applyMatrix4(matrix.premultiply(crystals.matrixWorld))
        },
      )
      for (let urn = 0; urn < urns.count; urn++) {
        const matrix = new Matrix4()
        urns.getMatrixAt(urn, matrix)
        const bounds = urns.geometry
          .boundingBox!.clone()
          .applyMatrix4(matrix.premultiply(urns.matrixWorld))
        for (const crystal of crystalBounds)
          expect(bounds.intersectsBox(crystal)).toBe(false)
      }
      garden.traverse((object) => {
        if (!(object instanceof Mesh) || !owned.has(object.geometry)) return
        const positions = object.geometry.getAttribute('position')
        const point = new Vector3()
        const count = object instanceof InstancedMesh ? object.count : 1
        for (let instance = 0; instance < count; instance++) {
          const matrix = new Matrix4()
          if (object instanceof InstancedMesh)
            object.getMatrixAt(instance, matrix)
          matrix.premultiply(object.matrixWorld)
          for (let vertex = 0; vertex < positions.count; vertex++) {
            if (positions.getY(vertex) >= 0.65) continue
            point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix)
            for (const crystal of crystalBounds)
              expect(crystal.containsPoint(point)).toBe(false)
          }
        }
      })
    } finally {
      assembly.root.traverse((object) => {
        if (object instanceof InstancedMesh) object.dispose()
      })
      for (const geometry of owned) geometry.dispose()
      material.dispose()
    }
  })
})
