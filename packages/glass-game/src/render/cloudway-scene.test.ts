// Cloudway scene theme tests — authored presentation data selects open-sky rendering for future trials.

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_GLASS_RIBBON, CLOUDWAY_GLASS_RIBBON_ROUTE, } from '../content/cloudway-trial'
import { CLOUDWAY_FOG_FAR, CLOUDWAY_FOG_NEAR, isCloudwayLevel, } from './cloudway-scene'

const CAMERA_PITCH = 0.36

function routeFogFactor(
  player: { x: number; y: number; z: number },
  waypoint: { x: number; z: number },
  boomDistance: number,
  yaw: number,
): number {
  const camera = {
    x: player.x + Math.sin(yaw) * Math.cos(CAMERA_PITCH) * boomDistance,
    y: player.y + 0.42 + Math.sin(CAMERA_PITCH) * boomDistance,
    z: player.z + Math.cos(yaw) * Math.cos(CAMERA_PITCH) * boomDistance,
  }
  const distance = Math.hypot(
    waypoint.x - camera.x,
    -camera.y,
    waypoint.z - camera.z,
  )
  const progress = Math.max(
    0,
    Math.min(
      1,
      (distance - CLOUDWAY_FOG_NEAR) / (CLOUDWAY_FOG_FAR - CLOUDWAY_FOG_NEAR),
    ),
  )
  return progress * progress * (3 - 2 * progress)
}

describe('Cloudway scene theme', () => {
  it('selects the theme from presentation data instead of a level id', () => {
    expect(
      isCloudwayLevel({
        ...CLOUDWAY_GLASS_RIBBON,
        id: 'future-cloudway-ferry',
      }),
    ).toBe(true)
    expect(
      isCloudwayLevel({
        ...CLOUDWAY_GLASS_RIBBON,
        presentation: {
          ...CLOUDWAY_GLASS_RIBBON.presentation!,
          theme: 'museum',
        },
      }),
    ).toBe(false)
    expect(
      isCloudwayLevel({
        ...CLOUDWAY_GLASS_RIBBON,
        presentation: {
          ...CLOUDWAY_GLASS_RIBBON.presentation!,
          theme: undefined,
        },
      }),
    ).toBe(false)
  })

  it.each([
    {
      label: 'arrival authored camera',
      checkpoint: 'cloudway-checkpoint-arrival',
      routeIndex: 0,
      boomDistance: 4,
      yaw: Math.PI,
      maximumNextFog: 0,
      maximumFollowingFog: 0.2,
      minimumThirdFog: 0.8,
    },
    {
      label: 'midroute authored camera',
      checkpoint: 'cloudway-checkpoint-glide-east',
      routeIndex: 6,
      boomDistance: 4,
      yaw: Math.PI,
      maximumNextFog: 0,
      maximumFollowingFog: 0.2,
      minimumThirdFog: 0.75,
    },
    {
      label: 'arrival widest oblique camera',
      checkpoint: 'cloudway-checkpoint-arrival',
      routeIndex: 0,
      boomDistance: 6.5,
      yaw: Math.PI - 0.58,
      maximumNextFog: 0.35,
      maximumFollowingFog: 0.9,
      minimumThirdFog: 1,
    },
  ])(
    'keeps two route cues and dissolves the third from the $label',
    ({
      checkpoint,
      routeIndex,
      boomDistance,
      yaw,
      maximumNextFog,
      maximumFollowingFog,
      minimumThirdFog,
    }) => {
      const player = CLOUDWAY_GLASS_RIBBON.checkpoints.find(
        (item) => item.id === checkpoint,
      )!.position
      const waypoints = CLOUDWAY_GLASS_RIBBON_ROUTE.waypoints

      expect(
        routeFogFactor(player, waypoints[routeIndex + 1]!, boomDistance, yaw),
      ).toBeLessThanOrEqual(maximumNextFog)
      expect(
        routeFogFactor(player, waypoints[routeIndex + 2]!, boomDistance, yaw),
      ).toBeLessThanOrEqual(maximumFollowingFog)
      expect(
        routeFogFactor(player, waypoints[routeIndex + 3]!, boomDistance, yaw),
      ).toBeGreaterThanOrEqual(minimumThirdFog)
    },
  )
})
