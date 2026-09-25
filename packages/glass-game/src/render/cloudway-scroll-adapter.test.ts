// Cloudway scroll adapter tests — semantic donor roles follow authoritative extent snapshots without mutating source art.

import type { Mesh as MeshType, Object3D } from 'three'
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, Texture, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { PlatformDefinition, PlatformRuntimeSnapshot } from '../contracts'
import { CLOUDWAY_SCROLL_ROLE_NAMES, createCloudwayScrollAdapter, } from './cloudway-scroll-adapter'
import { disposeMaterials, disposeObject } from './dispose'

interface DonorFixture {
  providerMaterial: MeshStandardMaterial
  providerTexture: Texture
  source: Group
}

function metadata(
  changes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    version: 1,
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'top-centre-of-fully-extended-support',
    },
    support: {
      state: 'fully-extended',
      topY: 0,
      width: 4,
      depth: 2,
    },
    motion: {
      kind: 'scroll',
      localExtensionAxis: 'x',
      roles: {
        deck: CLOUDWAY_SCROLL_ROLE_NAMES.deck,
        negativeRoller: CLOUDWAY_SCROLL_ROLE_NAMES.negativeRoller,
        positiveRoller: CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller,
        persistent: ['ScrollFixedGold'],
      },
      rollerEdgeAnchors: {
        negative: [-2, 0, 0],
        positive: [2, 0, 0],
      },
    },
    ...changes,
  }
}

function donor(
  options: { deckYaw?: number; persistent?: boolean } = {},
): DonorFixture {
  const providerTexture = new Texture()
  providerTexture.rotation = 0.61
  const providerMaterial = new MeshStandardMaterial({ map: providerTexture })
  providerMaterial.name = 'gilt-scroll-bridge__provider_full_pbr'
  const source = new Group()
  source.name = 'Cloudway_GiltScrollBridge_Runtime'
  source.userData.collider_json = JSON.stringify({
    shape: 'box',
    width: 4,
    depth: 2,
    height: 0.3,
    topY: 0,
    center: [0, -0.15, 0],
  })
  const adapterMetadata = metadata()
  if (options.persistent === false) {
    const motion = adapterMetadata.motion as {
      roles: { persistent: string[] }
    }
    motion.roles.persistent = []
  }
  source.userData.platform_adapter_json = JSON.stringify(adapterMetadata)

  const carrier = new Group()
  carrier.name = 'AuthoredCarrier'
  source.add(carrier)

  const deck = new Group()
  deck.name = CLOUDWAY_SCROLL_ROLE_NAMES.deck
  const deckMesh = new Mesh(new BoxGeometry(4, 0.2, 2), providerMaterial)
  deckMesh.name = 'ScrollDeckGlass'
  deckMesh.position.y = -0.1
  deckMesh.rotation.y = options.deckYaw ?? 0
  deck.add(deckMesh)
  carrier.add(deck)

  for (const [name, x] of [
    [CLOUDWAY_SCROLL_ROLE_NAMES.negativeRoller, -2],
    [CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller, 2],
  ] as const) {
    const roller = new Group()
    roller.name = name
    roller.position.x = x
    const rollerMesh = new Mesh(
      new BoxGeometry(0.25, 0.3, 2.2),
      providerMaterial,
    )
    rollerMesh.name = `${name}Gold`
    rollerMesh.position.y = -0.15
    roller.add(rollerMesh)
    carrier.add(roller)
  }

  if (options.persistent !== false) {
    const fixed = new Group()
    fixed.name = 'ScrollFixedGold'
    const fixedMesh = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), providerMaterial)
    fixedMesh.name = 'ScrollFixedGoldDetail'
    fixedMesh.position.y = -0.15
    fixed.add(fixedMesh)
    carrier.add(fixed)
  }

  return { providerMaterial, providerTexture, source }
}

function platform(renderQuarterTurns: 0 | 1 = 0): PlatformDefinition {
  const turned = renderQuarterTurns === 1
  return {
    id: `scroll-${renderQuarterTurns}`,
    minX: turned ? 9 : 8,
    maxX: turned ? 11 : 12,
    minZ: turned ? 18 : 19,
    maxZ: turned ? 22 : 21,
    top: 3,
    thickness: 0.3,
    kind: 'bridge',
    material: 'brass',
    renderQuarterTurns,
    behavior: {
      kind: 'scroll',
      axis: turned ? 'z' : 'x',
      minLengthRatio: 0.25,
      extendedSeconds: 4,
      retractedSeconds: 3,
      transitionSeconds: 1.5,
      initialState: 'extended',
    },
  }
}

