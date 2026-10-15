import { describe, expect, it } from 'vitest'
import { targetAt } from '@/lib/glide/glide-path'
import { rideTarget, rideXOn } from './bay-ride'
import { createBayScroll, holdCamera } from './bay-scroll'
import { demoTake } from './demo/demo-script'
import type { AheadTake } from './merc-ahead'
import { AHEAD_SAMPLES, mercAheadOf } from './merc-ahead'

/** Take 2 of the demo on its root, the camera standing as the room's does. */
function aheadAt(now: number): AheadTake {
  const take = demoTake('on', 48)
  const { path, countIn } = take.plan
  return {
    path,
    countIn,
    scroll: holdCamera(createBayScroll(path, countIn), take.hold),
    waveAt: () => 0,
    voice: take.voice,
    now,
  }
}

describe("Merc's spots ahead of the demo's take", () => {
  it('samples the time asked for, from now', () => {
    const take = aheadAt(4)
    const spots = mercAheadOf(take, 3.2)
    expect(spots).toHaveLength(AHEAD_SAMPLES + 1)
    // The first is where he rides now: the camera's x for him, his feet
    // on the voice at the path's clock.
    const t = 4 - take.countIn
    expect(spots[0].x).toBeCloseTo(rideXOn(take.scroll, t), 9)
    expect(spots[0].zoom).toBe(take.scroll.zoom(t))
    const last = spots[spots.length - 1]
    expect(last.x).toBeCloseTo(rideXOn(take.scroll, t + 3.2), 9)
  })

  it('rides past the playhead once the camera stands', () => {
    const take = aheadAt(take2Top())
    const spots = mercAheadOf(take, 2)
    // The camera stands: Merc moves right across the screen.
    expect(spots[spots.length - 1].x).toBeGreaterThan(spots[0].x)
  })

  it('puts his feet on the voice, and on the root where it is silent', () => {
    const take = aheadAt(2.8 + 2.467)
    const [now] = mercAheadOf(take, 0)
    const t = 2.467
    const point = take.voice[Math.round((t + take.countIn) / 0.025)]
    const root = take.path.arches[0].rootMidi
    const top = take.path.arches[0].topMidi
    expect(now.feetY).toBeCloseTo(
      rideTarget(
        root + point.cents / 100,
        targetAt(take.path, t),
        root,
        top - root,
      ),
      9,
    )
    // In the count-in nothing is sung.
    const [early] = mercAheadOf(aheadAt(0.5), 0)
    expect(early.feetY).toBeCloseTo(rideTarget(null, null, root, top - root), 9)
  })
})

/** Take 2's top, on the take's clock. */
function take2Top(): number {
  const take = demoTake('on', 48)
  return take.plan.countIn + take.hold.to
}
