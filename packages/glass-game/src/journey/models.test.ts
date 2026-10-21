// Journey model tests — partial loads retire resources.

import { AnimationClip, BoxGeometry, BufferGeometry, Group, Int16BufferAttribute, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Texture, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { loadJourneyMapModels } from './models'
import type { JourneyGltfDocument } from './resources'
import { loadJourneyGltf } from './resources'

function createKitScene(
  includePortraitInset = true,
  includePlatformFinish = false,
): Group {
  const scene = new Group()
  for (const name of [
    'map_canopy',
    'map_column',
    'map_planter',
    'map_frame',
    'map_platform',
    'map_bridge',
    'map_island_root',
  ]) {
    const node = new Group()
    node.name = name
    if (name === 'map_frame' && includePortraitInset) {
      const material = new MeshBasicMaterial()
      material.name = 'map_frame_atlas_00'
      node.add(new Mesh(new PlaneGeometry(0.79, 1.5), material))
    }
    if (name === 'map_platform' && includePlatformFinish) {
      const marble = new MeshBasicMaterial()
      marble.name = 'map_ivory_marble'
      const gold = new MeshBasicMaterial()
      gold.name = 'map_champagne_gold'
      const finish = new Mesh(new BoxGeometry(1, 0.1, 1), [marble, gold])
      finish.name = 'platform-finish-fixture'
      node.add(finish)
    }
    scene.add(node)
  }
  return scene
}

function createArchitectureScene(includeConservatory = true): Group {
  const scene = new Group()
  const connector = new Group()
  connector.name = 'map_twin_connector'
  scene.add(connector)
  if (includeConservatory) {
    const conservatory = new Group()
    conservatory.name = 'map_conservatory'
    scene.add(conservatory)
  }
  return scene
}

describe('journey map model loading', () => {
  it.each([true, false])(
    'preserves donor ownership and decoded garden placement, marked=%s',
    async (marked) => {
      const kitScene = createKitScene()
      const apron = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
      apron.name = 'map_platform_mesh_4'
      const trim = new Group()
      trim.name = 'preserved-terrace-trim'
      kitScene.getObjectByName('map_platform')!.add(apron, trim)
      const bitmap = { width: 8, height: 8, close: vi.fn() }
      const texture = new Texture(bitmap)
      const materials = [
        new MeshBasicMaterial({ map: texture, alphaTest: 0.5 }),
        new MeshBasicMaterial({ map: texture, alphaTest: 0.5 }),
      ]
      const geometry = new BufferGeometry()
      // Quantized positions retain a child decode transform beneath each
      // identity donor root. Removing that child transform moves the plants.
      geometry.setAttribute(
        'position',
        new Int16BufferAttribute(
          [32767, 0, -32767, 0, 32767, 0, -32767, 0, 32767],
          3,
          true,
        ),
      )
      const sculptureScene = new Group()
      for (const name of [
        'map_temple_amber',
        'map_temple_teal',
        'map_cliff',
        'map_cypress',
        'map_flower_cluster',
      ]) {
        const unit = new Group()
        unit.name = name
        if (name === 'map_cliff' && marked) unit.userData.museumEdgeVersion = 3
        sculptureScene.add(unit)
      }
      const foliageNames = [
        'map_foliage_first_light',
        'map_foliage_twin_galleries',
        'map_foliage_resonance_conservatory',
      ]
      for (const name of foliageNames) {
        const unit = new Group()
        unit.name = name
        const decode = new Group()
        decode.name = 'quantized-position-decode'
        decode.position.set(0.19, -0.37, 0.11)
        decode.scale.set(0.7, 1.4, 0.6)
        for (const material of materials)
          decode.add(new Mesh(geometry, material))
        unit.add(decode)
        sculptureScene.add(unit)
      }
      const snapshot = (scene: Group) => {
        const objects: unknown[] = []
        scene.traverse((object) => {
          objects.push({
            id: object.uuid,
            name: object.name,
            parent: object.parent?.uuid,
            children: object.children.map((child) => child.uuid),
            position: object.position.toArray(),
            quaternion: object.quaternion.toArray(),
            scale: object.scale.toArray(),
            userData: { ...object.userData },
            geometry: (object as Mesh).geometry,
            material: (object as Mesh).material,
            castShadow: object.castShadow,
            receiveShadow: object.receiveShadow,
          })
        })
        return objects
      }
      const before = [snapshot(kitScene), snapshot(sculptureScene)]
      const originalPositions = Array.from(geometry.attributes.position!.array)
      const disposeTexture = vi.spyOn(texture, 'dispose')
      const resourceDisposals = [
        geometry,
        ...materials,
        apron.geometry,
        apron.material,
      ].map((resource) => vi.spyOn(resource, 'dispose'))
      resourceDisposals.push(disposeTexture)
      const mercScene = new Group()
      mercScene.add(new Mesh(new PlaneGeometry(), new MeshBasicMaterial()))
      const signal = new AbortController().signal
      const documents = await Promise.all(
        [kitScene, mercScene, sculptureScene].map((scene) =>
          loadJourneyGltf('/fixture.gltf', signal, {
            fetch: vi.fn().mockResolvedValue(new Response('{}')),
            parse: async () => ({ scene, animations: [] }),
          }),
        ),
      )
      const documentDisposals = documents.map((document) =>
        vi.spyOn(document, 'dispose'),
      )
      const models = await loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        signal,
        {
          sculptureUrl: '/sculpture.glb',
          loadGltf: vi
            .fn()
            .mockResolvedValueOnce(documents[0])
            .mockResolvedValueOnce(documents[1])
            .mockResolvedValueOnce(documents[2]),
        },
      )
      try {
        for (const [
          index,
          island,
        ] of FLOATING_MUSEUM_JOURNEY.landmasses.entries()) {
          const cliff = models.root.getObjectByName(
            `${island.id}-sculpted-cliff`,
          )!
          expect(
            cliff.children
              .filter((child) => foliageNames.includes(child.name))
              .map((child) => child.name),
          ).toEqual(marked ? [foliageNames[index]] : [])
          const terrace = models.root.getObjectByName(
            `${island.id}-ivory-terrace`,
          )!
          expect(terrace.getObjectByName(trim.name)).toBeDefined()
          expect(terrace.getObjectByName(apron.name) !== undefined).toBe(
            !marked,
          )
          expect(cliff.scale.y).toBeCloseTo(
            island.scale[1] * (marked ? 1.65 : 2.25),
          )
          if (!marked) continue
          const source = sculptureScene.getObjectByName(foliageNames[index]!)!
          const attached = cliff.getObjectByName(foliageNames[index]!)!
          expect(attached).not.toBe(source)
          const decode = attached.getObjectByName('quantized-position-decode')!
          const mesh = decode.children[0] as Mesh
          expect(mesh.geometry).toBe(geometry)
          expect(mesh.material).toBe(materials[0])
          const actual = mesh.localToWorld(new Vector3(1, 0, -1))
          const expected = new Vector3(
            (0.89 * island.scale[0] * 2.621731) / 4.5,
            -0.37 * island.scale[1] * 1.65,
            (-0.49 * island.scale[2] * 2.602302) / 2.464056,
          )
            .applyAxisAngle(new Vector3(0, 1, 0), island.yaw)
            .add(new Vector3(...island.position))
          expect(actual.distanceTo(expected)).toBeLessThan(1e-10)
        }
        expect(
          models.root.getObjectByName('museum-hanging-ivy') !== undefined,
        ).toBe(!marked)
        expect([snapshot(kitScene), snapshot(sculptureScene)]).toEqual(before)
        expect(Array.from(geometry.attributes.position!.array)).toEqual(
          originalPositions,
        )
        for (const dispose of resourceDisposals)
          expect(dispose).not.toHaveBeenCalled()
        expect(bitmap.close).not.toHaveBeenCalled()
      } finally {
        models.dispose()
        models.dispose()
      }
      for (const dispose of [...documentDisposals, ...resourceDisposals])
        expect(dispose).toHaveBeenCalledOnce()
      expect(bitmap.close).toHaveBeenCalledOnce()
      expect(bitmap.close.mock.invocationCallOrder[0]).toBeGreaterThan(
        disposeTexture.mock.invocationCallOrder[0]!,
      )
    },
  )

  it.each([
    {
      assetProfile: 'mobile' as const,
      maximumConcurrentBundleLoads: 1 as const,
    },
    { assetProfile: 'full' as const, maximumConcurrentBundleLoads: 2 as const },
  ])(
    'bounds $assetProfile GLB preparation and profiles every document',
    async (policy) => {
      const documents = Array.from({ length: 3 }, () => ({
        scene: new Group(),
        animations: [],
        dispose: vi.fn(),
      }))
      const failure = new Error('architecture unavailable')
      const finishLoads: (() => void)[] = []
      let active = 0
      let peak = 0
      const loadGltf = vi.fn(() => {
        const index = loadGltf.mock.calls.length - 1
        active++
        peak = Math.max(peak, active)
        return new Promise<JourneyGltfDocument>((resolve, reject) => {
          finishLoads.push(() => {
            if (index === 3) reject(failure)
            else resolve(documents[index]!)
          })
        }).finally(() => {
          active--
        })
      })
      const signal = new AbortController().signal
      const pending = loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        signal,
        {
          ...policy,
          loadGltf,
          sculptureUrl: '/sculpture.glb',
          architectureUrl: '/architecture.glb',
        },
      ).catch((error: unknown) => error)

      await vi.waitFor(() => expect(loadGltf).toHaveBeenCalled())
      const initiallyStarted = loadGltf.mock.calls.length
      for (let index = 0; index < 4; index++) {
        await vi.waitFor(() => expect(finishLoads.length).toBeGreaterThan(0))
        finishLoads.shift()!()
      }
      expect(await pending).toBe(failure)
      expect(initiallyStarted).toBe(policy.maximumConcurrentBundleLoads)
      expect(peak).toBe(policy.maximumConcurrentBundleLoads)
      for (const url of [
        '/map.glb',
        '/merc.glb',
        '/sculpture.glb',
        '/architecture.glb',
      ])
        expect(loadGltf).toHaveBeenCalledWith(url, signal, {
          assetProfile: policy.assetProfile,
        })
      for (const document of documents)
        expect(document.dispose).toHaveBeenCalledOnce()
    },
  )

  it('does not decode queued GLBs after cancellation and retires the active document', async () => {
    const document = { scene: new Group(), animations: [], dispose: vi.fn() }
    let finishMap!: (document: JourneyGltfDocument) => void
    const loadGltf = vi.fn((url: string) =>
      url === '/map.glb'
        ? new Promise<JourneyGltfDocument>((resolve) => {
            finishMap = resolve
          })
        : Promise.resolve({
            scene: new Group(),
            animations: [],
            dispose: vi.fn(),
          }),
    )
    const controller = new AbortController()
    const pending = loadJourneyMapModels(
      FLOATING_MUSEUM_JOURNEY,
      '/map.glb',
      '/merc.glb',
      controller.signal,
      {
        loadGltf,
        assetProfile: 'mobile',
        maximumConcurrentBundleLoads: 1,
        sculptureUrl: '/sculpture.glb',
        architectureUrl: '/architecture.glb',
      },
    ).catch((error: unknown) => error)

    await vi.waitFor(() => expect(loadGltf).toHaveBeenCalled())
    controller.abort()
    finishMap(document)
    expect(await pending).toMatchObject({ name: 'AbortError' })
    expect(loadGltf).toHaveBeenCalledExactlyOnceWith(
      '/map.glb',
      controller.signal,
      { assetProfile: 'mobile' },
    )
    expect(document.dispose).toHaveBeenCalledOnce()
  })

  it('retires assembled scenery when mascot normalization fails', async () => {
    const kitScene = createKitScene()
    const kit = { scene: kitScene, animations: [], dispose: vi.fn() }
    const merc = { scene: new Group(), animations: [], dispose: vi.fn() }
    const failure = new Error('invalid mascot bounds')
    vi.spyOn(merc.scene, 'updateWorldMatrix').mockImplementation(() => {
      throw failure
    })
    const disposeGeometry = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const disposeMaterial = vi.spyOn(Material.prototype, 'dispose')
    try {
      await expect(
        loadJourneyMapModels(
          FLOATING_MUSEUM_JOURNEY,
          '/map.glb',
          '/merc.glb',
          new AbortController().signal,
          {
            loadGltf: vi
              .fn()
              .mockResolvedValueOnce(kit)
              .mockResolvedValueOnce(merc),
          },
        ),
      ).rejects.toBe(failure)
      expect(kit.dispose).toHaveBeenCalledOnce()
      expect(merc.dispose).toHaveBeenCalledOnce()
      expect(disposeGeometry).toHaveBeenCalled()
      expect(disposeMaterial).toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('rejects a missing portrait inset before assembly resources are allocated', async () => {
    const kit = {
      scene: createKitScene(false),
      animations: [],
      dispose: vi.fn(),
    }
    const merc = { scene: new Group(), animations: [], dispose: vi.fn() }
    const updateWorldMatrix = vi.spyOn(merc.scene, 'updateWorldMatrix')
    const disposeGeometry = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const disposeMaterial = vi.spyOn(Material.prototype, 'dispose')
    try {
      await expect(
        loadJourneyMapModels(
          FLOATING_MUSEUM_JOURNEY,
          '/map.glb',
          '/merc.glb',
          new AbortController().signal,
          {
            loadGltf: vi
              .fn()
              .mockResolvedValueOnce(kit)
              .mockResolvedValueOnce(merc),
          },
        ),
      ).rejects.toThrow(
        'Journey map_frame must contain exactly one portrait inset using material map_frame_atlas_00; found 0.',
      )
      expect(updateWorldMatrix).not.toHaveBeenCalled()
      expect(disposeGeometry).not.toHaveBeenCalled()
      expect(disposeMaterial).not.toHaveBeenCalled()
      expect(kit.dispose).toHaveBeenCalledOnce()
      expect(merc.dispose).toHaveBeenCalledOnce()
    } finally {
      vi.restoreAllMocks()
    }
  })

  it.each([
    'map_foliage_first_light',
    'map_foliage_twin_galleries',
    'map_foliage_resonance_conservatory',
  ])(
    'rejects a garden kit missing %s before allocating assembly materials',
    async (missingRoot) => {
      const kit = { scene: createKitScene(), animations: [], dispose: vi.fn() }
      const merc = { scene: new Group(), animations: [], dispose: vi.fn() }
      const sculptureScene = new Group()
      for (const name of [
        'map_temple_amber',
        'map_temple_teal',
        'map_cliff',
        'map_cypress',
        'map_flower_cluster',
        'map_foliage_first_light',
        'map_foliage_twin_galleries',
        'map_foliage_resonance_conservatory',
      ]) {
        if (name === missingRoot) continue
        const node = new Group()
        node.name = name
        if (name === 'map_cliff') node.userData.museumEdgeVersion = 3
        sculptureScene.add(node)
      }
      const sculpture = {
        scene: sculptureScene,
        animations: [],
        dispose: vi.fn(),
      }
      const allocateMaterial = vi.spyOn(
        MeshStandardMaterial.prototype,
        'setValues',
      )
      const updateMascot = vi.spyOn(merc.scene, 'updateWorldMatrix')
      try {
        await expect(
          loadJourneyMapModels(
            FLOATING_MUSEUM_JOURNEY,
            '/map.glb',
            '/merc.glb',
            new AbortController().signal,
            {
              sculptureUrl: '/sculpture.glb',
              loadGltf: vi
                .fn()
                .mockResolvedValueOnce(kit)
                .mockResolvedValueOnce(merc)
                .mockResolvedValueOnce(sculpture),
            },
          ),
        ).rejects.toThrow(`Journey map kit is missing ${missingRoot}.`)
        expect(allocateMaterial).not.toHaveBeenCalled()
        expect(updateMascot).not.toHaveBeenCalled()
        for (const document of [kit, merc, sculpture])
          expect(document.dispose).toHaveBeenCalledOnce()
      } finally {
        vi.restoreAllMocks()
      }
    },
  )

  it('disposes a successful sibling document when the other load fails', async () => {
    const dispose = vi.fn()
    const document: JourneyGltfDocument = {
      scene: new Group(),
      animations: [new AnimationClip('idle', 1)],
      dispose,
    }
    const failure = new Error('merc unavailable')
    const loadGltf = vi
      .fn()
      .mockResolvedValueOnce(document)
      .mockRejectedValueOnce(failure)

    await expect(
      loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        new AbortController().signal,
        { loadGltf },
      ),
    ).rejects.toBe(failure)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('retires both base documents when the supplemental sculpture fails', async () => {
    const mapDispose = vi.fn()
    const mercDispose = vi.fn()
    const mapDocument: JourneyGltfDocument = {
      scene: new Group(),
      animations: [],
      dispose: mapDispose,
    }
    const mercDocument: JourneyGltfDocument = {
      scene: new Group(),
      animations: [new AnimationClip('idle', 1)],
      dispose: mercDispose,
    }
    const failure = new Error('sculpture unavailable')
    const loadGltf = vi
      .fn()
      .mockResolvedValueOnce(mapDocument)
      .mockResolvedValueOnce(mercDocument)
      .mockRejectedValueOnce(failure)

    await expect(
      loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        new AbortController().signal,
        { loadGltf, sculptureUrl: '/sculpture.glb' },
      ),
    ).rejects.toBe(failure)
    expect(mapDispose).toHaveBeenCalledOnce()
    expect(mercDispose).toHaveBeenCalledOnce()
  })

  it('retires every loaded model when the architecture polish kit fails', async () => {
    const map = { scene: new Group(), animations: [], dispose: vi.fn() }
    const merc = { scene: new Group(), animations: [], dispose: vi.fn() }
    const sculpture = { scene: new Group(), animations: [], dispose: vi.fn() }
    const failure = new Error('architecture unavailable')
    const loadGltf = vi
      .fn()
      .mockResolvedValueOnce(map)
      .mockResolvedValueOnce(merc)
      .mockResolvedValueOnce(sculpture)
      .mockRejectedValueOnce(failure)

    await expect(
      loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        new AbortController().signal,
        {
          loadGltf,
          sculptureUrl: '/sculpture.glb',
          architectureUrl: '/architecture.glb',
        },
      ),
    ).rejects.toBe(failure)
    expect(map.dispose).toHaveBeenCalledOnce()
    expect(merc.dispose).toHaveBeenCalledOnce()
    expect(sculpture.dispose).toHaveBeenCalledOnce()
  })

  it('validates polish nodes before allocating assembly resources', async () => {
    const map = {
      scene: createKitScene(),
      animations: [],
      dispose: vi.fn(),
    }
    const merc = { scene: new Group(), animations: [], dispose: vi.fn() }
    const architecture = {
      scene: createArchitectureScene(false),
      animations: [],
      dispose: vi.fn(),
    }

    await expect(
      loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        new AbortController().signal,
        {
          loadGltf: vi
            .fn()
            .mockResolvedValueOnce(map)
            .mockResolvedValueOnce(merc)
            .mockResolvedValueOnce(architecture),
          architectureUrl: '/architecture.glb',
        },
      ),
    ).rejects.toThrow('Journey map kit is missing map_conservatory.')
    expect(map.dispose).toHaveBeenCalledOnce()
    expect(merc.dispose).toHaveBeenCalledOnce()
    expect(architecture.dispose).toHaveBeenCalledOnce()
  })

  it('retires decoded mystery art when a sibling model fails', async () => {
    const bitmap = { close: vi.fn() }
    const texture = new Texture(bitmap)
    const dispose = vi.spyOn(texture, 'dispose')
    const kit = { scene: new Group(), animations: [], dispose: vi.fn() }
    const failure = new Error('merc unavailable')
    await expect(
      loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        new AbortController().signal,
        {
          loadGltf: vi
            .fn()
            .mockResolvedValueOnce(kit)
            .mockRejectedValueOnce(failure),
          mysteryPortraitUrl: '/mystery.webp',
          loadTexture: vi.fn().mockResolvedValue(texture),
        },
      ),
    ).rejects.toBe(failure)
    expect(kit.dispose).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('does not reveal a half-loaded museum when mystery artwork fails', async () => {
    const kit = { scene: new Group(), animations: [], dispose: vi.fn() }
    const merc = { scene: new Group(), animations: [], dispose: vi.fn() }
    const failure = new Error('portrait unavailable')
    await expect(
      loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        new AbortController().signal,
        {
          loadGltf: vi
            .fn()
            .mockResolvedValueOnce(kit)
            .mockResolvedValueOnce(merc),
          mysteryPortraitUrl: '/mystery.webp',
          loadTexture: vi.fn().mockRejectedValue(failure),
        },
      ),
    ).rejects.toBe(failure)
    expect(kit.dispose).toHaveBeenCalledOnce()
    expect(merc.dispose).toHaveBeenCalledOnce()
  })

  it('shares one correctly oriented mystery texture and retires it once', async () => {
    const bitmap = { close: vi.fn(), width: 768, height: 1152 }
    const texture = new Texture(bitmap)
    const disposeTexture = vi.spyOn(texture, 'dispose')
    const kit = { scene: createKitScene(), animations: [], dispose: vi.fn() }
    const mercScene = new Group()
    mercScene.add(new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial()))
    const merc = { scene: mercScene, animations: [], dispose: vi.fn() }
    const models = await loadJourneyMapModels(
      FLOATING_MUSEUM_JOURNEY,
      '/map.glb',
      '/merc.glb',
      new AbortController().signal,
      {
        loadGltf: vi
          .fn()
          .mockResolvedValueOnce(kit)
          .mockResolvedValueOnce(merc),
        mysteryPortraitUrl: '/mystery.webp',
        loadTexture: vi.fn().mockResolvedValue(texture),
      },
    )
    for (const object of models.portraitMysteries.values()) {
      const mystery = object as Mesh<BufferGeometry, MeshBasicMaterial>
      expect(mystery.material.map).toBe(texture)
      expect(mystery.visible).toBe(true)
    }
    expect(texture.repeat.toArray()).toEqual([-1, -1])
    expect(texture.offset.toArray()).toEqual([1, 1])
    models.dispose()
    models.dispose()
    expect(disposeTexture).toHaveBeenCalledOnce()
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(kit.dispose).toHaveBeenCalledOnce()
    expect(merc.dispose).toHaveBeenCalledOnce()
  })

  it('installs the polish kit and Carrara maps, then retires each owner once', async () => {
    const kit = {
      scene: createKitScene(true, true),
      animations: [],
      dispose: vi.fn(),
    }
    const mercScene = new Group()
    mercScene.add(new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial()))
    const merc = { scene: mercScene, animations: [], dispose: vi.fn() }
    const architecture = {
      scene: createArchitectureScene(),
      animations: [],
      dispose: vi.fn(),
    }
    const marbleTextures = {
      map: new Texture(),
      normalMap: new Texture(),
      roughnessMap: new Texture(),
      dispose: vi.fn(),
    }
    const loadMarbleTextures = vi.fn().mockResolvedValue(marbleTextures)
    const loadTexture = vi.fn().mockResolvedValue(new Texture())
    const models = await loadJourneyMapModels(
      FLOATING_MUSEUM_JOURNEY,
      '/map.glb',
      '/merc.glb',
      new AbortController().signal,
      {
        assetProfile: 'mobile',
        loadGltf: vi
          .fn()
          .mockResolvedValueOnce(kit)
          .mockResolvedValueOnce(merc)
          .mockResolvedValueOnce(architecture),
        architectureUrl: '/architecture.glb',
        marbleTextureUrls: {
          basecolor: '/base.webp',
          normal: '/normal.webp',
          roughness: '/roughness.webp',
        },
        loadMarbleTextures,
        mysteryPortraitUrl: '/mystery.webp',
        loadTexture,
      },
    )

    expect(loadMarbleTextures).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(AbortSignal),
      undefined,
      { assetProfile: 'mobile' },
    )
    expect(loadTexture).toHaveBeenCalledWith(
      '/mystery.webp',
      expect.any(AbortSignal),
      { assetProfile: 'mobile' },
    )

    const finish = models.root.getObjectByName(
      'platform-finish-fixture',
    ) as Mesh<BufferGeometry, Material[]>
    const ivory = finish.material[0] as MeshStandardMaterial
    expect(ivory.map).toBe(marbleTextures.map)
    expect(ivory.normalMap).toBe(marbleTextures.normalMap)
    expect(ivory.roughnessMap).toBe(marbleTextures.roughnessMap)
    expect(models.root.getObjectByName('map_twin_connector')).toBeDefined()
    expect(models.root.getObjectByName('map_conservatory')).toBeDefined()

    models.dispose()
    models.dispose()
    expect(kit.dispose).toHaveBeenCalledOnce()
    expect(merc.dispose).toHaveBeenCalledOnce()
    expect(architecture.dispose).toHaveBeenCalledOnce()
    expect(marbleTextures.dispose).toHaveBeenCalledOnce()
  })
})
