// Pearl court tests — joined presentation stays bounded while donor attributes and collision remain unchanged.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Mesh as MeshType } from 'three'
import { BoxGeometry, BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3, } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it, vi } from 'vitest'
import type { PlatformDefinition } from '../contracts'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS } from './cloudway-laboratory-catalog'
import { fitCloudwayLaboratoryRigidPresentation } from './cloudway-laboratory-platforms'
import { clipPearlCourtGeometry, createPearlCourtBatches, PEARL_COURT_EDGES, pearlCourtJoinMask, } from './cloudway-pearl-court'
import * as pearlSurface from './cloudway-pearl-surface'
import { disposeObject } from './dispose'
import * as rigidBatch from './rigid-platform-batch'
import { updateRigidPlatformBatch } from './rigid-platform-batch'

const contact = { width: 3.2, depth: 0.72 }

function platform(
  id: string,
  x = 0,
  z = 0,
  turns: 0 | 1 | 2 | 3 = 0,
): PlatformDefinition {
  const width = turns % 2 === 0 ? contact.width : contact.depth
  const depth = turns % 2 === 0 ? contact.depth : contact.width
  return {
    id,
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    top: 0,
    thickness: 0.34,
    kind: 'deck',
    material: 'stone',
    renderQuarterTurns: turns,
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
  }
}

