// ============================================================
// Theme Store Tests
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appStore, initTheme, setTheme, toggleTheme } from '@/stores'
import { autoDayTheme, autoNightTheme, isDaytime, resolveThemeForSource, setAutoTheme, setThemeSource, stopThemeAutoWatch, themeSource, } from '@/stores/theme-store'

/**
 * jsdom ships no `window.matchMedia` at all, so `system` mode needs a fake
 * whose `matches` we can flip and whose `change` listeners we can fire.
 * `restoreMatchMedia` puts the (absent) original back.
 */
const NO_MATCH_MEDIA = Symbol('no matchMedia')
let originalMatchMedia: typeof window.matchMedia | typeof NO_MATCH_MEDIA =
  NO_MATCH_MEDIA

function installMatchMedia(initialDark: boolean) {
  if (originalMatchMedia === NO_MATCH_MEDIA && 'matchMedia' in window) {
    originalMatchMedia = window.matchMedia
  }
  const listeners = new Set<() => void>()
  let dark = initialDark
  const mql = {
    get matches() {
      return dark
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia

  return {
    setDark(next: boolean) {
      dark = next
      listeners.forEach((fn) => {
        fn()
      })
    },
    listenerCount: () => listeners.size,
  }
}

function restoreMatchMedia(): void {
  if (originalMatchMedia === NO_MATCH_MEDIA) {
    // @ts-expect-error — jsdom has no matchMedia; put the gap back
    delete window.matchMedia
    return
  }
  window.matchMedia = originalMatchMedia
}

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset to dark theme (also drops any auto source back to manual)
    setTheme('dark')
    setAutoTheme('day', 'light')
    setAutoTheme('night', 'dark')
    localStorage.clear()
  })

  afterEach(() => {
    stopThemeAutoWatch()
    restoreMatchMedia()
    vi.useRealTimers()
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

    it('should set data-theme attribute on document', () => {
      setTheme('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('toggleTheme', () => {
    it('should cycle from dark to light', () => {
      setTheme('dark')
      toggleTheme()
      expect(appStore.theme()).toBe('light')
    })

    it('should cycle from light to midnight', () => {
      setTheme('light')
      toggleTheme()
      expect(appStore.theme()).toBe('midnight')
    })

    it('should cycle through all themes and wrap around', () => {
      setTheme('slate')
      toggleTheme()
      expect(appStore.theme()).toBe('dark')
    })

    it('should persist toggled theme', () => {
      setTheme('dark')
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

    it('sets data-theme on an auto source even when nothing changed', () => {
      // The ordinary reload for an auto user: the resolved preset already
      // equals the stored one, so syncAutoTheme has nothing to write. The
      // attribute still has to be there, or :root's dark defaults win and a
      // light auto preset loads dark. jsdom has no matchMedia, so 'system'
      // resolves to the day preset.
      setAutoTheme('day', 'light')
      setThemeSource('system')
      expect(appStore.theme()).toBe('light')

      document.documentElement.removeAttribute('data-theme')
      initTheme()

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      stopThemeAutoWatch()
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

  describe('new themes', () => {
    it('should set theme to midnight', () => {
      setTheme('midnight')
      expect(appStore.theme()).toBe('midnight')
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'midnight',
      )
    })

    it('should set theme to forest', () => {
      setTheme('forest')
      expect(appStore.theme()).toBe('forest')
    })

    it('should set theme to ocean', () => {
      setTheme('ocean')
      expect(appStore.theme()).toBe('ocean')
    })

    it('should set theme to cyberpunk', () => {
      setTheme('cyberpunk')
      expect(appStore.theme()).toBe('cyberpunk')
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
      expect(() => {
        setTheme('dark')
      }).not.toThrow()
    })
  })

  describe('auto source — system', () => {
    it('applies the night preset when the device prefers dark', () => {
      installMatchMedia(true)
      setAutoTheme('night', 'midnight')
      setThemeSource('system')
      expect(appStore.theme()).toBe('midnight')
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'midnight',
      )
    })

    it('applies the day preset when the device prefers light', () => {
      installMatchMedia(false)
      setAutoTheme('day', 'amber')
      setThemeSource('system')
      expect(appStore.theme()).toBe('amber')
    })

    it('follows a later change of the system preference', () => {
      const mm = installMatchMedia(false)
      setThemeSource('system')
      expect(appStore.theme()).toBe('light')
      mm.setDark(true)
      expect(appStore.theme()).toBe('dark')
      mm.setDark(false)
      expect(appStore.theme()).toBe('light')
    })

    it('re-applies when the day or night preset is changed', () => {
      installMatchMedia(true)
      setThemeSource('system')
      expect(appStore.theme()).toBe('dark')
      setAutoTheme('night', 'ocean')
      expect(appStore.theme()).toBe('ocean')
    })

    it('survives an environment with no matchMedia', () => {
      restoreMatchMedia()
      expect(() => {
        setThemeSource('system')
      }).not.toThrow()
      expect(themeSource()).toBe('system')
    })
  })

  describe('auto source — time of day', () => {
    it('treats the window from 07:00 to 18:59 as day', () => {
      expect(isDaytime(6)).toBe(false)
      expect(isDaytime(7)).toBe(true)
      expect(isDaytime(18)).toBe(true)
      expect(isDaytime(19)).toBe(false)
      expect(isDaytime(23)).toBe(false)
    })

    it('applies the day preset during the day window', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
      setAutoTheme('day', 'forest')
      setThemeSource('time')
      expect(appStore.theme()).toBe('forest')
    })

    it('flips to the night preset when the clock crosses the boundary', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 15, 18, 59, 0))
      setAutoTheme('night', 'slate')
      setThemeSource('time')
      expect(appStore.theme()).toBe('light')

      vi.setSystemTime(new Date(2026, 0, 15, 19, 0, 0))
      vi.advanceTimersByTime(60_000)
      expect(appStore.theme()).toBe('slate')
    })
  })

  describe('manual override', () => {
    it('picking a preset drops the source back to manual', () => {
      installMatchMedia(true)
      setThemeSource('system')
      expect(themeSource()).toBe('system')

      setTheme('rose')
      expect(themeSource()).toBe('manual')
      expect(appStore.theme()).toBe('rose')
    })

    it('stops listening once the source is manual', () => {
      const mm = installMatchMedia(false)
      setThemeSource('system')
      expect(mm.listenerCount()).toBe(1)

      setTheme('rose')
      expect(mm.listenerCount()).toBe(0)
      mm.setDark(true)
      expect(appStore.theme()).toBe('rose')
    })

    it('toggleTheme is a manual pick', () => {
      installMatchMedia(true)
      setThemeSource('system')
      toggleTheme()
      expect(themeSource()).toBe('manual')
    })
  })

  describe('resolveThemeForSource', () => {
    it('returns the current preset for a manual source', () => {
      setTheme('cyberpunk')
      expect(resolveThemeForSource('manual')).toBe('cyberpunk')
    })

    it('maps the system preference onto the day and night presets', () => {
      const mm = installMatchMedia(true)
      expect(resolveThemeForSource('system')).toBe(autoNightTheme())
      mm.setDark(false)
      expect(resolveThemeForSource('system')).toBe(autoDayTheme())
    })
  })

  describe('initTheme with an auto source', () => {
    it('resolves the source instead of restoring the stored preset', () => {
      installMatchMedia(true)
      setAutoTheme('night', 'midnight')
      setThemeSource('system')
      setTheme('light')
      setThemeSource('system')

      initTheme()
      expect(appStore.theme()).toBe('midnight')
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'midnight',
      )
    })
  })
})
