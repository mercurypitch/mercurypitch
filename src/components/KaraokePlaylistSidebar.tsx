// ============================================================
// KaraokePlaylistSidebar — playlist list + editor (Stem Mixer left sidebar)
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { KaraokePlaylistRecord } from '@/db'
import { createPlaylist, deletePlaylist, getPlaylistsReactive, renamePlaylist, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { ConfirmDialog } from './ConfirmDialog'
import { CheckSmall, Mic, Pencil, Play, Trash2, X } from './icons'
import { KaraokePlaylistEditor } from './KaraokePlaylistEditor'
import styles from './KaraokePlaylistSidebar.module.css'

interface KaraokePlaylistSidebarProps {
  onClose: () => void
}

export const KaraokePlaylistSidebar: Component<KaraokePlaylistSidebarProps> = (
  props,
) => {
  const playlists = () => getPlaylistsReactive()
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

  return (
    <div class={styles.sidebar}>
      <div class={styles.header}>
        <h3 class={styles.title}>
          <Mic />
          Karaoke Playlists
        </h3>
        <button
          class={styles.iconBtn}
          title="Close"
          onClick={() => props.onClose()}
        >
          <X />
        </button>
      </div>

      <div class={styles.body}>
        {/* ── Playlist list ─────────────────────────────── */}
        <div class={styles.section}>
          <For
            each={playlists()}
            fallback={<p class={styles.empty}>No playlists yet.</p>}
          >
            {(pl) => (
              <div
                class={styles.playlistRow}
                classList={{ [styles.playlistActive]: pl.id === selectedId() }}
              >
                <Show
                  when={editingId() === pl.id}
                  fallback={
                    <button
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
                          class={`${styles.iconBtn} ${styles.playBtn}`}
                          title="Start this playlist"
                          disabled={pl.items.length === 0}
                          onClick={() => startPlaylist(pl.id)}
                        >
                          <Play />
                        </button>
                        <button
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
              class={styles.addBtn}
              onClick={handleCreate}
              disabled={!newName().trim()}
            >
              Add
            </button>
          </div>
        </div>

        {/* ── Selected playlist editor ──────────────────── */}
        <Show when={selectedId()}>
          <KaraokePlaylistEditor playlistId={selectedId()!} />
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
    </div>
  )
}
