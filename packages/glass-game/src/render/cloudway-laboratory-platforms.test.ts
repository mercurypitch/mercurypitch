// Cloudway laboratory renderer tests — accepted dense donors install together or retain the complete gameplay fallback.

import type { InstancedMesh as InstancedMeshType, Mesh as MeshType, } from 'three'
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS, CLOUDWAY_CRYSTAL_PROMENADE_STUDY, } from '../content/cloudway-laboratory'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { createMuseumAssetLoadPlan } from './asset-load-plan'
import { CLOUDWAY_LAB_BUNDLE_IDS, CLOUDWAY_LAB_ROOT_NAMES, } from './cloudway-laboratory-catalog'
import { createCloudwayLaboratoryPlatformRenderer } from './cloudway-laboratory-platforms'
import { disposeMaterials, disposeObject } from './dispose'
import { createMaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'

function materials(): MuseumMaterials {
  return Object.fromEntries(
    ['marble', 'teal', 'limestone', 'gold', 'rock', 'glass', 'mirror'].map(
      (id) => [id, new MeshPhysicalMaterial()],
    ),
  ) as MuseumMaterials
}

function fallbacks(level: LevelDefinition): Map<string, Group> {
  return new Map(
    level.platforms.map((platform) => {
      const floor = new Group()
      floor.name = `floor-${platform.id}`
      floor.add(
        new Mesh(new BoxGeometry(1, 0.1, 1), new MeshStandardMaterial()),
      )
      return [platform.id, floor]
    }),
  )
}

function pearlDonor(): Group {
  const source = new Group()
  source.name = CLOUDWAY_LAB_ROOT_NAMES.pearlRest
  source.userData.collider_json = JSON.stringify({
    shape: 'box',
    width: 3.2,
    depth: 0.72,
    height: 0.34,
    topY: 0,
    center: [0, -0.17, 0],
  })
  source.userData.cloudway_lab_asset_json = JSON.stringify({
    schema: 'cloudway-lab-static-v1',
    assetId: 'pearl-marble-long',
    kind: 'platform',
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'landing-or-resting-datum',
    },
    contact: {
      kind: 'rectangle',
      width: 3.2,
      depth: 0.72,
      topY: 0,
      height: 0.34,
    },
    material: {
      kind: 'provider-pbr',
      appearanceStatus: 'provider-pbr-preserved',
      intendedAppearance: 'opaque',
    },
    geometry: { triangles: 12, decimated: false, remeshed: false },
  })
  const mesh = new Mesh(
    new BoxGeometry(3.2, 0.34, 0.72),
    new MeshStandardMaterial(),
  )
  mesh.name = 'PearlDenseGeometry'
  mesh.position.y = -0.17
  source.add(mesh)
  return source
}

function scrollDonor(): Group {
  const width = CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS.scroll.localWidth
  const depth = CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS.scroll.localDepth
  const source = new Group()
  source.name = CLOUDWAY_LAB_ROOT_NAMES.scroll
  source.userData.collider_json = JSON.stringify({
    shape: 'box',
    width,
    depth,
    height: 0.1,
    topY: 0,
    center: [0, -0.05, 0],
  })
  source.userData.platform_adapter_json = JSON.stringify({
    version: 1,
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'top-centre-of-fully-extended-support',
    },
    support: { state: 'fully-extended', topY: 0, width, depth },
    motion: {
      kind: 'scroll',
      localExtensionAxis: 'x',
      roles: {
        deck: 'ScrollDeck',
        negativeRoller: 'ScrollRollerNegative',
        positiveRoller: 'ScrollRollerPositive',
        persistent: [],
      },
      rollerEdgeAnchors: {
        negative: [-width / 2, 0, 0],
        positive: [width / 2, 0, 0],
      },
    },
  })

  const deck = new Group()
  deck.name = 'ScrollDeck'
  const addDeckMesh = (
    name: string,
    material: MeshStandardMaterial,
    height: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
    mesh.name = name
    mesh.position.y = -height / 2
    deck.add(mesh)
  }
  addDeckMesh(
    'ScrollDeckGeometry',
    new MeshPhysicalMaterial({ metalness: 0, transmission: 0.9 }),
    0.05,
  )
  addDeckMesh(
    'ScrollDeckGoldStarDetailLayer',
    new MeshStandardMaterial({ metalness: 0.8 }),
    0.01,
  )
  addDeckMesh(
    'ScrollDeckFrostEtchDetailLayer',
    new MeshPhysicalMaterial({ metalness: 0, transmission: 0.45 }),
    0.005,
  )
  source.add(deck)

  for (const [roleName, meshName, x] of [
    ['ScrollRollerNegative', 'ScrollRollerNegativeGeometry', -width / 2],
    ['ScrollRollerPositive', 'ScrollRollerPositiveGeometry', width / 2],
  ] as const) {
    const role = new Group()
    role.name = roleName
    role.position.x = x
    const mesh = new Mesh(
      new BoxGeometry(0.12, 0.12, depth),
      new MeshStandardMaterial({ metalness: 0.6 }),
    )
    mesh.name = meshName
    mesh.position.y = -0.06
    role.add(mesh)
    source.add(role)
  }
  return source
}

