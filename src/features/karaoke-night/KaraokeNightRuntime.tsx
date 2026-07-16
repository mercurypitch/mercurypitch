// Always-mounted (lazy) runtime for Karaoke Night: owns the playlist runner
// and consumes the ?playlist= deep-link from the studio. It lives OUTSIDE the
// stage host so a playlist can start before any song is staged (the deep-link
// case) and keeps running if the visitor collapses the rail.
import { onMount } from 'solid-js'
import { useKaraokePlaylistRunner } from '@/features/stem-mixer/karaoke-playlist-runner'
import { initKaraokePlaylistStore, isPlaylistActive, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { showNotification } from '@/stores/notifications-store'
import { initGroupStore, initSessionStore } from '@/stores/uvr-store'
import type { KaraokeSong } from './KaraokeRailPanels'

interface KaraokeNightRuntimeProps {
  onSong: (song: KaraokeSong) => void
}

export function KaraokeNightRuntime(props: KaraokeNightRuntimeProps) {
  onMount(() => {
    void (async () => {
      // The stores must be loaded before a deep-linked playlist can resolve
      // its sessions (all three init calls are idempotent — the rail panels
      // fire them too).
      await Promise.all([
        initSessionStore(),
        initGroupStore(),
        initKaraokePlaylistStore(),
      ])
      const playlistId = new URLSearchParams(window.location.search).get(
        'playlist',
      )
      if (playlistId === null || playlistId === '') return
      // Consume the param so a reload doesn't restart the playlist.
      window.history.replaceState(null, '', window.location.pathname)
      startPlaylist(playlistId)
      // startPlaylist is a no-op for an unknown id or an empty queue — tell
      // the visitor instead of silently showing the hero.
      if (!isPlaylistActive()) {
        showNotification(
          'That playlist could not be found on this device.',
          'warning',
        )
      }
    })()
  })

  // One runner for the whole page: hydrates each armed song and puts it on
  // stage (the stage host renders it; manual library/demo picks bypass this).
  useKaraokePlaylistRunner((hydrated) => {
    props.onSong({
      sessionId: hydrated.sessionId,
      title: hydrated.originalFile?.name ?? 'Your song',
      stems: {
        vocal: hydrated.outputs?.vocal,
        instrumental: hydrated.outputs?.instrumental,
      },
    })
  })

  return null
}
