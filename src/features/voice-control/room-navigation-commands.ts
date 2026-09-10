// ============================================================
// Room navigation voice commands — getting out of a standalone document
// ============================================================
//
// The vocabulary a standalone room needs and nothing more: "what can I say",
// the short list of tabs that lead back into the app shell, and the other
// rooms. `navigation-commands.ts` holds the full studio set and re-exports
// everything here, so the shell keeps one import.
//
// ── Why this is its own module ──
//
// The studio set reaches the karaoke playlist store and the UVR store, and
// both open Dexie. A module-level import is not tree-shakeable, so a room
// that wanted only "go home" was dragging the `vendor-db` chunk into its
// first paint — which is exactly what Drum Night's lazy-asset audit caught
// the moment its voice control was wired up. Keep the heavy stores out of
// this file; the audit is the only thing that will tell you if they return.

import type { Accessor } from 'solid-js'
import type { ActiveTab } from '@/features/tabs/constants'
import { isTabVisible, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PATH, TAB_PIANO, TAB_SETTINGS, TAB_SINGING, tabLabel, } from '@/features/tabs/constants'
import { buildHash } from '@/lib/hash-router'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { VoiceCommand } from './types'

export interface NavigationVoiceDeps {
  /** Immersive overlays suspend navigation like they suspend shortcuts. */
  suspended?: Accessor<boolean>
  /** Opens the "what can I say" overlay. */
  openVoiceHelp?: () => void
  /** Uses the shell's guarded tab navigation when a surface has unsaved work. */
  navigateToTab?: (
    tab: ActiveTab,
    onResolved?: (accepted: boolean) => void,
  ) => void
  /**
   * Whether this is a phone-width viewport. Injected so the karaoke split
   * below can be tested; defaults to the app's shared accessor.
   */
  isNarrow?: Accessor<boolean>
  /** Leaves the app for a standalone page. Injected for the same reason. */
  leaveForPage?: (path: string) => void
  /**
   * The path of the document this is running in, used only to leave the
   * current room out of the room list. Injected so it can be tested.
   */
  currentPath?: () => string
}

/**
 * The standalone rooms — the "nights".
 *
 * Each is a separate document with its own app, reached by leaving this one.
 * Listed here rather than derived from the SEO entry model: that model also
 * holds landing pages, and a command that walks someone onto a marketing page
 * is worse than no command.
 *
 * Only Karaoke Night had one of these. "Go to guitar night" simply did
 * nothing, which reads as voice control being broken rather than as a phrase
 * nobody wrote down.
 *
 * Ambiguity against the tab set is not a risk: a phrase has to consume the
 * whole utterance, so "go to guitar" reaches the guitar TAB and "go to guitar
 * night" reaches the room, with no overlap to arbitrate.
 */
export const NIGHT_ROOMS: Array<{
  id: string
  label: string
  path: string
  /** Spoken names, most canonical first. */
  names: string[]
}> = [
  {
    id: 'nav.karaokeNight',
    label: 'Karaoke Night',
    path: '/karaoke-night',
    names: ['karaoke night', 'the karaoke stage', 'karaoke stage'],
  },
  {
    id: 'nav.guitarNight',
    label: 'Guitar Night',
    path: '/guitar-night',
    names: ['guitar night', 'the guitar room', 'guitar room'],
  },
  {
    id: 'nav.pianoNight',
    label: 'Piano Night',
    path: '/piano-night',
    names: ['piano night', 'the piano room', 'piano room'],
  },
  {
    id: 'nav.drumNight',
    label: 'Drum Night',
    path: '/drum-night',
    names: ['drum night', 'the drum room', 'drum room', 'drums night'],
  },
]

/**
 * Ways to ask for a tab.
 *
 * The bare name counts. "Singing" on its own is how a person actually speaks
 * to a phone across the room, and having to say "go to" first made voice
 * control feel like it was refusing perfectly clear speech. Nothing becomes
 * ambiguous by adding it: a phrase has to consume the whole utterance, so a
 * bare name only ever wins when it WAS the whole utterance.
 */
