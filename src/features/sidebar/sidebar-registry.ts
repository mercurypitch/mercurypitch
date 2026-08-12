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
import { lazy } from 'solid-js'
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
  | 'karaoke-queue'
  | 'karaoke-groups'
  | 'karaoke-setlists'
  | 'jam-room'

export const SIDEBAR_PANELS: Record<SidebarPanelId, Component> = {
  character: CharacterPanel,
  library: LibraryPanel,
  'playback-setup': PlaybackSetupPanel,
  mic: MicPanel,
  routine: RoutinePanel,
  activity: ActivityPanel,
  'note-list': NoteListPanel,
  display: DisplayPanel,
  // Tab-specific panels load with their tab's interaction, not in the
  // shell chunk (plan rule 4): lazy() keeps the karaoke stack off every
  // other tab's first paint.
  'karaoke-queue': lazy(() => import('./panels/KaraokeQueuePanel')),
  'karaoke-groups': lazy(() => import('./panels/KaraokeGroupsPanel')),
  'karaoke-setlists': lazy(() => import('./panels/KaraokeSetlistsPanel')),
  'jam-room': lazy(() => import('./panels/JamRoomPanel')),
}

/**
 * The plan's §4 matrix. Character only where a voice character drives the
 * engine; Library only where the melody library feeds the surface;
 * Playback Setup only on musical tabs. Karaoke and Jam gain their own
 * rail panels in later steps; until then they show universal panels only.
 * The three dev surfaces keep the historical full list — nobody is
 * cleaning up a hidden lab.
 */
const DEV_SURFACE_LAYOUT: readonly SidebarPanelId[] = [
  'character',
  'library',
  'playback-setup',
  'mic',
  'routine',
  'activity',
  'display',
]

export const SIDEBAR_LAYOUT: Record<ActiveTab, readonly SidebarPanelId[]> = {
  [TAB_HOME]: ['character', 'mic', 'routine', 'activity'],
  [TAB_PATH]: ['mic', 'routine', 'activity'],
  [TAB_SINGING]: [
    'character',
    'library',
    'playback-setup',
    'mic',
    'routine',
    'activity',
    'note-list',
    'display',
  ],
  [TAB_PIANO]: ['library', 'playback-setup', 'mic', 'display'],
  [TAB_GUITAR]: ['library', 'mic'],
  [TAB_EXERCISES]: ['character', 'mic', 'routine', 'activity'],
  [TAB_KARAOKE]: ['karaoke-queue', 'karaoke-groups', 'karaoke-setlists', 'mic'],
  [TAB_JAM]: ['jam-room', 'mic'],
  [TAB_COMMUNITY]: ['mic', 'activity'],
  [TAB_LEADERBOARD]: ['mic'],
  [TAB_CHALLENGES]: ['mic', 'activity'],
  [TAB_COMPOSE]: ['library', 'playback-setup', 'mic', 'note-list'],
  [TAB_ANALYSIS]: ['mic', 'display'],
  [TAB_SETTINGS]: ['mic'],
  [TAB_PITCH_TEST]: DEV_SURFACE_LAYOUT,
  [TAB_PITCH_ALGO]: DEV_SURFACE_LAYOUT,
  [TAB_LAB]: DEV_SURFACE_LAYOUT,
}

/** The tab's panels in screen order, with the universal mic guaranteed. */
export function sidebarPanelIdsFor(tab: ActiveTab): readonly SidebarPanelId[] {
  const ids = SIDEBAR_LAYOUT[tab] ?? (['mic'] as const)
  return ids.includes('mic') ? ids : [...ids, 'mic']
}
