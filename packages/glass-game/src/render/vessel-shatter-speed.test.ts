// Shatter playback integration — whole rigid fractures, micro particles and rewards share one presentation age.

import type { InstancedMesh } from 'three'
import { expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { LIVING_GLASS_TRIAL } from '../content/living-glass-trial'
import type { BreakableSnapshot } from '../contracts'
import { SHATTER_PLAYBACK_SPEED, shatterLifecycleSeconds, } from '../core/shatter-presentation'
import { createVessel } from './vessels'

it.each(['goblet', 'vase', 'portrait'] as const)(
  'preserves the complete %s fracture path at slower speed',
  (variant) => {
    const target = { ...GLASSWORKS.breakables[0]!, variant }
    const normal = createVessel(target, false, { shatterPlaybackSpeed: 1 })
    const slow = createVessel(target, false, { shatterPlaybackSpeed: 0.4 })
    const state: BreakableSnapshot = {
      id: target.id,
      phase: 'shattering',
      charge: 1,
      brokenAt: 0,
    }
    try {
      normal.update(state, 0.3)
      slow.update(state, 0.75)
      const normalShards = normal.root.getObjectByName(
        `vessel-shards-${target.id}`,
      )!
      const slowShards = slow.root.getObjectByName(
        `vessel-shards-${target.id}`,
      )!
      expect(slowShards.visible).toBe(true)
      slowShards.children.forEach((shard, index) => {
        expect(
          shard.position.distanceTo(normalShards.children[index]!.position),
        ).toBeLessThan(1e-8)
        expect(
          shard.quaternion.angleTo(normalShards.children[index]!.quaternion),
        ).toBeLessThan(1e-7)
        expect(
          shard.scale.distanceTo(normalShards.children[index]!.scale),
        ).toBeLessThan(1e-8)
      })
      const normalBurst = normal.root.getObjectByName(
        `shatter-burst-${target.id}`,
      )!
      const slowBurst = slow.root.getObjectByName(`shatter-burst-${target.id}`)!
      expect(slowBurst.visible).toBe(true)
      slowBurst.children.forEach((object, index) => {
        const actual = (object as InstancedMesh).instanceMatrix.array
        const expected = (normalBurst.children[index] as InstancedMesh)
          .instanceMatrix.array
        expect(
          actual.every((value, i) => Math.abs(value - expected[i]!) < 1e-6),
        ).toBe(true)
      })
      slow.setShatterPlaybackSpeed(1.6)
      slow.update(state, 2.4)
      expect(slowShards.visible).toBe(true)
      expect(slowBurst.visible).toBe(true)
      slow.update(state, 5.76)
      expect(slowShards.visible).toBe(false)
      expect(slowBurst.visible).toBe(false)
      slow.update({ ...state, phase: 'complete', brokenAt: null }, 20)
      expect(slowShards.visible).toBe(false)
      expect(slowBurst.visible).toBe(false)
    } finally {
      normal.dispose()
      slow.dispose()
    }
  },
)

it('keeps a hidden Rosebud release and its reward on the latched speed', () => {
  const target = LIVING_GLASS_TRIAL.breakables[0]!
  const vessel = createVessel(target, false, { shatterPlaybackSpeed: 0.4 })
  const state: BreakableSnapshot = {
    id: target.id,
    phase: 'shattering',
    charge: 1,
    brokenAt: 0,
  }
  try {
    vessel.update(state, 0, false)
    vessel.setShatterPlaybackSpeed(1.6)
    vessel.update(state, 3)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'releasing',
      rewardVisible: true,
      releaseProgress: 0.5,
    })
    vessel.update(state, 5.76)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'completed',
      releaseProgress: 1,
    })
  } finally {
    vessel.dispose()
  }
})

it('keeps the brief reduced-motion effect at real time and omits micro particles', () => {
  const target = GLASSWORKS.breakables[0]!
  const vessel = createVessel(target, true, { shatterPlaybackSpeed: 0.4 })
  const state: BreakableSnapshot = {
    id: target.id,
    phase: 'shattering',
    charge: 1,
    brokenAt: 0,
  }
  try {
    vessel.update(state, 0.44)
    const shards = vessel.root.getObjectByName(`vessel-shards-${target.id}`)!
    expect(shards.visible).toBe(true)
    expect(
      vessel.root.getObjectByName(`shatter-burst-${target.id}`),
    ).toBeUndefined()
    vessel.update(state, 0.45)
    expect(shards.visible).toBe(false)
  } finally {
    vessel.dispose()
  }
})

it('uses the recorded break speed even if settings changed before its first visible frame', () => {
  const target = GLASSWORKS.breakables[0]!
  const vessel = createVessel(target, false, { shatterPlaybackSpeed: 1.6 })
  try {
    vessel.update(
      {
        id: target.id,
        phase: 'shattering',
        charge: 1,
        brokenAt: 0,
        shatterPlaybackSpeed: 0.4,
      },
      3,
    )
    expect(
      vessel.root.getObjectByName(`vessel-shards-${target.id}`)!.visible,
    ).toBe(true)
  } finally {
    vessel.dispose()
  }
})

it('uses half speed by default from anticipation through the final normal-motion shard', () => {
  const target = GLASSWORKS.breakables[0]!
  const vessel = createVessel(target, false)
  const state: BreakableSnapshot = {
    id: target.id,
    phase: 'shattering',
    charge: 1,
    brokenAt: 0,
  }
  try {
    const intact = vessel.root.getObjectByName(`vessel-intact-${target.id}`)!
    const shards = vessel.root.getObjectByName(`vessel-shards-${target.id}`)!
    vessel.update(state, 0.199)
    expect(intact.visible).toBe(true)
    expect(shards.visible).toBe(false)
    vessel.update(state, 0.2)
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(true)
    vessel.update(state, 4.599)
    expect(shards.visible).toBe(true)
    vessel.update(
      state,
      shatterLifecycleSeconds(SHATTER_PLAYBACK_SPEED.default),
    )
    expect(shards.visible).toBe(false)
  } finally {
    vessel.dispose()
  }
})