export function tabPhrases(names: readonly string[]): string[] {
  return names.flatMap((name) => [
    ...(NOT_ON_THEIR_OWN.has(name) ? [] : [name]),
    `go to ${name}`,
    `open ${name}`,
    `show ${name}`,
    `switch to ${name}`,
  ])
}

/**
 * Ways to ask for a room. Deliberately more than the tab set gets: these are
 * spoken at a phone from across the room, and "start guitar night" is at
 * least as natural as "go to" — a room is something you begin, not only
 * somewhere you go.
 */
export function roomPhrases(names: readonly string[]): string[] {
  return names.flatMap((name) => [
    name,
    `go to ${name}`,
    `open ${name}`,
    `start ${name}`,
    `show ${name}`,
    `switch to ${name}`,
    `take me to ${name}`,
  ])
}

/**
 * Names too common in a lyric to be a command on their own.
 *
 * Voice control is listening while music plays, and the wake word is only
 * required in some modes, so a bare name has to be a word nobody sings by
 * accident. "Home" is in half the choruses ever written, and "go home" and
 * "take me home" already carry the intent without the risk.
 */
const NOT_ON_THEIR_OWN = new Set(['home'])

export const TAB_SPOKEN_NAMES: Array<{
  tab: ActiveTab
  names: string[]
  /** Whole phrases beyond the go-to/open/show/switch-to templates. */
  extra?: string[]
}> = [
  {
    tab: TAB_HOME,
    names: ['home', 'the home page', 'home page'],
    // "go home" reads naturally without the "to".
    extra: ['go home', 'take me home'],
  },
  { tab: TAB_SINGING, names: ['singing', 'the singing tab', 'singing tab'] },
  { tab: TAB_KARAOKE, names: ['karaoke', 'the karaoke tab', 'karaoke tab'] },
  { tab: TAB_PIANO, names: ['piano', 'the piano tab', 'piano tab'] },
  { tab: TAB_GUITAR, names: ['guitar', 'the guitar tab', 'guitar tab'] },
  { tab: TAB_EXERCISES, names: ['exercises', 'the exercises', 'drills'] },
  { tab: TAB_COMPOSE, names: ['compose', 'the composer', 'the editor'] },
  { tab: TAB_PATH, names: ['the path', 'path', 'the ascent'] },
  { tab: TAB_JAM, names: ['jam', 'the jam room', 'jam room'] },
  { tab: TAB_ANALYSIS, names: ['analysis', 'my takes'] },
  { tab: TAB_CHALLENGES, names: ['challenges', 'the challenges'] },
  { tab: TAB_COMMUNITY, names: ['community', 'the community'] },
  { tab: TAB_LEADERBOARD, names: ['leaderboard', 'the leaderboard'] },
  { tab: TAB_SETTINGS, names: ['settings', 'the settings'] },
]

/**
 * Leaving the current document, with the page injectable for tests.
 *
 * A full page load, not a hash change: a standalone room and the app shell
 * are different documents, and the tab set below uses the same door to
 * reach Karaoke Night.
 */
export function resolveLeaveForPage(
  deps: NavigationVoiceDeps,
): (path: string) => void {
  return (path: string): void => {
    if (deps.leaveForPage !== undefined) {
      deps.leaveForPage(path)
      return
    }
    window.location.assign(path)
  }
}

/**
 * "What can I say" on its own, because not every surface has tabs.
 *
 * The standalone Karaoke Night page registers Mercury Sing and the mixer's
 * set but never the tab set this file mostly is — so the one command whose
 * whole job is to LIST the others was missing exactly where a singer, hands
 * busy and phone across the room, most needs to ask.
 */
