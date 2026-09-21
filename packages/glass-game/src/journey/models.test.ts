// Journey model tests — partial loads retire resources and bridge transforms meet endpoints.

import { AnimationClip, BufferGeometry, Group, Material, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { journeyBridgeTransform, loadJourneyMapModels } from './models'
import type { JourneyGltfDocument } from './resources'

function createKitScene(includePortraitInset = true): Group {
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
    scene.add(node)
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
