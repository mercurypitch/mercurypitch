// Development capability tests — explicit native/deployed policy wins over the bundler's server flag.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasDevelopmentTuning } from './development-tuning'

describe('development tuning capability', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('keeps compiled CI and deployed development controls available', () => {
    vi.stubEnv('DEV', false)
    expect(hasDevelopmentTuning({ developmentTuning: true })).toBe(true)
    expect(hasDevelopmentTuning({})).toBe(false)
  })
  it('honors release opt-out even when previewed by a development server', () => {
    vi.stubEnv('DEV', true)
    expect(hasDevelopmentTuning({ developmentTuning: false })).toBe(false)
    expect(hasDevelopmentTuning({})).toBe(true)
  })
})
