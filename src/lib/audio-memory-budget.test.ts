// ============================================================
// Audio memory budget tests — device classing and the native override seam
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { audioMemoryBudget, decodedAudioBudgetBytes, encodedAudioBudgetBytes, nativeDeviceMemoryGb, setNativeDeviceMemoryGb, } from './audio-memory-budget'

const MIB = 1024 * 1024
const GIB = 1024 * MIB

afterEach(() => setNativeDeviceMemoryGb(null))

describe('audioMemoryBudget', () => {
  it('gives a reported-mobile device the conservative ceiling', () => {
    const budget = audioMemoryBudget({ mobile: true, deviceMemoryGb: 4 })

    expect(budget.deviceClass).toBe('mobile')
    expect(budget.encodedBytes).toBe(256 * MIB)
    expect(budget.decodedBytes).toBe(384 * MIB)
  })

  it('drops a low-memory phone further still', () => {
    const budget = audioMemoryBudget({ mobile: true, deviceMemoryGb: 2 })

    expect(budget.encodedBytes).toBe(128 * MIB)
    expect(budget.decodedBytes).toBe(192 * MIB)
  })

  it('trusts an explicit desktop claim over a narrow viewport', () => {
    // A desktop browser in a small window is still a desktop.
    const budget = audioMemoryBudget({ mobile: false, matchesNarrow: true })

    expect(budget.deviceClass).toBe('desktop')
    expect(budget.encodedBytes).toBe(2 * GIB)
  })

  it('falls back to viewport width when the platform will not say', () => {
    expect(audioMemoryBudget({ matchesNarrow: true }).deviceClass).toBe(
      'mobile',
    )
    expect(audioMemoryBudget({ matchesNarrow: false }).deviceClass).toBe(
      'desktop',
    )
  })

  it('gives a desktop the generous ceiling when memory is unreported', () => {
    const budget = audioMemoryBudget({
      mobile: false,
      deviceMemoryGb: undefined,
    })

    expect(budget.reportedMemoryGb).toBeNull()
    expect(budget.encodedBytes).toBe(2 * GIB)
    expect(budget.decodedBytes).toBe(4 * GIB)
  })

  it('treats the spec-capped 8 the same as any larger machine', () => {
    // navigator.deviceMemory clamps to 8, so a 64 GB workstation and an 8 GB
    // laptop are indistinguishable here. Both get the generous tier.
    expect(
      audioMemoryBudget({ mobile: false, deviceMemoryGb: 8 }),
    ).toMatchObject({ encodedBytes: 2 * GIB, decodedBytes: 4 * GIB })
  })

  it('scales a genuinely small desktop down', () => {
    expect(
      audioMemoryBudget({ mobile: false, deviceMemoryGb: 4 }),
    ).toMatchObject({ encodedBytes: 1 * GIB, decodedBytes: 2 * GIB })
    expect(
      audioMemoryBudget({ mobile: false, deviceMemoryGb: 2 }),
    ).toMatchObject({ encodedBytes: 384 * MIB, decodedBytes: 512 * MIB })
  })
})

describe('setNativeDeviceMemoryGb', () => {
  it('lets a native shell report the real figure the browser hides', () => {
    setNativeDeviceMemoryGb(64)
    const budget = audioMemoryBudget({ mobile: false })

    expect(nativeDeviceMemoryGb()).toBe(64)
    expect(budget.reportedMemoryGb).toBe(64)
    expect(budget.fromNativeReport).toBe(true)
    expect(budget.encodedBytes).toBe(2 * GIB)
  })

  it('lets a native shell report a small phone the browser flatters', () => {
    setNativeDeviceMemoryGb(2)
    const budget = audioMemoryBudget({ mobile: true })

    expect(budget.decodedBytes).toBe(192 * MIB)
  })

  it('ignores a nonsense figure and clears on null', () => {
    setNativeDeviceMemoryGb(Number.NaN)
    expect(nativeDeviceMemoryGb()).toBeNull()

    setNativeDeviceMemoryGb(16)
    setNativeDeviceMemoryGb(null)
    expect(nativeDeviceMemoryGb()).toBeNull()
    expect(audioMemoryBudget({ mobile: false }).fromNativeReport).toBe(false)
  })
})

describe('budget accessors', () => {
  it('read the same numbers the profile reports', () => {
    const budget = audioMemoryBudget()

    expect(encodedAudioBudgetBytes()).toBe(budget.encodedBytes)
    expect(decodedAudioBudgetBytes()).toBe(budget.decodedBytes)
  })
})
