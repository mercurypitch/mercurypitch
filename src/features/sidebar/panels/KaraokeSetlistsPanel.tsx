// Setlists in the rail — every saved playlist, one tap from starting.
// Playback goes through the same store transport the gallery uses
// (startPlaylist), so the mixer's overlay machinery takes over exactly
// as if the gallery's play button had been pressed. Editing stays in
// the gallery inside the panel; the rail is for GLANCING and STARTING.
//
// Default export: loaded lazily by the registry.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { Play } from '@/components/icons'
import { getPlaylistsReactive, startPlaylist, } from '@/stores/karaoke-playlist-store'
import styles from './KaraokeRail.module.css'

const KaraokeSetlistsPanel: Component = () => (
  <Show when={getPlaylistsReactive().length > 0}>
    <CollapsibleSection
      title="Setlists"
      storageKey="sidebar-karaoke-setlists-open"
    >
      <div class={styles.setlistList} data-tour="karaoke.rail-setlists">
        <For each={getPlaylistsReactive()}>
          {(pl) => (
            <div class={styles.setlistRow}>
              <span class={styles.setlistName} title={pl.name}>
                {pl.name}
              </span>
              <span class={styles.setlistCount}>
                {pl.items.length} {pl.items.length === 1 ? 'item' : 'items'}
              </span>
              <button
                class={styles.setlistPlay}
                title={`Start "${pl.name}" in the studio`}
                aria-label={`Start playlist ${pl.name}`}
                disabled={pl.items.length === 0}
                onClick={() => startPlaylist(pl.id)}
              >
                <Play />
              </button>
            </div>
          )}
        </For>
      </div>
    </CollapsibleSection>
  </Show>
)

export default KaraokeSetlistsPanel
