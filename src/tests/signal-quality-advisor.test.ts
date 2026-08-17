// ============================================================
// signal-quality advisor — one toast, at the right moment, never a nag
// ============================================================

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADVISOR_COOLDOWN_MS, ADVISOR_POLL_MS, ADVISOR_SESSION_CAP, ADVISOR_STAMP_KEY, createSignalQualityAdvisor, } from '@/features/mic-feedback/signal-quality-advisor'
import { publishDetectionFrame, resetSignalQuality } from '@/lib/signal-quality'

const GATE = 0.005

// Synthetic clocks: perfT is the detector's frame time base, wallT the
// cooldown stamp's. The advisor compares each only against itself.
let perfT = 0
let wallT = 0

const feedNoisy = (ms: number): void => {
  const until = perfT + ms
  while (perfT < until) {
    for (let i = 0; i < 2; i++) {
      perfT += 33
      publishDetectionFrame({
        rms: 0.012,
        clarity: 0.33,
        accepted: true,
        frequency: 233,
        gateRms: GATE,
        confidenceFloor: 0.3,
        atMs: perfT,
      })
    }
    for (let i = 0; i < 4; i++) {
      perfT += 33
      publishDetectionFrame({
        rms: 0.012,
        clarity: 0.15,
        accepted: false,
        frequency: 0,
        gateRms: GATE,
        confidenceFloor: 0.3,
        atMs: perfT,
      })
    }
  }
}

interface Harness {
  notify: ReturnType<typeof vi.fn>
  dismiss: ReturnType<typeof vi.fn>
  openSettings: ReturnType<typeof vi.fn>
  storage: Map<string, string>
  dispose: () => void
}

const start = (preset: 'quiet' | 'home' | 'noisy' = 'quiet'): Harness => {
  const notify = vi.fn(() => 42)
  const dismiss = vi.fn()
  const openSettings = vi.fn()
  const storage = new Map<string, string>()
  const dispose = createSignalQualityAdvisor({
    now: () => wallT,
    frameNow: () => perfT,
    notify: notify as never,
    dismiss: dismiss as never,
    openSettings: openSettings as never,
    preset: () => preset,
    storage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    },
  })
  return { notify, dismiss, openSettings, storage, dispose }
}

const tick = (): void => {
  vi.advanceTimersByTime(ADVISOR_POLL_MS)
}

let harness: Harness | null = null

beforeEach(() => {
  vi.useFakeTimers()
  resetSignalQuality()
  perfT = 1_000_000
  wallT = 5_000_000
})

afterEach(() => {
  harness?.dispose()
  harness = null
  vi.useRealTimers()
})

describe('createSignalQualityAdvisor', () => {
  it('speaks up once about a noisy room, and stamps the cooldown', () => {
    harness = start()
    feedNoisy(6_000)
    tick()

    expect(harness.notify).toHaveBeenCalledTimes(1)
    const [message, type, , opts] = harness.notify.mock.calls[0] as [
      string,
      string,
      unknown,
      { channel: string; title: string },
    ]
    expect(message).toContain('High Noise')
    expect(type).toBe('warning')
    expect(opts.channel).toBe('signal-quality')
    expect(opts.title).toBe('Microphone')
    expect(harness.storage.get(ADVISOR_STAMP_KEY)).toBe(String(wallT))

    // The window was consumed — the very next poll must not re-fire.
    tick()
    expect(harness.notify).toHaveBeenCalledTimes(1)
  })

  it('the action jumps to the anchored mic setting', () => {
    harness = start()
    feedNoisy(6_000)
    tick()

    const action = (
      harness.notify.mock.calls[0] as unknown as [
        string,
        string,
        { label: string; onClick: () => void },
      ]
    )[2]
    expect(action.label).toBe('Open mic settings')
    action.onClick()
    expect(harness.dismiss).toHaveBeenCalledWith(42)
    expect(harness.openSettings).toHaveBeenCalledWith(
      'singing',
      'sensitivity-presets',
    )
  })

  it('already on the noisy preset, it recommends the room instead', () => {
    harness = start('noisy')
    feedNoisy(6_000)
    tick()

    expect(harness.notify).toHaveBeenCalledTimes(1)
    const message = (harness.notify.mock.calls[0] as [string])[0]
    expect(message).toContain('quieter spot')
    expect(message).not.toContain('High Noise')
  })

  it('holds its tongue until the window has really been observed', () => {
    harness = start()
    feedNoisy(3_000)
    tick()
    expect(harness.notify).not.toHaveBeenCalled()
  })

  it('never advises on a window the mic stopped feeding', () => {
    harness = start()
    feedNoisy(6_000)
    perfT += 2_000 // mic off: frames stop, the clock does not
    tick()
    expect(harness.notify).not.toHaveBeenCalled()
  })

  it('cooldown and session cap bound the nagging', () => {
    harness = start()
    feedNoisy(6_000)
    tick()
    expect(harness.notify).toHaveBeenCalledTimes(1)

    // Still noisy, still inside the cooldown: quiet.
    feedNoisy(6_000)
    tick()
    expect(harness.notify).toHaveBeenCalledTimes(1)

    // Cooldown over: one more, and that is the session's last word.
    wallT += ADVISOR_COOLDOWN_MS
    feedNoisy(6_000)
    tick()
    expect(harness.notify).toHaveBeenCalledTimes(ADVISOR_SESSION_CAP)

    wallT += ADVISOR_COOLDOWN_MS
    feedNoisy(6_000)
    tick()
    expect(harness.notify).toHaveBeenCalledTimes(ADVISOR_SESSION_CAP)
  })

  it('disposing stops the loop', () => {
    harness = start()
    harness.dispose()
    feedNoisy(6_000)
    tick()
    expect(harness.notify).not.toHaveBeenCalled()
  })
})

describe('wiring pins', () => {
  it('the preset select is anchored for the deep link', () => {
    expect(readFileSync('src/components/SettingsPanel.tsx', 'utf8')).toContain(
      'data-settings-anchor="sensitivity-presets"',
    )
  })

  it('the app starts exactly one advisor, next to the engine', () => {
    const source = readFileSync('src/contexts/EngineContext.tsx', 'utf8')
    expect(source).toContain('createSignalQualityAdvisor()')
    expect(source).toContain('disposeSignalAdvisor()')
  })

  it('the practice engine opts its detectors into live telemetry', () => {
    const source = readFileSync('src/lib/practice-engine.ts', 'utf8')
    expect(source.match(/telemetry: 'live'/g)).toHaveLength(3)
  })
})
