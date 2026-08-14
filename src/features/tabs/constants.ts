// ── Tab ID constants ───────────────────────────────────────────────
// Use these everywhere instead of raw strings.
// Renaming a tab is a single-line change here — no string-hunt needed.

export const TAB_HOME = 'home' as const
export const TAB_PATH = 'path' as const
export const TAB_PROGRESS = 'progress' as const
export const TAB_SINGING = 'singing' as const
export const TAB_PIANO = 'piano' as const
export const TAB_COMPOSE = 'compose' as const
export const TAB_SETTINGS = 'settings' as const
export const TAB_ANALYSIS = 'analysis' as const
export const TAB_COMMUNITY = 'community' as const
export const TAB_LEADERBOARD = 'leaderboard' as const
export const TAB_CHALLENGES = 'challenges' as const
export const TAB_KARAOKE = 'karaoke' as const
export const TAB_VOICE_HISTORY = 'voice-history' as const
export const TAB_PITCH_TEST = 'pitch-test' as const
export const TAB_PITCH_ALGO = 'pitch-algo' as const
/** Hidden audio-research surface. Hash route only — never in TAB_GROUPS. */
export const TAB_LAB = 'lab' as const
/** Hidden Lab sub-surfaces. Kept as tabs so every tool remains deep-linkable. */
export const TAB_LAB_TRANSCRIBE = 'lab-transcribe' as const
export const TAB_LAB_DIFF = 'lab-diff' as const
export const TAB_EXERCISES = 'exercises' as const
export const TAB_EAR_LAB = 'ear-lab' as const
export const TAB_JAM = 'jam' as const
export const TAB_GUITAR = 'guitar' as const

export type ActiveTab =
  | typeof TAB_HOME
  | typeof TAB_PATH
  | typeof TAB_PROGRESS
  | typeof TAB_SINGING
  | typeof TAB_PIANO
  | typeof TAB_COMPOSE
  | typeof TAB_SETTINGS
  | typeof TAB_ANALYSIS
  | typeof TAB_COMMUNITY
  | typeof TAB_LEADERBOARD
  | typeof TAB_CHALLENGES
  | typeof TAB_KARAOKE
  | typeof TAB_VOICE_HISTORY
  | typeof TAB_PITCH_TEST
  | typeof TAB_PITCH_ALGO
  | typeof TAB_LAB
  | typeof TAB_LAB_TRANSCRIBE
  | typeof TAB_LAB_DIFF
  | typeof TAB_EXERCISES
  | typeof TAB_EAR_LAB
  | typeof TAB_JAM
  | typeof TAB_GUITAR

/** Default tab when the app loads — the daily Home hub. */
export const DEFAULT_TAB = TAB_HOME

// ── Canonical tab order & grouping ──────────────────────────────────
// SINGLE source of truth for the order tabs appear in. Both the visible
// tab bar (`AppNavTabs`) and the mobile swipe navigation (`App.tsx`) derive
// their order from here, so swapping two tabs is a one-line change that keeps
// the bar and the swipe gesture in sync — they can no longer drift apart.

export interface TabGroupDef {
  readonly id: string
  readonly label: string
  readonly tabs: readonly ActiveTab[]
  /**
   * How many of this group's tabs sit in the bar itself before the rest
   * fold behind the group's overflow button. Defaults to
   * `MAX_INLINE_GROUP_TABS`; override only with a reason, because every
   * extra inline tab is width the next feature cannot have.
   */
  readonly maxInline?: number
}

/**
 * Tabs per group in the bar before the overflow button appears.
 *
 * Three is the whole point of the grouping: the app has outgrown a flat
 * bar and has more surfaces coming (Hear Yourself, Ear Lab, Progress), so
 * a group's width has to be a constant rather than a function of how many
 * tabs we have shipped. Same shape as the phone's bottom bar — a few
 * destinations, then More.
 */
export const MAX_INLINE_GROUP_TABS = 3

export const TAB_GROUPS: readonly TabGroupDef[] = [
  {
    // Where you are, not what you practise: the daily hub, guided path,
    // Progress, and the personal records you return to. Individual records
    // may still be scoped to one instrument.
    id: 'you',
    label: 'You',
    tabs: [TAB_HOME, TAB_PATH, TAB_PROGRESS, TAB_VOICE_HISTORY],
  },
  {
    // An instrument selector, plus the drills that back it. Karaoke moved
    // to Play — it is a performance, not a practice surface.
    id: 'practice',
    label: 'Practice',
    tabs: [TAB_SINGING, TAB_GUITAR, TAB_PIANO, TAB_EXERCISES, TAB_EAR_LAB],
  },
  {
    // Singing at something or with someone.
    id: 'play',
    label: 'Play',
    tabs: [
      TAB_KARAOKE,
      TAB_JAM,
      TAB_CHALLENGES,
      TAB_COMMUNITY,
      TAB_LEADERBOARD,
    ],
  },
  {
    // Power-user surfaces. Settings is last on purpose: it is the way back
    // from simple mode, so it must never be the tab that overflows.
    id: 'studio',
    label: 'Studio',
    tabs: [TAB_COMPOSE, TAB_ANALYSIS, TAB_SETTINGS],
  },
]

