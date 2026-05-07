// ============================================================
// Hash Router — Client-side hash-based routing
// ============================================================

import type { ActiveTab } from '@/stores'

export type HashRoute =
  | { type: 'tab'; tab: ActiveTab }
  | { type: 'uvr-session'; sessionId: string }
  | { type: 'share'; shareType: string; shareId: string }
  | { type: 'unknown' }

const VALID_TABS: Set<string> = new Set([
  'practice',
  'editor',
  'settings',
  'vocal-analysis',
  'community',
  'leaderboard',
  'vocal-challenges',
  'uvr',
])

function isValidTab(tab: string): tab is ActiveTab {
  return VALID_TABS.has(tab)
}

/**
 * Parse the current window.location.hash into a HashRoute.
 * Leading `#` is stripped before parsing.
 *
 * Examples:
 *   #/practice              → { type: 'tab', tab: 'practice' }
 *   #/uvr/session/abc123    → { type: 'uvr-session', sessionId: 'abc123' }
 *   #/share?type=melody&id=xyz → { type: 'share', shareType: 'melody', shareId: 'xyz' }
 *   '' / #/unknown          → { type: 'unknown' }
 */
export function parseHash(rawHash: string): HashRoute {
  const hash = rawHash.replace(/^#/, '')

  if (!hash || hash === '/') {
    return { type: 'unknown' }
  }

  // Match: /uvr/session/:sessionId
  const uvrMatch = hash.match(/^\/uvr\/session\/(.+)$/)
  if (uvrMatch) {
    return { type: 'uvr-session', sessionId: uvrMatch[1] }
  }

  // Match: /share?type=...&id=...
  const shareMatch = hash.match(/^\/share\?type=([^&]+)&id=(.+)$/)
  if (shareMatch) {
    return { type: 'share', shareType: shareMatch[1], shareId: shareMatch[2] }
  }

  // Match: /tab-name
  const tabMatch = hash.match(/^\/([a-z-]+)$/)
  if (tabMatch && isValidTab(tabMatch[1])) {
    return { type: 'tab', tab: tabMatch[1] }
  }

  return { type: 'unknown' }
}

/**
 * Build a hash string (without leading #) from a HashRoute.
 */
export function buildHash(route: HashRoute): string {
  switch (route.type) {
    case 'tab':
      return `/${route.tab}`
    case 'uvr-session':
      return `/uvr/session/${route.sessionId}`
    case 'share':
      return `/share?type=${route.shareType}&id=${route.shareId}`
    case 'unknown':
      return '/'
  }
}

/**
 * Navigate to a hash route by setting window.location.hash.
 * Creates a new browser history entry.
 */
export function navigateTo(route: HashRoute): void {
  const hash = `#${buildHash(route)}`
  if (window.location.hash === hash) return
  window.location.hash = hash
}

/**
 * Replace the current hash without creating a new history entry.
 * Used for syncing signal state → URL (e.g., tab changes from UI clicks).
 */
export function replaceHash(route: HashRoute): void {
  const hash = `#${buildHash(route)}`
  if (window.location.hash === hash) return
  history.replaceState(null, '', hash)
}
