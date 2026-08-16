// ============================================================
// Accuracy bands — the Perfect band must be reachable
// (CLAUDE-JOURNEY-020)
// ============================================================
//
// Every band table is consumed as `avgCents <= threshold`, and avgCents is
// an absolute deviation. A threshold of 0 therefore admits only an exact
// 0.0-cent reading — measure zero on a continuous pitch trace — so a
// "Perfect" row with threshold 0 is a band no singer can enter. The
// Professional preset shipped exactly that row, and the Accuracy Bands
// editor (whose Perfect field declares min="1") displayed the 0 it had
// just installed as an invalid value. These tests pin the floor at 1
// everywhere a threshold can come from: the preset, the setter, the
// persisted-settings load, and the practice engine's fallback table.

import { render } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TierSelector } from '@/components/TierSelector'
import { centsToBand } from '@/lib/practice-engine'
import { applyAccuracyTier, getAccuracyTierInfo, getBandRating, setBand, settings, } from '@/stores/settings-store'

describe('professional tier bands', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('installs no unreachable band — every scoring threshold is at least 1', () => {
    applyAccuracyTier('professional')
    for (const band of settings().bands) {
      if (band.band > 0) {
        expect(
          band.threshold,
          `band ${band.band} has an unreachable threshold`,
        ).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('lets a half-cent-accurate singer actually score Perfect', () => {
    applyAccuracyTier('professional')
    expect(getBandRating(0.5)).toBe(100)
  })

  it('keeps the Perfect field valid against its own min="1"', () => {
    // The Accuracy Bands editor's Perfect input declares min="1" max="50";
    // whatever a preset writes must satisfy the field that displays it.
    applyAccuracyTier('professional')
    const perfect = settings().bands.find((b) => b.band === 100)
    expect(perfect).toBeDefined()
    expect(perfect!.threshold).toBeGreaterThanOrEqual(1)
    expect(perfect!.threshold).toBeLessThanOrEqual(50)
  })

  it('describes the tier with the threshold it actually applies', () => {
    applyAccuracyTier('professional')
    const perfect = settings().bands.find((b) => b.band === 100)!
    const described = getAccuracyTierInfo('professional').description
    expect(described).toContain(
      `${perfect.threshold} cent${perfect.threshold === 1 ? '' : 's'}`,
    )
  })
})

describe('setBand', () => {
  beforeEach(() => {
    localStorage.clear()
    applyAccuracyTier('learning')
  })

  it('refuses to store a 0 the editor field itself rejects', () => {
    // parseInt('') || 0 in the panel used to smuggle a 0 in on field-clear.
    const idx = settings().bands.findIndex((b) => b.band === 100)
    setBand(idx, 0)
    const perfect = settings().bands.find((b) => b.band === 100)
    expect(perfect!.threshold).toBeGreaterThanOrEqual(1)
  })

  it('floors a non-finite threshold instead of storing NaN', () => {
    const idx = settings().bands.findIndex((b) => b.band === 100)
    setBand(idx, Number.NaN)
    const perfect = settings().bands.find((b) => b.band === 100)
    expect(Number.isFinite(perfect!.threshold)).toBe(true)
    expect(perfect!.threshold).toBeGreaterThanOrEqual(1)
  })
})

describe('persisted settings from the broken preset', () => {
  it('heals a stored threshold-0 band on load', async () => {
    // Users who picked Professional before the fix have threshold 0 in
    // localStorage; the preset fix alone would leave them stuck until they
    // re-click the tier. The store must clamp scoring bands on read.
    vi.resetModules()
    localStorage.clear()
    localStorage.setItem(
      'pitchperfect_settings',
      JSON.stringify({
        detectionThreshold: 0.15,
        sensitivity: 7,
        minConfidence: 0.6,
        minAmplitude: 3,
        tonicAnchor: false,
        bands: [
          { threshold: 0, band: 100, color: '#3fb950' },
          { threshold: 3, band: 90, color: '#58a6ff' },
          { threshold: 8, band: 75, color: '#2dd4bf' },
          { threshold: 15, band: 50, color: '#d29922' },
          { threshold: 999, band: 0, color: '#f85149' },
        ],
      }),
    )
    const store = await import('@/stores/settings-store')
    const bands = store.settings().bands
    const perfect = bands.find((b) => b.band === 100)
    expect(perfect!.threshold).toBeGreaterThanOrEqual(1)
    // The catch-all row is not a scoring band and stays put.
    expect(bands.find((b) => b.band === 0)!.threshold).toBe(999)
    // The rest of the stored settings survive untouched.
    expect(store.settings().sensitivity).toBe(7)
  })
  it('passes a bands-less stored blob through untouched', async () => {
    // Defensive arm: an older or partial persisted shape without a bands
    // array must load without the healer throwing on it.
    vi.resetModules()
    localStorage.clear()
    localStorage.setItem(
      'pitchperfect_settings',
      JSON.stringify({
        detectionThreshold: 0.12,
        sensitivity: 6,
        minConfidence: 0.5,
        minAmplitude: 2,
      }),
    )
    const store = await import('@/stores/settings-store')
    expect(store.settings().detectionThreshold).toBe(0.12)
  })
})

describe('practice engine fallback bands', () => {
  it('gives centsToBand a reachable Perfect without explicit bands', () => {
    // NoteList calls centsToBand(avgCents) with no table; the fallback's
    // Perfect row was threshold 0 — unreachable for every real note.
    expect(centsToBand(0.5)).toBe(100)
  })
})

describe('TierSelector copy', () => {
  it('advertises the Professional tier with its real, reachable threshold', () => {
    const { container } = render(() => <TierSelector />)
    const text = container.textContent ?? ''
    expect(text).toContain('\u00b11 cent')
    expect(text).not.toContain('\u00b10 cents')
    const professional = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Professional'),
    )
    expect(professional?.title).toContain('within 1 cent')
  })
})
