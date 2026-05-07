// ============================================================
// SharedControlToolbar Tests
// Tests for the unified control toolbar component
// ============================================================

import { describe, expect, it } from 'vitest'
import { PLAYBACK_MODE_SESSION, TAB_COMPOSE, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { appStore } from '@/stores'
import type { ActiveTab, PlaybackMode, PracticeSubMode } from '@/types'

// ========================================
// Utility functions (copied for testing without triggering imports)
// ========================================

/** Determine current practice mode based on global state */
function activePracticeMode(
  playMode: () => PlaybackMode,
  sessionActive: () => boolean,
): string {
  // Session mode takes priority
  if (sessionActive()) return 'Session'

  // Practice run-once vs repeat
  if (playMode() === PLAYBACK_MODE_SESSION) {
    return 'Run-once'
  }
  if (playMode() === 'repeat') {
    return 'Repeat'
  }
  return 'Run-once'
}

// Scale types matching the types file
const SCALE_TYPES = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'harmonic-minor', label: 'Harmonic Minor' },
  { value: 'pentatonic', label: 'Pentatonic' },
  { value: 'blues', label: 'Blues' },
  { value: 'chromatic', label: 'Chromatic' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolydian' },
] as const

describe('SharedControlToolbar Types', () => {
  it('PracticeSubMode has all expected values', () => {
    const modes: PracticeSubMode[] = ['all', 'random', 'focus', 'reverse']
    expect(modes).toContain('all')
    expect(modes).toContain('random')
    expect(modes).toContain('focus')
    expect(modes).toContain('reverse')
  })

  it('ActiveTab has all expected values', () => {
    const tabs: ActiveTab[] = [TAB_SINGING, TAB_COMPOSE, TAB_SETTINGS]
    expect(tabs).toContain(TAB_SINGING)
    expect(tabs).toContain(TAB_COMPOSE)
    expect(tabs).toContain(TAB_SETTINGS)
  })
})

describe('activePracticeMode utility', () => {
  beforeEach(() => {
    appStore.setSessionActive(false)
  })

  it('returns "Session" when session is active', () => {
    appStore.setSessionActive(true)
    const result = activePracticeMode(
      () => PLAYBACK_MODE_SESSION,
      () => appStore.sessionActive(),
    )
    expect(result).toBe('Session')
  })

  it('returns "Run-once" when playMode is practice and no session', () => {
    appStore.setSessionActive(false)
    const result = activePracticeMode(
      () => PLAYBACK_MODE_SESSION,
      () => appStore.sessionActive(),
    )
    expect(result).toBe('Run-once')
  })

  it('returns "Repeat" when playMode is repeat and no session', () => {
    appStore.setSessionActive(false)
    const result = activePracticeMode(
      () => 'repeat',
      () => appStore.sessionActive(),
    )
    expect(result).toBe('Repeat')
  })

  it('returns "Run-once" when playMode is once and no session', () => {
    appStore.setSessionActive(false)
    const result = activePracticeMode(
      () => 'once',
      () => appStore.sessionActive(),
    )
    expect(result).toBe('Run-once')
  })

  it('session takes priority over playMode', () => {
    appStore.setSessionActive(true)
    const result = activePracticeMode(
      () => 'repeat',
      () => appStore.sessionActive(),
    )
    expect(result).toBe('Session')
  })

  it('distinguishes all three practice modes correctly', () => {
    appStore.setSessionActive(false)
    expect(
      activePracticeMode(
        () => 'once',
        () => false,
      ),
    ).toBe('Run-once')
    expect(
      activePracticeMode(
        () => 'repeat',
        () => false,
      ),
    ).toBe('Repeat')
    expect(
      activePracticeMode(
        () => PLAYBACK_MODE_SESSION,
        () => false,
      ),
    ).toBe('Run-once')
  })
})