function snapshot(
  target: PlatformDefinition,
  lengthRatio: number,
): PlatformRuntimeSnapshot {
  return {
    id: target.id,
    offset: { x: 0, y: 0, z: 0 },
    phase: lengthRatio === 1 ? 'extended' : 'retracted',
    phaseProgress: 0,
    collisionEnabled: true,
    lengthRatio,
  }
}

function semanticMaterials() {
  const texture = new Texture()
  texture.rotation = 0.27
  return {
    glass: new MeshPhysicalMaterial({
      map: texture,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.92,
      thickness: 0.055,
    }),
    gold: new MeshPhysicalMaterial({
      metalness: 1,
      roughness: 0.3,
    }),
  }
}

function role(root: Object3D, name: string): Object3D {
  const result = root.getObjectByName(name)
  if (result === undefined) throw new Error(`Missing test role ${name}`)
  return result
}

function firstMesh(root: Object3D): MeshType {
  let result: MeshType | undefined
  root.traverse((object) => {
    if (result === undefined && (object as MeshType).isMesh)
      result = object as MeshType
  })
  if (result === undefined) throw new Error(`Missing mesh below ${root.name}`)
  return result
}

function sourceFingerprint(root: Object3D): readonly unknown[] {
  const result: unknown[] = []
  root.traverse((object) => {
    const mesh = object as MeshType
    const materials = mesh.isMesh
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : []
    result.push({
      name: object.name,
      parent: object.parent?.name,
      position: object.position.toArray(),
      quaternion: object.quaternion.toArray(),
      scale: object.scale.toArray(),
      matrix: object.matrix.toArray(),
      matrixWorld: object.matrixWorld.toArray(),
      geometry: mesh.isMesh ? mesh.geometry.uuid : undefined,
      materials: materials.map((material) => material.uuid),
    })
  })
  return result
}

function disposeFixture(
  fixture: DonorFixture,
  materials?: { glass: MeshPhysicalMaterial; gold: MeshPhysicalMaterial },
): void {
  disposeObject(fixture.source)
  if (materials !== undefined)
    disposeMaterials([materials.glass, materials.gold])
}

