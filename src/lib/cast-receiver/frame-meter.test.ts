// ============================================================
// Frame meter tests — frames a second, evenness, late frames, heap
// ============================================================

import { describe, expect, it } from 'vitest'
import { createFrameMeter } from '@/lib/cast-receiver/frame-meter'

function run(meter: ReturnType<typeof createFrameMeter>, intervals: number[]) {
  let time = 1000
  meter.tick(time)
  for (const interval of intervals) {
    time += interval
    meter.tick(time)
  }
}

describe('the frame meter', () => {
  it('reads nothing before two frames', () => {
    const meter = createFrameMeter()
    meter.tick(1000)
    expect(meter.reading()).toMatchObject({ fps: 0, frames: 0, late: 0 })
  })

  it('reads a steady 60 a second as 60, with no late frames', () => {
    const meter = createFrameMeter()
    run(meter, Array<number>(120).fill(1000 / 60))
    expect(meter.reading()).toMatchObject({
      fps: 60,
      medianMs: 16.7,
      p95Ms: 16.7,
      late: 0,
      frames: 120,
    })
  })

  it('counts a frame the display skipped as late, and it shows in the 95th percentile', () => {
    const meter = createFrameMeter()
    const intervals = Array<number>(100).fill(1000 / 60)
    for (let index = 10; index < 100; index += 10) intervals[index] = 1000 / 30
    run(meter, intervals)
    const reading = meter.reading()
    expect(reading.late).toBe(9)
    expect(reading.medianMs).toBe(16.7)
    expect(reading.p95Ms).toBe(33.3)
    expect(reading.fps).toBeLessThan(60)
  })

  it('keeps only its span of frames', () => {
    const meter = createFrameMeter({}, 10)
    run(meter, [...Array<number>(10).fill(50), ...Array<number>(10).fill(20)])
    expect(meter.reading()).toMatchObject({ frames: 10, fps: 50, late: 0 })
  })

  it('reads the heap where the browser reports it, in MB', () => {
    const meter = createFrameMeter({
      memory: { usedJSHeapSize: 52_428_800, jsHeapSizeLimit: 536_870_912 },
    })
    expect(meter.reading()).toMatchObject({ heapMb: 50, heapLimitMb: 512 })
    expect(createFrameMeter().reading()).toMatchObject({
      heapMb: null,
      heapLimitMb: null,
    })
  })
})
