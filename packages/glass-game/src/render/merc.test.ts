// Adventure jump pose — the shipped mascot remains upright throughout airborne travel.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Mesh } from 'three'
import { Box3, Group, MeshPhysicalMaterial, SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'
import { disposeObject } from './dispose'
import { loadAdventureMerc, mercMoveTimeScale } from './merc'

afterEach(() => vi.restoreAllMocks())

it('matches Merc move cadence to pace while bounding feathered and future speeds', () => {
  expect(mercMoveTimeScale(1.15)).toBeCloseTo(1)
  expect(mercMoveTimeScale(1.55)).toBeCloseTo(1.55 / 1.15)
  expect(mercMoveTimeScale(2.7)).toBeCloseTo(2.7 / 1.15)
  expect(mercMoveTimeScale(0.09)).toBe(0.35)
  expect(mercMoveTimeScale(6)).toBe(2.4)
})

async function parseActualMerc() {
  const source = await readFile(
    fileURLToPath(
      new URL(
        '../../../../apps/beside-cue/public/games/glass3d/merc.glb',
        import.meta.url,
      ),
    ),
  )
  return new GLTFLoader().parseAsync(
    source.buffer.slice(
      source.byteOffset,
      source.byteOffset + source.byteLength,
    ),
    '',
  )
}

it('retains the actual rig, authored eyes, morphs, and gameplay clips', async () => {
  const gltf = await parseActualMerc()
  try {
    const names = new Set<string>()
    gltf.scene.traverse((object) => names.add(object.name))
    expect([...names]).toEqual(
      expect.arrayContaining([
        'base',
        'head',
        'hand_l',
        'hand_r',
        'merc_body',
        'merc_face',
        'merc_hand_l',
        'merc_hand_r',
      ]),
    )
    const body = gltf.scene.getObjectByName('merc_body')
    const face = gltf.scene.getObjectByName('merc_face') as Mesh
    expect(body).toBeInstanceOf(SkinnedMesh)
    expect(face).toBeInstanceOf(SkinnedMesh)
    expect(
      (body as SkinnedMesh).skeleton.bones.map((bone) => bone.name),
    ).toEqual(
      expect.arrayContaining(['base', 'head', 'hand_l', 'hand_r', 'root']),
    )
    expect(face.morphTargetDictionary).toMatchObject({
      blink: expect.any(Number),
      wide: expect.any(Number),
      sing: expect.any(Number),
    })
    expect(
      Array.isArray(face.material)
        ? face.material[0]?.name
        : face.material.name,
    ).toBe('merc_eye')
    expect(gltf.animations.map((clip) => clip.name).sort()).toEqual([
      'celebrate',
      'fall',
      'laugh',
      'listen',
      'move',
      'sing',
      'welcome',
    ])
    const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]))
    // The source spans are 1.6s/1.2s. Blender retains a 1/30s key origin,
    // and Three defines clip duration as the largest key time.
    expect(clips.get('welcome')?.duration).toBeCloseTo(49 / 30, 5)
    expect(clips.get('laugh')?.duration).toBeCloseTo(37 / 30, 5)
    for (const name of ['welcome', 'laugh']) {
      const clip = clips.get(name)!
      expect(clip.tracks).toHaveLength(16)
      expect(
        clip.tracks.some((track) =>
          track.name.includes('morphTargetInfluences'),
        ),
      ).toBe(true)
      expect(
        clip.tracks.every((track) =>
          Array.from(track.values).every(Number.isFinite),
        ),
      ).toBe(true)
    }
  } finally {
    disposeObject(gltf.scene)
  }
})

it('uses one canonical physical finish for the actual body and hands without replacing the eyes', async () => {
  const gltf = await parseActualMerc()
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf)
  const actor = await loadAdventureMerc('local-test-merc.glb')
  try {
    const body = actor.root.getObjectByName('merc_body') as SkinnedMesh
    const left = actor.root.getObjectByName('merc_hand_l') as SkinnedMesh
    const right = actor.root.getObjectByName('merc_hand_r') as SkinnedMesh
    const face = actor.root.getObjectByName('merc_face') as SkinnedMesh
    expect(body.material).toBe(left.material)
    expect(body.material).toBe(right.material)
    expect(body.material).toBeInstanceOf(MeshPhysicalMaterial)
    expect(body.material).toMatchObject({
      metalness: 1,
      roughness: 0.065,
      iridescence: 0.85,
      iridescenceIOR: 1.65,
      envMapIntensity: 1.25,
    })
    expect(face.material).not.toBe(body.material)
    expect(
      Array.isArray(face.material)
        ? face.material[0]?.name
        : face.material.name,
    ).toBe('merc_eye')
    expect(body.castShadow).toBe(true)
    expect(face.castShadow).toBe(true)
    const parent = new Group()
    parent.add(actor.root)
    actor.dispose()
    expect(actor.root.parent).toBeNull()
    expect(() => actor.dispose()).not.toThrow()
  } finally {
    actor.dispose()
  }
})

