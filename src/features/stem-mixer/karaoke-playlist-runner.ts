// Shared karaoke-playlist machinery: stem-URL hydration for stored sessions
// and the runner that feeds armed playlist songs into a host's mixer. Used by
// the studio's UvrPanel and the standalone Karaoke Night page — keep it free
// of app-shell (app-store) imports.

import { createEffect } from 'solid-js'
import { hydrateStemUrls } from '@/db/services/uvr-service'
import { advance, currentIndex, currentSong, isPlaylistActive, phase, } from '@/stores/karaoke-playlist-store'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessions, getUvrSession, saveAllUvrSessions, } from '@/stores/uvr-store'

const locallyHydratedSessions = new Set<string>()

/** Make a completed session's stem URLs playable. Local sessions persist
 *  their stems as db blobs; the object URLs in the cached record die with the
 *  page that minted them, so verify liveness (cheap HEAD on blob:) and
 *  re-mint from the db when needed. */
export async function ensureSessionHydrated(
  session: UvrSession,
): Promise<UvrSession> {
  if (session.status === 'completed') {
    if (locallyHydratedSessions.has(session.sessionId)) {
      return session
    }

    if (session.outputs?.vocal?.startsWith('blob:') === true) {
      try {
        const res = await fetch(session.outputs.vocal, { method: 'HEAD' })
        if (res.ok) {
          locallyHydratedSessions.add(session.sessionId)
          return session
        }
      } catch {
        // fetch failed, blob is dead
      }
    }

    const urls = await hydrateStemUrls(session.sessionId)
    if (urls) {
      locallyHydratedSessions.add(session.sessionId)
      return { ...session, outputs: { ...session.outputs, ...urls } }
    }
  }
  return session
}

let loadingPlaylistSong: string | null = null

async function loadPlaylistSong(
  sessionId: string,
  onSongReady: (hydrated: UvrSession) => void,
): Promise<void> {
  const session = getUvrSession(sessionId)
  if (!session) {
    showNotification('Karaoke: song unavailable, skipping…', 'warning')
    advance()
    return
  }
  const hydrated = await ensureSessionHydrated(session)
  // A newer skip may have superseded this (async) load — bail if this song is
  // no longer the current one, so we don't clobber the mixer out of order.
  if (currentSong()?.sessionId !== sessionId) return
  // Persist freshly-hydrated stem URLs back into the session cache. Otherwise
  // revisiting this song (prev/next) re-reads the cached session, whose blob:
  // URLs are dead after a reload, and the stems fail to load — so the song
  // won't play.
  if (hydrated !== session) {
    const all = getAllUvrSessions()
    const idx = all.findIndex((s) => s.sessionId === sessionId)
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        outputs: { ...all[idx].outputs, ...hydrated.outputs },
      }
      saveAllUvrSessions(all)
    }
  }
  onSongReady(hydrated)
}

/** Watch the playlist phase machine and hand each armed ('ready') song —
 *  hydrated and cache-persisted — to the host, which mounts it into its
 *  mixer. Call once from the component that owns the mixer view. */
export function useKaraokePlaylistRunner(
  onSongReady: (hydrated: UvrSession) => void,
): void {
  createEffect(() => {
    // Clear the dedupe key between runs, or restarting a playlist would
    // block its first song (same index:sessionId as the previous run).
    if (!isPlaylistActive()) {
      loadingPlaylistSong = null
      return
    }
    const song = currentSong()
    if (!song || phase() !== 'ready') return
    // Re-load whenever the (index, song) changes — revisiting a song replays it.
    const key = `${currentIndex()}:${song.sessionId}`
    if (loadingPlaylistSong === key) return
    loadingPlaylistSong = key
    void loadPlaylistSong(song.sessionId, onSongReady)
  })
}
