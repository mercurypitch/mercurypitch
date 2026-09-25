// Approach pad visibility — next required targets stay marked and completed exhibits stop inviting interaction.

import { Group, MeshBasicMaterial } from 'three'
import { expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'
import { disposeObject } from './dispose'
import { createExhibitApproachPads } from './exhibit-approach-pads'

it('marks the next target before proximity, highlights arrival, and removes completed markers', () => {
  const root = new Group()
  const pads = createExhibitApproachPads(
    GLASSWORKS,
    () => root,
    new MeshBasicMaterial(),
  )
  const target = GLASSWORKS.breakables[0]!
  const pad = root.getObjectByName(`approach-pad-${target.id}`)!
  const ring = root.getObjectByName(`approach-ring-${target.id}`)!
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  pads.update({
    ...snapshot,
    nextRequiredBreakableId: target.id,
    nearbyBreakableId: null,
  })
  expect(pad.visible).toBe(true)
  expect(ring.visible).toBe(true)
  pads.update({
    ...snapshot,
    nextRequiredBreakableId: null,
    nearbyBreakableId: null,
  })
  expect(ring.visible).toBe(false)
  pads.update({
    ...snapshot,
    nextRequiredBreakableId: null,
    nearbyBreakableId: target.id,
  })
  expect(ring.visible).toBe(true)
  pads.update({
    ...snapshot,
    completedBreakableIds: [target.id],
    nearbyBreakableId: null,
  })
  expect(pad.visible).toBe(false)
  disposeObject(root)
})