/** The group a tab belongs to, or `undefined` for hash-only surfaces. */
export function tabGroupOf(tab: ActiveTab): TabGroupDef | undefined {
  return TAB_GROUPS.find((g) => g.tabs.includes(tab))
}

export interface SplitGroupTabs {
  /** Rendered as buttons in the bar. */
  readonly inline: readonly ActiveTab[]
  /** Rendered inside the group's overflow menu. Empty means no button. */
  readonly overflow: readonly ActiveTab[]
}

/**
 * Split one group's visible tabs into the bar row and its overflow menu.
 *
 * The active tab is always pulled into the row, taking the last inline
 * slot. A bar that hides where you currently are is worse than a bar with
 * one fewer choice on it — and it is the failure the phone's More button
 * has always avoided by highlighting itself.
 *
 * Pure and exported so both bars and the tests agree on the rule.
 */
export function splitGroupTabs(
  tabs: readonly ActiveTab[],
  active: ActiveTab,
  cap: number = MAX_INLINE_GROUP_TABS,
): SplitGroupTabs {
  if (tabs.length <= cap) return { inline: tabs, overflow: [] }

  const head = tabs.slice(0, cap)
  const tail = tabs.slice(cap)
  if (!tail.includes(active)) return { inline: head, overflow: tail }

  // Promote the active tab into the last slot; the tab it displaces goes
  // back to the front of the overflow list so the menu keeps declared order.
  const promoted = [...head.slice(0, cap - 1), active]
  const rest = tabs.filter((t) => !promoted.includes(t))
  return { inline: promoted, overflow: rest }
}

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
//    (the primary groups' tabs for the current scope + Settings, nothing
//    else — see PRIMARY_GROUP_IDS).

export type PracticeScope = 'all' | 'singing' | 'guitar' | 'piano'
export type UiMode = 'advanced' | 'simple'

/** Which scopes a tab belongs to. Settings is handled separately (always). */
const TAB_SCOPES: Record<ActiveTab, readonly PracticeScope[]> = {
  // Home is the daily hub for every instrument.
  [TAB_HOME]: ['singing', 'guitar', 'piano'],
  // The Ascent guided path — every instrument's daily practice feeds it.
  [TAB_PATH]: ['singing', 'guitar', 'piano'],
  // Progress is a cross-practice destination. Voice data leads today; the
  // contract remains instrument-neutral as measured piano/guitar records land.
  [TAB_PROGRESS]: ['singing', 'guitar', 'piano'],
  [TAB_SINGING]: ['singing'],
  [TAB_PIANO]: ['piano'],
  [TAB_GUITAR]: ['guitar'],
  [TAB_EXERCISES]: ['singing'],
  // The Ear Lab measures hearing, which every instrument shares.
  [TAB_EAR_LAB]: ['singing', 'guitar', 'piano'],
  [TAB_KARAOKE]: ['singing'],
  [TAB_VOICE_HISTORY]: ['singing'],
  [TAB_JAM]: ['singing'],
  [TAB_COMMUNITY]: ['singing', 'guitar', 'piano'],
  [TAB_LEADERBOARD]: ['singing', 'guitar', 'piano'],
  [TAB_CHALLENGES]: ['singing'],
  [TAB_COMPOSE]: ['singing', 'piano'],
  [TAB_ANALYSIS]: ['singing'],
  [TAB_SETTINGS]: ['singing', 'guitar', 'piano'],
  // Hidden research sub-surfaces (not in TAB_GROUPS); scoped like Analysis.
  [TAB_PITCH_TEST]: ['singing'],
  [TAB_PITCH_ALGO]: ['singing'],
  [TAB_LAB]: ['singing'],
  [TAB_LAB_TRANSCRIBE]: ['singing'],
  [TAB_LAB_DIFF]: ['singing'],
}

/**
 * Groups that make up the practice-first UI.
 *
 * Home and Path used to live inside the practice group, so simple mode got
 * them for free. After the regrouping the primary groups must be named or
 * simple mode silently loses its hub. Phone bar priority is separate below:
 * belonging to You makes a destination reachable, not automatically pinned.
 */
