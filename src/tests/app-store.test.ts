// ============================================================
// App Store Tests — Settings and persistence
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appStore, getBandRating, setBand, setDetectionThreshold, setMinAmplitude, setMinConfidence, setSensitivity, setSettings, } from '@/stores'
import { deleteAllUvrSessions, getUvrSession, importUvrSession, updateUvrSessionOutputs, } from '@/stores/app-store'
import { SENSITIVITY_PRESETS } from '@/stores/settings-store'

/**
 * The settings signal resolves its stored value once, at module init, so a
 * "fresh browser" case cannot be expressed by clearing localStorage alone —
 * a sibling test's setSettings() has already moved the live signal, and
 * removeItem does not move it back. Re-import after resetModules to get the
 * module-init path the assertion is actually about. Same shape as
 * karaoke-settings-store.test.ts.
 */
const loadFreshStores = async () => {
  vi.resetModules()
  const [stores, settingsStore] = await Promise.all([
    import('@/stores'),
    import('@/stores/settings-store'),
  ])
  return { ...stores, ...settingsStore }
}

describe('Settings — init and defaults', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
  })

  it('starts a fresh browser on the most forgiving profile', async () => {
    // Nothing has measured the room yet, and the two ways of being wrong are
    // not equivalent: too strict reads as a dead mic with no explanation
    // ('noisy' was the original default and did exactly that), too forgiving
    // lets a little room noise through, which is visible and fixable.
    // Asserted against the preset rather than by repeating its numbers, so
    // the label and the thresholds cannot drift apart.
    const fresh = await loadFreshStores()
    const s = fresh.appStore.settings()
    expect(s.detectionThreshold).toBe(
      fresh.SENSITIVITY_PRESETS.quiet.detectionThreshold,
    )
    expect(s.sensitivity).toBe(fresh.SENSITIVITY_PRESETS.quiet.sensitivity)
    expect(s.minConfidence).toBe(fresh.SENSITIVITY_PRESETS.quiet.minConfidence)
    expect(s.minAmplitude).toBe(fresh.SENSITIVITY_PRESETS.quiet.minAmplitude)
    expect(s.bands).toHaveLength(5)
  })

  it('labels that starting profile as the preset it actually is', async () => {
    // The sidebar/settings label and the thresholds are two halves of one
    // choice: a mismatch shows a preset the numbers do not reflect.
    const fresh = await loadFreshStores()
    expect(fresh.sensitivityPreset()).toBe('quiet')
    expect(SENSITIVITY_PRESETS.quiet.minConfidence).toBeLessThan(
      SENSITIVITY_PRESETS.home.minConfidence,
    )
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
    setSettings(stored)

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
  // getBandRating maps a cents error onto whichever band table is currently in
  // the settings signal. These cases used to assert against the table that the
  // 'loads from localStorage if present' case above happens to leave behind:
  // clearing localStorage does not reset an in-memory signal, so under a
  // shuffled order they failed (cents 5 scores 100 against the shipped
  // 'learning' table, not 90). Set the table this block is actually about, so
  // the expectations below are readable and independent of file order.
  const BANDS = [
    { threshold: 0, band: 100, color: '#3fb950' },
    { threshold: 10, band: 90, color: '#58a6ff' },
    { threshold: 25, band: 75, color: '#2dd4bf' },
    { threshold: 50, band: 50, color: '#d29922' },
    { threshold: 999, band: 0, color: '#f85149' },
  ]

  beforeEach(() => {
    localStorage.removeItem('pitchperfect_settings')
    setSettings((prev) => ({ ...prev, bands: BANDS }))
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

describe('updateUvrSessionOutputs', () => {
  beforeEach(() => {
    deleteAllUvrSessions()
  })

  it('preserves an existing instrumentalMidi output across updates', () => {
    importUvrSession({
      sessionId: 'uvr-test-session',
      status: 'processing',
      progress: 50,
      originalFile: { name: 'song.mp3', size: 100, mimeType: 'audio/mp3' },
      outputs: { instrumentalMidi: 'instrumental.mid' },
      createdAt: 0,
    })

    updateUvrSessionOutputs('uvr-test-session', [
      { stem: 'vocal', path: 'vocal.wav' },
      { stem: 'instrumental', path: 'instrumental.wav' },
    ])

    const session = getUvrSession('uvr-test-session')
    expect(session?.outputs?.vocal).toBe('vocal.wav')
    expect(session?.outputs?.instrumental).toBe('instrumental.wav')
    expect(session?.outputs?.instrumentalMidi).toBe('instrumental.mid')
  })
})
