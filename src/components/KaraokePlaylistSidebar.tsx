// ============================================================
// KaraokePlaylistSidebar — build, edit & start karaoke playlists
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { KaraokePlaylistItem, KaraokePlaylistRecord } from '@/db'
import { createPersistedSignal } from '@/lib/storage'
import { getAllUvrSessionsReactive, getGroupsReactive, } from '@/stores/app-store'
import { addItem, createPlaylist, deletePlaylist, getPlaylistsReactive, removeItem, renamePlaylist, reorderItems, setItemShuffleWithinGroup, setItemSinger, setPlaylistShuffleOrder, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { CheckSmall, ChevronDown, ChevronUp, Mic, Pencil, Play, Trash2, X, } from './icons'
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
  // 'pills' (click-to-toggle badges) or 'list' (dropdowns). Persisted.
  const [addView, setAddView] = createPersistedSignal<'pills' | 'list'>(
    'km-add-view',
    'pills',
  )
  // Controlled dropdown values so they always reset to the placeholder and a
  // single/only option can still be picked (selecting fires change every time).
  const [groupSelectVal, setGroupSelectVal] = createSignal('')
  const [songSelectVal, setSongSelectVal] = createSignal('')
  // Compact items view (hide per-item reorder/shuffle) + collapsible add list,
  // so the editor stays short enough to reach the add controls. Persisted.
  const [compactItems, setCompactItems] = createPersistedSignal(
    'km-compact-items',
    false,
  )
  const [addOpen, setAddOpen] = createPersistedSignal('km-add-open', true)

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
    // Default the singer to the group's name (a group is usually one person's
    // set); the user can override it afterwards.
    void addItem(id, {
      kind: 'group',
      refId: gid,
      singerName: groupInfo(gid)?.name,
    })
  }

  const handleAddSession = (sid: string) => {
    const id = selectedId()
    if (id === null || sid === '') return
    void addItem(id, { kind: 'session', refId: sid })
  }

  // Pill view: click to add, click again to remove.
  const groupItem = (pl: KaraokePlaylistRecord, gid: string) =>
    pl.items.find((it) => it.kind === 'group' && it.refId === gid)
  const sessionItem = (pl: KaraokePlaylistRecord, sid: string) =>
    pl.items.find((it) => it.kind === 'session' && it.refId === sid)

  const toggleGroup = (pl: KaraokePlaylistRecord, gid: string) => {
    const existing = groupItem(pl, gid)
    if (existing) void removeItem(pl.id, existing.id)
    else
      void addItem(pl.id, {
        kind: 'group',
        refId: gid,
        singerName: groupInfo(gid)?.name,
      })
  }
  const toggleSession = (pl: KaraokePlaylistRecord, sid: string) => {
    const existing = sessionItem(pl, sid)
    if (existing) void removeItem(pl.id, existing.id)
    else void addItem(pl.id, { kind: 'session', refId: sid })
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
              <Show when={pl().items.length > 0}>
                <div class={styles.itemsHeader}>
                  <span class={styles.itemsHeaderLabel}>
                    In playlist ({pl().items.length})
                  </span>
                  <button
                    class={styles.viewToggle}
                    title={
                      compactItems()
                        ? 'Show reorder & shuffle controls'
                        : 'Compact list (hide reorder)'
                    }
                    onClick={() => setCompactItems(!compactItems())}
                  >
                    {compactItems() ? 'Detailed' : 'Compact'}
                  </button>
                </div>
              </Show>
              <div class={styles.itemsList}>
                <For
                  each={pl().items}
                  fallback={
                    <p class={styles.empty}>
                      Add groups or songs below to build this playlist.
                    </p>
                  }
                >
                  {(item, i) => (
                    <div
                      class={styles.itemRow}
                      classList={{ [styles.itemRowCompact]: compactItems() }}
                    >
                      <Show when={!compactItems()}>
                        <div class={styles.itemReorder}>
                          <button
                            class={styles.iconBtn}
                            title="Move up"
                            disabled={i() === 0}
                            onClick={() =>
                              void reorderItems(pl().id, i(), i() - 1)
                            }
                          >
                            <ChevronUp />
                          </button>
                          <button
                            class={styles.iconBtn}
                            title="Move down"
                            disabled={i() === pl().items.length - 1}
                            onClick={() =>
                              void reorderItems(pl().id, i(), i() + 1)
                            }
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </Show>

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
                        <Show when={item.kind === 'group' && !compactItems()}>
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
              </div>

              {/* Add controls */}
              <div class={styles.addControls}>
                <div class={styles.addHeader}>
                  <button
                    class={styles.addHeaderTitle}
                    onClick={() => setAddOpen(!addOpen())}
                  >
                    <Show when={addOpen()} fallback={<ChevronDown size={16} />}>
                      <ChevronUp />
                    </Show>
                    Add songs & groups
                  </button>
                  <Show when={addOpen()}>
                    <button
                      class={styles.viewToggle}
                      title={
                        addView() === 'pills'
                          ? 'Switch to dropdown view'
                          : 'Switch to pill view'
                      }
                      onClick={() =>
                        setAddView(addView() === 'pills' ? 'list' : 'pills')
                      }
                    >
                      {addView() === 'pills' ? 'Dropdowns' : 'Pills'}
                    </button>
                  </Show>
                </div>

                <Show when={addOpen()}>
                  <Show
                    when={addView() === 'pills'}
                    fallback={
                      <>
                        <Show when={groups().length > 0}>
                          <select
                            class={styles.select}
                            value={groupSelectVal()}
                            onChange={(e) => {
                              handleAddGroup(e.currentTarget.value)
                              setGroupSelectVal('')
                            }}
                          >
                            <option value="">+ Add group…</option>
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
                          value={songSelectVal()}
                          onChange={(e) => {
                            handleAddSession(e.currentTarget.value)
                            setSongSelectVal('')
                          }}
                        >
                          <option value="">+ Add song…</option>
                          <For each={sessions()}>
                            {(s) => (
                              <option value={s.sessionId}>
                                {s.originalFile?.name ?? 'Unknown'}
                              </option>
                            )}
                          </For>
                        </select>
                      </>
                    }
                  >
                    {/* Pill view — click to add, click again to remove */}
                    <Show when={groups().length > 0}>
                      <div class={styles.pillSection}>
                        <span class={styles.pillSectionLabel}>Groups</span>
                        <div class={styles.pills}>
                          <For each={groups()}>
                            {(g) => (
                              <button
                                class={styles.pill}
                                classList={{
                                  [styles.pillActive]:
                                    groupItem(pl(), g.id) !== undefined,
                                }}
                                title={`${g.name} (${g.sessionIds.length})`}
                                onClick={() => toggleGroup(pl(), g.id)}
                              >
                                <Show when={groupItem(pl(), g.id)}>
                                  <CheckSmall size={13} />
                                </Show>
                                {g.name}
                                <span class={styles.pillCount}>
                                  {g.sessionIds.length}
                                </span>
                              </button>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    <Show
                      when={sessions().length > 0}
                      fallback={
                        <p class={styles.empty}>No songs available yet.</p>
                      }
                    >
                      <div class={styles.pillSection}>
                        <span class={styles.pillSectionLabel}>Songs</span>
                        <div class={styles.pills}>
                          <For each={sessions()}>
                            {(s) => (
                              <button
                                class={styles.pill}
                                classList={{
                                  [styles.pillActive]:
                                    sessionItem(pl(), s.sessionId) !==
                                    undefined,
                                }}
                                title={s.originalFile?.name ?? 'Unknown'}
                                onClick={() => toggleSession(pl(), s.sessionId)}
                              >
                                <Show when={sessionItem(pl(), s.sessionId)}>
                                  <CheckSmall size={13} />
                                </Show>
                                {s.originalFile?.name ?? 'Unknown'}
                              </button>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </Show>
                </Show>
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
