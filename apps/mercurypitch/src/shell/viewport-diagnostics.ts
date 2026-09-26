// ============================================================
// Viewport diagnostics — did the web view ever turn?
// ============================================================
//
// Device round 5: the app would not turn on the owner's iPhone, and nothing
// on the phone could say whether the web view had even been told. (It was the
// Control Center's portrait lock.) What comes back from a device round is the
// Audio section's copied report, so the answer goes there: the orientation,
// the window's size and the safe-area insets as rows, and one line in the
// record for every change, from launch — `orientationchange` and
// `screen.orientation`'s `change` as they arrive, and a resize once it has
// settled, because a turn is a burst of them.
//
// THE INSETS TWO WAYS. `--safe-*` is `env(safe-area-inset-*)` inside a custom
// property, and whether WebKit substitutes env() there is not known (PR 859
// final review, NB10): the alley reads `--safe-right` with getPropertyValue,
// and would read 0 on its side if it did not. So a row shows the property as
// getComputedStyle hands it back — `47px`, or the `env(...)` untouched —
// beside the inset a box padded with `var(--safe-*)` really gets.
//
// Test builds only, as the whole Developer screen is: main.tsx installs it
// behind VITE_PORTABLE_CONSOLE, through a dynamic import.

import type { AudioReport } from '@/lib/audio-diagnostics'
import { audioReporter } from '@/lib/audio-diagnostics'

/** A turn is a burst of resizes; the record keeps the one it settles on. */
export const RESIZE_SETTLE_MS = 250

const SIDES = ['top', 'right', 'bottom', 'left'] as const

/** `screen.orientation.type`, or what to say where the web view has none. */
function orientationType(): string {
  const screenOrientation = (
    globalThis.screen as { orientation?: { type?: string } } | undefined
  )?.orientation
  return screenOrientation?.type ?? 'not available'
}

/** Each `--safe-*` as the engine resolves the custom property, trimmed. */
function declaredInsets(): string[] {
  const style = window.getComputedStyle(document.documentElement)
  return SIDES.map(
    (side) => style.getPropertyValue(`--safe-${side}`).trim() || 'unset',
  )
}

/** What a box padded with `var(--safe-*)` gets, in CSS px; '?' if unread. */
function usedInsets(): string[] {
  const probe = document.createElement('div')
  probe.setAttribute('data-viewport-probe', '')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;' +
    'pointer-events:none;padding:var(--safe-top,0px) var(--safe-right,0px) ' +
    'var(--safe-bottom,0px) var(--safe-left,0px)'
  document.body.appendChild(probe)
  try {
    const style = window.getComputedStyle(probe)
    return [
      style.paddingTop,
      style.paddingRight,
      style.paddingBottom,
      style.paddingLeft,
    ].map((value) => {
      const px = Number.parseFloat(value)
      return Number.isFinite(px) ? String(Math.round(px * 10) / 10) : '?'
    })
  } finally {
    probe.remove()
  }
}

/** The Developer screen's Orientation row: `landscape-primary · 844 x 390`. */
export function orientationRow(): string {
  return `${orientationType()} · ${window.innerWidth} x ${window.innerHeight}`
}

/** The Safe insets row, top right bottom left: `0px 47px 21px 47px · in use 0 47 21 47`. */
export function safeInsetsRow(): string {
  return `${declaredInsets().join(' ')} · in use ${usedInsets().join(' ')}`
}

function reading(): Record<string, unknown> {
  return {
    orientation: orientationType(),
    w: window.innerWidth,
    h: window.innerHeight,
    safe: declaredInsets().join(' '),
  }
}

/**
 * Start writing the viewport into the record: a `launch` line now, then a
 * line per change. Returns the way to stop, for a test.
 */
export function installViewportDiagnostics(
  report: AudioReport = audioReporter('viewport'),
): () => void {
  // What the last settled line said. The two orientation events are written
  // as they arrive and do not move it: WebKit can send them before the
  // window has its new size, and the resize after them is the line that says
  // what the turn settled on.
  let settled = reading()
  report('launch', settled)

  const onOrientationChange = (): void => {
    report('orientationchange', reading())
  }
  const onScreenOrientation = (): void => {
    report('orientation', reading())
  }
  let settle: number | undefined
  const onResize = (): void => {
    window.clearTimeout(settle)
    settle = window.setTimeout(() => {
      const now = reading()
      const same = Object.keys(now).every((key) => now[key] === settled[key])
      if (same) return
      settled = now
      report('resize', now)
    }, RESIZE_SETTLE_MS)
  }

  const screenOrientation = (
    globalThis.screen as { orientation?: EventTarget } | undefined
  )?.orientation
  window.addEventListener('orientationchange', onOrientationChange)
  window.addEventListener('resize', onResize)
  screenOrientation?.addEventListener?.('change', onScreenOrientation)
  return () => {
    window.clearTimeout(settle)
    window.removeEventListener('orientationchange', onOrientationChange)
    window.removeEventListener('resize', onResize)
    screenOrientation?.removeEventListener?.('change', onScreenOrientation)
  }
}
