// Adventure vessel regressions — persistent artwork survives its breakable glazing.

import type { Group, Mesh } from 'three'
import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { SHATTER_LIFECYCLE_SECONDS, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { getBreakableRenderRecipe } from './catalog'
import { createVessel } from './vessels'

describe('persistent glazed artwork', () => {
  it('fractures the glazing while preserving the authored image plane and frame contract', () => {
    const target = GLASSWORKS_JOURNEY.breakables.find((item) =>
      item.id.endsWith('/archive/encounter/archive-glazing'),
    )
    expect(target).toBeDefined()
    const recipe = getBreakableRenderRecipe(target!.variant)
    expect(recipe).toMatchObject({
      bundle: 'legend-slab',
      persistentPrefix: 'legend_cash_frame_',
      portraitTexture: 'painting-archive-v5',
    })

    const vessel = createVessel(target!, false)
    vessel.setPortrait(new Texture())
    const art = vessel.root.getObjectByName(
      `persistent-portrait-${target!.id}`,
    ) as Mesh
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${target!.id}`,
    ) as Mesh
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${target!.id}`,
    ) as Group

    expect(art.visible).toBe(true)
    vessel.update(
      { id: target!.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      0.2,
    )
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(true)
    expect(art.visible).toBe(true)

    vessel.update(
      { id: target!.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      SHATTER_LIFECYCLE_SECONDS - 0.001,
    )
    expect(shards.visible).toBe(true)
    vessel.update(
      { id: target!.id, charge: 1, phase: 'complete', brokenAt: 0 },
      SHATTER_LIFECYCLE_SECONDS,
    )
    expect(shards.visible).toBe(false)

    vessel.update(
      { id: target!.id, charge: 1, phase: 'complete', brokenAt: null },
      10,
    )
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(false)
    expect(art.visible).toBe(true)
    vessel.dispose()
  })

  it('keeps the reduced-motion shard beat short inside the full gameplay lifecycle', () => {
    const target = GLASSWORKS_JOURNEY.breakables.find((item) =>
      item.id.endsWith('/archive/encounter/archive-glazing'),
    )!
    const vessel = createVessel(target, true)
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${target.id}`,
    ) as Group
    const wave = vessel.root.children.find(
      (child) => (child as Mesh).geometry?.type === 'RingGeometry',
    ) as Mesh

    vessel.update(
      { id: target.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      0.2,
    )
    expect(shards.visible).toBe(true)
    expect(wave.visible).toBe(false)
    vessel.update(
      { id: target.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      SHATTER_PRESENTATION_TIMING.reducedMotion.visibleFlightSeconds,
    )
    expect(shards.visible).toBe(false)
    expect(SHATTER_LIFECYCLE_SECONDS).toBeCloseTo(2.3)
    vessel.dispose()
  })
})