export function createVoiceHelpCommands(
  deps: NavigationVoiceDeps = {},
): VoiceCommand[] {
  const notSuspended = () => deps.suspended?.() !== true
  return [
    {
      id: 'nav.voiceHelp',
      label: 'Voice commands',
      phrases: [
        'what can i say',
        'voice help',
        'voice commands',
        'show voice commands',
        'list commands',
      ],
      available: notSuspended,
      run: () => {
        deps.openVoiceHelp?.()
        return 'Voice commands'
      },
    },
  ]
}

/**
 * Tabs a standalone document offers as the way back into the app shell.
 *
 * Deliberately short — this is an exit, not a second tab bar. Home leads
 * because it answers under every scope and UI mode, so there is always one
 * phrase that gets a singer out; the rest are the surfaces someone leaving
 * a room actually asks for next.
 */
const LEAVE_FOR_STUDIO_TABS: ReadonlySet<ActiveTab> = new Set<ActiveTab>([
  TAB_HOME,
  TAB_SINGING,
  TAB_KARAOKE,
  TAB_PIANO,
  TAB_GUITAR,
  TAB_EXERCISES,
  TAB_CHALLENGES,
  TAB_SETTINGS,
])

/**
 * Wording that only means something from outside the shell — inside the app
 * you are already in the studio, so these stay off the tab set.
 */
const BACK_TO_STUDIO_PHRASES = ['back to the studio', 'back to the app']

/**
 * Getting out of a standalone room by voice.
 *
 * Karaoke Night, Guitar Night and the other standalone documents are not
 * the app shell: the tab set below never loads there, so no phrase that
 * LEAVES a surface existed on them. Voice could carry a singer into a room
 * and then had nothing to say that got them out again — the room's own
 * commands and "what can I say" were the entire vocabulary.
 *
 * Same visibility rule as the tab set: a tab hidden by the user's practice
 * scope or simple mode is not somewhere voice may put them. Home and
 * Settings are visible under every combination, so the exit never closes.
 */
export function createLeaveForStudioVoiceCommands(
  deps: NavigationVoiceDeps = {},
): VoiceCommand[] {
  const notSuspended = () => deps.suspended?.() !== true
  const leaveForPage = resolveLeaveForPage(deps)
  const currentPath = () =>
    deps.currentPath?.() ?? window.location.pathname.replace(/\/$/, '')

  // A room can be left for another room, not only for the studio. Without
  // this, walking from Guitar Night to Karaoke Night by voice meant going
  // home first and asking again.
  //
  // The room you are standing in is left out: it would be a full page load
  // that lands you exactly where you already are, which on a phone reads as
  // the app throwing the session away for nothing.
  const roomCommands: VoiceCommand[] = NIGHT_ROOMS.filter(
    (room) => room.path !== currentPath(),
  ).map((room) => ({
    id: room.id,
    label: room.label,
    phrases: roomPhrases(room.names),
    available: notSuspended,
    run: () => {
      leaveForPage(room.path)
      return room.label
    },
  }))

  return TAB_SPOKEN_NAMES.filter(({ tab }) => LEAVE_FOR_STUDIO_TABS.has(tab))
    .map(
      ({ tab, names, extra }): VoiceCommand => ({
        // Distinct from the tab set's `nav.<tab>`: a page could in principle
        // hold both, and two commands must never share an id.
        id: `nav.leave.${tab}`,
        label: `Go to ${tabLabel(tab)}`,
        phrases: [
          ...tabPhrases(names),
          ...(extra ?? []),
          ...(tab === TAB_HOME ? BACK_TO_STUDIO_PHRASES : []),
        ],
        available: () =>
          notSuspended() && isTabVisible(tab, practiceScope(), uiMode()),
        run: () => {
          // Built by the router rather than spelled out here, so the tab route
          // format stays in one place.
          leaveForPage(`/#${buildHash({ type: 'tab', tab })}`)
          return `Go to ${tabLabel(tab)}`
        },
      }),
    )
    .concat(roomCommands)
}
