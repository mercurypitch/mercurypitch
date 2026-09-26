// Camera platform occlusion tests — runtime platform motion keeps cheap camera proxies aligned.

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_STUDY } from '../content/cloudway-laboratory'
import { CLOUDWAY_GLASS_RIBBON } from '../content/cloudway-trial'
import { createCameraPlatformOcclusion } from './camera-platform-occlusion'

describe('camera platform occlusion', () => {
  it('moves and resets the authored proxy with its runtime platform offset', () => {
    const occlusion = createCameraPlatformOcclusion(CLOUDWAY_GLASS_RIBBON)
    const glide = occlusion.obstacles.find(
      (obstacle) => obstacle.id === 'cloudway-glide-raft',
    )!
    const authoredMin = glide.box.min.clone()
    const authoredMax = glide.box.max.clone()

    occlusion.updatePlatformStates([
      {
        id: 'cloudway-glide-raft',
        offset: { x: 1.25, y: -0.5, z: 2.75 },
      },
    ])

    expect(glide.box.min.x).toBeCloseTo(authoredMin.x + 1.25)
    expect(glide.box.min.y).toBeCloseTo(authoredMin.y - 0.5)
    expect(glide.box.min.z).toBeCloseTo(authoredMin.z + 2.75)
    expect(glide.box.max.x).toBeCloseTo(authoredMax.x + 1.25)
    expect(glide.box.max.y).toBeCloseTo(authoredMax.y - 0.5)
    expect(glide.box.max.z).toBeCloseTo(authoredMax.z + 2.75)

    occlusion.updatePlatformStates(undefined)
    expect(glide.box.min).toEqual(authoredMin)
    expect(glide.box.max).toEqual(authoredMax)
  })

  it('shrinks the proxy to the live scroll deck and roller envelope', () => {
    const occlusion = createCameraPlatformOcclusion(
      CLOUDWAY_CRYSTAL_PROMENADE_STUDY,
    )
    const scroll = occlusion.obstacles.find(
      (obstacle) => obstacle.id === 'scroll-deck',
    )!
    const extendedLength = scroll.box.max.z - scroll.box.min.z

    occlusion.updatePlatformStates([
      {
        id: 'scroll-deck',
        offset: { x: 0, y: 0, z: 0 },
        lengthRatio: 0.25,
      },
    ])

    expect(scroll.box.max.z - scroll.box.min.z).toBeLessThan(extendedLength)
  })
})