export const PRIMARY_GROUP_IDS: readonly string[] = ['you', 'practice']

/** Tabs of the primary groups, in canonical order. */
export const PRIMARY_TABS: readonly ActiveTab[] = TAB_GROUPS.filter((g) =>
  PRIMARY_GROUP_IDS.includes(g.id),
).flatMap((g) => [...g.tabs])

/**
 * Stable priority for the phone's four direct destinations.
 *
 * This is deliberately independent from group membership. You can gain a
 * personal destination such as Hear Yourself without pushing the scope's
 * core instrument off the bar; every visible destination not selected here
 * remains reachable through More.
 */
export const MOBILE_BAR_TAB_PRIORITY: readonly ActiveTab[] = [
  TAB_HOME,
  TAB_PATH,
  TAB_PROGRESS,
  TAB_SINGING,
  TAB_GUITAR,
  TAB_PIANO,
  TAB_EXERCISES,
]

export const MOBILE_BAR_SLOT_COUNT = 4

/** Simple mode keeps only the primary groups + Settings (the way back). */
const SIMPLE_TABS: ReadonlySet<ActiveTab> = new Set<ActiveTab>([
  ...PRIMARY_TABS,
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

/** Direct phone destinations for the current scope and mode, in priority order. */
export function mobileBarTabs(scope: PracticeScope, mode: UiMode): ActiveTab[] {
  return MOBILE_BAR_TAB_PRIORITY.filter((tab) =>
    isTabVisible(tab, scope, mode),
  ).slice(0, MOBILE_BAR_SLOT_COUNT)
}

/** Canonical order filtered to the visible tabs (drives the swipe nav). */
export function visibleTabOrder(
  scope: PracticeScope,
  mode: UiMode,
): ActiveTab[] {
  return TAB_ORDER.filter((t) => isTabVisible(t, scope, mode))
}

/**
 * Landing tab when the current one is filtered out by a scope change.
 * Home is visible in every scope, so it's the universal fallback.
 */
export function scopeHomeTab(_scope: PracticeScope): ActiveTab {
  return TAB_HOME
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
  [TAB_HOME]: 'home',
  [TAB_PATH]: 'path',
  [TAB_PROGRESS]: 'progress',
  [TAB_SINGING]: 'singing',
  [TAB_PIANO]: 'piano',
  [TAB_COMPOSE]: 'compose',
  [TAB_SETTINGS]: 'settings',
  [TAB_ANALYSIS]: 'analysis',
  [TAB_COMMUNITY]: 'community',
  [TAB_LEADERBOARD]: 'leaderboard',
  [TAB_CHALLENGES]: 'challenges',
  [TAB_KARAOKE]: 'karaoke',
  [TAB_VOICE_HISTORY]: 'voice-history',
  [TAB_PITCH_TEST]: 'pitch-test',
  [TAB_PITCH_ALGO]: 'pitch-algo',
  [TAB_LAB]: 'lab',
  [TAB_LAB_TRANSCRIBE]: 'lab-transcribe',
  [TAB_LAB_DIFF]: 'lab-diff',
  [TAB_EXERCISES]: 'exercises',
  [TAB_EAR_LAB]: 'ear-lab',
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
    [TAB_HOME]: 'Home',
    [TAB_PATH]: 'Path',
    [TAB_PROGRESS]: 'Progress',
    [TAB_SINGING]: 'Singing',
    [TAB_PIANO]: 'Piano',
    [TAB_COMPOSE]: 'Compose',
    [TAB_SETTINGS]: 'Settings',
    [TAB_ANALYSIS]: 'Analysis',
    [TAB_COMMUNITY]: 'Community',
    [TAB_LEADERBOARD]: 'Leaderboard',
    [TAB_CHALLENGES]: 'Challenges',
    [TAB_KARAOKE]: 'Karaoke',
    [TAB_VOICE_HISTORY]: 'Hear Yourself',
    [TAB_PITCH_TEST]: 'Pitch Analysis',
    [TAB_PITCH_ALGO]: 'Pitch Test',
    [TAB_LAB]: 'Lab',
    [TAB_LAB_TRANSCRIBE]: 'Transcription Bench',
    [TAB_LAB_DIFF]: 'Mapping Differ',
    [TAB_EXERCISES]: 'Exercises',
    [TAB_EAR_LAB]: 'Ear Lab',
    [TAB_JAM]: 'Jam',
    [TAB_GUITAR]: 'Guitar',
  }
  return labels[tab]
}