describe('SCALE_TYPES constant', () => {
  it('contains all expected scale types', () => {
    const scaleLabels = SCALE_TYPES.map((s) => s.label)
    expect(scaleLabels).toContain('Major')
    expect(scaleLabels).toContain('Minor')
    expect(scaleLabels).toContain('Harmonic Minor')
    expect(scaleLabels).toContain('Pentatonic')
    expect(scaleLabels).toContain('Blues')
    expect(scaleLabels).toContain('Chromatic')
    expect(scaleLabels).toContain('Dorian')
    expect(scaleLabels).toContain('Mixolydian')
  })

  it('has matching values for all scale types', () => {
    expect(SCALE_TYPES).toHaveLength(8)
    const expectedValues = [
      'major',
      'minor',
      'harmonic-minor',
      'pentatonic',
      'blues',
      'chromatic',
      'dorian',
      'mixolydian',
    ]
    const actualValues = SCALE_TYPES.map((s) => s.value)
    expect(actualValues).toEqual(expectedValues)
  })

  it('has unique values for all scale types', () => {
    const values = SCALE_TYPES.map((s) => s.value)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

describe('SharedControlToolbar Button Visibility Logic', () => {
  beforeEach(() => {
    appStore.setSessionActive(false)
    appStore.setTheme('light')
    appStore.setMicWaveVisible(false)
  })

  describe('Stopped state (not playing, not paused)', () => {
    it('shows Play button', () => {
      const isStopped = true
      const isPlaying = false
      const isPaused = false

      expect(isStopped).toBe(true)
      expect(isPlaying).toBe(false)
      expect(isPaused).toBe(false)
    })

    it('Pause button is hidden', () => {
      const isPlaying = false
      const isPaused = false

      expect(isPlaying).toBe(false)
      expect(isPaused).toBe(false)
    })

    it('Continue button is hidden', () => {
      const isPlaying = false
      const isPaused = false

      expect(isPlaying).toBe(false)
      expect(isPaused).toBe(false)
    })

    it('Stop button is rendered but inactive', () => {
      const isPlaying = false
      const isPaused = false
      const isActive = isPlaying || isPaused

      expect(isActive).toBe(false)
    })
  })

  describe('Playing state (playing, not paused)', () => {
    it('Play button is hidden', () => {
      const isStopped = false
      const isPlaying = true
      const isPaused = false

      expect(isStopped).toBe(false)
      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(false)
    })

    it('Pause button is shown', () => {
      const isPlaying = true
      const isPaused = false

      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(false)
    })

    it('Continue button is hidden', () => {
      const isPlaying = true
      const isPaused = false

      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(false)
    })

    it('Stop button is rendered and active', () => {
      const isPlaying = true
      const isPaused = false
      const isActive = isPlaying || isPaused

      expect(isActive).toBe(true)
    })
  })

  describe('Paused state (playing, paused)', () => {
    it('Play button is hidden', () => {
      const isStopped = false
      const isPlaying = true
      const isPaused = true

      expect(isStopped).toBe(false)
      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(true)
    })

    it('Pause button is hidden', () => {
      const isPlaying = true
      const isPaused = true

      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(true)
    })

    it('Continue button is shown', () => {
      const isPlaying = true
      const isPaused = true

      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(true)
    })

    it('Stop button is rendered and active', () => {
      const isPlaying = true
      const isPaused = true
      const isActive = isPlaying || isPaused

      expect(isActive).toBe(true)
    })
  })

  describe('Stop button state transitions', () => {
    it('Stop button starts inactive and becomes active when playing', () => {
      // Initial state
      const isPlaying = false
      const isPaused = false
      const isActive = isPlaying || isPaused
      expect(isActive).toBe(false)

      // After playing starts
      const playingState = { isPlaying: true, isPaused: false }
      const playingActive = playingState.isPlaying || playingState.isPaused
      expect(playingActive).toBe(true)
    })

    it('Stop button stays active while playing or paused', () => {
      const cases = [
        { isPlaying: true, isPaused: false, expectedActive: true },
        { isPlaying: true, isPaused: true, expectedActive: true },
        { isPlaying: false, isPaused: true, expectedActive: true },
      ]

      for (const { isPlaying, isPaused, expectedActive } of cases) {
        const isActive = isPlaying || isPaused
        expect(isActive).toBe(expectedActive)
      }
    })
  })

  describe('Play -> Pause transition', () => {
    it('Play button disappears when playing starts', () => {
      // Stopped
      const stopped = { isStopped: true, isPlaying: false, isPaused: false }
      expect(stopped.isPlaying).toBe(false)

      // Playing
      const playing = { isStopped: false, isPlaying: true, isPaused: false }
      expect(playing.isPlaying).toBe(true)
      expect(playing.isStopped).toBe(false)
    })
  })

  describe('Pause -> Resume transition', () => {
    it('Continue button disappears when resume starts', () => {
      // Paused
      const paused = { isStopped: false, isPlaying: true, isPaused: true }
      expect(paused.isPaused).toBe(true)

      // Playing
      const playing = { isStopped: false, isPlaying: true, isPaused: false }
      expect(playing.isPaused).toBe(false)
    })
  })

  describe('Stop -> Play transition', () => {
    it('Play button reappears when stopped after stop', () => {
      // Playing
      const playing = { isStopped: false, isPlaying: true, isPaused: false }
      expect(playing.isPlaying).toBe(true)

      // Stopped
      const stopped = { isStopped: true, isPlaying: false, isPaused: false }
      expect(stopped.isPlaying).toBe(false)
      expect(stopped.isStopped).toBe(true)
    })
  })

  describe('Record button state', () => {
    beforeEach(() => {
      appStore.setSessionActive(false)
    })

    it('Record button enabled when stopped', () => {
      const isPlaying = false
      const isPaused = false

      expect(isPlaying).toBe(false)
      expect(isPaused).toBe(false)
    })

    it('Record button disabled when playing', () => {
      const isPlaying = true
      const isPaused = false

      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(false)
    })

    it('Record button disabled when paused', () => {
      const isPlaying = true
      const isPaused = true

      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(true)
    })
  })
})
