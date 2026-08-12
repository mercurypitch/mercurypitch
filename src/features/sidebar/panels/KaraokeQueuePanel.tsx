// The live setlist queue, at a glance. Renders NOTHING while idle —
// a queue card duplicating panel state earns its place only during a
// run, when the panel is a full-screen stage and the rail is the one
// glanceable surface left (plan §7, question 1).
//
// Default export: loaded lazily by the registry.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { activePlaylistId, currentIndex, currentSong, getPlaylist, isPlaylistActive, nextSong, queue, } from '@/stores/karaoke-playlist-store'
import styles from './KaraokeRail.module.css'

const KaraokeQueuePanel: Component = () => {
  const playlistName = (): string => {
    const id = activePlaylistId()
    return (id === null ? undefined : getPlaylist(id)?.name) ?? 'Setlist'
  }

  return (
    <Show when={isPlaylistActive()}>
      <div class={styles.queueCard} data-tour="karaoke.rail-queue">
        <span class={styles.queueTitle}>{playlistName()}</span>
        <span class={styles.queueNow}>
          {currentSong()?.songTitle ?? '—'}{' '}
          <span class={styles.queuePosition}>
            {currentIndex() + 1} / {queue().length}
          </span>
        </span>
        <Show when={nextSong()}>
          {(next) => (
            <span class={styles.queueNext}>Next · {next().songTitle}</span>
          )}
        </Show>
      </div>
    </Show>
  )
}

export default KaraokeQueuePanel