describe('Pearl continuous court presentation', () => {
  it('only joins full coplanar permanently static contacts in donor-local orientation', () => {
    const centre = platform('centre')
    const neighbors = [
      centre,
      platform('left', -3.2),
      platform('right', 3.2),
      platform('front', 0, -0.72),
      platform('back', 0, 0.72),
    ]
    expect(pearlCourtJoinMask(centre, neighbors, contact)).toBe(15)
    for (const turns of [0, 1, 2, 3] as const) {
      const rotated = platform('rotated', 0, 0, turns)
      const angle = (turns * Math.PI) / 2
      expect(
        pearlCourtJoinMask(
          rotated,
          [
            rotated,
            platform(
              'neighbor',
              Math.cos(angle) * 3.2,
              -Math.sin(angle) * 3.2,
              turns,
            ),
          ],
          contact,
        ),
      ).toBe(PEARL_COURT_EDGES.positiveX)
      expect(
        pearlCourtJoinMask(
          rotated,
          [
            rotated,
            platform(
              'neighbor',
              Math.sin(angle) * 0.72,
              Math.cos(angle) * 0.72,
              turns,
            ),
          ],
          contact,
        ),
      ).toBe(PEARL_COURT_EDGES.positiveZ)
    }
    for (const changed of [
      { top: 0.001 },
      { unlockAfter: 'later' },
      { activation: { allCompleted: ['later'] } },
      { minX: -1.5 },
      { renderQuarterTurns: 1 },
      { minZ: 0.361 },
      {
        behavior: {
          kind: 'glide',
          translation: { x: 1, y: 0, z: 0 },
          travelSeconds: 1,
          dwellSeconds: 1,
        },
      },
      { supportPolygon: [{ x: 0, z: 0 }] },
      { parentPlatformId: 'compound' },
    ]) {
      const other = {
        ...platform('other', 0, 0.72),
        ...changed,
      } as PlatformDefinition
      expect(
        pearlCourtJoinMask(centre, [centre, other], contact),
        JSON.stringify(changed),
      ).toBe(0)
    }
  })

  it('shares unchanged attributes, interpolates cut UVs and retains the exterior endcap', () => {
    const geometry = new BoxGeometry(3.4, 0.34, 0.9)
    const donor = new Mesh(geometry, new MeshStandardMaterial())
    donor.updateMatrixWorld(true)
    const sourcePosition = geometry.getAttribute('position').array.slice()
    const parts = clipPearlCourtGeometry(
      donor,
      PEARL_COURT_EDGES.positiveZ,
      contact,
    )
    expect(parts).toHaveLength(2)
    expect(parts[0]!.getAttribute('position')).toBe(
      geometry.getAttribute('position'),
    )
    const point = new Vector3()
    let max = -Infinity,
      min = Infinity,
      cutVertices = 0
    for (const part of parts) {
      const position = part.getAttribute('position'),
        uv = part.getAttribute('uv')
      const indices =
        part.index === null
          ? Array.from({ length: position.count }, (_, index) => index)
          : Array.from(part.index.array)
      for (const index of indices) {
        point.fromBufferAttribute(position, index)
        max = Math.max(max, point.z)
        min = Math.min(min, point.z)
        expect(uv.getX(index)).toBeGreaterThanOrEqual(0)
        expect(uv.getX(index)).toBeLessThanOrEqual(1)
        expect(uv.getY(index)).toBeGreaterThanOrEqual(0)
        expect(uv.getY(index)).toBeLessThanOrEqual(1)
        if (Math.abs(point.z - 0.36) < 1e-6) cutVertices++
      }
    }
    expect(max).toBeCloseTo(0.36, 6)
    expect(min).toBeCloseTo(-0.45, 6)
    expect(cutVertices).toBeGreaterThan(0)
    expect(geometry.getAttribute('position').array).toEqual(sourcePosition)
    parts.forEach((part) => part.dispose())
    donor.geometry.dispose()
    donor.material.dispose()
  })

  it('batches matching variants and keeps culling, active state and contact definitions intact', () => {
    const donor = new Mesh(
      new BoxGeometry(3.4, 0.34, 0.9),
      new MeshStandardMaterial(),
    )
    donor.name = 'pearl'
    donor.updateMatrixWorld(true)
    const platforms = [
      platform('a'),
      platform('b', 0, 0.72),
      platform('c', 0, 1.44),
      platform('d', 5, 0),
    ]
    const before = JSON.stringify(platforms)
    const placements = platforms.map((item) => ({
      platform: item,
      placement: new Matrix4().makeTranslation(
        (item.minX + item.maxX) / 2,
        item.top,
        (item.minZ + item.maxZ) / 2,
      ),
    }))
    const batches = createPearlCourtBatches(donor, placements, contact)
    expect(batches).toHaveLength(4)
    expect(
      new Set(
        batches.map((batch) => batch.mesh.geometry.getAttribute('position')),
      ).size,
    ).toBe(1)
    for (const batch of batches) {
      updateRigidPlatformBatch(
        batch,
        true,
        new Set(platforms.map((item) => item.id)),
        new Map(),
        (box) => box.max.x < 4,
      )
      expect(
        batch.instances.every((instance) =>
          platforms.includes(instance.platform),
        ),
      ).toBe(true)
    }
    expect(batches.reduce((count, batch) => count + batch.mesh.count, 0)).toBe(
      3,
    )
    for (const batch of batches) {
      updateRigidPlatformBatch(batch, true, new Set(['d']), new Map())
      expect(batch.mesh.count).toBe(
        batch.instances.some((item) => item.platform.id === 'd') ? 1 : 0,
      )
      batch.mesh.dispose()
      batch.mesh.geometry.dispose()
    }
    expect(JSON.stringify(platforms)).toBe(before)
    donor.geometry.dispose()
    donor.material.dispose()
  })

  it('releases every owned variant if creating a later instance batch fails', () => {
    const donor = new Mesh(
      new BoxGeometry(3.4, 0.34, 0.9),
      new MeshStandardMaterial(),
    )
    donor.updateMatrixWorld(true)
    const sourceDispose = vi.fn()
    donor.geometry.addEventListener('dispose', sourceDispose)
    const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const original = rigidBatch.createRigidPlatformBatch
    let calls = 0
    const create = vi
      .spyOn(rigidBatch, 'createRigidPlatformBatch')
      .mockImplementation((...args) => {
        if (++calls === 2) throw new Error('fixture later batch failure')
        return original(...args)
      })
    const platforms = [platform('a'), platform('b', 0, 0.72)]
    expect(() =>
      createPearlCourtBatches(
        donor,
        platforms.map((item) => ({ platform: item, placement: new Matrix4() })),
        contact,
      ),
    ).toThrow('fixture later batch failure')
    expect(sourceDispose).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledTimes(6)
    create.mockRestore()
    dispose.mockRestore()
    donor.geometry.dispose()
    donor.material.dispose()
  })

  it('releases completed shell and marble batches after a later failure without taking source ownership', () => {
    const donorMap = new Texture()
    const surfaceMaps = [new Texture(), new Texture(), new Texture()]
    const donor = new Mesh(
      new BoxGeometry(3.4, 0.34, 0.9),
      new MeshStandardMaterial({ map: donorMap }),
    )
    const surfaceMaterial = new MeshStandardMaterial({
      map: surfaceMaps[0],
      normalMap: surfaceMaps[1],
      roughnessMap: surfaceMaps[2],
    })
    donor.updateMatrixWorld(true)
    const sourceAttributes = Object.entries(donor.geometry.attributes).map(
      ([name, attribute]) => ({
        name,
        attribute,
        values: attribute.array.slice(),
      }),
    )
    const sourceIndex = donor.geometry.index!
    const sourceIndices = sourceIndex.array.slice()
    const borrowedDispose = vi.fn()
    for (const borrowed of [
      donor.geometry,
      donor.material,
      surfaceMaterial,
      donorMap,
      ...surfaceMaps,
    ])
      borrowed.addEventListener('dispose', borrowedDispose)
    const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const replaced: ReturnType<typeof pearlSurface.replacePearlCourtSurface>[] =
      []
    const replaceOriginal = pearlSurface.replacePearlCourtSurface
    const replace = vi
      .spyOn(pearlSurface, 'replacePearlCourtSurface')
      .mockImplementation((...args) => {
        const result = replaceOriginal(...args)
        replaced.push(result)
        return result
      })
    const completed: ReturnType<typeof rigidBatch.createRigidPlatformBatch>[] =
      []
    const batchDispose = [vi.fn(), vi.fn()]
    const attemptedGeometries: BufferGeometry[] = []
    const original = rigidBatch.createRigidPlatformBatch
    const create = vi
      .spyOn(rigidBatch, 'createRigidPlatformBatch')
      .mockImplementation((...args) => {
        attemptedGeometries.push(args[0].geometry)
        if (attemptedGeometries.length === 3)
          throw new Error('fixture failure after marble batch')
        const batch = original(...args)
        batch.mesh.addEventListener('dispose', batchDispose[completed.length]!)
        completed.push(batch)
        return batch
      })
    try {
      const platforms = [platform('a'), platform('b', 0, 0.72)]
      expect(() =>
        createPearlCourtBatches(
          donor,
          platforms.map((item) => ({
            platform: item,
            placement: new Matrix4(),
          })),
          contact,
          surfaceMaterial,
        ),
      ).toThrow('fixture failure after marble batch')
      expect(completed.map((batch) => batch.mesh.material)).toEqual([
        donor.material,
        surfaceMaterial,
      ])
      for (const listener of batchDispose)
        expect(listener).toHaveBeenCalledOnce()
      expect(replaced).toHaveLength(2)
      const ownedGeometries = new Set([
        ...attemptedGeometries,
        ...replaced.flatMap(({ shell, surface }) => [
          ...shell,
          ...(surface === null ? [] : [surface]),
        ]),
      ])
      for (const geometry of ownedGeometries) {
        expect(geometry).not.toBe(donor.geometry)
        expect(
          dispose.mock.contexts.filter((disposed) => disposed === geometry),
        ).toHaveLength(1)
      }
      // Intermediate cut parts are owned too, even when they share donor attributes.
      expect(new Set(dispose.mock.contexts).size).toBe(
        dispose.mock.contexts.length,
      )
      expect(borrowedDispose).not.toHaveBeenCalled()
      for (const { name, attribute, values } of sourceAttributes) {
        expect(donor.geometry.getAttribute(name)).toBe(attribute)
        expect(attribute.array).toEqual(values)
      }
      expect(donor.geometry.index).toBe(sourceIndex)
      expect(sourceIndex.array).toEqual(sourceIndices)
      expect(donor.material.map).toBe(donorMap)
      expect(surfaceMaterial.map).toBe(surfaceMaps[0])
      expect(surfaceMaterial.normalMap).toBe(surfaceMaps[1])
      expect(surfaceMaterial.roughnessMap).toBe(surfaceMaps[2])
    } finally {
      create.mockRestore()
      replace.mockRestore()
      dispose.mockRestore()
      donor.geometry.dispose()
      donor.material.dispose()
      surfaceMaterial.dispose()
      donorMap.dispose()
      surfaceMaps.forEach((map) => map.dispose())
    }
  })

  it('clips the actual fitted indexed Pearl donor and preserves its source hash and unjoined bounds', async () => {
    const bytes = readFileSync(
      new URL(
        '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/pearl-marble-long/pearl-marble-long-runtime-v1.glb',
        import.meta.url,
      ),
    )
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'dda126cc3c9ea41a326fd06299f1bdf89e1a7e2789b1c2eceb83380c0f9ca861',
    )
    const scene = (
      await new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .register(() => ({
          name: 'EXT_texture_webp',
          loadTexture: async () => new Texture(),
        }))
        .parseAsync(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          '',
        )
    ).scene
    fitCloudwayLaboratoryRigidPresentation(scene, 'pearlRest', contact)
    scene.updateMatrixWorld(true)
    const donor = scene.getObjectByName(
      'CloudwayLab_PearlMarbleLong__provider_detail',
    )! as MeshType
    const originalIndex = donor.geometry.index!.array.slice()
    const parts = clipPearlCourtGeometry(
      donor,
      PEARL_COURT_EDGES.negativeZ | PEARL_COURT_EDGES.positiveZ,
      contact,
    )
    const point = new Vector3()
    let minX = Infinity,
      maxX = -Infinity
    for (const part of parts) {
      const position = part.getAttribute('position')
      const indices =
        part.index === null
          ? Array.from({ length: position.count }, (_, index) => index)
          : Array.from(part.index.array)
      for (const index of indices) {
        point
          .fromBufferAttribute(position, index)
          .applyMatrix4(donor.matrixWorld)
        expect(point.z).toBeGreaterThanOrEqual(-0.360001)
        expect(point.z).toBeLessThanOrEqual(0.360001)
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
      }
      for (const attribute of Object.values(part.attributes))
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
    }
    expect(minX).toBeCloseTo(-1.686747, 5)
    expect(maxX).toBeCloseTo(1.686747, 5)
    expect(donor.geometry.index!.array).toEqual(originalIndex)
    expect(
      parts.reduce(
        (count, geometry) =>
          count +
          (geometry.index?.count ?? geometry.getAttribute('position').count) /
            3,
        0,
      ),
    ).toBeLessThan(112284)
    const clippedMeshes = parts.map((geometry) => {
      const mesh = new Mesh(geometry, donor.material)
      mesh.matrixWorld.copy(donor.matrixWorld)
      return mesh
    })
    const ray = new Raycaster()
    for (const x of [-1.55, -1, 0, 1, 1.55])
      for (const z of [-0.35, 0, 0.35]) {
        ray.set(new Vector3(x, 2, z), new Vector3(0, -1, 0))
        const original = ray.intersectObject(donor, false)[0]
        const clipped = ray.intersectObjects(clippedMeshes, false)[0]
        expect(original).toBeDefined()
        expect(clipped?.point.y).toBeCloseTo(original!.point.y, 6)
      }
    parts.forEach((geometry) => geometry.dispose())
    disposeObject(scene)
  })
})
