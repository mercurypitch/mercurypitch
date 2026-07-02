// ── Tab ID constants ───────────────────────────────────────────────
// Use these everywhere instead of raw strings.
// Renaming a tab is a single-line change here — no string-hunt needed.

export const TAB_SINGING = 'singing' as const
export const TAB_PIANO = 'piano' as const
export const TAB_COMPOSE = 'compose' as const
export const TAB_SETTINGS = 'settings' as const
export const TAB_ANALYSIS = 'analysis' as const
export const TAB_COMMUNITY = 'community' as const
export const TAB_LEADERBOARD = 'leaderboard' as const
export const TAB_CHALLENGES = 'challenges' as const
export const TAB_KARAOKE = 'karaoke' as const
export const TAB_PITCH_TEST = 'pitch-test' as const
export const TAB_PITCH_ALGO = 'pitch-algo' as const
export const TAB_EXERCISES = 'exercises' as const
export const TAB_JAM = 'jam' as const
export const TAB_GUITAR = 'guitar' as const

export type ActiveTab =
  | typeof TAB_SINGING
  | typeof TAB_PIANO
  | typeof TAB_COMPOSE
  | typeof TAB_SETTINGS
  | typeof TAB_ANALYSIS
  | typeof TAB_COMMUNITY
  | typeof TAB_LEADERBOARD
  | typeof TAB_CHALLENGES
  | typeof TAB_KARAOKE
  | typeof TAB_PITCH_TEST
  | typeof TAB_PITCH_ALGO
  | typeof TAB_EXERCISES
  | typeof TAB_JAM
  | typeof TAB_GUITAR

/** Default tab when the app loads. */
export const DEFAULT_TAB = TAB_SINGING

// ── Canonical tab order & grouping ──────────────────────────────────
// SINGLE source of truth for the order tabs appear in. Both the visible
// tab bar (`AppNavTabs`) and the mobile swipe navigation (`App.tsx`) derive
// their order from here, so swapping two tabs is a one-line change that keeps
// the bar and the swipe gesture in sync — they can no longer drift apart.

export interface TabGroupDef {
  readonly id: string
  readonly label: string
  readonly tabs: readonly ActiveTab[]
}

export const TAB_GROUPS: readonly TabGroupDef[] = [
  {
    id: 'practice',
    label: 'Practice',
    tabs: [TAB_SINGING, TAB_PIANO, TAB_GUITAR, TAB_EXERCISES, TAB_KARAOKE],
  },
  {
    id: 'social',
    label: 'Social',
    tabs: [TAB_COMMUNITY, TAB_LEADERBOARD, TAB_CHALLENGES, TAB_JAM],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    tabs: [TAB_COMPOSE, TAB_ANALYSIS, TAB_SETTINGS],
  },
]

/**
 * Flattened canonical tab order. The mobile swipe gesture steps through this
 * list, so a left/right swipe always follows the visual order of the tab bar.
 */
export const TAB_ORDER: readonly ActiveTab[] = TAB_GROUPS.flatMap((g) => [
  ...g.tabs,
])

// ── Practice scope & UI mode visibility ─────────────────────────────
// Two orthogonal user settings (persisted in settings-store) drive which
// tabs exist in the UI:
//  - practice scope: the instrument the user practices ('all' shows every
//    instrument's surface),
//  - UI mode: 'advanced' is the full app; 'simple' is a practice-first UI
//    (practice tabs of the current scope + Settings, nothing else).

export type PracticeScope = 'all' | 'singing' | 'guitar' | 'piano'
export type UiMode = 'advanced' | 'simple'

/** Which scopes a tab belongs to. Settings is handled separately (always). */
const TAB_SCOPES: Record<ActiveTab, readonly PracticeScope[]> = {
  [TAB_SINGING]: ['singing'],
  [TAB_PIANO]: ['piano'],
  [TAB_GUITAR]: ['guitar'],
  [TAB_EXERCISES]: ['singing'],
  [TAB_KARAOKE]: ['singing'],
  [TAB_JAM]: ['singing'],
  [TAB_COMMUNITY]: ['singing', 'guitar', 'piano'],
  [TAB_LEADERBOARD]: ['singing', 'guitar', 'piano'],
  [TAB_CHALLENGES]: ['singing'],
  [TAB_COMPOSE]: ['singing', 'piano'],
  [TAB_ANALYSIS]: ['singing'],
  [TAB_SETTINGS]: ['singing', 'guitar', 'piano'],
  // Dev-only sub-surfaces (not in TAB_GROUPS); scoped like Analysis.
  [TAB_PITCH_TEST]: ['singing'],
  [TAB_PITCH_ALGO]: ['singing'],
}

/** Simple mode keeps only the practice group + Settings (the way back). */
const SIMPLE_TABS: ReadonlySet<ActiveTab> = new Set<ActiveTab>([
  ...(TAB_GROUPS.find((g) => g.id === 'practice')?.tabs ?? []),
  TAB_SETTINGS,
])

/** Is `tab` visible under the given scope and UI mode? */
export function isTabVisible(
  tab: ActiveTab,
  scope: PracticeScope,
  mode: UiMode,
): boolean {
  // Settings always stays reachable — it hosts the mode switch itself.
  if (tab === TAB_SETTINGS) return true
  if (mode === 'simple' && !SIMPLE_TABS.has(tab)) return false
  return scope === 'all' || TAB_SCOPES[tab].includes(scope)
}

/** Canonical order filtered to the visible tabs (drives the swipe nav). */
export function visibleTabOrder(
  scope: PracticeScope,
  mode: UiMode,
): ActiveTab[] {
  return TAB_ORDER.filter((t) => isTabVisible(t, scope, mode))
}

/** Landing tab when the current one is filtered out by a scope change. */
export function scopeHomeTab(scope: PracticeScope): ActiveTab {
  switch (scope) {
    case 'guitar':
      return TAB_GUITAR
    case 'piano':
      return TAB_PIANO
    default:
      return DEFAULT_TAB
  }
}

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
  [TAB_PIANO]: 'piano',
  [TAB_COMPOSE]: 'compose',
  [TAB_SETTINGS]: 'settings',
  [TAB_ANALYSIS]: 'analysis',
  [TAB_COMMUNITY]: 'community',
  [TAB_LEADERBOARD]: 'leaderboard',
  [TAB_CHALLENGES]: 'challenges',
  [TAB_KARAOKE]: 'karaoke',
  [TAB_PITCH_TEST]: 'pitch-test',
  [TAB_PITCH_ALGO]: 'pitch-algo',
  [TAB_EXERCISES]: 'exercises',
  [TAB_JAM]: 'jam',
  [TAB_GUITAR]: 'guitar',
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
    [TAB_PIANO]: 'Piano',
    [TAB_COMPOSE]: 'Compose',
    [TAB_SETTINGS]: 'Settings',
    [TAB_ANALYSIS]: 'Analysis',
    [TAB_COMMUNITY]: 'Community',
    [TAB_LEADERBOARD]: 'Leaderboard',
    [TAB_CHALLENGES]: 'Challenges',
    [TAB_KARAOKE]: 'Karaoke',
    [TAB_PITCH_TEST]: 'Pitch Analysis',
    [TAB_PITCH_ALGO]: 'Pitch Test',
    [TAB_EXERCISES]: 'Exercises',
    [TAB_JAM]: 'Jam',
    [TAB_GUITAR]: 'Guitar',
  }
  return labels[tab]
}
