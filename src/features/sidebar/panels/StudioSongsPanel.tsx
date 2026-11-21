// Studio songs in the rail — every song on this device, one tap from opening, with its length, lanes and last edit, under a New song button.
// The list, the switch and New song are the Studio page's, lent through
// studio-songs-store: a row asks the page to open its song, New song asks
// it to make one, and the page decides through the same checks its own
// song list makes. New song sits above the list, outside its scroll, so a
// long library never pushes it out of view. The rail never
// reads a song or its audio itself. Nothing renders while no Studio page is
// mounted, or while there are no songs: the page's own empty state, with
// its Create project button, is right beside the rail and says it better.
//
// Default export: loaded lazily by the registry so Studio's rail stays out
// of the shell chunk.

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { Plus } from '@/components/icons'
import type { StudioProjectSummary } from '@/lib/studio/model/types'
import { isPhoneStage } from '@/lib/use-viewport'
import type { StudioSongsLoan } from '@/stores/studio-songs-store'
import { studioSongs } from '@/stores/studio-songs-store'
import { setSidebarOpen, sidebarOpen } from '@/stores/ui-store'
import { songDuration, songEdited, songLanes } from './studio-song-meta'
import styles from './StudioRail.module.css'

/** Five level bars that jump to a new reading when the row is pointed at. */
const SongGlyph: Component = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect x="2.8" y="9" width="2.4" height="6" rx="1.2" />
    <rect x="7.3" y="6" width="2.4" height="12" rx="1.2" />
    <rect x="11.8" y="10.5" width="2.4" height="3" rx="1.2" />
    <rect x="16.3" y="8.5" width="2.4" height="7" rx="1.2" />
    <rect x="20.8" y="7" width="2.4" height="10" rx="1.2" />
  </svg>
)

const SongRow: Component<{
  song: StudioProjectSummary
  loan: StudioSongsLoan
  onOpen: (id: string) => void
}> = (props) => {
  const isOpen = () => props.song.id === props.loan.openId()
  // A held switch waits on every other song; the open one only comes
  // forward, which nothing holds. aria-disabled rather than disabled, so a
  // row pressed with Enter keeps the focus when the hold arrives.
  const held = () =>
    !isOpen() && (props.loan.hold() !== null || props.loan.opening())
  const edited = () => songEdited(props.song.updatedAt)
  const length = () =>
    props.song.clipCount > 0 ? songDuration(props.song.durationFrames) : 'Empty'
  const label = () =>
    [
      props.song.title,
      props.song.clipCount > 0 ? length() : 'empty',
      songLanes(props.song.trackCount),
      edited()?.long.toLowerCase(),
    ]
      .filter(Boolean)
      .join(', ')
  return (
    <li>
      <button
        type="button"
        class={styles.row}
        aria-label={label()}
        aria-current={isOpen() ? 'true' : undefined}
        aria-disabled={held() ? 'true' : undefined}
        title={props.song.title}
        onClick={() => {
          if (!held()) props.onOpen(props.song.id)
        }}
      >
        <span class={styles.glyph}>
          <SongGlyph />
        </span>
        <span class={styles.body}>
          <span class={styles.titleLine}>
            <span class={styles.title}>{props.song.title}</span>
            <Show when={edited()}>
              {(when) => <span class={styles.edited}>{when().short}</span>}
            </Show>
          </span>
          <span class={styles.pills}>
            <span class={`${styles.pill} ${styles.pillTime}`}>{length()}</span>
            <span class={styles.pill}>{songLanes(props.song.trackCount)}</span>
            <Show when={isOpen()}>
              <span class={`${styles.pill} ${styles.pillOpen}`}>Open</span>
            </Show>
          </span>
        </span>
      </button>
    </li>
  )
}

/** New song: held by everything that holds a switch, and by a save in flight. */
const NewSongButton: Component<{
  loan: StudioSongsLoan
  onCreate: () => void
}> = (props) => {
  const held = () =>
    props.loan.hold() !== null ||
    props.loan.opening() ||
    !props.loan.canCreate()
  return (
    <button
      type="button"
      class={styles.create}
      aria-disabled={held() ? 'true' : undefined}
      onClick={() => {
        if (!held()) props.onCreate()
      }}
    >
      <span class={styles.createGlyph}>
        <Plus size={16} />
      </span>
      New song
    </button>
  )
}

const StudioSongsPanel: Component = () => {
  /**
   * On a phone the rail is a drawer that slides off-screen, and a closed
   * one would keep every row mounted: a second set of song buttons nobody
   * can see, in the tab order. Same rule as the Jam rail's song list.
   */
  const listOnScreen = (): boolean => !isPhoneStage() || sidebarOpen()

  function open(loan: StudioSongsLoan, id: string): void {
    // On a phone the drawer covers the song: a pick folds it away.
    if (isPhoneStage()) setSidebarOpen(false)
    void loan.open(id)
  }

  function create(loan: StudioSongsLoan): void {
    // The new song opens under the drawer, as a picked one does.
    if (isPhoneStage()) setSidebarOpen(false)
    void loan.create()
  }

  return (
    <Show when={studioSongs()}>
      {(loan) => {
        // Rows are keyed by song id: each save hands the page a fresh list
        // of summaries, and keying by object would rebuild every row,
        // dropping the focus and replaying the hover.
        const byId = createMemo(
          () =>
            new Map(
              loan()
                .songs()
                .map((song) => [song.id, song]),
            ),
        )
        const ids = createMemo(() =>
          loan()
            .songs()
            .map((song) => song.id),
        )
        return (
          <Show when={ids().length > 0}>
            {/* The tour's target holds the whole section, header included,
                so it is there while the section is collapsed; the step's
                reveal opens it. */}
            <div data-tour="studio.rail-songs">
              <CollapsibleSection
                title="Your songs"
                storageKey="sidebar-studio-songs-open"
              >
                <div class={styles.panel}>
                  <Show when={listOnScreen()}>
                    <NewSongButton
                      loan={loan()}
                      onCreate={() => create(loan())}
                    />
                  </Show>
                  {/* Mounted with the section, empty until a hold: a live
                      region that appears with its text is often not read.
                      A song opening waits without a reason, and the page's
                      own work on a new song is not one to read out. */}
                  <p class={styles.hold} role="status">
                    {loan().opening() ? '' : (loan().hold() ?? '')}
                  </p>
                  <Show when={listOnScreen()}>
                    <nav aria-label="Studio songs">
                      <ul class={styles.list}>
                        <For each={ids()}>
                          {(id) => (
                            <Show when={byId().get(id)}>
                              {(song) => (
                                <SongRow
                                  song={song()}
                                  loan={loan()}
                                  onOpen={(picked) => open(loan(), picked)}
                                />
                              )}
                            </Show>
                          )}
                        </For>
                      </ul>
                    </nav>
                  </Show>
                </div>
              </CollapsibleSection>
            </div>
          </Show>
        )
      }}
    </Show>
  )
}

export default StudioSongsPanel
