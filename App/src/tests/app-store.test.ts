// ============================================================
// App Store Tests — Settings and persistence
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { appStore, getBandRating, initSettings, setBand, setDetectionThreshold, setMinAmplitude, setMinConfidence, setSensitivity, } from '@/stores'

describe('Settings — init and defaults', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    initSettings()
  })

  it('loads default settings when no localStorage', () => {
    const s = appStore.settings()
    expect(s.detectionThreshold).toBe(0.1)
    expect(s.sensitivity).toBe(5)
    expect(s.minConfidence).toBe(0.3)
    expect(s.minAmplitude).toBe(1)
    expect(s.bands).toHaveLength(5)
  })

  it('loads from localStorage if present', () => {
    const stored = {
      detectionThreshold: 0.15,
      sensitivity: 8,
      minConfidence: 0.6,
      minAmplitude: 7,
      bands: [
        { threshold: 0, band: 100, color: '#3fb950' },
        { threshold: 10, band: 90, color: '#58a6ff' },
        { threshold: 25, band: 75, color: '#2dd4bf' },
        { threshold: 50, band: 50, color: '#d29922' },
        { threshold: 999, band: 0, color: '#f85149' },
      ],
    }
    localStorage.setItem('pitchperfect_settings', JSON.stringify(stored))
    initSettings()

    const s = appStore.settings()
    expect(s.detectionThreshold).toBe(0.15)
    expect(s.sensitivity).toBe(8)
    expect(s.minConfidence).toBe(0.6)
    expect(s.minAmplitude).toBe(7)
  })
})

describe('Settings — setDetectionThreshold', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    initSettings()
  })

  it('sets threshold within valid range', () => {
    setDetectionThreshold(0.15)
    expect(appStore.settings().detectionThreshold).toBe(0.15)
  })

  it('clamps to minimum 0.05', () => {
    setDetectionThreshold(0.01)
    expect(appStore.settings().detectionThreshold).toBe(0.05)
  })

  it('clamps to maximum 0.20', () => {
    setDetectionThreshold(0.3)
    expect(appStore.settings().detectionThreshold).toBe(0.2)
  })

  it('persists to localStorage', () => {
    setDetectionThreshold(0.18)
    const stored = JSON.parse(localStorage.getItem('pitchperfect_settings')!)
    expect(stored.detectionThreshold).toBe(0.18)
  })
})

describe('Settings — setSensitivity', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    initSettings()
  })

  it('sets sensitivity within valid range', () => {
    setSensitivity(8)
    expect(appStore.settings().sensitivity).toBe(8)
  })

  it('clamps to minimum 1', () => {
    setSensitivity(0)
    expect(appStore.settings().sensitivity).toBe(1)
  })

  it('clamps to maximum 10', () => {
    setSensitivity(15)
    expect(appStore.settings().sensitivity).toBe(10)
  })
})

describe('Settings — setMinConfidence', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    initSettings()
  })

  it('sets minConfidence within valid range', () => {
    setMinConfidence(0.7)
    expect(appStore.settings().minConfidence).toBe(0.7)
  })

  it('clamps to minimum 0.30', () => {
    setMinConfidence(0.1)
    expect(appStore.settings().minConfidence).toBe(0.3)
  })

  it('clamps to maximum 0.90', () => {
    setMinConfidence(1.0)
    expect(appStore.settings().minConfidence).toBe(0.9)
  })
})

describe('Settings — setMinAmplitude', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    initSettings()
  })

  it('sets minAmplitude within valid range', () => {
    setMinAmplitude(7)
    expect(appStore.settings().minAmplitude).toBe(7)
  })

  it('clamps to minimum 1', () => {
    setMinAmplitude(0)
    expect(appStore.settings().minAmplitude).toBe(1)
  })

  it('clamps to maximum 10', () => {
    setMinAmplitude(15)
    expect(appStore.settings().minAmplitude).toBe(10)
  })
})

describe('Settings — setBand', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    initSettings()
  })

  it('updates a band threshold', () => {
    setBand(1, 15)
    const bands = appStore.settings().bands
    // Band with threshold=15 should be in the sorted position
    const hasThreshold15 = bands.some((b) => b.threshold === 15)
    expect(hasThreshold15).toBe(true)
  })

  it('persists band changes to localStorage', () => {
    setBand(0, 3)
    const stored = JSON.parse(localStorage.getItem('pitchperfect_settings')!)
    const band100 = stored.bands.find(
      (b: { band: number; threshold: number }) => b.band === 100,
    )
    expect(band100.threshold).toBe(3)
  })
})

describe('Settings — getBandRating', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    initSettings()
  })

  it('returns 100 for cents <= 0', () => {
    expect(getBandRating(0)).toBe(100)
  })

  it('returns 90 for cents between 1 and 10', () => {
    expect(getBandRating(5)).toBe(90)
    expect(getBandRating(10)).toBe(90)
  })

  it('returns 75 for cents between 11 and 25', () => {
    expect(getBandRating(20)).toBe(75)
    expect(getBandRating(25)).toBe(75)
  })

  it('returns 50 for cents between 26 and 50', () => {
    expect(getBandRating(30)).toBe(50)
    expect(getBandRating(50)).toBe(50)
  })

  it('returns 0 for cents > 50', () => {
    expect(getBandRating(51)).toBe(0)
    expect(getBandRating(100)).toBe(0)
    expect(getBandRating(500)).toBe(0)
  })

  it('returns 0 for null', () => {
    expect(getBandRating(null)).toBe(0)
  })
})
