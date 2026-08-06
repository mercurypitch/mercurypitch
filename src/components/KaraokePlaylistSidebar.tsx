// ============================================================
// KaraokePlaylistSidebar — playlist list + editor (Stem Mixer left sidebar)
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { KaraokePlaylistRecord } from '@/db'
import type { PlayAlongPreset, PlayAlongStemKey, } from '@/features/stem-mixer/play-along'
import { karaokeNightPlaylistUrl } from '@/lib/karaoke-night-link'
import { createPlaylist, deletePlaylist, getPlaylistsReactive, renamePlaylist, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { ConfirmDialog } from './ConfirmDialog'
import { CheckSmall, Music, Pencil, Play, StageCurtains, Trash2, X, } from './icons'
import { KaraokePlaylistEditor } from './KaraokePlaylistEditor'
import styles from './KaraokePlaylistSidebar.module.css'
import { PlayAlongSelect } from './PlayAlongSelect'

export interface KaraokeLibrarySong {
  sessionId: string
  title: string
  availableStems: readonly PlayAlongStemKey[]
}

interface KaraokePlaylistSidebarProps {
  onClose: () => void
  songs: readonly KaraokeLibrarySong[]
  currentSessionId: string
  onPickSong?: (sessionId: string) => void
  onPlayAlong?: (sessionId: string, preset: PlayAlongPreset) => void
}

export const KaraokePlaylistSidebar: Component<KaraokePlaylistSidebarProps> = (
  props,
) => {
  const playlists = () => getPlaylistsReactive()
  const [view, setView] = createSignal<'songs' | 'playlists'>('songs')
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [newName, setNewName] = createSignal('')
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')
  // Playlist queued for deletion (drives the confirm modal).
  const [pendingDelete, setPendingDelete] =
    createSignal<KaraokePlaylistRecord | null>(null)

  const confirmDelete = () => {
    const pl = pendingDelete()
    if (pl) void deletePlaylist(pl.id)
    setPendingDelete(null)
  }

  const handleCreate = () => {
    const name = newName().trim()
    if (!name) return
    void createPlaylist(name).then((pl) => {
      setSelectedId(pl.id)
      setNewName('')
    })
  }

  const handleRename = (id: string) => {
    const name = editName().trim()
    if (name) void renamePlaylist(id, name)
    setEditingId(null)
  }

  const handlePickSong = (sessionId: string): void => {
    if (
      sessionId === props.currentSessionId ||
      props.onPickSong === undefined
    ) {
      return
    }
    props.onClose()
    props.onPickSong(sessionId)
  }

  const handlePlayAlong = (
    sessionId: string,
    preset: PlayAlongPreset,
  ): void => {
    if (props.onPlayAlong === undefined) return
    props.onClose()
    props.onPlayAlong(sessionId, preset)
  }

  return (
    <aside class={styles.sidebar} aria-label="Songs and playlists">
      <div class={styles.header}>
        <div>
          <h3 class={styles.title}>
            <Music />
            Songs
          </h3>
          <p class={styles.subtitle}>Library and playlists</p>
        </div>
        <button
          type="button"
          class={styles.iconBtn}
          title="Close"
          aria-label="Close songs"
          onClick={() => props.onClose()}
        >
          <X />
        </button>
      </div>

      <div class={styles.tabs} role="tablist" aria-label="Song drawer views">
        <button
          id="song-drawer-tab-songs"
          type="button"
          role="tab"
          aria-controls="song-drawer-panel-songs"
          aria-selected={view() === 'songs'}
          class={styles.tab}
          classList={{ [styles.tabActive]: view() === 'songs' }}
          onClick={() => setView('songs')}
        >
          Songs <span class={styles.tabCount}>{props.songs.length}</span>
        </button>
        <button
          id="song-drawer-tab-playlists"
          type="button"
          role="tab"
          aria-controls="song-drawer-panel-playlists"
          aria-selected={view() === 'playlists'}
          class={styles.tab}
          classList={{ [styles.tabActive]: view() === 'playlists' }}
          onClick={() => setView('playlists')}
        >
          Playlists <span class={styles.tabCount}>{playlists().length}</span>
        </button>
      </div>

      <div class={styles.body}>
        <Show when={view() === 'songs'}>
          <section
            id="song-drawer-panel-songs"
            class={styles.section}
            role="tabpanel"
            aria-labelledby="song-drawer-tab-songs"
          >
            <p class={styles.sectionIntro}>
              Switch songs, or choose the part you perform.
            </p>
            <ul class={styles.songList}>
              <For
                each={props.songs}
                fallback={
                  <li class={styles.empty}>
                    No processed songs on this device yet.
                  </li>
                }
              >
                {(song) => {
                  const active = () => song.sessionId === props.currentSessionId
                  return (
                    <li
                      class={styles.songRow}
                      classList={{ [styles.songActive]: active() }}
                    >
                      <button
                        type="button"
                        class={styles.songButton}
                        disabled={active() || props.onPickSong === undefined}
                        aria-current={active() ? 'true' : undefined}
                        onClick={() => handlePickSong(song.sessionId)}
                      >
                        <span class={styles.songTitle} title={song.title}>
                          {song.title}
                        </span>
                        <span class={styles.songMeta}>
                          {active() ? 'Now mixing' : 'Open and play'}
                        </span>
                      </button>
                      <Show when={props.onPlayAlong !== undefined}>
                        <PlayAlongSelect
                          sessionId={song.sessionId}
                          availableStems={song.availableStems}
                          discoverStoredStems
                          compact
                          ariaLabel={`Choose what you perform in ${song.title}`}
                          onSelect={(preset) =>
                            handlePlayAlong(song.sessionId, preset)
                          }
                        />
                      </Show>
                    </li>
                  )
                }}
              </For>
            </ul>
          </section>
        </Show>

        <Show when={view() === 'playlists'}>
          <section
            id="song-drawer-panel-playlists"
            class={styles.section}
            role="tabpanel"
            aria-labelledby="song-drawer-tab-playlists"
          >
            <For
              each={playlists()}
              fallback={<p class={styles.empty}>No playlists yet.</p>}
            >
              {(pl) => (
                <div
                  class={styles.playlistRow}
                  classList={{
                    [styles.playlistActive]: pl.id === selectedId(),
                  }}
                >
                  <Show
                    when={editingId() === pl.id}
                    fallback={
                      <button
                        type="button"
                        class={styles.playlistName}
                        onClick={() => setSelectedId(pl.id)}
                      >
                        {pl.name}
                        <span class={styles.playlistCount}>
                          {pl.items.length}
                        </span>
                      </button>
                    }
                  >
                    <input
                      class={styles.editInput}
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(pl.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      ref={(el) => setTimeout(() => el.focus(), 0)}
                    />
                  </Show>

                  <div class={styles.playlistActions}>
                    <Show
                      when={editingId() === pl.id}
                      fallback={
                        <>
                          <button
                            type="button"
                            class={`${styles.iconBtn} ${styles.playBtn}`}
                            title="Start this playlist here in the studio"
                            disabled={pl.items.length === 0}
                            onClick={() => startPlaylist(pl.id)}
                          >
                            <Play />
                          </button>
                          <button
                            type="button"
                            class={`${styles.iconBtn} ${styles.playBtn}`}
                            title="Sing this playlist on Karaoke Night — the theatre stage"
                            disabled={pl.items.length === 0}
                            onClick={() =>
                              window.location.assign(
                                karaokeNightPlaylistUrl(pl.id),
                              )
                            }
                          >
                            <StageCurtains size={13} />
                          </button>
                          <button
                            type="button"
                            class={styles.iconBtn}
                            title="Rename"
                            onClick={() => {
                              setEditingId(pl.id)
                              setEditName(pl.name)
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            class={styles.iconBtn}
                            title="Delete playlist"
                            onClick={() => setPendingDelete(pl)}
                          >
                            <Trash2 />
                          </button>
                        </>
                      }
                    >
                      <button
                        type="button"
                        class={styles.iconBtn}
                        title="Save"
                        onClick={() => handleRename(pl.id)}
                      >
                        <CheckSmall size={15} />
                      </button>
                    </Show>
                  </div>
                </div>
              )}
            </For>

            <div class={styles.createRow}>
              <input
                class={styles.createInput}
                placeholder="New playlist name…"
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button
                type="button"
                class={styles.addBtn}
                onClick={handleCreate}
                disabled={!newName().trim()}
              >
                Add
              </button>
            </div>
          </section>

          <Show when={selectedId()}>
            <KaraokePlaylistEditor playlistId={selectedId()!} />
          </Show>
        </Show>
      </div>

      <ConfirmDialog
        open={pendingDelete() !== null}
        title="Delete Playlist"
        message={
          <>
            Delete <strong>{pendingDelete()?.name}</strong>? This only removes
            the playlist — your songs and recordings stay in the library.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </aside>
  )
}
