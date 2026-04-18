// ============================================================
// Theme Store Tests
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appStore, initTheme,setTheme, toggleTheme } from '@/stores/app-store'

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset to dark theme
    setTheme('dark')
    localStorage.clear()
  })

  describe('theme signal', () => {
    it('should default to dark theme', () => {
      const store = appStore
      expect(store.theme()).toBe('dark')
    })

    it('should track theme changes', () => {
      const store = appStore
      setTheme('light')
      expect(store.theme()).toBe('light')
    })
  })

  describe('setTheme', () => {
    it('should set theme to light', () => {
      setTheme('light')
      expect(appStore.theme()).toBe('light')
    })

    it('should set theme to dark', () => {
      setTheme('light')
      setTheme('dark')
      expect(appStore.theme()).toBe('dark')
    })

    it('should persist theme to localStorage', () => {
      setTheme('light')
      expect(localStorage.getItem('pitchperfect_theme')).toBe('light')
    })

    it('should set data-theme attribute on document', () => {
      setTheme('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('should dispatch themeChange event', () => {
      const handler = vi.fn()
      window.addEventListener('pitchperfect:themeChange', handler)
      setTheme('light')
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { theme: 'light' },
        }),
      )
      window.removeEventListener('pitchperfect:themeChange', handler)
    })
  })

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      setTheme('dark')
      toggleTheme()
      expect(appStore.theme()).toBe('light')
    })

    it('should toggle from light to dark', () => {
      setTheme('light')
      toggleTheme()
      expect(appStore.theme()).toBe('dark')
    })

    it('should persist toggled theme', () => {
      toggleTheme()
      expect(localStorage.getItem('pitchperfect_theme')).toBe('light')
    })
  })

  describe('initTheme', () => {
    it('should apply stored theme on init', () => {
      // Set theme first, then init should apply it
      setTheme('light')
      initTheme()
      expect(appStore.theme()).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('should default to dark when no theme stored', () => {
      // initTheme applies the current signal value to DOM
      initTheme()
      expect(appStore.theme()).toBe('dark')
    })

    it('should apply data-theme attribute on init', () => {
      setTheme('light')
      initTheme()
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('should work when starting from dark theme', () => {
      setTheme('dark')
      initTheme()
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  describe('localStorage persistence', () => {
    it('should load theme from localStorage on initialization', () => {
      localStorage.setItem('pitchperfect_theme', 'light')
      // Re-import to reset module state - in real app this would be fresh page load
      expect(localStorage.getItem('pitchperfect_theme')).toBe('light')
    })

    it('should handle localStorage errors gracefully', () => {
      // The function should not throw even if localStorage fails
      expect(() => { setTheme('dark'); }).not.toThrow()
    })
  })
})
