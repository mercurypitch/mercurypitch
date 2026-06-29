// ============================================================
// KaraokePlaylistGallery — collapsible cards of saved playlists
// shown above the session list in the Karaoke upload view.
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { KaraokePlaylistRecord } from '@/db'
import { exportKaraokePlaylists } from '@/db/services/session-export-service'
import { createPersistedSignal } from '@/lib/storage'
import { getGroupsReactive } from '@/stores/app-store'
import { createPlaylist, deletePlaylist, getPlaylistsReactive, renamePlaylist, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { showNotification } from '@/stores/notifications-store'
import { ConfirmDialog } from './ConfirmDialog'
import { CheckSmall, ChevronDown, ChevronUp, Download, Pencil, Play, Playlist, Plus, SlidersHorizontal, Trash2, X, } from './icons'
import { KaraokePlaylistEditor } from './KaraokePlaylistEditor'
import styles from './KaraokePlaylistGallery.module.css'

export const KaraokePlaylistGallery: Component = () => {
  const playlists = () => getPlaylistsReactive()
  const [open, setOpen] = createPersistedSignal(
    'uvr-playlist-gallery-open',
    true,
  )
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')
  const [exportingId, setExportingId] = createSignal<string | null>(null)
  // Which card has the full editor expanded below it.
  const [expandedId, setExpandedId] = createSignal<string | null>(null)
  // Playlist queued for deletion (drives the confirm modal).
  const [pendingDelete, setPendingDelete] =
    createSignal<KaraokePlaylistRecord | null>(null)

  const confirmDelete = () => {
    const pl = pendingDelete()
    if (pl) void deletePlaylist(pl.id)
    setPendingDelete(null)
  }

  const handleExport = (id: string) => {
    if (exportingId() !== null) return
    setExportingId(id)
    void exportKaraokePlaylists([id])
      .then(() => showNotification('Karaoke playlist exported', 'success'))
      .catch(() => showNotification('Export failed', 'error'))
      .finally(() => setExportingId(null))
  }

  const groupSize = (gid: string) =>
    getGroupsReactive().find((g) => g.id === gid)?.sessionIds.length ?? 0

  // Total playable songs (groups expand to their members).
  const songCount = (pl: KaraokePlaylistRecord) =>
    pl.items.reduce(
      (n, it) => n + (it.kind === 'group' ? groupSize(it.refId) : 1),
      0,
    )

  const singerNames = (pl: KaraokePlaylistRecord) => {
    const names = new Set<string>()
    for (const it of pl.items) {
      const n = it.singerName?.trim()
      if (n !== undefined && n !== '') names.add(n)
    }
    return [...names]
  }

  const handleRename = (id: string) => {
    const name = editName().trim()
    if (name !== '') void renamePlaylist(id, name)
    setEditingId(null)
  }

  const handleCreate = () => {
    void createPlaylist('New Playlist').then((pl) => {
      // Drop straight into inline rename so the user names it immediately.
      setEditingId(pl.id)
      setEditName(pl.name)
    })
  }

  const hasPlaylists = createMemo(() => playlists().length > 0)

  return (
    <div class={styles.gallery}>
      <button class={styles.sectionHeader} onClick={() => setOpen(!open())}>
        <span class={styles.sectionTitle}>
          Karaoke Playlists
          <span class={styles.badge}>{playlists().length}</span>
        </span>
        <Show when={open()} fallback={<ChevronDown size={18} />}>
          <ChevronUp />
        </Show>
      </button>

      <Show when={open()}>
        <Show
          when={hasPlaylists()}
          fallback={
            <div class="empty-state empty-state-compact">
              <span class="empty-icon">
                <Playlist />
              </span>
              <h3>No playlists yet</h3>
              <p>Create a playlist to line up songs for a karaoke set.</p>
              <button class="primary-btn" onClick={handleCreate}>
                <Plus /> Create playlist
              </button>
            </div>
          }
        >
          <div class={styles.cards}>
            <For each={playlists()}>
              {(pl) => (
                <div class={styles.cardWrap}>
                  <div
                    class={styles.card}
                    classList={{
                      [styles.cardExpanded]: expandedId() === pl.id,
                    }}
                  >
                    <div class={styles.cardMain}>
                      <Show
                        when={editingId() === pl.id}
                        fallback={
                          <div class={styles.cardName} title={pl.name}>
                            {pl.name}
                          </div>
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
                      <div class={styles.cardMeta}>
                        <span>
                          {songCount(pl)}{' '}
                          {songCount(pl) === 1 ? 'song' : 'songs'}
                        </span>
                        <Show when={singerNames(pl).length > 0}>
                          <span class={styles.metaDot}>·</span>
                          <span
                            class={styles.singers}
                            title={singerNames(pl).join(', ')}
                          >
                            {singerNames(pl).join(', ')}
                          </span>
                        </Show>
                      </div>
                    </div>

                    <div class={styles.cardActions}>
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
                              title="Export this playlist + its songs (singers, groups) to a ZIP"
                              disabled={
                                pl.items.length === 0 || exportingId() !== null
                              }
                              onClick={() => handleExport(pl.id)}
                            >
                              <Download />
                            </button>
                            <button
                              class={styles.iconBtn}
                              classList={{
                                [styles.iconBtnActive]: expandedId() === pl.id,
                              }}
                              title="Edit songs & groups"
                              onClick={() =>
                                setExpandedId(
                                  expandedId() === pl.id ? null : pl.id,
                                )
                              }
                            >
                              <SlidersHorizontal />
                            </button>
                            <button
                              class={styles.iconBtn}
                              title="Rename"
                              onClick={() => {
                                setEditingId(pl.id)
                                setEditName(pl.name)
                              }}
                            >
                              <Pencil size={14} />
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
                          <CheckSmall size={16} />
                        </button>
                        <button
                          class={styles.iconBtn}
                          title="Cancel"
                          onClick={() => setEditingId(null)}
                        >
                          <X />
                        </button>
                      </Show>
                    </div>
                  </div>

                  <Show when={expandedId() === pl.id}>
                    <div class={styles.editorWrap}>
                      <KaraokePlaylistEditor playlistId={pl.id} />
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

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
