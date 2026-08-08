// ============================================================
// Navigation voice commands — spoken tab switching
// ============================================================
//
// "go to karaoke" and friends over setActiveTab, the same primitive nav
// clicks and the hash router funnel through. Only tabs visible under the
// current practice scope and UI mode answer; a hidden tab's phrase reports
// "not available" instead of making the tab appear. Registered by App right
// after the transport set, for the shell's lifetime.

import type { Accessor } from 'solid-js'
import { requestKaraokeAutoplay } from '@/features/stem-mixer/karaoke-launch-intent'
import type { ActiveTab } from '@/features/tabs/constants'
import { isTabVisible, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PATH, TAB_PIANO, TAB_SETTINGS, TAB_SINGING, tabLabel, } from '@/features/tabs/constants'
import { navigateTo } from '@/lib/hash-router'
import { getPlaylistsReactive, isPlaylistActive, jumpTo, queue, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { practiceScope, uiMode } from '@/stores/settings-store'
import { hideLibrary, isLibraryModalOpen, setActiveTab, showLibrary, } from '@/stores/ui-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import type { VoiceCommand } from './types'
import { voiceFailure } from './types'

export interface NavigationVoiceDeps {
  /** Immersive overlays suspend navigation like they suspend shortcuts. */
  suspended?: Accessor<boolean>
  /** Opens the "what can I say" overlay. */
  openVoiceHelp?: () => void
}

const TAB_SPOKEN_NAMES: Array<{ tab: ActiveTab; names: string[] }> = [
  { tab: TAB_HOME, names: ['home', 'the home page', 'home page'] },
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

export function createNavigationVoiceCommands(
  deps: NavigationVoiceDeps = {},
): VoiceCommand[] {
  const notSuspended = () => deps.suspended?.() !== true

  const commands: VoiceCommand[] = TAB_SPOKEN_NAMES.map(({ tab, names }) => ({
    id: `nav.${tab}`,
    label: `Go to ${tabLabel(tab)}`,
    phrases: names.flatMap((name) => [
      `go to ${name}`,
      `open ${name}`,
      `show ${name}`,
      `switch to ${name}`,
    ]),
    available: () =>
      notSuspended() && isTabVisible(tab, practiceScope(), uiMode()),
    run: () => {
      setActiveTab(tab)
      return `Go to ${tabLabel(tab)}`
    },
  }))

  commands.push(
    {
      id: 'nav.karaokeNight',
      label: 'Karaoke Night',
      // Distinct wording from "go to karaoke" (the tab): this leaves the
      // app for the standalone stage, same tab per the owner's call.
      phrases: [
        'open karaoke night',
        'karaoke night',
        'start karaoke night',
        'go to karaoke night',
      ],
      available: notSuspended,
      run: () => {
        window.location.assign('/karaoke-night')
        return 'Karaoke Night'
      },
    },
    {
      id: 'nav.randomSong',
      label: 'Random song',
      // The in-mixer version handles an ALREADY-running playlist; this one
      // starts karaoke from anywhere. Gated so it never restarts a session
      // mid-singing.
      phrases: [
        'play random song from my list',
        'play a random song',
        'play random song',
        'random song',
        'play a song',
        'play song',
        'play something',
        'surprise me',
      ],
      available: () => notSuspended() && !isPlaylistActive(),
      run: () => {
        // Songs first — most libraries have no playlists at all. A random
        // separated song opens straight in its mixer.
        const songs = getAllUvrSessionsReactive().filter(
          (s) => s.status === 'completed',
        )
        if (songs.length > 0) {
          const pick = songs[Math.floor(Math.random() * songs.length)]
          setActiveTab(TAB_KARAOKE)
          requestKaraokeAutoplay()
          navigateTo({
            type: 'uvr-session-mixer',
            sessionId: pick.sessionId,
          })
          const name = pick.originalFile?.name.replace(/\.[a-z0-9]+$/i, '')
          return name !== undefined && name !== ''
            ? `Random song: ${name}`
            : 'Random song'
        }
        // A library organized into playlists still works.
        const playlists = getPlaylistsReactive()
        if (playlists.length === 0) {
          return voiceFailure('No songs in your library yet')
        }
        const pick = playlists[Math.floor(Math.random() * playlists.length)]
        startPlaylist(pick.id)
        const entries = queue()
        if (entries.length === 0) {
          return voiceFailure('That playlist is empty')
        }
        jumpTo(Math.floor(Math.random() * entries.length))
        setActiveTab(TAB_KARAOKE)
        return 'Random song — starting karaoke'
      },
    },
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
    {
      id: 'nav.libraryOpen',
      label: 'Open library',
      phrases: [
        'open library',
        'open the library',
        'show the library',
        'show library',
      ],
      available: notSuspended,
      run: () => {
        showLibrary()
        return 'Library open'
      },
    },
    {
      id: 'nav.libraryClose',
      label: 'Close library',
      phrases: [
        'close library',
        'close the library',
        'hide the library',
        'hide library',
      ],
      available: notSuspended,
      run: () => {
        if (!isLibraryModalOpen()) return voiceFailure('Library is not open')
        hideLibrary()
        return 'Library closed'
      },
    },
  )

  return commands
}
