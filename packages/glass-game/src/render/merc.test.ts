// Adventure jump pose — the shipped mascot remains upright throughout airborne travel.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'
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
