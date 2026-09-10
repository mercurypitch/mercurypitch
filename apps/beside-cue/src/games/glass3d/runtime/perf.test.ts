import { describe, expect, it } from 'vitest'
import { chipLines, createFrameMeter, isPerfChipEnabled, timed } from './perf'

describe('the frame meter', () => {
  it('reports a window once a second has passed, and only then', () => {
    const meter = createFrameMeter(1000)
    for (let k = 0; k < 60; k++) {
      expect(meter.frame(k * (1000 / 60), 4, true)).toBeNull()
    }
    const window = meter.frame(1000, 4, true)
    expect(window).not.toBeNull()
    expect(window!.fps).toBe(61)
  })

  // Calm draws fewer frames, not cheaper ones: the cost of a drawn frame
  // stays put and the share of the second spent in the loop is what falls.
  it('averages drawn frames only, and counts every pass as busy time', () => {
    const meter = createFrameMeter(1000)
    let last = null
    for (let k = 0; k <= 60; k++) {
      const drew = k % 2 === 0
      last = meter.frame(k * (1000 / 60), drew ? 6 : 0.5, drew) ?? last
    }
    expect(last).not.toBeNull()
    expect(last!.fps).toBe(31)
    expect(last!.cpuMs).toBeCloseTo(6, 6)
    expect(last!.cpuMaxMs).toBe(6)
    // 31 drawn at 6 ms and 30 skipped at 0.5 ms, over one second.
    expect(last!.busy).toBeCloseTo((31 * 6 + 30 * 0.5) / 1000, 6)
  })

  it('keeps the worst drawn frame, not the worst skipped one', () => {
    const meter = createFrameMeter(1000)
    meter.frame(0, 5, true)
    meter.frame(300, 40, false)
    meter.frame(600, 9, true)
    const window = meter.frame(1000, 5, true)
    expect(window!.cpuMaxMs).toBe(9)
  })

  it('starts a fresh window after reporting', () => {
    const meter = createFrameMeter(1000)
    meter.frame(0, 30, true)
    meter.frame(1000, 30, true)
    meter.frame(1500, 2, true)
    const second = meter.frame(2000, 2, true)
    expect(second!.cpuMaxMs).toBe(2)
    expect(second!.fps).toBe(2)
  })

  // One detector frame is polled by every simulation step until the next
  // arrives, so counting reads would report the step rate, not the
  // detector's.
  it('counts f0 frames by change of level, not by reads', () => {
    const meter = createFrameMeter(1000)
    meter.frame(0, 1, true)
    for (let f = 0; f < 47; f++) {
      for (let read = 0; read < 3; read++) meter.level(0.01 + f * 0.0001)
    }
    meter.level(0) // silence is no frame
    const window = meter.frame(1000, 1, true)
    expect(window!.f0Hz).toBe(47)
  })

  it('opens a new window when the clock goes backwards', () => {
    const meter = createFrameMeter(1000)
    meter.frame(5000, 1, true)
    expect(meter.frame(100, 1, true)).toBeNull()
    expect(meter.frame(1100, 1, true)).not.toBeNull()
  })

  it('ignores a clock that is not a number', () => {
    const meter = createFrameMeter(1000)
    expect(meter.frame(Number.NaN, 1, true)).toBeNull()
  })
})

describe('the chip', () => {
  const frames = {
    fps: 60,
    cpuMs: 3.24,
    cpuMaxMs: 8.06,
    busy: 0.194,
    f0Hz: 47,
  }

  it('reads frame, then scene load, then the microphone', () => {
    expect(
      // Handed over in the order they happened to land, which is not the
      // order they are read in.
      chipLines('WebGL2', frames, false, {
        first: 612.6,
        f0: 150,
        draw: 45.2,
        gpu: 120.4,
        mic: 901,
        compile: 80,
        merc: 340,
        scene: 38.4,
      }),
    ).toEqual([
      'WebGL2 · 60 fps · cpu 3.2/8.1 ms · 19% · f0 47 Hz',
      'scene 38 · gpu 120 · merc 340 · compile 80 · draw 45 · first 613 ms',
      'mic 901 · f0 150 ms',
    ])
  })

  it('says only the backend before anything is measured', () => {
    expect(chipLines('WebGPU', null, false, {})).toEqual(['WebGPU'])
  })

  it('leaves out the f0 rate before the microphone is live', () => {
    expect(chipLines('WebGL2', { ...frames, f0Hz: 0 }, false, {})[0]).toBe(
      'WebGL2 · 60 fps · cpu 3.2/8.1 ms · 19%',
    )
  })

  it('says when the stage is calm', () => {
    expect(chipLines('WebGL2', { ...frames, fps: 30 }, true, {})[0]).toMatch(
      /· calm$/,
    )
  })
})

describe('who sees the chip', () => {
  it('shows in a development build', () => {
    expect(isPerfChipEnabled({ DEV: true }, '')).toBe(true)
  })

  it('stays hidden from a player on a production build', () => {
    expect(isPerfChipEnabled({ DEV: false }, '')).toBe(false)
    expect(isPerfChipEnabled({}, '?devSeed')).toBe(false)
  })

  it('shows on a production build asked with ?perf', () => {
    expect(isPerfChipEnabled({ DEV: false }, '?perf')).toBe(true)
    expect(isPerfChipEnabled({ DEV: false }, '?devSeed&perf')).toBe(true)
  })
})

describe('timing a load', () => {
  it('reports from when the work started to when it resolved', async () => {
    let clock = 100
    const reports: number[] = []
    const value = await timed(
      async () => {
        clock = 350
        return 'merc'
      },
      (ms) => reports.push(ms),
      () => clock,
    )
    expect(value).toBe('merc')
    expect(reports).toEqual([250])
  })

  it('reports nothing for work that failed', async () => {
    const reports: number[] = []
    await expect(
      timed(
        () => Promise.reject(new Error('404')),
        (ms) => reports.push(ms),
      ),
    ).rejects.toThrow('404')
    expect(reports).toEqual([])
  })
})
