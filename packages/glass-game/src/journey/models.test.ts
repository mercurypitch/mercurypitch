// Journey model tests — partial loads retire resources and bridge transforms meet endpoints.

import { AnimationClip, Group, Matrix4, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { journeyBridgeTransform, loadJourneyMapModels } from './models'
import type { JourneyGltfDocument } from './resources'

describe('journey map model loading', () => {
  it('disposes a successful sibling document when the other load fails', async () => {
    const dispose = vi.fn()
    const document: JourneyGltfDocument = {
      scene: new Group(),
      animations: [new AnimationClip('idle', 1)],
      dispose,
    }
    const failure = new Error('merc unavailable')
    const loadGltf = vi
      .fn()
      .mockResolvedValueOnce(document)
      .mockRejectedValueOnce(failure)

    await expect(
      loadJourneyMapModels(
        FLOATING_MUSEUM_JOURNEY,
        '/map.glb',
        '/merc.glb',
        new AbortController().signal,
        { loadGltf },
      ),
    ).rejects.toBe(failure)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('maps the final bridge dimensions onto both authored endpoints', () => {
    for (const bridge of FLOATING_MUSEUM_JOURNEY.bridges) {
      const transform = journeyBridgeTransform(bridge)
      const matrix = new Matrix4().compose(
        transform.position,
        transform.rotation,
        transform.scale,
      )
      const localHalfLength = 3.323364 / 2
      const start = new Vector3(0, 0, -localHalfLength).applyMatrix4(matrix)
      const end = new Vector3(0, 0, localHalfLength).applyMatrix4(matrix)
      expect(start.toArray()).toEqual(
        bridge.from.map((value) => expect.closeTo(value, 6)),
      )
      expect(end.toArray()).toEqual(
        bridge.to.map((value) => expect.closeTo(value, 6)),
      )
    }
  })
})