function crackleDonor(key: 'roseCrackle' | 'amethystCrackle'): Group {
  const isRose = key === 'roseCrackle'
  const source = new Group()
  source.name = CLOUDWAY_LAB_ROOT_NAMES[key]
  const width = 1.64
  const depth = isRose ? 1.64 : 1.1
  const height = isRose ? 0.24 : 0.25
  const materialKinds = isRose
    ? {
        CloudwayLab_RoseQuartz__glass: 'glass',
        CloudwayLab_RoseQuartz__framework: 'opaque',
        CloudwayLab_RoseQuartz__internal_detail: 'opaque',
        CloudwayLab_RoseQuartz__corner_provider_pbr: 'opaque',
        CloudwayLab_RoseQuartz__ivory: 'opaque',
      }
    : {
        CloudwayLab_Amethyst__glass: 'glass',
        CloudwayLab_Amethyst__framework: 'opaque',
        CloudwayLab_Amethyst__internal_detail: 'opaque',
        CloudwayLab_Amethyst__corner_provider_pbr: 'opaque',
        CloudwayLab_Amethyst__luminous_accent: 'opaque',
      }
  const authoredMaterials = new Map(
    Object.entries(materialKinds).map(([name, kind]) => {
      const material =
        kind === 'glass'
          ? new MeshPhysicalMaterial({
              metalness: 0,
              roughness: 0.1,
              transmission: 0.8,
            })
          : new MeshStandardMaterial({ metalness: 0.5, roughness: 0.35 })
      material.name = name
      return [name, material]
    }),
  )
  const materialNames = [...authoredMaterials.keys()]
  const addMesh = (owner: Group, name: string, materialName: string) => {
    const mesh = new Mesh(
      new BoxGeometry(0.2, height, 0.2),
      authoredMaterials.get(materialName)!,
    )
    mesh.name = name
    mesh.position.y = -height / 2
    owner.add(mesh)
  }
  const prefix = source.name
  const persistent = new Group()
  persistent.name = `${prefix}__persistent`
  for (let index = 2; index < materialNames.length; index++)
    addMesh(
      persistent,
      `${prefix}PersistentMesh${index}`,
      materialNames[index]!,
    )
  source.add(persistent)
  const intact = new Group()
  intact.name = `${prefix}__intact`
  addMesh(intact, `${prefix}IntactGlass`, materialNames[0]!)
  addMesh(intact, `${prefix}IntactDetail`, materialNames[1]!)
  source.add(intact)
  const contact = new Group()
  contact.name = `${prefix}__contact`
  addMesh(contact, `${prefix}Contact`, materialNames[1]!)
  source.add(contact)
  const shardNames: string[] = []
  for (let index = 0; index < 18; index++) {
    const shard = new Group()
    shard.name = `${prefix}__shard_${String(index).padStart(3, '0')}`
    shard.position.set((index % 6) * 0.02, 0, Math.floor(index / 6) * 0.02)
    addMesh(shard, `${prefix}ShardMesh${index}`, materialNames[0]!)
    source.add(shard)
    shardNames.push(shard.name)
  }
  source.userData.platform_adapter_json = JSON.stringify({
    version: 1,
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'top-centre-of-fully-extended-support',
    },
    support: { state: 'intact', topY: 0, width, depth },
    motion: {
      kind: 'crackle',
      roles: {
        persistent: [persistent.name],
        intactGlass: intact.name,
        contact: contact.name,
        shards: shardNames,
      },
      materials: Object.fromEntries(
        materialNames.map((name, index) => [`region${index}`, name]),
      ),
    },
  })
  source.userData.collider_json = JSON.stringify({
    shape: 'box',
    width,
    depth,
    height,
    topY: 0,
    center: [0, -height / 2, 0],
  })
  return source
}

function allMeshes(root: Group): MeshType[] {
  const result: MeshType[] = []
  root.traverse((object) => {
    if ((object as MeshType).isMesh) result.push(object as MeshType)
  })
  return result
}

function disposeTestScene(
  scene: Group,
  donors: readonly Group[],
  palette: MuseumMaterials,
  library: ReturnType<typeof createMaterialLibrary>,
): void {
  disposeObject(scene, library.materials)
  donors.forEach((donor) => disposeObject(donor))
  library.dispose()
  disposeMaterials(Object.values(palette))
}

