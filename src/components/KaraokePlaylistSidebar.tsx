// ============================================================
// KaraokePlaylistSidebar — build, edit & start karaoke playlists
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { KaraokePlaylistItem } from '@/db'
import { getAllUvrSessionsReactive, getGroupsReactive, } from '@/stores/app-store'
import { addItem, createPlaylist, deletePlaylist, getPlaylistsReactive, removeItem, renamePlaylist, reorderItems, setItemShuffleWithinGroup, setItemSinger, setPlaylistShuffleOrder, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { CheckSmall, ChevronDown, ChevronUp, Pencil, Play, Trash2, X, } from './icons'
import styles from './KaraokePlaylistSidebar.module.css'

interface KaraokePlaylistSidebarProps {
  onClose: () => void
}

export const KaraokePlaylistSidebar: Component<KaraokePlaylistSidebarProps> = (
  props,
) => {
  const playlists = () => getPlaylistsReactive()
  const groups = () => getGroupsReactive()
  const sessions = () => getAllUvrSessionsReactive()

  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [newName, setNewName] = createSignal('')
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')

  const selected = createMemo(() =>
    playlists().find((p) => p.id === selectedId()),
  )

  // Resolve a display label for a playlist item.
  const sessionTitle = (sid: string) =>
    sessions().find((s) => s.sessionId === sid)?.originalFile?.name ?? 'Unknown'
  const groupInfo = (gid: string) => groups().find((g) => g.id === gid)

  const itemLabel = (item: KaraokePlaylistItem): string => {
    if (item.kind === 'session') return sessionTitle(item.refId)
    const g = groupInfo(item.refId)
    return g ? `${g.name} (${g.sessionIds.length})` : 'Unknown group'
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

  const handleAddGroup = (gid: string) => {
    const id = selectedId()
    if (id === null || gid === '') return
    void addItem(id, { kind: 'group', refId: gid })
  }

  const handleAddSession = (sid: string) => {
    const id = selectedId()
    if (id === null || sid === '') return
    void addItem(id, { kind: 'session', refId: sid })
  }

  return (
    <div class={styles.sidebar}>
      <div class={styles.header}>
        <h3 class={styles.title}>🎤 Karaoke Playlists</h3>
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
                          onClick={() => void deletePlaylist(pl.id)}
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
        <Show when={selected()}>
          {(pl) => (
            <div class={styles.section}>
              <label class={styles.shuffleRow}>
                <input
                  type="checkbox"
                  checked={pl().shuffleOrder ?? false}
                  onChange={(e) =>
                    void setPlaylistShuffleOrder(
                      pl().id,
                      e.currentTarget.checked,
                    )
                  }
                />
                Shuffle song order
              </label>

              {/* Items */}
              <For
                each={pl().items}
                fallback={
                  <p class={styles.empty}>
                    Add groups or songs below to build this playlist.
                  </p>
                }
              >
                {(item, i) => (
                  <div class={styles.itemRow}>
                    <div class={styles.itemReorder}>
                      <button
                        class={styles.iconBtn}
                        title="Move up"
                        disabled={i() === 0}
                        onClick={() => void reorderItems(pl().id, i(), i() - 1)}
                      >
                        <ChevronUp />
                      </button>
                      <button
                        class={styles.iconBtn}
                        title="Move down"
                        disabled={i() === pl().items.length - 1}
                        onClick={() => void reorderItems(pl().id, i(), i() + 1)}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    <div class={styles.itemMain}>
                      <div class={styles.itemLabel}>
                        <span
                          class={styles.itemKind}
                          classList={{
                            [styles.kindGroup]: item.kind === 'group',
                          }}
                        >
                          {item.kind === 'group' ? 'GROUP' : 'SONG'}
                        </span>
                        {itemLabel(item)}
                      </div>
                      <input
                        class={styles.singerInput}
                        placeholder={
                          item.kind === 'group'
                            ? 'Singer for whole group…'
                            : 'Singer…'
                        }
                        value={item.singerName ?? ''}
                        onChange={(e) =>
                          void setItemSinger(
                            pl().id,
                            item.id,
                            e.currentTarget.value,
                          )
                        }
                      />
                      <Show when={item.kind === 'group'}>
                        <label class={styles.shuffleWithin}>
                          <input
                            type="checkbox"
                            checked={item.shuffleWithinGroup ?? false}
                            onChange={(e) =>
                              void setItemShuffleWithinGroup(
                                pl().id,
                                item.id,
                                e.currentTarget.checked,
                              )
                            }
                          />
                          Shuffle within group
                        </label>
                      </Show>
                    </div>

                    <button
                      class={styles.iconBtn}
                      title="Remove"
                      onClick={() => void removeItem(pl().id, item.id)}
                    >
                      <X />
                    </button>
                  </div>
                )}
              </For>

              {/* Add controls */}
              <div class={styles.addControls}>
                <Show when={groups().length > 0}>
                  <select
                    class={styles.select}
                    value=""
                    onChange={(e) => {
                      handleAddGroup(e.currentTarget.value)
                      e.currentTarget.value = ''
                    }}
                  >
                    <option value="" disabled>
                      + Add group…
                    </option>
                    <For each={groups()}>
                      {(g) => (
                        <option value={g.id}>
                          {g.name} ({g.sessionIds.length})
                        </option>
                      )}
                    </For>
                  </select>
                </Show>

                <select
                  class={styles.select}
                  value=""
                  onChange={(e) => {
                    handleAddSession(e.currentTarget.value)
                    e.currentTarget.value = ''
                  }}
                >
                  <option value="" disabled>
                    + Add song…
                  </option>
                  <For each={sessions()}>
                    {(s) => (
                      <option value={s.sessionId}>
                        {s.originalFile?.name ?? 'Unknown'}
                      </option>
                    )}
                  </For>
                </select>
              </div>

              <button
                class={styles.startBtn}
                disabled={pl().items.length === 0}
                onClick={() => startPlaylist(pl().id)}
              >
                <Play /> Start playlist
              </button>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
