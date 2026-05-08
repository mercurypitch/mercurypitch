// ============================================================
// Hash Router — Client-side hash-based routing
// ============================================================

import type { ActiveTab } from '@/stores'

export type HashRoute =
  | { type: 'tab'; tab: ActiveTab }
  | { type: 'uvr-upload' }
  | { type: 'uvr-history' }
  | { type: 'uvr-session'; sessionId: string }
  | { type: 'uvr-session-mixer'; sessionId: string }
  | { type: 'share'; shareType: string; shareId: string }
  | { type: 'learn' }
  | { type: 'learn-chapter'; chapterId: string }
  | { type: 'guide' }
  | { type: 'guide-start'; sectionId: string }
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

const VALID_GUIDE_SECTIONS: Set<string> = new Set([
  'practice',
  'toolbar',
  'editor',
  'settings',
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

  // Match: /uvr/session/:sessionId/mixer
  const uvrMixerMatch = hash.match(/^\/uvr\/session\/(.+)\/mixer$/)
  if (uvrMixerMatch) {
    return { type: 'uvr-session-mixer', sessionId: uvrMixerMatch[1] }
  }

  // Match: /uvr/session/:sessionId
  const uvrMatch = hash.match(/^\/uvr\/session\/(.+)$/)
  if (uvrMatch) {
    return { type: 'uvr-session', sessionId: uvrMatch[1] }
  }

  // Match: /uvr/history
  if (hash === '/uvr/history') {
    return { type: 'uvr-history' }
  }

  // Match: /uvr/upload or bare /uvr
  if (hash === '/uvr/upload' || hash === '/uvr') {
    return { type: 'uvr-upload' }
  }

  // Match: /share?type=...&id=...
  const shareMatch = hash.match(/^\/share\?type=([^&]+)&id=(.+)$/)
  if (shareMatch) {
    return { type: 'share', shareType: shareMatch[1], shareId: shareMatch[2] }
  }

  // Match: /learn/:chapterId
  const learnChapterMatch = hash.match(/^\/learn\/(.+)$/)
  if (learnChapterMatch) {
    return { type: 'learn-chapter', chapterId: learnChapterMatch[1] }
  }

  // Match: /learn
  if (hash === '/learn') {
    return { type: 'learn' }
  }

  // Match: /guide/all
  if (hash === '/guide/all') {
    return { type: 'guide-start', sectionId: 'all' }
  }

  // Match: /guide/:sectionId
  const guideSectionMatch = hash.match(/^\/guide\/([a-z-]+)$/)
  if (guideSectionMatch && VALID_GUIDE_SECTIONS.has(guideSectionMatch[1])) {
    return { type: 'guide-start', sectionId: guideSectionMatch[1] }
  }

  // Match: /guide
  if (hash === '/guide') {
    return { type: 'guide' }
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
    case 'uvr-upload':
      return '/uvr'
    case 'uvr-history':
      return '/uvr/history'
    case 'uvr-session':
      return `/uvr/session/${route.sessionId}`
    case 'uvr-session-mixer':
      return `/uvr/session/${route.sessionId}/mixer`
    case 'share':
      return `/share?type=${route.shareType}&id=${route.shareId}`
    case 'learn':
      return '/learn'
    case 'learn-chapter':
      return `/learn/${route.chapterId}`
    case 'guide':
      return '/guide'
    case 'guide-start':
      return route.sectionId === 'all'
        ? '/guide/all'
        : `/guide/${route.sectionId}`
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
