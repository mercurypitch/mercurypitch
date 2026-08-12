// Songs in the rail — the Karaoke library's groups AND the songs inside
// the selected one, lifted out of the panel body so the session list
// keeps its vertical space (docs/plans/sidebar-per-tab.md §4).
//
// The pills are the existing SessionGroupTabs, so creating, renaming and
// deleting a group all still work from here. What is new is the list
// underneath: picking a group used to only filter the panel behind you,
// which on a rail reads as "groups, and then nothing". Now the group's
// songs are right there, and one click opens a song on the stage.
//
// Opening goes through the hash route rather than a callback, because
// UvrPanel already owns that path: /karaoke/session/:id/mixer hydrates
// the stems and switches the view. The rail does not need to know how.
//
// Default export: the registry loads this panel lazily so the karaoke
// stack stays out of the shell chunk.

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { Play } from '@/components/icons'
import { SessionGroupTabs } from '@/components/SessionGroupTabs'
import { groupLibrarySongs } from '@/features/karaoke-night/library-grouping'
import { navigateTo } from '@/lib/hash-router'
import { extractTitle } from '@/lib/lyrics-service'
import { setSidebarOpen } from '@/stores/ui-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive, getGroupsReactive, karaokeActiveGroupId, setKaraokeActiveGroupId, } from '@/stores/uvr-store'
import styles from './KaraokeRail.module.css'

/** Only a finished separation has stems to sing over. */
const isPlayable = (session: UvrSession): boolean =>
  session.status === 'completed'

const songTitle = (session: UvrSession): string =>
  extractTitle(session.originalFile?.name ?? 'Untitled')

const KaraokeGroupsPanel: Component = () => {
  /** Newest first, the order the panel's own session list uses. */
  const byNewest = createMemo<UvrSession[]>(() =>
    [...getAllUvrSessionsReactive()].sort((a, b) => b.createdAt - a.createdAt),
  )

  /**
   * The songs of the selected group, or every song when the selection is
   * "All". Membership comes from `groupLibrarySongs` — the same pure
   * resolver Karaoke Night's library rail uses — so a song assigned one
   * way (curated order) and a song assigned the other (`groupId` drift)
   * both show up here, in the order they would actually be sung.
   */
  const songs = createMemo<UvrSession[]>(() => {
    const groupId = karaokeActiveGroupId()
    if (groupId === null) return byNewest()
    const grouped = groupLibrarySongs(byNewest(), getGroupsReactive())
    return grouped.groups.find((g) => g.id === groupId)?.songs ?? []
  })

  const groupName = (): string | null => {
    const id = karaokeActiveGroupId()
    if (id === null) return null
    return getGroupsReactive().find((g) => g.id === id)?.name ?? null
  }

  const openSong = (sessionId: string): void => {
    navigateTo({ type: 'uvr-session-mixer', sessionId })
    // On a phone the rail IS the drawer, and it covers the stage the song
    // just opened on. Harmless on a desktop, where the class does nothing.
    setSidebarOpen(false)
  }

  return (
    <CollapsibleSection title="Songs" storageKey="sidebar-karaoke-groups-open">
      <div class={styles.groupsWrap} data-tour="karaoke.rail-groups">
        <SessionGroupTabs
          activeGroupId={karaokeActiveGroupId()}
          onSelectGroup={setKaraokeActiveGroupId}
        />
      </div>

      <Show
        when={songs().length > 0}
        fallback={
          <p class={styles.songsEmpty}>
            <Show
              when={groupName()}
              fallback="No songs yet — upload one to get started."
            >
              {(name) => <>Nothing in {name()} yet.</>}
            </Show>
          </p>
        }
      >
        <div class={styles.songList} data-tour="karaoke.rail-songs">
          <For each={songs()}>
            {(session) => (
              <button
                type="button"
                class={styles.songRow}
                disabled={!isPlayable(session)}
                title={
                  isPlayable(session)
                    ? `Open "${songTitle(session)}" on the stage`
                    : `${songTitle(session)} — ${session.status}, not ready to sing yet`
                }
                onClick={() => openSong(session.sessionId)}
              >
                <Show
                  when={isPlayable(session)}
                  fallback={
                    <span class={styles.songState}>{session.status}</span>
                  }
                >
                  {/* Always drawn, not hover-only: a phone has no hover and
                      a TV has no pointer, so an affordance that only appears
                      on hover is no affordance on two of three surfaces. */}
                  <span class={styles.songPlay} aria-hidden="true">
                    <Play />
                  </span>
                </Show>
                <span class={styles.songName}>{songTitle(session)}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </CollapsibleSection>
  )
}

export default KaraokeGroupsPanel
