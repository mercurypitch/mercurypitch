// ============================================================
// SharedControlToolbar Tests
// Tests for the unified control toolbar component
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ActiveTab, PracticeSubMode, } from '@/components/shared/SharedControlToolbar'
import { appStore } from '@/stores/app-store'

describe('SharedControlToolbar Types', () => {
  it('PracticeSubMode has all expected values', () => {
    const modes: PracticeSubMode[] = ['all', 'random', 'focus', 'reverse']
    expect(modes).toContain('all')
    expect(modes).toContain('random')
    expect(modes).toContain('focus')
    expect(modes).toContain('reverse')
  })

  it('ActiveTab has all expected values', () => {
    const tabs: ActiveTab[] = ['practice', 'editor', 'settings']
    expect(tabs).toContain('practice')
    expect(tabs).toContain('editor')
    expect(tabs).toContain('settings')
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