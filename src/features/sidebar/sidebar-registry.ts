// ── Sidebar panel registry ───────────────────────────────────────────
// One AppSidebar shell; WHAT it shows is this file's decision, per tab.
// docs/plans/sidebar-per-tab.md is the agreed matrix — change layouts
// there first, then here.
//
// Rules (the plan's §3):
// 1. Panels are dumb and importable — each reads stores directly. The few
//    App callbacks a panel needs come from SidebarHostContext.
// 2. Order in the array = order on screen.
// 3. Persisted open/closed keys stay per-panel (sidebar-<id>-open), so
//    user preferences survive re-arrangement.
// 4. Tour selectors (data-tour) live INSIDE panel components, so steps
//    keep resolving wherever a panel is mounted.
// 5. 'mic' is universal: the shell appends it when a layout forgets it,
//    because one global sensitivity setting has no tab where changing it
//    is meaningless. Listing it per tab is allowed (to place it), but
//    dropping it is not possible.
//
// This is deliberately NOT a portal API — a registry is greppable, the
// tour engine can reason about it, and a page cannot leak page-lifetime
// state into an app-lifetime surface.

import type { Component } from 'solid-js'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_KARAOKE, TAB_LAB, TAB_LEADERBOARD, TAB_PATH, TAB_PIANO, TAB_PITCH_ALGO, TAB_PITCH_TEST, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { ActivityPanel } from './panels/ActivityPanel'
import { CharacterPanel } from './panels/CharacterPanel'
import { DisplayPanel } from './panels/DisplayPanel'
import { LibraryPanel } from './panels/LibraryPanel'
import { MicPanel } from './panels/MicPanel'
import { NoteListPanel } from './panels/NoteListPanel'
import { PlaybackSetupPanel } from './panels/PlaybackSetupPanel'
import { RoutinePanel } from './panels/RoutinePanel'

export type SidebarPanelId =
  | 'character'
  | 'library'
  | 'playback-setup'
  | 'mic'
  | 'routine'
  | 'activity'
  | 'note-list'
  | 'display'

export const SIDEBAR_PANELS: Record<SidebarPanelId, Component> = {
  character: CharacterPanel,
  library: LibraryPanel,
  'playback-setup': PlaybackSetupPanel,
  mic: MicPanel,
  routine: RoutinePanel,
  activity: ActivityPanel,
  'note-list': NoteListPanel,
  display: DisplayPanel,
}

/**
 * Step 1 of the migration: every tab maps to TODAY's exact section list,
 * so this refactor is provably invisible. The per-tab matrix from the
 * plan's §4 lands as edits to this table only.
 */
const CURRENT_LAYOUT: readonly SidebarPanelId[] = [
  'character',
  'library',
  'playback-setup',
  'mic',
  'routine',
  'activity',
  'display',
]

/** Singing and Settings additionally show the note list, as today. */
const CURRENT_LAYOUT_WITH_NOTES: readonly SidebarPanelId[] = [
  'character',
  'library',
  'playback-setup',
  'mic',
  'routine',
  'activity',
  'note-list',
  'display',
]

export const SIDEBAR_LAYOUT: Record<ActiveTab, readonly SidebarPanelId[]> = {
  [TAB_HOME]: CURRENT_LAYOUT,
  [TAB_PATH]: CURRENT_LAYOUT,
  [TAB_SINGING]: CURRENT_LAYOUT_WITH_NOTES,
  [TAB_PIANO]: CURRENT_LAYOUT,
  [TAB_GUITAR]: CURRENT_LAYOUT,
  [TAB_EXERCISES]: CURRENT_LAYOUT,
  [TAB_KARAOKE]: CURRENT_LAYOUT,
  [TAB_JAM]: CURRENT_LAYOUT,
  [TAB_COMMUNITY]: CURRENT_LAYOUT,
  [TAB_LEADERBOARD]: CURRENT_LAYOUT,
  [TAB_CHALLENGES]: CURRENT_LAYOUT,
  [TAB_COMPOSE]: CURRENT_LAYOUT,
  [TAB_ANALYSIS]: CURRENT_LAYOUT,
  [TAB_SETTINGS]: CURRENT_LAYOUT_WITH_NOTES,
  [TAB_PITCH_TEST]: CURRENT_LAYOUT,
  [TAB_PITCH_ALGO]: CURRENT_LAYOUT,
  [TAB_LAB]: CURRENT_LAYOUT,
}

/** The tab's panels in screen order, with the universal mic guaranteed. */
export function sidebarPanelIdsFor(
  tab: ActiveTab,
): readonly SidebarPanelId[] {
  const ids = SIDEBAR_LAYOUT[tab] ?? CURRENT_LAYOUT
  return ids.includes('mic') ? ids : [...ids, 'mic']
}
