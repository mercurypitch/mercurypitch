import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeviceProbe } from './device-tier'
import { analysisFpsFor, classifyDevice, createFrameHealthSampler, presentationFpsFor, renderScaleFor, scoreDeviceTier, } from './device-tier'

const DESKTOP: DeviceProbe = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  uaDataMobile: false,
  hardwareConcurrency: 12,
  deviceMemoryGb: 8,
  maxTouchPoints: 0,
  coarsePointer: false,
  noHover: false,
  tvMediaType: false,
  screenWidth: 2560,
}

const probe = (overrides: Partial<DeviceProbe>): DeviceProbe => ({
  ...DESKTOP,
  ...overrides,
})

describe('classifyDevice', () => {
  it('reads a desktop browser as desktop', () => {
    expect(classifyDevice(DESKTOP)).toBe('desktop')
  })

  it('reads an Android phone as mobile', () => {
    expect(
      classifyDevice(
        probe({
          userAgent:
            'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          uaDataMobile: true,
          maxTouchPoints: 5,
          coarsePointer: true,
          noHover: true,
        }),
      ),
    ).toBe('mobile')
  })

  it('reads an iPad (which claims to be a Mac) as mobile', () => {
    expect(
      classifyDevice(
        probe({
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          maxTouchPoints: 5,
        }),
      ),
    ).toBe('mobile')
  })

  it.each([
    [
      'Google TV / Android TV',
      'Mozilla/5.0 (Linux; Android 12; BRAVIA 4K GB Build/STTL.211213.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Safari/537.36 CrKey/1.54.250320',
    ],
    [
      'Samsung Tizen',
      'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/6.0 TV Safari/537.36',
    ],
    [
      'LG webOS',
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager',
    ],
    [
      'Amazon Fire TV',
      'Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7233) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
    ],
  ])('reads %s as a tv', (_label, userAgent) => {
    expect(classifyDevice(probe({ userAgent, maxTouchPoints: 0 }))).toBe('tv')
  })

  it('reads a Philips Android TV browser with a phone-shaped UA as a tv', () => {
    // The exact case that started this: no TV token anywhere in the UA. What
    // gives it away is Android WITHOUT `Mobile`, plus zero touch points.
    expect(
      classifyDevice(
        probe({
          userAgent:
            'Mozilla/5.0 (Linux; Android 10; Philips 2020 Build/QTG3.200305.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.120 Safari/537.36',
          uaDataMobile: null,
          maxTouchPoints: 0,
          coarsePointer: true,
          noHover: true,
        }),
      ),
    ).toBe('tv')
  })

  it('does not mistake an Android tablet for a tv', () => {
    // Same missing `Mobile` token — but a tablet reports touch points.
    expect(
      classifyDevice(
        probe({
          userAgent:
            'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          uaDataMobile: false,
          maxTouchPoints: 10,
          coarsePointer: true,
          noHover: true,
        }),
      ),
    ).toBe('desktop')
  })

  it('honours the `tv` media type when the user agent says nothing', () => {
    expect(classifyDevice(probe({ tvMediaType: true }))).toBe('tv')
  })
})

describe('scoreDeviceTier', () => {
  it('gives a modern desktop the full budget', () => {
    expect(scoreDeviceTier(DESKTOP)).toBe('high')
  })

  it('never lets a tv reach the high tier', () => {
    const tv = probe({
      userAgent: 'SMART-TV; Tizen 7.0',
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      screenWidth: 1280,
    })
    expect(scoreDeviceTier(tv)).toBe('balanced')
  })

  it('drops a 4K tv to the low tier', () => {
    const tv = probe({
      userAgent: 'SMART-TV; Tizen 7.0',
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      screenWidth: 3840,
    })
    expect(scoreDeviceTier(tv)).toBe('low')
  })

  it('drops any device with two cores to the low tier', () => {
    expect(scoreDeviceTier(probe({ hardwareConcurrency: 2 }))).toBe('low')
  })

  it('drops any device with 2 GB of memory to the low tier', () => {
    expect(scoreDeviceTier(probe({ deviceMemoryGb: 2 }))).toBe('low')
  })

  it('treats a four-core desktop as balanced', () => {
    expect(scoreDeviceTier(probe({ hardwareConcurrency: 4 }))).toBe('balanced')
  })

  it('assumes four cores when the browser hides the count', () => {
    expect(scoreDeviceTier(probe({ hardwareConcurrency: 0 }))).toBe('balanced')
  })
})

