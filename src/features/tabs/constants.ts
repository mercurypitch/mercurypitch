// ── Tab ID constants ───────────────────────────────────────────────
// Use these everywhere instead of raw strings.
// Renaming a tab is a single-line change here — no string-hunt needed.

export const TAB_SINGING = 'singing' as const
export const TAB_COMPOSE = 'compose' as const
export const TAB_SETTINGS = 'settings' as const
export const TAB_ANALYSIS = 'analysis' as const
export const TAB_COMMUNITY = 'community' as const
export const TAB_LEADERBOARD = 'leaderboard' as const
export const TAB_CHALLENGES = 'challenges' as const
export const TAB_KARAOKE = 'karaoke' as const
export const TAB_PITCH_TEST = 'pitch-test' as const
export const TAB_PITCH_ALGO = 'pitch-algo' as const

export type ActiveTab =
  | typeof TAB_SINGING
  | typeof TAB_COMPOSE
  | typeof TAB_SETTINGS
  | typeof TAB_ANALYSIS
  | typeof TAB_COMMUNITY
  | typeof TAB_LEADERBOARD
  | typeof TAB_CHALLENGES
  | typeof TAB_KARAOKE
  | typeof TAB_PITCH_TEST
  | typeof TAB_PITCH_ALGO

/** Default tab when the app loads. */
export const DEFAULT_TAB = TAB_SINGING

// ── PlaybackMode constants ──────────────────────────────────────────
// These are separate from tab IDs. `PLAYBACK_MODE_SESSION` is the
// string 'practice' which was previously overloaded as both a
// PlaybackMode value and the old ActiveTab value.

export const PLAYBACK_MODE_ONCE = 'once' as const
export const PLAYBACK_MODE_REPEAT = 'repeat' as const
export const PLAYBACK_MODE_SESSION = 'session' as const

export type PlaybackMode =
  | typeof PLAYBACK_MODE_ONCE
  | typeof PLAYBACK_MODE_REPEAT
  | typeof PLAYBACK_MODE_SESSION

// ── Walkthrough tab ─────────────────────────────────────────────────
// Walkthrough data can reference 'study' which is not a real UI tab.

export const WALKTHROUGH_TAB_STUDY = 'study' as const
export type WalkthroughTab = ActiveTab | typeof WALKTHROUGH_TAB_STUDY

// ── DOM helpers ─────────────────────────────────────────────────────

const TAB_TO_ELEMENT_ID: Record<ActiveTab, string> = {
  [TAB_SINGING]: 'singing',
  [TAB_COMPOSE]: 'compose',
  [TAB_SETTINGS]: 'settings',
  [TAB_ANALYSIS]: 'analysis',
  [TAB_COMMUNITY]: 'community',
  [TAB_LEADERBOARD]: 'leaderboard',
  [TAB_CHALLENGES]: 'challenges',
  [TAB_KARAOKE]: 'karaoke',
  [TAB_PITCH_TEST]: 'pitch-test',
  [TAB_PITCH_ALGO]: 'pitch-algo',
}

/** Returns the DOM element CSS selector for a tab button, e.g. `#tab-singing`. */
export function tabElementId(tab: ActiveTab): string {
  return `#tab-${TAB_TO_ELEMENT_ID[tab]}`
}

/** Builds a tab ID DOM element string from any active tab (used for ID attributes). */
export function tabButtonId(tab: ActiveTab): string {
  return `tab-${TAB_TO_ELEMENT_ID[tab]}`
}

/** Human-readable label for each tab (shown in UI). */
export function tabLabel(tab: ActiveTab): string {
  const labels: Record<ActiveTab, string> = {
    [TAB_SINGING]: 'Singing',
    [TAB_COMPOSE]: 'Compose',
    [TAB_SETTINGS]: 'Settings',
    [TAB_ANALYSIS]: 'Analysis',
    [TAB_COMMUNITY]: 'Community',
    [TAB_LEADERBOARD]: 'Leaderboard',
    [TAB_CHALLENGES]: 'Challenges',
    [TAB_KARAOKE]: 'Karaoke',
    [TAB_PITCH_TEST]: 'Pitch Analysis',
    [TAB_PITCH_ALGO]: 'Pitch Test',
  }
  return labels[tab]
}
