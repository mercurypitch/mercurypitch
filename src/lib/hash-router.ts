// ============================================================
// Hash Router — Client-side hash-based routing
// ============================================================

import { TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PIANO, TAB_PITCH_ALGO, TAB_PITCH_TEST, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { decodeSharePayload } from '@/lib/share-codec'
import type { ActiveTab } from '@/stores'
import type { SettingsSection } from '@/stores/ui-store'

export type HashRoute =
  | { type: 'tab'; tab: ActiveTab }
  | { type: 'jam-room'; roomId: string }
  | { type: 'uvr-upload' }
  | { type: 'uvr-session'; sessionId: string }
  | { type: 'uvr-session-mixer'; sessionId: string }
  | { type: 'share-short'; shortId: string }
  | {
      type: 'share-load'
      shareType: 'melody' | 'exercise' | 'routine'
      payload: string
    }
  | { type: 'share-fallback'; shareType: string; shareId: string }
  | { type: 'learn' }
  | { type: 'learn-chapter'; chapterId: string }
  | { type: 'guide' }
  | { type: 'guide-start'; sectionId: string }
  /** Return from Stripe checkout (success_url / cancel_url in the
   *  db-worker's billing.ts) — lands on Settings → Credits. */
  | { type: 'billing-return'; outcome: 'success' | 'cancel' }
  /** A specific Settings sub-tab, e.g. #/settings/credits. */
  | { type: 'settings-section'; section: SettingsSection }
  | { type: 'admin-weekly' }
  | { type: 'unknown' }

const VALID_TABS: Set<string> = new Set([
  TAB_HOME,
  TAB_SINGING,
  TAB_PIANO,
  TAB_COMPOSE,
  TAB_SETTINGS,
  TAB_ANALYSIS,
  TAB_COMMUNITY,
  TAB_LEADERBOARD,
  TAB_CHALLENGES,
  TAB_KARAOKE,
  TAB_JAM,
  TAB_EXERCISES,
  TAB_GUITAR,
  TAB_PITCH_TEST,
  TAB_PITCH_ALGO,
])

// Keep in sync with GUIDE_SECTIONS ids in app-store.ts.
const VALID_GUIDE_SECTIONS: Set<string> = new Set([
  'practice',
  'toolbar',
  'editor',
  'effects',
  'settings-general',
  'settings-practice',
  'settings-display',
])

// Settings sub-tab <-> URL slug. The Practice section's internal value is
// 'singing'; its user-facing slug matches the tab label.
const SETTINGS_SLUG_TO_SECTION: Record<string, SettingsSection | undefined> = {
  account: 'account',
  practice: 'singing',
  display: 'display',
  credits: 'credits',
}

const SETTINGS_SECTION_TO_SLUG: Record<SettingsSection, string> = {
  account: 'account',
  singing: 'practice',
  display: 'display',
  credits: 'credits',
}

function isValidTab(tab: string): tab is ActiveTab {
  return VALID_TABS.has(tab)
}

/**
 * Parse the current window.location.hash into a HashRoute.
 * Leading `#` is stripped before parsing.
 *
 * Examples:
 *   #/singing               → { type: 'tab', tab: 'singing' }
 *   #/uvr/session/abc123    → { type: 'uvr-session', sessionId: 'abc123' }
 *   #/share?type=melody&id=xyz → { type: 'share-fallback', shareType: 'melody', shareId: 'xyz' }
 *   '' / #/unknown          → { type: 'unknown' }
 */
export function parseHash(rawHash: string): HashRoute {
  const hash = rawHash.replace(/^#/, '')

  if (!hash || hash === '/') {
    return { type: 'unknown' }
  }

  // Match: /jam:roomId
  const jamMatch = hash.match(/^\/jam:(.+)$/)
  if (jamMatch) {
    return { type: 'jam-room', roomId: jamMatch[1] }
  }

  // Match: /karaoke/session/:sessionId/mixer or /uvr/...
  const uvrMixerMatch = hash.match(/^\/(?:karaoke|uvr)\/session\/(.+)\/mixer$/)
  if (uvrMixerMatch) {
    return { type: 'uvr-session-mixer', sessionId: uvrMixerMatch[1] }
  }

  // Match: /karaoke/session/:sessionId or /uvr/...
  const uvrMatch = hash.match(/^\/(?:karaoke|uvr)\/session\/(.+)$/)
  if (uvrMatch) {
    return { type: 'uvr-session', sessionId: uvrMatch[1] }
  }

  // Match: /karaoke/upload or bare /karaoke (or /uvr/...)
  if (
    hash === '/karaoke/upload' ||
    hash === '/karaoke' ||
    hash === '/uvr/upload' ||
    hash === '/uvr'
  ) {
    return { type: 'uvr-upload' }
  }

  // Match: /s/:shortId — shortened share URL
  const shareShortMatch = hash.match(/^\/s\/([A-Za-z0-9]+)$/)
  if (shareShortMatch) {
    return { type: 'share-short', shortId: shareShortMatch[1] }
  }

  // Match: /share/{base64url-encoded payload} — self-contained shared content
  const shareLoadMatch = hash.match(/^\/share\/([A-Za-z0-9_-]+)$/)
  if (shareLoadMatch) {
    const decoded = decodeSharePayload(shareLoadMatch[1])
    if (
      decoded &&
      (decoded.t === 'melody' ||
        decoded.t === 'exercise' ||
        decoded.t === 'routine')
    ) {
      return {
        type: 'share-load',
        shareType: decoded.t,
        payload: shareLoadMatch[1],
      }
    }
  }

  // Match: /share?type=...&id=... — legacy community share fallback
  const shareFallbackMatch = hash.match(/^\/share\?type=([^&]+)&id=(.+)$/)
  if (shareFallbackMatch) {
    return {
      type: 'share-fallback',
      shareType: decodeURIComponent(shareFallbackMatch[1]),
      shareId: decodeURIComponent(shareFallbackMatch[2]),
    }
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

  // Stripe checkout return URLs (see workers/db-worker/src/billing.ts):
  // success lands on Settings → Account with a confirmation; the cancel URL
  // is /pricing, which is where the pricing panel lives too.
  if (hash === '/billing/success') {
    return { type: 'billing-return', outcome: 'success' }
  }
  if (hash === '/pricing') {
    return { type: 'billing-return', outcome: 'cancel' }
  }

  // Match: /settings/<section> — deep link to a Settings sub-tab. The
  // URL slug "practice" maps to the internal section value 'singing'.
  const settingsMatch = hash.match(/^\/settings\/([a-z-]+)$/)
  if (settingsMatch) {
    const section = SETTINGS_SLUG_TO_SECTION[settingsMatch[1]]
    if (section !== undefined) {
      return { type: 'settings-section', section }
    }
  }

  // Match: /admin/weekly (owner-only weekly-challenge authoring)
  if (hash === '/admin/weekly' || hash === '/admin') {
    return { type: 'admin-weekly' }
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
    case 'jam-room':
      return `/jam:${route.roomId}`
    case 'uvr-upload':
      return '/karaoke'
    case 'uvr-session':
      return `/karaoke/session/${route.sessionId}`
    case 'uvr-session-mixer':
      return `/karaoke/session/${route.sessionId}/mixer`
    case 'share-short':
      return `/s/${route.shortId}`
    case 'share-load':
      return `/share/${route.payload}`
    case 'share-fallback':
      return `/share?type=${encodeURIComponent(route.shareType)}&id=${encodeURIComponent(route.shareId)}`
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
    case 'billing-return':
      return route.outcome === 'success' ? '/billing/success' : '/pricing'
    case 'settings-section':
      return `/settings/${SETTINGS_SECTION_TO_SLUG[route.section]}`
    case 'admin-weekly':
      return '/admin/weekly'
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
