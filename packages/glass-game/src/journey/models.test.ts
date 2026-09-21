// Journey model tests — partial loads retire resources and bridge transforms meet endpoints.

import type { MeshStandardMaterial } from 'three'
import { AnimationClip, BoxGeometry, BufferGeometry, Group, Material, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Texture, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { journeyBridgeTransform, loadJourneyMapModels } from './models'
import type { JourneyGltfDocument } from './resources'

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
    const models = await loadJourneyMapModels(
      FLOATING_MUSEUM_JOURNEY,
      '/map.glb',
      '/merc.glb',
      new AbortController().signal,
      {
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
        loadMarbleTextures: vi.fn().mockResolvedValue(marbleTextures),
      },
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

  it('maps the final bridge dimensions onto both authored endpoints', () => {
    for (const bridge of FLOATING_MUSEUM_JOURNEY.bridges) {
      const transform = journeyBridgeTransform(bridge)
      const matrix = new Matrix4().compose(
        transform.position,
        transform.rotation,
        transform.scale,
      )
      const localHalfLength = 3.323364 / 2
      const start = new Vector3(0, 0, -localHalfLength).applyMatrix4(matrix)
      const end = new Vector3(0, 0, localHalfLength).applyMatrix4(matrix)
      expect(start.toArray()).toEqual(
        bridge.from.map((value) => expect.closeTo(value, 6)),
      )
      expect(end.toArray()).toEqual(
        bridge.to.map((value) => expect.closeTo(value, 6)),
      )
    }
  })
})
