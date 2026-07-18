// ============================================================
// Platform services — web implementations.
// ============================================================
//
// The one seam between the app and the host platform. Components import
// `platform` (or the `haptics` re-export in @/lib/haptics) and never touch
// `navigator.vibrate` / wake locks / `@capacitor/*` APIs directly. The
// future Capacitor build swaps this module's implementations for plugin
// calls behind the same interface — one file, no component changes.
// (docs/plans/mobile-native/capacitor-readiness.md §A3)
//
// Every implementation here must be a safe no-op when the underlying web
// API is missing: these run in every browser, in jsdom tests, and inside
// WKWebView (where e.g. navigator.vibrate does not exist).

export interface HapticsService {
  /** Light tick for taps on primary controls. */
  tapLight(): void
  /** Positive pattern — score reveal, personal best, streak milestone. */
  success(): void
  /** Cautionary pattern — destructive confirm, run aborted. */
  warning(): void
}

export interface KeepAwakeService {
  /** Keep the screen on (during an active practice run). */
  enable(): Promise<void>
  /** Release the screen lock; safe to call when not held. */
  disable(): Promise<void>
}

export interface StatusBarService {
  /** Native builds restyle the OS status bar; on web this is a no-op
      (the static theme-color meta covers browser chrome). */
  setStyle(style: 'light' | 'dark'): void
}

export interface PlatformServices {
  haptics: HapticsService
  keepAwake: KeepAwakeService
  statusBar: StatusBarService
  /** Share via the native sheet where available; falls back to copying
      the URL. Resolves true when something was shared/copied. */
  share(data: { title?: string; text?: string; url?: string }): Promise<boolean>
  /** Open a URL outside the app shell. */
  openExternal(url: string): void
}

const canVibrate =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

const vibrate = (pattern: number | number[]): void => {
  if (!canVibrate) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* some browsers throw without a user gesture — a haptic is never worth an error */
  }
}

let wakeSentinel: WakeLockSentinel | null = null

export const platform: PlatformServices = {
  haptics: {
    tapLight: () => vibrate(10),
    success: () => vibrate([15, 30, 40]),
    warning: () => vibrate([30, 40, 30]),
  },

  keepAwake: {
    async enable() {
      if (wakeSentinel || typeof navigator === 'undefined') return
      if (!('wakeLock' in navigator)) return
      try {
        wakeSentinel = await navigator.wakeLock.request('screen')
        wakeSentinel.addEventListener('release', () => {
          wakeSentinel = null
        })
      } catch {
        /* denied (low battery, not visible) — practice works without it */
      }
    },
    async disable() {
      const sentinel = wakeSentinel
      wakeSentinel = null
      try {
        await sentinel?.release()
      } catch {
        /* already released */
      }
    },
  },

  statusBar: {
    setStyle() {
      /* web no-op — see StatusBarService docs */
    },
  },

  async share(data) {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(data)
        return true
      } catch {
        /* user dismissed the sheet, or data unsupported — try the fallback */
      }
    }
    const url = data.url ?? data.text
    if (url === undefined || url === '' || typeof navigator === 'undefined') {
      return false
    }
    try {
      // clipboard is absent in insecure contexts at runtime despite the
      // types — the catch covers the resulting TypeError as well as denial.
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  },

  openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
}