function animatedMinimumY(
  root: Awaited<ReturnType<typeof loadAdventureMerc>>['root'],
): number {
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (object instanceof SkinnedMesh) object.computeBoundingBox()
  })
  return new Box3().setFromObject(root).min.y
}

it('keeps the actual Merc hands above the gameplay floor through grounded clips', async () => {
  const gltf = await parseActualMerc()
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf)
  const actor = await loadAdventureMerc('local-test-merc.glb')
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  const minimumY: number[] = []
  const sample = (frames: number) => {
    for (let frame = 0; frame < frames; frame++) {
      snapshot.elapsedSeconds += 1 / 60
      actor.update(snapshot, 1 / 60, false)
      minimumY.push(animatedMinimumY(actor.root))
    }
  }

  try {
    sample(90)
    snapshot.player.velocity.x = 1
    sample(100)
    snapshot.player.velocity.x = 0
    snapshot.breakables[0]!.phase = 'charging'
    sample(90)
    snapshot.breakables[0]!.phase = 'complete'
    sample(90)

    expect(Math.min(...minimumY)).toBeGreaterThan(0.005)
    expect(actor.root.position.y).toBe(snapshot.player.position.y)
  } finally {
    actor.dispose()
  }
})

it.each([false, true])(
  'keeps the actual Merc rig upright on repeated jumps with reduced motion=%s',
  async (reducedMotion) => {
    const gltf = await parseActualMerc()
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf)
    const actor = await loadAdventureMerc('local-test-merc.glb')
    const snapshot = createGlassGame(GLASSWORKS).snapshot()
    const base = actor.root.getObjectByName('base')!
    const upright = base.quaternion.clone()
    let maximumLean = 0
    try {
      for (let jump = 0; jump < 3; jump++) {
        for (let frame = 0; frame < 70; frame++) {
          snapshot.player.grounded = frame >= 60
          snapshot.player.velocity.y = frame < 30 ? 3 : -3
          snapshot.player.velocity.x = jump === 0 ? 0 : 1
          snapshot.elapsedSeconds += 1 / 60
          actor.update(snapshot, 1 / 60, reducedMotion)
          maximumLean = Math.max(maximumLean, base.quaternion.angleTo(upright))
        }
      }
      expect(maximumLean).toBeLessThan(0.25)
      expect(actor.root.position.y).toBe(snapshot.player.position.y)
    } finally {
      actor.dispose()
    }
  },
)

it('rejects a resolved Merc GLB when one of its dependencies failed', async () => {
  const gltf = await parseActualMerc()
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementationOnce(
    async function (this: GLTFLoader) {
      this.manager.itemError('merc-texture.webp')
      return gltf
    },
  )

  await expect(loadAdventureMerc('local-test-merc.glb')).rejects.toThrow(
    'Merc has unavailable dependencies: merc-texture.webp',
  )
})

it('turns toward a side step smoothly and independently of frame cadence', async () => {
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync')
  const turnFor = async (dt: number, frames: number): Promise<number> => {
    load.mockResolvedValueOnce(await parseActualMerc())
    const actor = await loadAdventureMerc('local-test-merc.glb')
    const snapshot = createGlassGame(GLASSWORKS).snapshot()
    snapshot.player.facingYaw = -Math.PI / 2
    snapshot.player.velocity.x = 1
    try {
      for (let frame = 0; frame < frames; frame++)
        actor.update(snapshot, dt, false)
      return actor.root.rotation.y
    } finally {
      actor.dispose()
    }
  }

  const firstLongFrame = await turnFor(0.05, 1)
  const sixtyFps = await turnFor(1 / 60, 12)
  const thirtyFps = await turnFor(1 / 30, 6)

  expect(firstLongFrame).toBeGreaterThan(0)
  expect(firstLongFrame).toBeLessThan(0.4)
  expect(sixtyFps).toBeGreaterThan(1)
  expect(sixtyFps).toBeLessThan(1.35)
  expect(thirtyFps).toBeCloseTo(sixtyFps, 5)
})
