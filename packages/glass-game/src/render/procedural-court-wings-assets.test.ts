// Court return clearance — measured donor joins and retained routes bound the below-floor visual extension.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Object3D } from 'three'
import { Box3, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3, } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { expect, it } from 'vitest'
import { PROCEDURAL_VISUAL_ENVELOPES } from '../authoring/procedural/chunk-envelopes'
import { generateProceduralCourse } from '../authoring/procedural/course-generator'
import { decodeProceduralCourseCode } from '../authoring/procedural/course-options'
import fixture from '../authoring/procedural/fixtures/course-v1.compatibility.json'
import type { PlatformDefinition, SolidPropDefinition } from '../contracts'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS, CLOUDWAY_LAB_ROOT_NAMES, } from './cloudway-laboratory-catalog'
import { fitCloudwayLaboratoryRigidPresentation } from './cloudway-laboratory-platforms'
import { disposeObject } from './dispose'
import { createProceduralCourtWingGeometry } from './procedural-court-wings'

const PROFILE_BY_RENDER_ID: Readonly<Record<string, string>> = {
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest]: 'pearl-rest',
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll]: 'gilt-scroll',
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseCrackle]: 'rose-crackle',
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseHexCrumble]: 'rose-hex-crumble',
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystCrackle]: 'amethyst-crackle',
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.frostLily]: 'frost-lily',
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.auroraGlide]: 'aurora-glide',
}

function sweptArtBounds(platform: PlatformDefinition): Box3 {
  const profile = PROFILE_BY_RENDER_ID[platform.renderId ?? '']
  expect(profile).toBeDefined()
  const local = PROCEDURAL_VISUAL_ENVELOPES[profile]
  const matrix = new Matrix4().makeRotationY(
    ((platform.renderQuarterTurns ?? 0) * Math.PI) / 2,
  )
  matrix.setPosition(
    (platform.minX + platform.maxX) / 2,
    platform.top,
    (platform.minZ + platform.maxZ) / 2,
  )
  const bounds = new Box3(
    new Vector3(local.minX, local.minY, local.minZ),
    new Vector3(local.maxX, local.maxY, local.maxZ),
  ).applyMatrix4(matrix)
  if (platform.behavior?.kind === 'glide') {
    const offset = new Vector3().copy(platform.behavior.translation)
    bounds.union(bounds.clone().translate(offset))
  }
  return bounds
}

function oriented<
  T extends PlatformDefinition | Extract<SolidPropDefinition, { shape: 'box' }>,
>(item: T, turn: number): T {
  const matrix = new Matrix4().makeRotationY((turn * Math.PI) / 2)
  const bounds = new Box3(
    new Vector3(item.minX, item.top, item.minZ),
    new Vector3(item.maxX, item.top, item.maxZ),
  ).applyMatrix4(matrix)
  return {
    ...item,
    minX: bounds.min.x,
    maxX: bounds.max.x,
    minZ: bounds.min.z,
    maxZ: bounds.max.z,
  }
}

