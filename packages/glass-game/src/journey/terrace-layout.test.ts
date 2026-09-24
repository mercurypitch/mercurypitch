// Terrace clearance tests — native rotation and stair ends protect steps from generated planting.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { clearsJourneyStairway, JOURNEY_STAIRWAYS } from './terrace-layout'

describe('processional approach clearance', () => {
  it.each(FLOATING_MUSEUM_JOURNEY.stages)(
    '$id protects its steps after scale and rotation',
    (stage) => {
      const spec = JOURNEY_STAIRWAYS[stage.kind]
      const world = (x: number, z: number) =>
        new Vector3(x, 0, z)
          .multiplyScalar(stage.scale)
          .applyAxisAngle(new Vector3(0, 1, 0), stage.yaw)
          .add(new Vector3(...stage.architecturePosition))
      expect(clearsJourneyStairway(stage, world(0, spec.frontZ), 0.1)).toBe(
        false,
      )
      expect(
        clearsJourneyStairway(stage, world(spec.width * 0.5, spec.frontZ), 0.1),
      ).toBe(false)
      expect(
        clearsJourneyStairway(
          stage,
          world(spec.width * 0.5 + 0.5, spec.frontZ),
          0.1,
        ),
      ).toBe(true)
    },
  )
})
