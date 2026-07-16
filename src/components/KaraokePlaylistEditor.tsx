// ============================================================
// KaraokePlaylistEditor — edit one playlist (items, singers, add controls)
// ============================================================
//
// Extracted from KaraokePlaylistSidebar so the same editor can be reused both
// in the Stem Mixer left sidebar and inline in the Karaoke upload-view gallery.

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { KaraokePlaylistItem, KaraokePlaylistRecord } from '@/db'
import { createPersistedSignal } from '@/lib/storage'
import { addItem, getPlaylistsReactive, removeItem, reorderItems, setItemShuffleWithinGroup, setItemSinger, setPlaylistPlayMode, setPlaylistShuffleOrder, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { addSessionToGroup, getAllUvrSessionsReactive, getGroupsReactive, removeSessionFromGroup, } from '@/stores/uvr-store'
import { CheckSmall, ChevronDown, ChevronUp, Play, X } from './icons'
import styles from './KaraokePlaylistSidebar.module.css'

interface KaraokePlaylistEditorProps {
  playlistId: string
}

export const KaraokePlaylistEditor: Component<KaraokePlaylistEditorProps> = (
  props,
) => {
  const groups = () => getGroupsReactive()
  const sessions = () => getAllUvrSessionsReactive()
  const playlist = () =>
    getPlaylistsReactive().find((p) => p.id === props.playlistId)

  // 'pills' (click-to-toggle badges) or 'list' (dropdowns). Persisted.
  const [addView, setAddView] = createPersistedSignal<'pills' | 'list'>(
    'km-add-view',
    'pills',
  )
  const [groupSelectVal, setGroupSelectVal] = createSignal('')
  const [songSelectVal, setSongSelectVal] = createSignal('')
  const [compactItems, setCompactItems] = createPersistedSignal(
    'km-compact-items',
    false,
  )
  const [addOpen, setAddOpen] = createPersistedSignal('km-add-open', true)
  // When set, clicking a song pill adds/removes that song to/from this group
  // (a group already in the playlist) instead of adding it as a standalone item.
  const [targetGroupId, setTargetGroupId] = createSignal<string | null>(null)

  const sessionTitle = (sid: string) =>
    sessions().find((s) => s.sessionId === sid)?.originalFile?.name ?? 'Unknown'
  const groupInfo = (gid: string) => groups().find((g) => g.id === gid)

  const itemLabel = (item: KaraokePlaylistItem): string => {
    if (item.kind === 'session') return sessionTitle(item.refId)
    const g = groupInfo(item.refId)
    return g ? `${g.name} (${g.sessionIds.length})` : 'Unknown group'
  }

  const handleAddGroup = (gid: string) => {
    if (gid === '') return
    void addItem(props.playlistId, {
      kind: 'group',
      refId: gid,
      singerName: groupInfo(gid)?.name,
    })
  }
  const handleAddSession = (sid: string) => {
    if (sid === '') return
    void addItem(props.playlistId, { kind: 'session', refId: sid })
  }

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

  // Groups currently in the playlist (valid "add songs into" targets).
  const playlistGroups = (pl: KaraokePlaylistRecord) =>
    pl.items
      .filter((it) => it.kind === 'group')
      .map((it) => groupInfo(it.refId))
      .filter((g): g is NonNullable<typeof g> => g !== undefined)

  const sessionInGroup = (gid: string, sid: string) =>
    groupInfo(gid)?.sessionIds.includes(sid) ?? false

  const toggleSessionInGroup = (gid: string, sid: string) => {
    if (sessionInGroup(gid, sid)) removeSessionFromGroup(sid)
    else void addSessionToGroup(sid, gid)
  }

  // Resolve the active song-target, ignoring a stale group no longer present.
  const effectiveTarget = (pl: KaraokePlaylistRecord): string | null => {
    const tg = targetGroupId()
    if (tg === null) return null
    return pl.items.some((it) => it.kind === 'group' && it.refId === tg)
      ? tg
      : null
  }
  const songPillActive = (pl: KaraokePlaylistRecord, sid: string) => {
    const tg = effectiveTarget(pl)
    return tg !== null
      ? sessionInGroup(tg, sid)
      : sessionItem(pl, sid) !== undefined
  }
  const onSongPillClick = (pl: KaraokePlaylistRecord, sid: string) => {
    const tg = effectiveTarget(pl)
    if (tg !== null) toggleSessionInGroup(tg, sid)
    else toggleSession(pl, sid)
  }

  return (
    <Show when={playlist()}>
      {(pl) => (
        <div class={styles.section}>
          <label class={styles.shuffleRow}>
            <input
              type="checkbox"
              checked={pl().playMode === 'roundRobin'}
              onChange={(e) =>
                void setPlaylistPlayMode(
                  pl().id,
                  e.currentTarget.checked ? 'roundRobin' : 'sequential',
                )
              }
            />
            Round-robin turns
            <span class={styles.shuffleHint}>(one song per group/turn)</span>
          </label>
          <label class={styles.shuffleRow}>
            <input
              type="checkbox"
              checked={pl().shuffleOrder ?? false}
              onChange={(e) =>
                void setPlaylistShuffleOrder(pl().id, e.currentTarget.checked)
              }
            />
            {pl().playMode === 'roundRobin'
              ? 'Shuffle turn order each round'
              : 'Shuffle song order'}
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
                  classList={{
                    [styles.itemRowCompact]: compactItems(),
                    [styles.itemRowTarget]:
                      item.kind === 'group' && targetGroupId() === item.refId,
                  }}
                >
                  <Show when={!compactItems()}>
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
                  </Show>

                  <div class={styles.itemMain}>
                    <Show
                      when={item.kind === 'group'}
                      fallback={
                        <div class={styles.itemLabel}>
                          <span class={styles.itemKind}>SONG</span>
                          {itemLabel(item)}
                        </div>
                      }
                    >
                      <button
                        class={styles.itemLabelBtn}
                        classList={{
                          [styles.itemLabelBtnActive]:
                            targetGroupId() === item.refId,
                        }}
                        title={
                          targetGroupId() === item.refId
                            ? 'Selected — clicking a song below adds it here. Click to deselect.'
                            : 'Select this group, then click songs below to add them into it'
                        }
                        onClick={() =>
                          setTargetGroupId(
                            targetGroupId() === item.refId ? null : item.refId,
                          )
                        }
                      >
                        <span class={`${styles.itemKind} ${styles.kindGroup}`}>
                          GROUP
                        </span>
                        {itemLabel(item)}
                      </button>
                    </Show>
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
                  fallback={<p class={styles.empty}>No songs available yet.</p>}
                >
                  <div class={styles.pillSection}>
                    <div class={styles.pillSectionHead}>
                      <span class={styles.pillSectionLabel}>Songs</span>
                      <Show
                        when={effectiveTarget(pl()) !== null}
                        fallback={
                          <Show when={playlistGroups(pl()).length > 0}>
                            <span class={styles.targetHint}>
                              tip: click a group above to add songs into it
                            </span>
                          </Show>
                        }
                      >
                        <span class={styles.targetHintActive}>
                          adding into: {groupInfo(effectiveTarget(pl())!)?.name}
                        </span>
                      </Show>
                    </div>
                    <div class={styles.pills}>
                      <For each={sessions()}>
                        {(s) => (
                          <button
                            class={styles.pill}
                            classList={{
                              [styles.pillActive]: songPillActive(
                                pl(),
                                s.sessionId,
                              ),
                            }}
                            title={s.originalFile?.name ?? 'Unknown'}
                            onClick={() => onSongPillClick(pl(), s.sessionId)}
                          >
                            <Show when={songPillActive(pl(), s.sessionId)}>
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
  )
}
