// ============================================================
// Navigation voice commands — spoken tab switching
// ============================================================
//
// "go to karaoke" and friends over setActiveTab, the same primitive nav
// clicks and the hash router funnel through. Only tabs visible under the
// current practice scope and UI mode answer; a hidden tab's phrase reports
// "not available" instead of making the tab appear. Registered by App right
// after the transport set, for the shell's lifetime.
//
// The standalone rooms are a different document with no tabs, so they
// register the two smaller sets from `room-navigation-commands.ts` instead.
// That module is deliberately free of anything that opens a database; this
// one is not, which is why the two are apart. Both are re-exported here so
// the shell has one import.

import { requestKaraokeAutoplay } from '@/features/stem-mixer/karaoke-launch-intent'
import type { ActiveTab } from '@/features/tabs/constants'
import { isTabVisible, TAB_KARAOKE, tabLabel } from '@/features/tabs/constants'
import { navigateTo } from '@/lib/hash-router'
import { isNarrow } from '@/lib/use-viewport'
import { getPlaylistsReactive, isPlaylistActive, jumpTo, queue, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { practiceScope, uiMode } from '@/stores/settings-store'
import { hideLibrary, isLibraryModalOpen, setActiveTab, showLibrary, } from '@/stores/ui-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import type { NavigationVoiceDeps } from './room-navigation-commands'
import { createVoiceHelpCommands, NIGHT_ROOMS, resolveLeaveForPage, roomPhrases, TAB_SPOKEN_NAMES, tabPhrases, } from './room-navigation-commands'
import type { VoiceCommand } from './types'
import { voiceFailure } from './types'

export type { NavigationVoiceDeps } from './room-navigation-commands'
export { createLeaveForStudioVoiceCommands } from './room-navigation-commands'
export { createVoiceHelpCommands }

export function createNavigationVoiceCommands(
  deps: NavigationVoiceDeps = {},
): VoiceCommand[] {
  const notSuspended = () => deps.suspended?.() !== true
  const navigateToTab = (
    tab: ActiveTab,
    onResolved?: (accepted: boolean) => void,
  ): void => {
    if (deps.navigateToTab !== undefined) {
      deps.navigateToTab(tab, onResolved)
      return
    }
    setActiveTab(tab)
    onResolved?.(true)
  }
  const narrow = (): boolean => (deps.isNarrow ?? isNarrow)()
  const leaveForPage = resolveLeaveForPage(deps)

  const commands: VoiceCommand[] = TAB_SPOKEN_NAMES.map(
    ({ tab, names, extra }) => ({
      id: `nav.${tab}`,
      label: `Go to ${tabLabel(tab)}`,
      phrases: [...tabPhrases(names), ...(extra ?? [])],
      available: () =>
        notSuspended() && isTabVisible(tab, practiceScope(), uiMode()),
      run: () => {
        // "Open karaoke" on a phone means the stage, not the desk. The
        // karaoke TAB is the mixer with its rails, panels and sidebar — a
        // surface built for a wide screen, and the wrong half of the app to
        // be dropped into by voice with the phone across the room. Karaoke
        // Night is the same songs on a stage that fits the device. On a
        // desktop the two stay separate, and the tab is what was asked for.
        if (tab === TAB_KARAOKE && narrow()) {
          leaveForPage('/karaoke-night')
          return 'Karaoke Night'
        }
        navigateToTab(tab)
        return `Go to ${tabLabel(tab)}`
      },
    }),
  )

  commands.push(
    // Distinct wording from the tabs ("go to karaoke"): these leave the app
    // for a standalone room, same tab per the owner's call.
    ...NIGHT_ROOMS.map((room) => ({
      id: room.id,
      label: room.label,
      phrases: roomPhrases(room.names),
      available: notSuspended,
      run: () => {
        leaveForPage(room.path)
        return room.label
      },
    })),
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
          navigateToTab(TAB_KARAOKE, (accepted) => {
            if (!accepted) return
            requestKaraokeAutoplay()
            navigateTo({
              type: 'uvr-session-mixer',
              sessionId: pick.sessionId,
            })
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
        if (pick.items.length === 0) {
          return voiceFailure('That playlist is empty')
        }
        navigateToTab(TAB_KARAOKE, (accepted) => {
          if (!accepted) return
          startPlaylist(pick.id)
          const entries = queue()
          if (entries.length === 0) return
          jumpTo(Math.floor(Math.random() * entries.length))
        })
        return 'Random song — starting karaoke'
      },
    },
    ...createVoiceHelpCommands(deps),
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
