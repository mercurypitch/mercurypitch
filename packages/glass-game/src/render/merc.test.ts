// Adventure jump pose — the shipped mascot remains upright throughout airborne travel.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'
import { loadAdventureMerc } from './merc'

afterEach(() => vi.restoreAllMocks())

it.each([false, true])(
  'keeps the actual Merc rig upright on repeated jumps with reduced motion=%s',
  async (reducedMotion) => {
    const source = await readFile(
      fileURLToPath(
        new URL(
          '../../../../apps/beside-cue/public/games/glass3d/merc.glb',
          import.meta.url,
        ),
      ),
    )
    const gltf = await new GLTFLoader().parseAsync(
      source.buffer.slice(
        source.byteOffset,
        source.byteOffset + source.byteLength,
      ),
      '',
    )
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