describe('Cloudway laboratory platform renderer', () => {
  it('declares the four accepted runtime bundles for the first slice', () => {
    const plan = createMuseumAssetLoadPlan(CLOUDWAY_CRYSTAL_PROMENADE_STUDY)
    for (const bundle of Object.values(CLOUDWAY_LAB_BUNDLE_IDS)) {
      expect(plan.bundles.filter((id) => id === bundle)).toEqual([bundle])
      expect(plan.taskIds.filter((id) => id === `bundle:${bundle}`)).toEqual([
        `bundle:${bundle}`,
      ])
    }
    expect(plan.bundles).toHaveLength(4)
  })

  it('commits accepted donors together and instances repeated rests', () => {
    const level = CLOUDWAY_CRYSTAL_PROMENADE_STUDY
    const palette = materials()
    const library = createMaterialLibrary()
    const scene = new Group()
    const floorById = fallbacks(level)
    floorById.forEach((floor) => scene.add(floor))
    const renderer = createCloudwayLaboratoryPlatformRenderer(
      level,
      scene,
      floorById,
      palette,
      library,
    )
    const pearl = pearlDonor()
    const scroll = scrollDonor()
    const rose = crackleDonor('roseCrackle')
    const amethyst = crackleDonor('amethystCrackle')

    renderer.install(pearl, CLOUDWAY_LAB_BUNDLE_IDS.pearlRest)
    expect(floorById.get('scroll-approach')?.children).toHaveLength(1)
    renderer.install(scroll, CLOUDWAY_LAB_BUNDLE_IDS.scroll)
    renderer.install(rose, CLOUDWAY_LAB_BUNDLE_IDS.roseCrackle)
    expect(floorById.get('scroll-deck')?.children).toHaveLength(1)
    renderer.install(amethyst, CLOUDWAY_LAB_BUNDLE_IDS.amethystCrackle)
    const snapshot = createGlassGame(level).snapshot()
    renderer.update(snapshot)

    for (const id of [
      'arrival-entry',
      'arrival',
      'arrival-court',
      'arrival-threshold',
      'scroll-approach',
      'scroll-deck',
      'scroll-catch',
      'rose-step',
      'amethyst-step',
      'final-catch',
    ])
      expect(floorById.get(id)?.children).toHaveLength(0)

    const installed = scene.getObjectByName('cloudway-laboratory-platform-art')
    expect(installed?.visible).toBe(true)
    expect(installed?.getObjectByName('rose-step__crackle-art')?.visible).toBe(
      true,
    )
    expect(
      installed?.getObjectByName('amethyst-step__crackle-art')?.visible,
    ).toBe(true)
    const batches: InstancedMeshType[] = []
    installed?.traverse((object) => {
      if (object instanceof InstancedMesh) batches.push(object)
    })
    expect(batches).toHaveLength(1)
    expect(batches[0]?.count).toBe(7)
    const matrixVersion = batches[0]!.instanceMatrix.version
    renderer.update(snapshot)
    expect(batches[0]!.instanceMatrix.version).toBe(matrixVersion)
    const actualZ: number[] = []
    const matrix = new Matrix4()
    const position = new Vector3()
    for (let index = 0; index < batches[0]!.count; index++) {
      batches[0]!.getMatrixAt(index, matrix)
      position.setFromMatrixPosition(matrix)
      actualZ.push(position.z)
    }
    const expectedZ = [
      ...CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS.platformCentres.arrivalRows,
      CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS.platformCentres.scrollApproach,
      CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS.platformCentres.scrollCatch,
      CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS.platformCentres.finalCatch,
    ].sort((a, b) => a - b)
    actualZ.sort((a, b) => a - b)
    expectedZ.forEach((expected, index) =>
      expect(actualZ[index]).toBeCloseTo(expected, 5),
    )
    allMeshes(installed as Group).forEach((mesh) => {
      expect(mesh.userData.excludeFromCameraCollision).toBe(true)
      expect(mesh.castShadow).toBe(false)
    })
    renderer.update({
      ...snapshot,
      enabledPlatformIds: snapshot.enabledPlatformIds.filter(
        (id) => id !== 'final-catch',
      ),
    })
    expect(batches[0]!.count).toBe(6)
    expect(batches[0]!.instanceMatrix.version).toBe(matrixVersion + 1)

    renderer.dispose()
    disposeTestScene(scene, [pearl, scroll, rose, amethyst], palette, library)
  })

  it('keeps every accepted-family fallback when the scroll donor is invalid', () => {
    const level = CLOUDWAY_CRYSTAL_PROMENADE_STUDY
    const palette = materials()
    const library = createMaterialLibrary()
    const scene = new Group()
    const floorById = fallbacks(level)
    const renderer = createCloudwayLaboratoryPlatformRenderer(
      level,
      scene,
      floorById,
      palette,
      library,
    )
    const pearl = pearlDonor()
    const scroll = scrollDonor()
    scroll.getObjectByName('ScrollDeckGeometry')?.removeFromParent()

    renderer.install(pearl, CLOUDWAY_LAB_BUNDLE_IDS.pearlRest)
    expect(() =>
      renderer.install(scroll, CLOUDWAY_LAB_BUNDLE_IDS.scroll),
    ).toThrow('ScrollDeckGeometry')
    for (const platform of level.platforms)
      if (platform.renderId !== undefined)
        expect(floorById.get(platform.id)?.children).toHaveLength(1)

    renderer.dispose()
    floorById.forEach((floor) => disposeObject(floor))
    disposeTestScene(scene, [pearl, scroll], palette, library)
  })
})