describe('render budgets', () => {
  it('leaves a capable device uncapped', () => {
    expect(presentationFpsFor('high')).toBe(Number.POSITIVE_INFINITY)
  })

  it('caps the low tier at 30 fps and 15 Hz analysis', () => {
    expect(presentationFpsFor('low')).toBe(30)
    expect(analysisFpsFor('low')).toBe(15)
  })

  it('pins the low tier to a 1x backing store', () => {
    expect(renderScaleFor('low', 3)).toBe(1)
  })

  it('never scales a canvas above the device ratio', () => {
    expect(renderScaleFor('high', 1)).toBe(1)
    expect(renderScaleFor('balanced', 1)).toBe(1)
  })

  it('caps a high-dpr device at 2x, and balanced at 1.5x', () => {
    expect(renderScaleFor('high', 3)).toBe(2)
    expect(renderScaleFor('balanced', 3)).toBe(1.5)
  })

  it('treats a nonsense device ratio as 1', () => {
    expect(renderScaleFor('high', 0)).toBe(1)
  })
})

describe('createFrameHealthSampler', () => {
  const feed = (
    sampler: ReturnType<typeof createFrameHealthSampler>,
    intervals: number[],
  ): void => {
    let t = 0
    sampler.record(t)
    for (const interval of intervals) {
      t += interval
      sampler.record(t)
    }
  }

  it('stays quiet while frames land on time', () => {
    const sampler = createFrameHealthSampler(10, 28, 0.4)
    feed(
      sampler,
      Array.from({ length: 40 }, () => 16.7),
    )
    expect(sampler.isStruggling()).toBe(false)
  })

  it('reports struggling once most of a window misses', () => {
    const sampler = createFrameHealthSampler(10, 28, 0.4)
    feed(
      sampler,
      Array.from({ length: 10 }, () => 50),
    )
    expect(sampler.isStruggling()).toBe(true)
  })

  it('ignores tab-switch gaps rather than counting them as stutter', () => {
    const sampler = createFrameHealthSampler(4, 28, 0.4)
    // Three multi-second gaps then healthy frames: not enough samples to judge.
    feed(sampler, [5000, 8000, 3000, 16.7, 16.7])
    expect(sampler.isStruggling()).toBe(false)
  })

  it('stays demoted once it has decided, so quality cannot oscillate', () => {
    const sampler = createFrameHealthSampler(4, 28, 0.4)
    feed(sampler, [50, 50, 50, 50])
    expect(sampler.isStruggling()).toBe(true)
    feed(
      sampler,
      Array.from({ length: 40 }, () => 8),
    )
    expect(sampler.isStruggling()).toBe(true)
  })

  it('forgets everything on reset', () => {
    const sampler = createFrameHealthSampler(4, 28, 0.4)
    feed(sampler, [50, 50, 50, 50])
    sampler.reset()
    expect(sampler.isStruggling()).toBe(false)
  })
})

describe('performanceMode persistence', () => {
  const PERFORMANCE_MODE_KEY = 'pitchperfect_performance_mode'

  /** The signal reads localStorage at import time, so each case reloads. */
  const loadModule = async () => {
    vi.resetModules()
    return await import('./device-tier')
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to auto', async () => {
    const mod = await loadModule()
    expect(mod.performanceMode()).toBe('auto')
  })

  it('persists an override and reads it back on the next session', async () => {
    const mod = await loadModule()
    mod.setPerformanceMode('low')
    expect(localStorage.getItem(PERFORMANCE_MODE_KEY)).toBe('low')

    const reloaded = await loadModule()
    expect(reloaded.performanceMode()).toBe('low')
  })

  it('ignores a corrupted stored value', async () => {
    localStorage.setItem(PERFORMANCE_MODE_KEY, 'turbo')
    const mod = await loadModule()
    expect(mod.performanceMode()).toBe('auto')
  })
})