it('keeps the full underside envelope clear of foreign intact and swept art across 400 mixed seeds and four headings', () => {
  const material = new MeshStandardMaterial()
  let returns = 0
  const intersections: string[] = []
  const recipes = [
    ...fixture.courses.map((saved) => ({
      ...decodeProceduralCourseCode(saved.code),
      label: saved.label,
    })),
    ...Array.from({ length: 400 }, (_, seed) => ({
      seed,
      label: `seed-${seed}`,
      difficulty: (['gentle', 'balanced', 'virtuoso'] as const)[seed % 3]!,
      melodyLessonId: (
        [
          'first-arc-v1',
          'sunlit-steps-v1',
          'gallery-arch-v1',
          'two-windows-v1',
        ] as const
      )[seed % 4]!,
      fogTheme: (['dawn', 'celestial', 'aurora', 'twilight'] as const)[
        seed % 4
      ]!,
      includeLivingCrystals: seed % 2 === 0,
      includeOptionalAlcoves: seed % 3 !== 0,
    })),
  ]
  for (const { label, ...recipe } of recipes) {
    const level = generateProceduralCourse(recipe).compiledLevel
    for (const turn of [0, 1, 2, 3]) {
      const matrix = new Matrix4().makeRotationY((turn * Math.PI) / 2)
      const platforms = level.platforms.map((platform) => ({
        ...oriented(platform, turn),
        renderQuarterTurns: (((platform.renderQuarterTurns ?? 0) + turn) %
          4) as 0 | 1 | 2 | 3,
        ...(platform.behavior?.kind === 'glide'
          ? {
              behavior: {
                ...platform.behavior,
                translation: new Vector3()
                  .copy(platform.behavior.translation)
                  .applyMatrix4(matrix),
              },
            }
          : {}),
      }))
      const floors = platforms.map((platform) => ({
        platform,
        art: sweptArtBounds(platform),
      }))
      for (const solid of level.solids ?? []) {
        if (solid.shape !== 'box') continue
        const moved = oriented(solid, turn)
        const geometry = createProceduralCourtWingGeometry(moved, platforms)
        if (geometry === undefined) continue
        returns++
        const mesh = new Mesh(geometry, material)
        mesh.position.set(
          (moved.minX + moved.maxX) / 2,
          moved.top - moved.thickness / 2,
          (moved.minZ + moved.maxZ) / 2,
        )
        mesh.updateMatrixWorld(true)
        const addedBounds = new Box3().setFromObject(mesh)
        const bottom = moved.top - moved.thickness
        addedBounds.max.y = bottom - 1e-5
        const alongX = moved.maxX - moved.minX > moved.maxZ - moved.minZ
        for (const { platform, art } of floors) {
          if (!addedBounds.intersectsBox(art)) continue
          const min = alongX ? moved.minX : moved.minZ
          const max = alongX ? moved.maxX : moved.maxZ
          const crossMin = alongX ? moved.minZ : moved.minX
          const crossMax = alongX ? moved.maxZ : moved.maxX
          const floorMin = alongX ? platform.minX : platform.minZ
          const floorMax = alongX ? platform.maxX : platform.maxZ
          const center = (min + max) / 2
          // Only the supporting slab is an intentional structural union. A
          // neighboring slab at the same height remains foreign art to check.
          const supports =
            platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest &&
            platform.behavior === undefined &&
            platform.activation === undefined &&
            platform.unlockAfter === undefined &&
            platform.parentPlatformId === undefined &&
            Math.abs(platform.top - bottom) < 1e-5 &&
            (alongX ? platform.minZ : platform.minX) <= crossMin + 1e-5 &&
            (alongX ? platform.maxZ : platform.maxX) >= crossMax - 1e-5 &&
            ((floorMin < min && floorMax > min && floorMax < center) ||
              (floorMax > max && floorMin < max && floorMin > center))
          if (!supports)
            intersections.push(`${label}/${turn}/${solid.id}/${platform.id}`)
        }
        geometry.dispose()
      }
    }
  }
  expect(intersections).toEqual([])
  expect(returns).toBeGreaterThan(10000)
  material.dispose()
}, 60_000)

it('anchors each tapered toe inside the actual decoded Pearl body and leaves its standing surface untouched', async () => {
  const bytes = readFileSync(
    new URL(
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/pearl-marble-long/pearl-marble-long-runtime-v1.glb',
      import.meta.url,
    ),
  )
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    'dda126cc3c9ea41a326fd06299f1bdf89e1a7e2789b1c2eceb83380c0f9ca861',
  )
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({
      name: 'EXT_texture_webp',
      loadTexture: async () => new Texture(),
    }))
  const scene = (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene
  const source = scene.getObjectByName(
    CLOUDWAY_LAB_ROOT_NAMES.pearlRest,
  ) as Object3D
  fitCloudwayLaboratoryRigidPresentation(source, 'pearlRest', {
    width: 3.2,
    depth: 0.72,
  })
  source.updateMatrixWorld(true)
  const donor = new Box3().setFromObject(source)
  expect(donor.min.y).toBeGreaterThan(-0.4)
  expect(donor.min.x).toBeLessThan(-1.6)
  expect(donor.max.x).toBeGreaterThan(1.6)
  for (const sign of [-1, 1]) {
    // These points are the interior side of the return foot, not the donor's
    // ornamental AABB edge. The existing floor/body really occupies this join.
    const ray = new Raycaster(
      new Vector3(sign * 1.5, 1, 0),
      new Vector3(0, -1, 0),
    )
    const hits = ray.intersectObject(source, true)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.point.y).toBeGreaterThan(-0.003)
    expect(hits[0]!.point.y).toBeLessThan(0.025)
    expect(-0.65).toBeLessThan(donor.min.y - 0.2)
  }
  disposeObject(scene)
})
