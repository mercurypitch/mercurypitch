// Vessel visibility regressions — culled effects freeze while authoritative lifecycle state keeps advancing.

import type { Group, Mesh } from 'three'
import { BoxGeometry, Matrix4 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { LIVING_GLASS_TRIAL } from '../content/living-glass-trial'
import type { BreakableSnapshot } from '../contracts'
import { SHATTER_PLAYBACK_SPEED, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { createVessel } from './vessels'

const target = LIVING_GLASS_TRIAL.breakables[0]!

function state(
  phase: BreakableSnapshot['phase'],
  brokenAt: number | null,
  charge = 1,
): BreakableSnapshot {
  return { id: target.id, phase, brokenAt, charge }
}

describe('culled vessel lifecycle', () => {
  it('rejects a late geometry lease while hidden without advancing visual effects', () => {
    const vessel = createVessel(target, false)
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${target.id}`,
    ) as Mesh
    vessel.update(state('charging', null, 0.7), 1)
    const before = vessel.resonanceSnapshot()
    const halfReleaseTime =
      1 +
      (SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds +
        SHATTER_PRESENTATION_TIMING.normal.visibleFlightSeconds / 2) /
        SHATTER_PLAYBACK_SPEED.default

    vessel.update(state('shattering', 1), halfReleaseTime, false)
    expect(vessel.resonanceSnapshot()).toEqual(before)
    expect(intact.visible).toBe(true)

    const incoming = new BoxGeometry(0.6, 0.8, 0.4)
    const release = vi.fn(() => incoming.dispose())
    vessel.setGeometryLease({
      geometry: incoming,
      pieces: [],
      crackGeometries: [],
      materials: [],
      transform: new Matrix4(),
      release,
    })
    expect(release).toHaveBeenCalledOnce()
    expect(vessel.root.getObjectByName(intact.name)).toBe(intact)

    vessel.update(state('shattering', 1), halfReleaseTime)
    expect(intact.visible).toBe(false)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'releasing',
      releaseProgress: 0.5,
    })
    vessel.dispose()
  })

  it('catches up from hidden completion and retry without replaying the release', () => {
    const vessel = createVessel(target, false)
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${target.id}`,
    ) as Mesh
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${target.id}`,
    ) as Group
    vessel.update(state('shattering', 1), 1.3)
    const releasing = vessel.resonanceSnapshot()
    vessel.update(state('complete', 1), 10, false)
    expect(vessel.resonanceSnapshot()).toEqual(releasing)

    vessel.update(state('complete', 1), 10)
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(false)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'completed',
      releaseProgress: 1,
    })

    vessel.update(state('idle', null, 0), 0, false)
    vessel.update(state('idle', null, 0), 0.1, false)
    expect(vessel.resonanceSnapshot()?.phase).toBe('completed')
    vessel.update(state('idle', null, 0), 0.2)
    expect(intact.visible).toBe(true)
    expect(shards.visible).toBe(false)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'idle',
      chargeProgress: 0,
      releaseProgress: 0,
      rewardVisible: false,
    })
    vessel.dispose()
  })
})