describe('Cloudway semantic scroll adapter', () => {
  it('uses authoritative full and minimum extents while rollers translate without stretching', () => {
    const fixture = donor()
    const target = platform()
    const materials = semanticMaterials()
    const adapter = createCloudwayScrollAdapter({
      source: fixture.source,
      platform: target,
      materials,
    })
    const deck = role(adapter.root, CLOUDWAY_SCROLL_ROLE_NAMES.deck)
    const negative = role(
      adapter.root,
      CLOUDWAY_SCROLL_ROLE_NAMES.negativeRoller,
    )
    const positive = role(
      adapter.root,
      CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller,
    )
    const persistent = role(adapter.root, 'ScrollFixedGold')
    const position = new Vector3()
    const scale = new Vector3()

    expect(adapter.root.visible).toBe(false)
    expect(adapter.getLiveBounds().isEmpty()).toBe(true)

    adapter.update(snapshot(target, 1))
    expect(adapter.root.position.toArray()).toEqual([10, 3, 20])
    expect(adapter.root.visible).toBe(true)
    deck.getWorldScale(scale)
    expect(scale.toArray()).toEqual([1, 1, 1])
    negative.getWorldPosition(position)
    expect(position.x).toBeCloseTo(8)
    positive.getWorldPosition(position)
    expect(position.x).toBeCloseTo(12)
    persistent.getWorldPosition(position)
    expect(position.toArray()).toEqual([10, 3, 20])
    const fullSize = adapter.getLiveBounds().getSize(new Vector3())
    expect(fullSize.x).toBeCloseTo(4.25)
    expect(fullSize.y).toBeCloseTo(0.3)
    expect(fullSize.z).toBeCloseTo(2.2)

    adapter.update(snapshot(target, 0.625))
    deck.getWorldScale(scale)
    expect(scale.x).toBeCloseTo(0.625)
    negative.getWorldPosition(position)
    expect(position.x).toBeCloseTo(8.75)
    positive.getWorldPosition(position)
    expect(position.x).toBeCloseTo(11.25)

    adapter.update(snapshot(target, 0.25))
    deck.getWorldScale(scale)
    expect(scale.toArray()).toEqual([0.25, 1, 1])
    negative.getWorldPosition(position)
    expect(position.x).toBeCloseTo(9.5)
    negative.getWorldScale(scale)
    expect(scale.toArray()).toEqual([1, 1, 1])
    positive.getWorldPosition(position)
    expect(position.x).toBeCloseTo(10.5)
    positive.getWorldScale(scale)
    expect(scale.toArray()).toEqual([1, 1, 1])
    persistent.getWorldPosition(position)
    expect(position.toArray()).toEqual([10, 3, 20])
    const minimumSize = adapter.getLiveBounds().getSize(new Vector3())
    expect(minimumSize.x).toBeCloseTo(1.25)
    expect(minimumSize.y).toBeCloseTo(0.3)
    expect(minimumSize.z).toBeCloseTo(2.2)

    const unchanged = negative.matrixWorld.clone()
    adapter.update(snapshot(target, 0.25))
    expect(negative.matrixWorld.equals(unchanged)).toBe(true)
    adapter.update(snapshot(target, 1))
    expect(adapter.getLiveBounds().getSize(new Vector3()).x).toBeCloseTo(4.25)

    expect(firstMesh(deck).material).toBe(materials.glass)
    expect(firstMesh(negative).material).toBe(materials.gold)
    expect(firstMesh(positive).material).toBe(materials.gold)
    expect(firstMesh(persistent).material).toBe(materials.gold)
    expect(fixture.providerMaterial.map).toBe(fixture.providerTexture)

    adapter.dispose()
    disposeFixture(fixture, materials)
  })

  it('maps canonical local X onto world Z after one quarter turn with swapped support dimensions', () => {
    const fixture = donor({ persistent: false })
    const target = platform(1)
    const materials = semanticMaterials()
    const adapter = createCloudwayScrollAdapter({
      source: fixture.source,
      platform: target,
      materials,
    })
    const negative = role(
      adapter.root,
      CLOUDWAY_SCROLL_ROLE_NAMES.negativeRoller,
    )
    const positive = role(
      adapter.root,
      CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller,
    )
    const position = new Vector3()

    adapter.update(snapshot(target, 0.25))
    negative.getWorldPosition(position)
    expect(position.x).toBeCloseTo(10)
    expect(position.z).toBeCloseTo(20.5)
    positive.getWorldPosition(position)
    expect(position.x).toBeCloseTo(10)
    expect(position.z).toBeCloseTo(19.5)
    const size = adapter.getLiveBounds().getSize(new Vector3())
    expect(size.x).toBeCloseTo(2.2)
    expect(size.z).toBeCloseTo(1.25)

    adapter.dispose()
    disposeFixture(fixture, materials)
  })

  it('preserves authored child transforms and geometry while applying cardinal yaw once', () => {
    const fixture = donor({ deckYaw: 0.31, persistent: false })
    const target = platform(1)
    const materials = semanticMaterials()
    const sourceDeck = firstMesh(
      role(fixture.source, CLOUDWAY_SCROLL_ROLE_NAMES.deck),
    )
    const sourcePositions = Array.from(
      sourceDeck.geometry.getAttribute('position').array,
    )
    const adapter = createCloudwayScrollAdapter({
      source: fixture.source,
      platform: target,
      materials,
    })

    adapter.update(snapshot(target, 1))
    const installedDeck = firstMesh(
      role(adapter.root, CLOUDWAY_SCROLL_ROLE_NAMES.deck),
    )
    expect(installedDeck.geometry).not.toBe(sourceDeck.geometry)
    expect(
      Array.from(installedDeck.geometry.getAttribute('position').array),
    ).toEqual(sourcePositions)
    expect(installedDeck.rotation.y).toBeCloseTo(sourceDeck.rotation.y)
    const expected = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
      .multiply(sourceDeck.quaternion)
    const actual = new Quaternion()
    installedDeck.getWorldQuaternion(actual)
    expect(actual.angleTo(expected)).toBeCloseTo(0)

    const installedMaterial = installedDeck.material as MeshPhysicalMaterial
    expect(installedMaterial).toBe(materials.glass)
    expect(installedMaterial.map).not.toBe(fixture.providerTexture)
    expect(installedMaterial.map?.rotation).toBeCloseTo(0.27)
    expect(fixture.providerTexture.rotation).toBeCloseTo(0.61)

    adapter.dispose()
    disposeFixture(fixture, materials)
  })

  it('rejects fused pilots and invalid contact, roles, or geometry without mutating source art', () => {
    const target = platform()
    const materials = semanticMaterials()
    const cases: {
      fixture: DonorFixture
      message: string
      sourceGeometry?: MeshType['geometry']
    }[] = []

    const fused = donor()
    const carrier = fused.source.getObjectByName('AuthoredCarrier')!
    carrier.clear()
    const fusedMesh = new Mesh(
      new BoxGeometry(4, 0.3, 2),
      fused.providerMaterial,
    )
    fusedMesh.name = 'OpaqueFusedPilot'
    carrier.add(fusedMesh)
    cases.push({ fixture: fused, message: CLOUDWAY_SCROLL_ROLE_NAMES.deck })

    const badContact = donor()
    badContact.source.userData.collider_json = JSON.stringify({
      shape: 'box',
      width: 4,
      depth: 2,
      height: 0.3,
      topY: 0.1,
      center: [0, -0.15, 0],
    })
    cases.push({ fixture: badContact, message: 'topY' })

    const missingRole = donor()
    missingRole.source
      .getObjectByName(CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller)!
      .removeFromParent()
    cases.push({
      fixture: missingRole,
      message: CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller,
    })

    const badGeometry = donor()
    const badDeckMesh = firstMesh(
      role(badGeometry.source, CLOUDWAY_SCROLL_ROLE_NAMES.deck),
    )
    badDeckMesh.geometry.getAttribute('position').setX(0, Number.NaN)
    cases.push({
      fixture: badGeometry,
      message: 'finite geometry bounds',
      sourceGeometry: badDeckMesh.geometry,
    })

    for (const item of cases) {
      const before = sourceFingerprint(item.fixture.source)
      expect(() =>
        createCloudwayScrollAdapter({
          source: item.fixture.source,
          platform: target,
          materials,
        }),
      ).toThrow(item.message)
      expect(sourceFingerprint(item.fixture.source)).toEqual(before)
      if (item.sourceGeometry !== undefined)
        expect(item.sourceGeometry.boundingBox).toBeNull()
      disposeFixture(item.fixture)
    }
    disposeMaterials([materials.glass, materials.gold])
  })

  it('requires explicit physical glass and matching world axis and dimensions', () => {
    const fixture = donor()
    const materials = semanticMaterials()
    const opaque = new MeshStandardMaterial()
    expect(() =>
      createCloudwayScrollAdapter({
        source: fixture.source,
        platform: platform(),
        materials: { ...materials, glass: opaque as MeshPhysicalMaterial },
      }),
    ).toThrow('MeshPhysicalMaterial')
    expect(() =>
      createCloudwayScrollAdapter({
        source: fixture.source,
        platform: {
          ...platform(1),
          behavior: { ...platform(1).behavior!, axis: 'x' },
        } as PlatformDefinition,
        materials,
      }),
    ).toThrow('world axis')
    expect(() =>
      createCloudwayScrollAdapter({
        source: fixture.source,
        platform: { ...platform(), maxX: 11.5 },
        materials,
      }),
    ).toThrow('support dimensions')

    opaque.dispose()
    disposeFixture(fixture, materials)
  })

  it('owns cloned geometry while borrowing semantic materials and source resources', () => {
    const fixture = donor({ persistent: false })
    const target = platform()
    const materials = semanticMaterials()
    const sourceDeck = firstMesh(
      role(fixture.source, CLOUDWAY_SCROLL_ROLE_NAMES.deck),
    )
    const sourceDispose = vi.spyOn(sourceDeck.geometry, 'dispose')
    const glassDispose = vi.spyOn(materials.glass, 'dispose')
    const goldDispose = vi.spyOn(materials.gold, 'dispose')
    const adapter = createCloudwayScrollAdapter({
      source: fixture.source,
      platform: target,
      materials,
    })
    adapter.update(snapshot(target, 1))
    const ownedGeometries: MeshType['geometry'][] = []
    adapter.root.traverse((object) => {
      const mesh = object as MeshType
      if (mesh.isMesh) ownedGeometries.push(mesh.geometry)
    })
    const ownedDisposals = ownedGeometries.map((geometry) =>
      vi.spyOn(geometry, 'dispose'),
    )
    const parent = new Group()
    parent.add(adapter.root)

    adapter.dispose()
    adapter.dispose()

    ownedDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce())
    expect(sourceDispose).not.toHaveBeenCalled()
    expect(glassDispose).not.toHaveBeenCalled()
    expect(goldDispose).not.toHaveBeenCalled()
    expect(adapter.root.parent).toBeNull()

    disposeFixture(fixture, materials)
  })
})
